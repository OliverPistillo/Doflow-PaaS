import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LeadsService } from '../src/superadmin/leads.service';
import { Lead, LeadStatus, LeadSource } from '../src/superadmin/entities/lead.entity';

describe('LeadsService', () => {
  let service: LeadsService;
  let mockRepo: any;
  let mockEmitter: any;

  const mockLead: Partial<Lead> = {
    id: 'test-uuid-1',
    fullName: 'Mario Rossi',
    email: 'mario@test.it',
    phone: '+39 123',
    company: 'Acme Srl',
    source: LeadSource.WEBSITE,
    status: LeadStatus.NEW,
    score: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([mockLead]),
      findOne: jest.fn().mockResolvedValue(mockLead),
      create: jest.fn().mockReturnValue(mockLead),
      save: jest.fn().mockResolvedValue(mockLead),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(1),
    };

    mockEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getRepositoryToken(Lead), useValue: mockRepo },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all leads without filters', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockLead]);
      expect(mockRepo.find).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      await service.findAll({ status: LeadStatus.NEW });
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: LeadStatus.NEW },
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a lead and emit event', async () => {
      const dto = { fullName: 'Lucia Verdi', email: 'lucia@test.it' };
      const result = await service.create(dto);

      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockLead);

      // Verifica che l'evento automation sia stato emesso
      expect(mockEmitter.emit).toHaveBeenCalledWith(
        'automation.trigger',
        expect.objectContaining({
          event: 'LEAD_CREATED',
          context: expect.objectContaining({ leadId: mockLead.id }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status and emit LEAD_STATUS_CHANGE', async () => {
      const result = await service.updateStatus('test-uuid-1', LeadStatus.QUALIFIED);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-uuid-1' } });
      expect(mockRepo.save).toHaveBeenCalled();

      expect(mockEmitter.emit).toHaveBeenCalledWith(
        'automation.trigger',
        expect.objectContaining({
          event: 'LEAD_STATUS_CHANGE',
          context: expect.objectContaining({
            fromStatus: LeadStatus.NEW,
            toStatus: LeadStatus.QUALIFIED,
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return stats object', async () => {
      const stats = await service.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('conversionRate');
      expect(stats).toHaveProperty('bySource');
      expect(stats).toHaveProperty('byStatus');
    });
  });

  describe('delete', () => {
    it('should delete a lead', async () => {
      const result = await service.delete('test-uuid-1');
      expect(mockRepo.delete).toHaveBeenCalledWith('test-uuid-1');
      expect(result).toHaveProperty('message');
    });
  });
});
