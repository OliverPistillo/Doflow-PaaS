import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceClient } from './entities/invoice-client.entity';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Invoice)
    private repo: Repository<Invoice>,
    @InjectRepository(InvoiceClient)
    private clientRepo: Repository<InvoiceClient>,
  ) {}

  // ── CREAZIONE ─────────────────────────────────────────────────────────────

  async create(data: DeepPartial<Invoice>) {
    // Auto-genera numero fattura SOLO per le fatture di cortesia, non per i preventivi
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

  // ── LETTURA SINGOLA (usata dal controller PDF per routing docType) ─────────

  async findOne(id: string): Promise<Invoice | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['lineItems'],
    });
  }

  // ── LETTURA SINGOLA CON TUTTI I RELATIONS (per generazione PDF) ───────────

  async findOneWithItems(id: string): Promise<Invoice | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['lineItems', 'template'],
    });
  }

  // ── LETTURA TUTTE ─────────────────────────────────────────────────────────

  async findAll(search?: string, statusFilter?: string, docTypeFilter?: string) {
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

    // Filtro tipo documento: preventivo | fattura
    if (docTypeFilter && docTypeFilter !== 'all') {
      if (docTypeFilter === 'preventivo') {
        qb.andWhere("invoice.docType = 'preventivo'");
      } else {
        // "fattura" include sia docType='fattura' che record senza docType (retrocompatibilità)
        qb.andWhere("(invoice.docType = 'fattura' OR invoice.docType IS NULL)");
      }
    }

    qb.orderBy('invoice.issueDate', 'DESC');
    return qb.getMany();
  }

  // ── DASHBOARD STATS ───────────────────────────────────────────────────────

  async getDashboardStats() {
    // KPI — considera solo fatture (non preventivi)
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

    // Trend ultimi 6 mesi (solo fatture)
    const rawTrend = await this.repo.query(`
      SELECT TO_CHAR(issue_date, 'Mon') as month, SUM(amount) as revenue
      FROM public.invoices
      WHERE status = 'paid'
        AND (doc_type = 'fattura' OR doc_type IS NULL)
      GROUP BY month, issue_date
      ORDER BY issue_date ASC
      LIMIT 7
    `);

    // Status Pie (solo fatture)
    const statusDist = await this.repo
      .createQueryBuilder('i')
      .select('i.status', 'name')
      .addSelect('COUNT(i.id)', 'value')
      .where("(i.docType = 'fattura' OR i.docType IS NULL)")
      .groupBy('i.status')
      .getRawMany();

    // Top clienti (solo fatture)
    const topClients = await this.repo
      .createQueryBuilder('i')
      .select('i.clientName', 'name')
      .addSelect('SUM(i.amount)', 'value')
      .where("(i.docType = 'fattura' OR i.docType IS NULL)")
      .groupBy('i.clientName')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    // Lista fatture per export (queryBuilder per evitare errori di tipo su docType)
    const invoices = await this.repo
      .createQueryBuilder('i')
      .where("(i.docType = 'fattura' OR i.docType IS NULL)")
      .orderBy('i.issueDate', 'DESC')
      .take(500)
      .getMany();

    return {
      kpi: {
        revenue: totalRevenue || 0,
        pending: pendingAmount || 0,
        overdue: overdueCount || 0,
      },
      trend: rawTrend,
      statusDistribution: statusDist.map(s => ({
        name:  s.name === 'paid' ? 'Pagate' : s.name === 'pending' ? 'In Scadenza' : 'Non Pagate',
        value: parseInt(s.value),
        color: s.name === 'paid' ? '#10B981' : s.name === 'pending' ? '#F59E0B' : '#EF4444',
      })),
      topClients: topClients.map(c => ({ ...c, value: parseFloat(c.value) })),
      invoices,
    };
  }

  async seed() {
    const count = await this.repo.count();
    if (count > 0) return;
  }

  // ── Anagrafica Clienti ────────────────────────────────────────────────────

  async findAllClients(): Promise<InvoiceClient[]> {
    return this.clientRepo.find({ order: { updatedAt: 'DESC' } });
  }

  async upsertClient(data: Partial<InvoiceClient>): Promise<InvoiceClient> {
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
}