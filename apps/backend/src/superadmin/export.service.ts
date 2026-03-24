import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { Invoice } from './entities/invoice.entity';
import { Tenant } from './entities/tenant.entity';
import { PlatformDeal } from './entities/platform-deal.entity';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(SupportTicket) private ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(PlatformDeal) private dealRepo: Repository<PlatformDeal>,
  ) {}

  // ─── Generic CSV builder ────────────────────────────────────

  private toCsv(headers: string[], rows: Record<string, any>[], keys: string[]): string {
    const headerLine = headers.join(',');
    const dataLines = rows.map(row =>
      keys.map(k => {
        const val = row[k];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(','),
    );
    return [headerLine, ...dataLines].join('\n');
  }

  // ─── Export specifici ───────────────────────────────────────

  async exportLeads(): Promise<string> {
    const leads = await this.leadRepo.find({ order: { createdAt: 'DESC' } });
    return this.toCsv(
      ['ID', 'Nome', 'Email', 'Telefono', 'Azienda', 'Fonte', 'Stato', 'Score', 'Creato'],
      leads,
      ['id', 'fullName', 'email', 'phone', 'company', 'source', 'status', 'score', 'createdAt'],
    );
  }

  async exportTickets(): Promise<string> {
    const tickets = await this.ticketRepo.find({ order: { createdAt: 'DESC' } });
    return this.toCsv(
      ['Codice', 'Oggetto', 'Categoria', 'Priorità', 'Stato', 'Tenant', 'Reporter', 'SLA (h)', 'Creato', 'Risolto'],
      tickets,
      ['ticketCode', 'subject', 'category', 'priority', 'status', 'tenantName', 'reporterEmail', 'slaHours', 'createdAt', 'resolvedAt'],
    );
  }

  async exportInvoices(): Promise<string> {
    const invoices = await this.invoiceRepo.find({ order: { createdAt: 'DESC' } });
    return this.toCsv(
      ['ID', 'Tipo', 'Stato', 'Importo', 'Cliente', 'Creata'],
      invoices,
      ['id', 'docType', 'status', 'amount', 'clientName', 'createdAt'],
    );
  }

  async exportTenants(): Promise<string> {
    const tenants = await this.tenantRepo.find({ order: { createdAt: 'DESC' } });
    return this.toCsv(
      ['ID', 'Nome', 'Slug', 'Piano', 'Attivo', 'Max Utenti', 'Storage MB', 'Creato'],
      tenants,
      ['id', 'name', 'slug', 'planTier', 'isActive', 'maxUsers', 'storageUsedMb', 'createdAt'],
    );
  }

  async exportDeals(): Promise<string> {
    const deals = await this.dealRepo.find({ order: { createdAt: 'DESC' } });
    return this.toCsv(
      ['ID', 'Titolo', 'Cliente', 'Fase', 'Valore (cent)', 'Probabilità', 'Chiusura Prevista', 'Creato'],
      deals,
      ['id', 'title', 'clientName', 'stage', 'valueCents', 'probabilityBps', 'expectedCloseDate', 'createdAt'],
    );
  }
}
