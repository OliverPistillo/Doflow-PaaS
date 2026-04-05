import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExportService } from '../src/superadmin/export.service';
import { Lead } from '../src/superadmin/entities/lead.entity';
import { SupportTicket } from '../src/superadmin/entities/support-ticket.entity';
import { Invoice } from '../src/superadmin/entities/invoice.entity';
import { Tenant } from '../src/superadmin/entities/tenant.entity';
import { PlatformDeal } from '../src/superadmin/entities/platform-deal.entity';

describe('ExportService', () => {
  let service: ExportService;

  const mockLeads = [
    { id: '1', fullName: 'Mario Rossi', email: 'mario@test.it', phone: '+39', company: 'Acme', source: 'WEBSITE', status: 'NEW', score: 50, createdAt: '2026-01-01' },
    { id: '2', fullName: 'Lucia, Verdi', email: 'lucia@test.it', phone: '', company: 'Beta "Corp"', source: 'META', status: 'QUALIFIED', score: 80, createdAt: '2026-02-01' },
  ];

  const mockTickets = [
    { ticketCode: 'TK-0001', subject: 'Bug login', category: 'BUG', priority: 'HIGH', status: 'OPEN', tenantName: 'Acme', reporterEmail: 'admin@acme.it', slaHours: 8, createdAt: '2026-03-01', resolvedAt: null },
  ];

  const createMockRepo = (data: any[]) => ({
    find: jest.fn().mockResolvedValue(data),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: getRepositoryToken(Lead), useValue: createMockRepo(mockLeads) },
        { provide: getRepositoryToken(SupportTicket), useValue: createMockRepo(mockTickets) },
        { provide: getRepositoryToken(Invoice), useValue: createMockRepo([]) },
        { provide: getRepositoryToken(Tenant), useValue: createMockRepo([]) },
        { provide: getRepositoryToken(PlatformDeal), useValue: createMockRepo([]) },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportLeads', () => {
    it('should return valid CSV string with headers', async () => {
      const csv = await service.exportLeads();
      const lines = csv.split('\n');

      // Header
      expect(lines[0]).toBe('ID,Nome,Email,Telefono,Azienda,Fonte,Stato,Score,Creato');
      // Data rows
      expect(lines.length).toBe(3); // header + 2 leads
    });

    it('should properly escape commas and quotes in CSV', async () => {
      const csv = await service.exportLeads();
      // "Lucia, Verdi" dovrebbe essere tra virgolette per la virgola
      expect(csv).toContain('"Lucia, Verdi"');
      // 'Beta "Corp"' dovrebbe avere doppi apici escaped
      expect(csv).toContain('"Beta ""Corp"""');
    });
  });

  describe('exportTickets', () => {
    it('should return valid CSV string', async () => {
      const csv = await service.exportTickets();
      const lines = csv.split('\n');
      expect(lines[0]).toContain('Codice');
      expect(lines[0]).toContain('Oggetto');
      expect(lines.length).toBe(2); // header + 1 ticket
    });

    it('should handle null resolvedAt', async () => {
      const csv = await service.exportTickets();
      // La data di risoluzione null dovrebbe essere stringa vuota
      expect(csv).toContain('TK-0001');
    });
  });

  describe('empty exports', () => {
    it('should return only header for empty invoices', async () => {
      const csv = await service.exportInvoices();
      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // solo header
    });
  });
});
