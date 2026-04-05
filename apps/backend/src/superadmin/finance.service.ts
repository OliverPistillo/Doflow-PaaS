// apps/backend/src/superadmin/finance.service.ts
// MODIFICATO: aggiunto supporto per preset righe fattura (SavedService).
// Nuovi metodi: findAllServices(), createService().
// Nuovo @InjectRepository(SavedService) nel costruttore.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Invoice, InvoiceStatus }   from './entities/invoice.entity';
import { InvoiceClient }             from './entities/invoice-client.entity';
import { SavedService }              from './entities/saved-service.entity';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Invoice)
    private repo: Repository<Invoice>,

    @InjectRepository(InvoiceClient)
    private clientRepo: Repository<InvoiceClient>,

    // NUOVO: repository per i preset di righe fattura
    @InjectRepository(SavedService)
    private serviceRepo: Repository<SavedService>,
  ) {}

  // ── CREAZIONE FATTURA / PREVENTIVO ────────────────────────────────────────

  async create(data: DeepPartial<Invoice>) {
    const isPreventivo = (data as any).docType === 'preventivo';

    if (!isPreventivo && !data.invoiceNumber) {
      const year = new Date().getFullYear();
      const lastInvoice = await this.repo
        .createQueryBuilder('i')
        .where('i.invoiceNumber LIKE :pattern', { pattern: `INV-${year}-%` })
        .andWhere("i.docType != 'preventivo' OR i.docType IS NULL")
        .orderBy('i.createdAt', 'DESC')
        .getOne();

      let nextNum = 1;
      if (lastInvoice?.invoiceNumber) {
        const parts = lastInvoice.invoiceNumber.split('-');
        if (parts.length === 3) nextNum = parseInt(parts[2], 10) + 1;
      }
      data.invoiceNumber = `INV-${year}-${nextNum.toString().padStart(3, '0')}`;
    }

    const invoice = this.repo.create(data);
    return this.repo.save(invoice);
  }

  // ── AGGIORNAMENTO ─────────────────────────────────────────────────────────

  async update(id: string, data: DeepPartial<Invoice>) {
    return this.repo.update(id, data);
  }

  // ── ELIMINAZIONE ──────────────────────────────────────────────────────────

  async delete(id: string) {
    return this.repo.delete(id);
  }

  // ── LETTURA SINGOLA ───────────────────────────────────────────────────────

  async findOne(id: string): Promise<Invoice | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['lineItems'],
    });
  }

  async findOneWithItems(id: string): Promise<Invoice | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['lineItems', 'template'],
    });
  }

  // ── LETTURA TUTTE ─────────────────────────────────────────────────────────

  async findAll(
    search?:       string,
    statusFilter?: string,
    docTypeFilter?: string,
  ) {
    const qb = this.repo.createQueryBuilder('invoice');

    if (search) {
      qb.where(
        '(invoice.clientName ILIKE :search OR invoice.invoiceNumber ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      qb.andWhere('invoice.status = :status', { status: statusFilter });
    }

    if (docTypeFilter && docTypeFilter !== 'all') {
      if (docTypeFilter === 'preventivo') {
        qb.andWhere("invoice.docType = 'preventivo'");
      } else {
        qb.andWhere("(invoice.docType = 'fattura' OR invoice.docType IS NULL)");
      }
    }

    qb.orderBy('invoice.issueDate', 'DESC');
    return qb.getMany();
  }

  // ── DASHBOARD STATS ───────────────────────────────────────────────────────

  async getDashboardStats() {
    const { totalRevenue } = await this.repo
      .createQueryBuilder('i')
      .select('SUM(i.amount)', 'totalRevenue')
      .where('i.status = :status', { status: InvoiceStatus.PAID })
      .andWhere("(i.docType = 'fattura' OR i.docType IS NULL)")
      .getRawOne();

    const { pendingAmount } = await this.repo
      .createQueryBuilder('i')
      .select('SUM(i.amount)', 'pendingAmount')
      .where('i.status = :status', { status: InvoiceStatus.PENDING })
      .andWhere("(i.docType = 'fattura' OR i.docType IS NULL)")
      .getRawOne();

    const overdueCount = await this.repo.count({
      where: { status: InvoiceStatus.OVERDUE },
    });

    const rawTrend = await this.repo.query(`
      SELECT TO_CHAR(issue_date, 'Mon') as month, SUM(amount) as revenue
      FROM public.invoices
      WHERE status = 'paid'
        AND (doc_type = 'fattura' OR doc_type IS NULL)
      GROUP BY month, issue_date
      ORDER BY issue_date ASC
      LIMIT 7
    `);

    const statusDist = await this.repo
      .createQueryBuilder('i')
      .select('i.status', 'name')
      .addSelect('COUNT(i.id)', 'value')
      .where("(i.docType = 'fattura' OR i.docType IS NULL)")
      .groupBy('i.status')
      .getRawMany();

    const topClients = await this.repo
      .createQueryBuilder('i')
      .select('i.clientName', 'name')
      .addSelect('SUM(i.amount)', 'value')
      .where("(i.docType = 'fattura' OR i.docType IS NULL)")
      .groupBy('i.clientName')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    const invoices = await this.repo
      .createQueryBuilder('i')
      .where("(i.docType = 'fattura' OR i.docType IS NULL)")
      .orderBy('i.issueDate', 'DESC')
      .take(500)
      .getMany();

    return {
      kpi: {
        revenue: totalRevenue  || 0,
        pending: pendingAmount || 0,
        overdue: overdueCount  || 0,
      },
      trend: rawTrend,
      statusDistribution: statusDist.map((s) => ({
        name:
          s.name === 'paid'    ? 'Pagate'      :
          s.name === 'pending' ? 'In Scadenza' : 'Non Pagate',
        value: parseInt(s.value, 10),
        color:
          s.name === 'paid'    ? '#10B981' :
          s.name === 'pending' ? '#F59E0B' : '#EF4444',
      })),
      topClients: topClients.map((c) => ({ ...c, value: parseFloat(c.value) })),
      invoices,
    };
  }

  async seed() {
    const count = await this.repo.count();
    if (count > 0) return;
  }

  // ── ANAGRAFICA CLIENTI ────────────────────────────────────────────────────

  async findAllClients(): Promise<InvoiceClient[]> {
    return this.clientRepo.find({ order: { updatedAt: 'DESC' } });
  }

  async upsertClient(
    data: Partial<InvoiceClient>,
  ): Promise<InvoiceClient> {
    const existing = await this.clientRepo.findOne({
      where: { clientName: data.clientName },
    });

    if (existing) {
      const updated = this.clientRepo.merge(existing, {
        ...data,
        invoiceCount: existing.invoiceCount + 1,
      });
      return this.clientRepo.save(updated);
    }

    const newClient = this.clientRepo.create({ ...data, invoiceCount: 1 });
    return this.clientRepo.save(newClient);
  }

  // ── PRESET RIGHE FATTURA (SavedService) ──────────────────────────────────
  // Usati da GET /superadmin/finance/services  → dropdown nel form Nuova Fattura
  //         POST /superadmin/finance/services  → salva una riga come preset

  /**
   * Ritorna tutti i preset ordinati per data di creazione (più recenti prima).
   * Ogni preset ha: id, description, unitPrice, quantity.
   */
  async findAllServices(): Promise<SavedService[]> {
    return this.serviceRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Crea un nuovo preset riga fattura.
   * Deduplicazione leggera: se esiste già un preset con la stessa descrizione
   * (case-insensitive), aggiorna il prezzo unitario invece di duplicare.
   */
  async createService(data: {
    description: string;
    unitPrice:   number;
    quantity:    number;
  }): Promise<SavedService> {
    // Deduplicazione leggera per descrizione identica
    const existing = await this.serviceRepo
      .createQueryBuilder('s')
      .where('LOWER(s.description) = LOWER(:desc)', { desc: data.description.trim() })
      .getOne();

    if (existing) {
      existing.unitPrice = data.unitPrice ?? existing.unitPrice;
      existing.quantity  = data.quantity  ?? existing.quantity;
      return this.serviceRepo.save(existing);
    }

    const preset = this.serviceRepo.create({
      description: data.description.trim(),
      unitPrice:   data.unitPrice ?? 0,
      quantity:    data.quantity  ?? 1,
    });
    return this.serviceRepo.save(preset);
  }
}
