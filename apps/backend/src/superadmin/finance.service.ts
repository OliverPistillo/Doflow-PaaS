import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Invoice)
    private repo: Repository<Invoice>,
  ) {}

  async create(data: DeepPartial<Invoice>) {
    const invoice = this.repo.create(data);
    return this.repo.save(invoice);
  }

  async getDashboardStats() {
    // 1. KPI Totali
    const { totalRevenue } = await this.repo
      .createQueryBuilder('i')
      .select('SUM(i.amount)', 'totalRevenue')
      .where('i.status = :status', { status: InvoiceStatus.PAID })
      .getRawOne();

    const { pendingAmount } = await this.repo
      .createQueryBuilder('i')
      .select('SUM(i.amount)', 'pendingAmount')
      .where('i.status = :status', { status: InvoiceStatus.PENDING })
      .getRawOne();
      
    const overdueCount = await this.repo.count({ where: { status: InvoiceStatus.OVERDUE } });

    // 2. Trend Ricavi (Ultimi 6 mesi)
    const rawTrend = await this.repo.query(`
        SELECT TO_CHAR(issue_date, 'Mon') as month, SUM(amount) as revenue 
        FROM invoices 
        WHERE status = 'paid' 
        GROUP BY month, issue_date 
        ORDER BY issue_date ASC 
        LIMIT 7
    `);

    // 3. Status Pie Chart
    const statusDist = await this.repo
      .createQueryBuilder('i')
      .select('i.status', 'name')
      .addSelect('COUNT(i.id)', 'value')
      .groupBy('i.status')
      .getRawMany();

    // 4. Top Clients
    const topClients = await this.repo
      .createQueryBuilder('i')
      .select('i.clientName', 'name')
      .addSelect('SUM(i.amount)', 'value')
      .groupBy('i.clientName')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    // 5. LISTA FATTURE (Per Export CSV)
    // Recuperiamo le ultime 500 fatture per l'export dettagliato
    const invoices = await this.repo.find({
        order: { issueDate: 'DESC' },
        take: 500
    });

    return {
      kpi: {
        revenue: totalRevenue || 0,
        pending: pendingAmount || 0,
        overdue: overdueCount || 0,
      },
      trend: rawTrend,
      statusDistribution: statusDist.map(s => ({
        name: s.name === 'paid' ? 'Pagate' : s.name === 'pending' ? 'In Scadenza' : 'Non Pagate',
        value: parseInt(s.value),
        color: s.name === 'paid' ? '#10B981' : s.name === 'pending' ? '#F59E0B' : '#EF4444'
      })),
      topClients: topClients.map(c => ({ ...c, value: parseFloat(c.value) })),
      invoices: invoices // <--- NUOVO CAMPO
    };
  }

  // METODO DI RICERCA AVANZATO
  async findAll(search?: string, status?: string) {
    const qb = this.repo.createQueryBuilder('invoice');

    // 1. Filtro Ricerca (Nome Cliente o Numero Fattura)
    if (search) {
      qb.where('(invoice.clientName ILIKE :search OR invoice.invoiceNumber ILIKE :search)', { 
        search: `%${search}%` 
      });
    }

    // 2. Filtro Stato
    if (status && status !== 'all') {
      qb.andWhere('invoice.status = :status', { status });
    }

    // Ordina per data emissione decrescente
    qb.orderBy('invoice.issueDate', 'DESC');

    return qb.getMany();
  }
}