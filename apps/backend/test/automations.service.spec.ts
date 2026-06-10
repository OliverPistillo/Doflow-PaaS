import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutomationsService } from '../src/superadmin/automations.service';
import { AutomationRule, TriggerEvent, ActionType } from '../src/superadmin/entities/automation-rule.entity';
import { PlatformNotificationsService } from '../src/superadmin/platform-notifications.service';
import { EmailTemplatesService } from '../src/superadmin/email-templates.service';

describe('AutomationsService', () => {
  let service: AutomationsService;
  let mockRepo: any;
  let mockNotifService: any;
  let mockEmailService: any;

  const activeRule: Partial<AutomationRule> = {
    id: 'rule-1',
    name: 'Lead qualificato → email',
    triggerEvent: TriggerEvent.LEAD_STATUS_CHANGE,
    triggerConditions: { toStatus: 'QUALIFIED' },
    actionType: ActionType.SEND_EMAIL,
    actionConfig: {
      templateSlug: 'lead_qualified',
      to: '{{email}}',
      variables: { nome: '{{fullName}}' },
    },
    isActive: true,
    executionCount: 0,
    lastExecutedAt: null,
  };

  const notifRule: Partial<AutomationRule> = {
    id: 'rule-2',
    name: 'Ticket critico → notifica',
    triggerEvent: TriggerEvent.TICKET_CREATED,
    triggerConditions: { priority: 'CRITICAL' },
    actionType: ActionType.CREATE_NOTIFICATION,
    actionConfig: {
      title: 'Ticket critico: {{subject}}',
      message: 'Da {{reporterEmail}}',
    },
    isActive: true,
    executionCount: 3,
  };

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([activeRule, notifRule]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 'rule-1') return Promise.resolve({ ...activeRule });
        if (where.id === 'rule-2') return Promise.resolve({ ...notifRule });
        return Promise.resolve(null);
      }),
      create: jest.fn().mockReturnValue(activeRule),
      save: jest.fn().mockImplementation(r => Promise.resolve({ ...r })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockNotifService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    mockEmailService = {
      sendWithTemplate: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationsService,
        { provide: getRepositoryToken(AutomationRule), useValue: mockRepo },
        { provide: PlatformNotificationsService, useValue: mockNotifService },
        { provide: EmailTemplatesService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AutomationsService>(AutomationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processEvent', () => {
    it('should match and execute LEAD_STATUS_CHANGE rule', async () => {
      mockRepo.find.mockResolvedValue([{ ...activeRule }]);

      const result = await service.processEvent(TriggerEvent.LEAD_STATUS_CHANGE, {
        leadId: 'lead-1',
        fullName: 'Mario Rossi',
        email: 'mario@test.it',
        toStatus: 'QUALIFIED',
      });

      expect(result.rulesMatched).toBe(1);
      expect(result.executed).toBe(1);
      expect(mockEmailService.sendWithTemplate).toHaveBeenCalledWith(
        'lead_qualified',
        'mario@test.it',
        expect.objectContaining({ nome: 'Mario Rossi' }),
      );
    });

    it('should NOT execute if conditions do not match', async () => {
      mockRepo.find.mockResolvedValue([{ ...activeRule }]);

      const result = await service.processEvent(TriggerEvent.LEAD_STATUS_CHANGE, {
        leadId: 'lead-2',
        toStatus: 'CONTACTED', // condizione richiede QUALIFIED
      });

      expect(result.rulesMatched).toBe(1);
      expect(result.executed).toBe(0);
      expect(mockEmailService.sendWithTemplate).not.toHaveBeenCalled();
    });

    it('should execute CREATE_NOTIFICATION action', async () => {
      mockRepo.find.mockResolvedValue([{ ...notifRule }]);

      const result = await service.processEvent(TriggerEvent.TICKET_CREATED, {
        subject: 'Server down',
        reporterEmail: 'admin@tenant.it',
        priority: 'CRITICAL',
      });

      expect(result.executed).toBe(1);
      expect(mockNotifService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Ticket critico: Server down',
          message: 'Da admin@tenant.it',
        }),
      );
    });

    it('should return 0 executed for no matching rules', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.processEvent(TriggerEvent.INVOICE_OVERDUE, {});
      expect(result.rulesMatched).toBe(0);
      expect(result.executed).toBe(0);
    });
  });

  describe('toggle', () => {
    it('should toggle rule active status', async () => {
      const result = await service.toggle('rule-1', false);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('getStats', () => {
    it('should return aggregated stats', async () => {
      const stats = await service.getStats();
      expect(stats).toHaveProperty('total', 2);
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('byTrigger');
      expect(stats).toHaveProperty('byAction');
    });
  });
});
