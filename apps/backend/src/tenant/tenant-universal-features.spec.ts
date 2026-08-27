import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { RoomServiceClient } from 'livekit-server-sdk';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FEATURE_ACCESS_META_KEY } from '../feature-access/feature-access.decorator';
import { FeatureAccessGuard } from '../feature-access/feature-access.guard';
import { NotificationsService } from '../realtime/notifications.service';
import { SalesIntelligenceController } from '../sales-intelligence/sales-intelligence.controller';
import { PlatformSuperadminGuard } from '../superadmin/platform-superadmin.guard';
import { CreateUniversalTenantFeatures1850000000000 } from '../migrations/1850000000000-CreateUniversalTenantFeatures';
import { TenantBonusService } from './tenant-bonus.service';
import { TenantCompanyIntelligenceController } from './tenant-company-intelligence.controller';
import { TenantCompanyIntelligenceService } from './tenant-company-intelligence.service';
import { TenantConversationsController } from './tenant-conversations.controller';
import { TenantConversationsService } from './tenant-conversations.service';
import { TenantFlowboardsService } from './tenant-flowboards.service';
import { TenantFlowboardsController } from './tenant-flowboards.controller';
import { TenantLivekitService } from './tenant-livekit.service';
import { TenantBonusController } from './tenant-bonus.controller';
import { ensureDoflowAutomationPerformanceTables } from './tenant-automation-performance-schema';
import { TenantTeamController } from './tenant-team.controller';
import { tenantActor } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';
import { withTenantIdempotency } from './tenant-universal-idempotency';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { TenantUniversalCapabilitiesService } from './tenant-universal-capabilities.service';
import { TENANT_UNIVERSAL_CAPABILITY } from './tenant-universal-capability.guard';

jest.mock('./tenant-universal-features-schema', () => ({
  ensureTenantUniversalFeatureTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./tenant-automation-performance-schema', () => ({
  ensureDoflowAutomationPerformanceTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./tenant-backend-contracts-schema', () => ({
  ensureTenantBackendContractTables: jest.fn().mockResolvedValue(undefined),
}));

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const RECORD_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function request(tenant = 'tenant_a', role = 'owner', headers: Record<string, string> = {}) {
  return {
    user: { sub: USER_A, id: USER_A, email: 'actor@example.test', role, tenantId: tenant, tenantSlug: tenant },
    headers,
  };
}

function capabilityAuthority(allowed = true) {
  return {
    require: jest.fn(async () => {
      if (!allowed) throw new ForbiddenException('Capability tenant richiesta');
    }),
    has: jest.fn().mockResolvedValue(allowed),
  };
}

function selectiveCapabilityAuthority(...allowed: string[]) {
  return {
    require: jest.fn(async (_actor: unknown, ...required: string[]) => {
      if (!required.some((capability) => allowed.includes(capability))) {
        throw new ForbiddenException('Capability tenant richiesta');
      }
    }),
    has: jest.fn(async (_actor: unknown, capability: string) => allowed.includes(capability)),
  };
}

function realtimeAuthority() {
  return { notifyUser: jest.fn().mockResolvedValue(undefined) };
}

describe('Universal tenant authority security', () => {
  beforeEach(() => jest.clearAllMocks());

  it('derives tenant only from the authenticated principal and explicitly rejects a mismatched tenant header', () => {
    expect(() => tenantActor({ ...request(), tenantId: 'tenant_b' }, 'test')).not.toThrow();
    expect(() => tenantActor(request('tenant_a', 'owner', { 'x-doflow-tenant-id': 'tenant_b' }), 'test'))
      .toThrow(ForbiddenException);
    expect(() => tenantActor({ user: { sub: USER_A, role: 'owner' }, tenantId: 'tenant_a' }, 'test'))
      .toThrow(ForbiddenException);
  });

  it('rejects tenant spoof keys in query/body before controller execution', () => {
    const guard = new TenantUniversalScopeGuard();
    const context = (req: any) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;
    expect(() => guard.canActivate(context({ ...request(), query: { tenantId: 'tenant_b' }, body: {} })))
      .toThrow(BadRequestException);
    expect(() => guard.canActivate(context({ ...request(), query: {}, body: { tenant_id: 'tenant_b' } })))
      .toThrow(BadRequestException);
  });

  it('denies a foreign conversation UUID without ever querying another tenant schema', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new TenantConversationsService({ query } as any, request(), realtimeAuthority() as any, capabilityAuthority() as any);
    await expect(service.getConversation(RECORD_B)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('"tenant_a".conversation_participants');
    expect(query.mock.calls[0][0]).not.toContain('tenant_b');
  });

  it('fails closed on a denied or unavailable universal capability before feature-table access', async () => {
    const query = jest.fn();
    const denied = new TenantConversationsService(
      { query } as any,
      request('tenant_a', 'manager'),
      realtimeAuthority() as any,
      capabilityAuthority(false) as any,
    );
    await expect(denied.listConversations({})).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();

    const unavailableAuthority = {
      require: jest.fn().mockRejectedValue(new Error('permissions database unavailable')),
      has: jest.fn(),
    };
    const unavailable = new TenantConversationsService(
      { query } as any,
      request('tenant_a', 'manager'),
      realtimeAuthority() as any,
      unavailableAuthority as any,
    );
    await expect(unavailable.listConversations({})).rejects.toThrow('permissions database unavailable');
    expect(query).not.toHaveBeenCalled();
  });

  it('maps generic universal capabilities to explicit tenant modules, including Bonus=reports', async () => {
    const empty = { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false };
    const access = {
      role: 'employee',
      audience: 'employee',
      modules: {
        projects: { ...empty, can_view: true },
        team: { ...empty, can_view: true },
        reports: { ...empty, can_view: true },
        notifications: empty,
        crm: { ...empty, can_view: true },
      },
    };
    const effective = { getCurrentAccess: jest.fn().mockResolvedValue(access) };
    const doflow = { current: jest.fn(), has: jest.fn() };
    const capabilities = new TenantUniversalCapabilitiesService(doflow as any, effective as any);
    const actor = tenantActor(request('tenant_a', 'employee'), 'capability-test');

    await expect(capabilities.has(actor, 'canViewProjects')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canViewTeam')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canViewOwnPoints')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canManagePointPolicies')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canReadNotifications')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canCreateFlowboards')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canUpdateFlowboards')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canDeleteFlowboards')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canCreateConversations')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canSendMessages')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canEditMessages')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canDeleteMessages')).resolves.toBe(false);
    await expect(capabilities.has(actor, 'canAnalyzeCompanies')).resolves.toBe(false);

    access.modules.projects = { ...empty, can_view: true, can_create: true, can_update: true, can_delete: true };
    access.modules.team = { ...empty, can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true };
    access.modules.crm = { ...empty, can_view: true, can_create: true };
    await expect(capabilities.has(actor, 'canCreateFlowboards')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canUpdateFlowboards')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canDeleteFlowboards')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canCreateConversations')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canSendMessages')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canEditMessages')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canDeleteMessages')).resolves.toBe(true);
    await expect(capabilities.has(actor, 'canAnalyzeCompanies')).resolves.toBe(true);
    expect(doflow.current).not.toHaveBeenCalled();

    effective.getCurrentAccess.mockRejectedValueOnce(new Error('permissions lookup failed'));
    await expect(capabilities.require(actor, 'canViewProjects')).rejects.toThrow('permissions lookup failed');
  });

  it('publishes action-level capability metadata while GET routes remain view-only', () => {
    const reflector = new Reflector();
    const required = (controller: any, handler: string) => reflector.getAllAndOverride<string[]>(
      TENANT_UNIVERSAL_CAPABILITY,
      [controller.prototype[handler], controller],
    );

    expect(required(TenantFlowboardsController, 'list')).toEqual(['canViewProjects']);
    expect(required(TenantFlowboardsController, 'create')).toEqual(['canCreateFlowboards']);
    expect(required(TenantFlowboardsController, 'save')).toEqual(['canUpdateFlowboards']);
    expect(required(TenantFlowboardsController, 'remove')).toEqual(['canDeleteFlowboards']);
    expect(required(TenantConversationsController, 'list')).toEqual(['canViewTeam']);
    expect(required(TenantConversationsController, 'create')).toEqual(['canCreateConversations']);
    expect(required(TenantConversationsController, 'leave')).toEqual(['canViewTeam']);
    expect(required(TenantConversationsController, 'send')).toEqual(['canSendMessages']);
    expect(required(TenantConversationsController, 'update')).toEqual(['canEditMessages']);
    expect(required(TenantConversationsController, 'remove')).toEqual(['canDeleteMessages']);
    expect(required(TenantCompanyIntelligenceController, 'list')).toEqual(['canViewAssignedLeads']);
    expect(required(TenantCompanyIntelligenceController, 'analyze')).toEqual(['canAnalyzeCompanies']);
  });

  it('adapts universal mutations to real Doflow project, comment and lead capabilities', async () => {
    const granted = new Set(['canEditProject', 'canCreateComments', 'canReactComments', 'canCreateLeads']);
    const doflowActor = tenantActor(request('doflow', 'employee'), 'doflow-capability-test');
    const doflow = {
      current: jest.fn().mockResolvedValue({
        id: USER_A,
        email: 'actor@example.test',
        role: 'employee',
        schema: 'doflow',
        capabilities: granted,
      }),
      has: jest.fn((_access: unknown, capability: string) => granted.has(capability)),
    };
    const capabilities = new TenantUniversalCapabilitiesService(doflow as any, { getCurrentAccess: jest.fn() } as any);

    await expect(capabilities.has(doflowActor, 'canUpdateFlowboards')).resolves.toBe(true);
    await expect(capabilities.has(doflowActor, 'canCreateFlowboardComments')).resolves.toBe(true);
    await expect(capabilities.has(doflowActor, 'canSendMessages')).resolves.toBe(true);
    await expect(capabilities.has(doflowActor, 'canReactMessages')).resolves.toBe(true);
    await expect(capabilities.has(doflowActor, 'canAnalyzeCompanies')).resolves.toBe(true);
    await expect(capabilities.has(doflowActor, 'canDeleteFlowboards')).resolves.toBe(false);
    expect(doflow.has).toHaveBeenCalledWith(expect.anything(), 'canEditProject');
    expect(doflow.has).toHaveBeenCalledWith(expect.anything(), 'canCreateComments');
    expect(doflow.has).toHaveBeenCalledWith(expect.anything(), 'canReactComments');
    expect(doflow.has).toHaveBeenCalledWith(expect.anything(), 'canCreateLeads');
  });

  it('does not promote Doflow own-comment capabilities to cross-author moderation', async () => {
    const granted = new Set(['canEditOwnComments']);
    const doflowActor = tenantActor(request('doflow', 'employee'), 'doflow-moderation-capability-test');
    const doflow = {
      current: jest.fn().mockResolvedValue({
        id: USER_A,
        email: 'actor@example.test',
        role: 'employee',
        schema: 'doflow',
        capabilities: granted,
      }),
      has: jest.fn((_access: unknown, capability: string) => granted.has(capability)),
    };
    const capabilities = new TenantUniversalCapabilitiesService(doflow as any, { getCurrentAccess: jest.fn() } as any);

    await expect(capabilities.has(doflowActor, 'canEditMessages')).resolves.toBe(true);
    await expect(capabilities.has(doflowActor, 'canUpdateFlowboardComments')).resolves.toBe(true);
    await expect(capabilities.has(doflowActor, 'canModerateMessages')).resolves.toBe(false);
    await expect(capabilities.has(doflowActor, 'canModerateFlowboardComments')).resolves.toBe(false);

    granted.add('canModerateComments');
    await expect(capabilities.has(doflowActor, 'canModerateMessages')).resolves.toBe(true);
    await expect(capabilities.has(doflowActor, 'canModerateFlowboardComments')).resolves.toBe(true);
  });

  it('keeps Team behind canViewTeam, bypasses only self module-permissions, and gates Company Intelligence by feature', () => {
    const reflector = new Reflector();
    const required = (handler: string) => reflector.getAllAndOverride<string[]>(
      TENANT_UNIVERSAL_CAPABILITY,
      [TenantTeamController.prototype[handler as keyof TenantTeamController], TenantTeamController],
    );
    expect(required('listMembers')).toEqual(['canViewTeam']);
    expect(required('currentModulePermissions')).toEqual([]);
    expect(reflector.getAllAndOverride(
      FEATURE_ACCESS_META_KEY,
      [TenantCompanyIntelligenceController.prototype.list, TenantCompanyIntelligenceController],
    )).toMatchObject({ moduleKey: 'crm.sales-intel', requireActiveSubscription: true });
  });

  it('denies read-only mutations in services and allows the action capability before DB access', async () => {
    const flowReadOnly = selectiveCapabilityAuthority('canViewProjects');
    const flowTransaction = jest.fn();
    const flowboards = new TenantFlowboardsService(
      { query: jest.fn(), transaction: flowTransaction } as any,
      request('tenant_a', 'viewer'),
      realtimeAuthority() as any,
      flowReadOnly as any,
    );
    await expect(flowboards.create({ name: 'Board' }, 'create-key')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(flowboards.update(RECORD_B, { optimisticVersion: 1 }, 'update-key')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(flowboards.remove(RECORD_B)).rejects.toBeInstanceOf(ForbiddenException);
    expect(flowReadOnly.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canCreateFlowboards');
    expect(flowReadOnly.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canUpdateFlowboards');
    expect(flowReadOnly.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canDeleteFlowboards');
    expect(flowTransaction).not.toHaveBeenCalled();

    const chatReadOnly = selectiveCapabilityAuthority('canViewTeam');
    const chatTransaction = jest.fn();
    const conversations = new TenantConversationsService(
      { query: jest.fn(), transaction: chatTransaction } as any,
      request('tenant_a', 'viewer'),
      realtimeAuthority() as any,
      chatReadOnly as any,
    );
    await expect(conversations.createConversation({ title: 'No' }, 'create-chat-key'))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(conversations.sendMessage(RECORD_B, { body: 'No' }, 'send-key'))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(conversations.updateMessage(RECORD_B, USER_B, { body: 'No' }, 'edit-key'))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(conversations.deleteMessage(RECORD_B, USER_B, 'delete-key'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(chatReadOnly.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canCreateConversations');
    expect(chatReadOnly.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canSendMessages');
    expect(chatReadOnly.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canEditMessages');
    expect(chatReadOnly.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canDeleteMessages');
    expect(chatTransaction).not.toHaveBeenCalled();

    const intelReadOnly = selectiveCapabilityAuthority('canViewAssignedLeads');
    const enrichment = { isConfigured: jest.fn().mockReturnValue(false), lookupCompany: jest.fn() };
    const intelligence = new TenantCompanyIntelligenceService(
      { query: jest.fn() } as any,
      enrichment as any,
      request('tenant_a', 'viewer'),
      intelReadOnly as any,
    );
    await expect(intelligence.analyze({ domain: 'example.com' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(intelReadOnly.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canAnalyzeCompanies');
    expect(enrichment.isConfigured).not.toHaveBeenCalled();

    const authorized = selectiveCapabilityAuthority('canAnalyzeCompanies');
    const allowedIntelligence = new TenantCompanyIntelligenceService(
      { query: jest.fn() } as any,
      enrichment as any,
      request('tenant_a', 'employee'),
      authorized as any,
    );
    await expect(allowedIntelligence.analyze({ domain: 'example.com' })).resolves.toMatchObject({ status: 'provider_unconfigured' });
    expect(authorized.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canAnalyzeCompanies');
  });

  it('enforces the PRO entitlement on direct Flowboard and Bonus API access', async () => {
    const reflector = new Reflector();
    const dataSource = {
      query: jest.fn().mockResolvedValue([{
        id: RECORD_B,
        slug: 'tenant-a',
        schemaName: 'tenant_a',
        planTier: 'STARTER',
        isActive: true,
      }]),
    };
    const guard = new FeatureAccessGuard(reflector, dataSource as any);
    const context = (controller: any, handler: string) => ({
      getClass: () => controller,
      getHandler: () => controller.prototype[handler],
      switchToHttp: () => ({ getRequest: () => request('tenant_a', 'manager') }),
    }) as any;

    await expect(guard.canActivate(context(TenantFlowboardsController, 'list')))
      .rejects.toMatchObject({ response: expect.objectContaining({ error: 'PLAN_REQUIRED', requiredPlan: 'PRO' }) });
    await expect(guard.canActivate(context(TenantBonusController, 'state')))
      .rejects.toMatchObject({ response: expect.objectContaining({ error: 'PLAN_REQUIRED', requiredPlan: 'PRO' }) });
    expect(dataSource.query).toHaveBeenCalledTimes(2);
  });

  it('rejects top-level actor spoofing and exposes receipt aggregation in message reads', async () => {
    const query = jest.fn();
    const transaction = jest.fn();
    const service = new TenantConversationsService({ query, transaction } as any, request(), realtimeAuthority() as any, capabilityAuthority() as any);
    await expect(service.createConversation({ title: 'A', userId: USER_B }, 'key'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
    expect((service as any).messageSelect('tenant_a')).toContain('conversation_message_receipts');
    expect((service as any).messageSelect('tenant_a')).toContain("'readAt'");
  });

  it('returns conversation summaries with active participants and the latest message', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new TenantConversationsService(
      { query } as any,
      request(),
      realtimeAuthority() as any,
      capabilityAuthority() as any,
    );

    await expect(service.listConversations({ limit: 20 })).resolves.toEqual({ items: [], nextCursor: null });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('AS participants');
    expect(sql).toContain('member.left_at IS NULL');
    expect(sql).toContain('AS "lastMessage"');
    expect(sql).toContain('latest.deleted_at IS NULL');
  });

  it.each([
    ['edit', (service: TenantConversationsService) => service.updateMessage(RECORD_B, USER_B, { body: 'tampered' })],
    ['delete', (service: TenantConversationsService) => service.deleteMessage(RECORD_B, USER_B)],
  ])('denies conversation-owner %s of another author without moderation capability', async (_operation, mutate) => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{
          id: USER_B,
          conversation_id: RECORD_B,
          author_id: USER_B,
          participant_role: 'owner',
          optimistic_version: 1,
          body: 'original',
          attachment_metadata: [],
        }]),
    };
    const capabilities = selectiveCapabilityAuthority('canEditMessages', 'canDeleteMessages');
    const service = new TenantConversationsService(
      {
        query: jest.fn(),
        transaction: (operation: any) => operation(manager),
      } as any,
      request('tenant_a', 'employee'),
      realtimeAuthority() as any,
      capabilities as any,
    );

    await expect(mutate(service)).rejects.toBeInstanceOf(ForbiddenException);
    expect(capabilities.has).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_A }),
      'canModerateMessages',
    );
    expect(manager.query).toHaveBeenCalledTimes(2);
  });

  it('allows a conversation moderator to edit another author and preserves the revision audit', async () => {
    const current = {
      id: USER_B,
      conversation_id: RECORD_B,
      author_id: USER_B,
      participant_role: 'member',
      optimistic_version: 1,
      body: 'original',
      attachment_metadata: [],
    };
    const updated = { ...current, body: 'moderated', optimistic_version: 2 };
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ role: 'member' }])
        .mockResolvedValueOnce([current])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([updated])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const capabilities = selectiveCapabilityAuthority('canEditMessages', 'canModerateMessages');
    const service = new TenantConversationsService(
      {
        query: jest.fn().mockResolvedValue([]),
        transaction: (operation: any) => operation(manager),
      } as any,
      request('tenant_a', 'employee'),
      realtimeAuthority() as any,
      capabilities as any,
    );

    await expect(service.updateMessage(RECORD_B, USER_B, { body: 'moderated' }))
      .resolves.toMatchObject({ id: USER_B, body: 'moderated', optimistic_version: 2 });
    expect(capabilities.has).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_A }),
      'canModerateMessages',
    );
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('conversation_message_revisions'))).toBe(true);
    expect(manager.query.mock.calls.some(([sql, params]) =>
      String(sql).includes('conversation_audit') && params?.[3] === 'message_updated')).toBe(true);
  });

  it('soft-removes a member, protects the creator and emits only tenant-qualified participant events', async () => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ created_by: USER_A }])
        .mockResolvedValueOnce([{ role: 'member' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const query = jest.fn().mockResolvedValue([{ user_id: USER_A }]);
    const transaction = jest.fn(async (operation: any) => operation(manager));
    const realtime = { notifyUser: jest.fn().mockResolvedValue(undefined) };
    const capabilities = capabilityAuthority();
    const service = new TenantConversationsService({ query, transaction } as any, request(), realtime as any, capabilities as any);

    await expect(service.removeParticipant(RECORD_B, USER_B)).resolves.toEqual({
      conversationId: RECORD_B, participantId: USER_B, removed: true,
    });
    expect(manager.query.mock.calls[3][0]).toContain('SET left_at=now()');
    expect([...manager.query.mock.calls, ...query.mock.calls].every(([sql]) => !String(sql).includes('tenant_b'))).toBe(true);
    expect(realtime.notifyUser).toHaveBeenCalledWith(
      USER_A,
      expect.objectContaining({ type: 'collaboration.participant.removed', conversationId: RECORD_B }),
      'tenant_a',
    );
    expect(realtime.notifyUser).toHaveBeenCalledWith(
      USER_B,
      expect.objectContaining({ type: 'collaboration.participant.removed', conversationId: RECORD_B }),
      'tenant_a',
    );
    expect(capabilities.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canManageConversations');

    const protectedManager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ created_by: USER_B }])
        .mockResolvedValueOnce([{ role: 'owner' }]),
    };
    const protectedService = new TenantConversationsService({
      query: jest.fn(),
      transaction: (operation: any) => operation(protectedManager),
    } as any, request(), realtime as any, capabilityAuthority() as any);
    await expect(protectedService.removeParticipant(RECORD_B, USER_B)).rejects.toBeInstanceOf(ForbiddenException);
    expect(protectedManager.query.mock.calls.some(([sql]) => String(sql).includes('SET left_at=now()'))).toBe(false);
  });

  it('never demotes an existing conversation owner while re-adding participants', async () => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ id: USER_B }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const service = new TenantConversationsService({
      query: jest.fn().mockResolvedValue([]),
      transaction: (operation: any) => operation(manager),
    } as any, request(), realtimeAuthority() as any, capabilityAuthority() as any);

    await expect(service.addParticipants(RECORD_B, { participantIds: [USER_B] }))
      .resolves.toEqual({ conversationId: RECORD_B, participantIds: [USER_B] });
    const upsertSql = String(manager.query.mock.calls[2][0]);
    expect(upsertSql).toContain("conversation_participants.role='owner'");
    expect(upsertSql).toContain("THEN 'owner'");
  });

  it('allows a view-only conversation member to leave while retaining owner protections', async () => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ role: 'member' }])
        .mockResolvedValueOnce([{ created_by: USER_B }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const capabilities = selectiveCapabilityAuthority('canViewTeam');
    const service = new TenantConversationsService(
      {
        query: jest.fn().mockResolvedValue([]),
        transaction: (operation: any) => operation(manager),
      } as any,
      request('tenant_a', 'viewer'),
      realtimeAuthority() as any,
      capabilities as any,
    );

    await expect(service.leaveConversation(RECORD_B)).resolves.toEqual({
      conversationId: RECORD_B,
      participantId: USER_A,
      left: true,
    });
    expect(manager.query.mock.calls[2][0]).toContain('SET left_at=now()');
    expect(capabilities.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canViewTeam');
  });

  it('denies creator leave and cross-tenant participant removal without emitting an event', async () => {
    const creatorManager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ created_by: USER_A }]),
    };
    const realtime = { notifyUser: jest.fn() };
    const creatorService = new TenantConversationsService({
      query: jest.fn(),
      transaction: (operation: any) => operation(creatorManager),
    } as any, request(), realtime as any, capabilityAuthority() as any);
    await expect(creatorService.leaveConversation(RECORD_B)).rejects.toBeInstanceOf(ForbiddenException);

    const foreignManager = { query: jest.fn().mockResolvedValueOnce([]) };
    const foreignService = new TenantConversationsService({
      query: jest.fn(),
      transaction: (operation: any) => operation(foreignManager),
    } as any, request(), realtime as any, capabilityAuthority() as any);
    await expect(foreignService.removeParticipant(RECORD_B, USER_B)).rejects.toBeInstanceOf(ForbiddenException);
    expect(foreignManager.query.mock.calls[0][0]).toContain('"tenant_a".conversation_participants');
    expect(foreignManager.query.mock.calls[0][0]).not.toContain('tenant_b');
    expect(realtime.notifyUser).not.toHaveBeenCalled();
  });

  it('denies a foreign Flowboard UUID and never changes schema from client input', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new TenantFlowboardsService({ query } as any, request(), realtimeAuthority() as any, capabilityAuthority() as any);
    await expect(service.get(RECORD_B)).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('"tenant_a".flowboards');
    expect(query.mock.calls[0][0]).not.toContain('tenant_b');
    await expect(service.list({ userId: USER_B })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists tenant templates explicitly and remaps graph identifiers when copying a Flowboard', async () => {
    const query = jest.fn().mockResolvedValue([{ id: RECORD_B, is_template: true }]);
    const service = new TenantFlowboardsService(
      { query } as any,
      request('tenant_a', 'employee'),
      realtimeAuthority() as any,
      capabilityAuthority() as any,
    );

    await expect(service.templates()).resolves.toEqual({ items: [{ id: RECORD_B, is_template: true }] });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('"tenant_a".flowboards');
    expect(query.mock.calls[0][0]).toContain('b.is_template=true');
    expect(query.mock.calls[0][0]).not.toContain('tenant_b');

    const copied = (service as any).cloneGraph(
      [{ id: 'source-parent' }, { id: 'source-child', parentId: 'source-parent' }],
      [{ id: 'source-edge', source: 'source-parent', target: 'source-child' }],
    );
    expect(copied.nodes[0].id).not.toBe('source-parent');
    expect(copied.nodes[1].id).not.toBe('source-child');
    expect(copied.nodes[1].parentId).toBe(copied.nodes[0].id);
    expect(copied.edges[0]).toMatchObject({ source: copied.nodes[0].id, target: copied.nodes[1].id });
    expect(copied.edges[0].id).not.toBe('source-edge');
  });

  it('allows only tenant administrators to create Flowboard templates', async () => {
    const transaction = jest.fn();
    const service = new TenantFlowboardsService(
      { query: jest.fn(), transaction } as any,
      request('tenant_a', 'employee'),
      realtimeAuthority() as any,
      selectiveCapabilityAuthority('canCreateFlowboards') as any,
    );
    await expect(service.create({ name: 'Modello', isTemplate: true }, 'template-key'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['edit', (service: TenantFlowboardsService) => service.updateComment(RECORD_B, USER_B, { body: 'tampered' })],
    ['delete', (service: TenantFlowboardsService) => service.deleteComment(RECORD_B, USER_B)],
  ])('denies Flowboard editor %s of another author without moderation capability', async (_operation, mutate) => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{
          id: RECORD_B,
          owner_user_id: USER_B,
          collaborator_permission: 'edit',
        }])
        .mockResolvedValueOnce([{
          id: USER_B,
          board_id: RECORD_B,
          author_user_id: USER_B,
          optimistic_version: 1,
          body: 'original',
        }]),
    };
    const capabilities = selectiveCapabilityAuthority(
      'canUpdateFlowboardComments',
      'canDeleteFlowboardComments',
    );
    const service = new TenantFlowboardsService(
      {
        query: jest.fn(),
        transaction: (operation: any) => operation(manager),
      } as any,
      request('tenant_a', 'employee'),
      realtimeAuthority() as any,
      capabilities as any,
    );

    await expect(mutate(service)).rejects.toBeInstanceOf(ForbiddenException);
    expect(capabilities.has).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_A }),
      'canModerateFlowboardComments',
    );
    expect(manager.query).toHaveBeenCalledTimes(2);
  });

  it('allows a Flowboard moderator to delete another author comment and records the audit', async () => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{
          id: RECORD_B,
          owner_user_id: USER_B,
          collaborator_permission: 'view',
        }])
        .mockResolvedValueOnce([{
          id: USER_B,
          board_id: RECORD_B,
          author_user_id: USER_B,
          optimistic_version: 1,
          body: 'unsafe',
        }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const capabilities = selectiveCapabilityAuthority(
      'canDeleteFlowboardComments',
      'canModerateFlowboardComments',
    );
    const service = new TenantFlowboardsService(
      {
        query: jest.fn().mockResolvedValue([]),
        transaction: (operation: any) => operation(manager),
      } as any,
      request('tenant_a', 'employee'),
      realtimeAuthority() as any,
      capabilities as any,
    );

    await expect(service.deleteComment(RECORD_B, USER_B)).resolves.toEqual({ id: USER_B, deleted: true });
    expect(capabilities.has).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_A }),
      'canModerateFlowboardComments',
    );
    expect(manager.query.mock.calls.some(([sql, params]) =>
      String(sql).includes('flowboard_audit') && params?.[2] === 'flowboard_comment_deleted')).toBe(true);
  });

  it('publishes a Flowboard save only to owner/collaborators on tenant-qualified channels', async () => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ id: RECORD_B, owner_user_id: USER_A, collaborator_permission: null }])
        .mockResolvedValueOnce([{ id: RECORD_B, optimistic_version: 2 }])
        .mockResolvedValueOnce([]),
    };
    const query = jest.fn().mockResolvedValue([{ user_id: USER_A }, { user_id: USER_B }]);
    const transaction = jest.fn(async (operation: any) => operation(manager));
    const realtime = { notifyUser: jest.fn().mockResolvedValue(undefined) };
    const capabilities = capabilityAuthority();
    const service = new TenantFlowboardsService({ query, transaction } as any, request(), realtime as any, capabilities as any);

    await expect(service.save(RECORD_B, { nodes: [], edges: [], viewport: {}, optimisticVersion: 1 }))
      .resolves.toEqual({ id: RECORD_B, optimistic_version: 2 });
    expect(realtime.notifyUser).toHaveBeenCalledTimes(2);
    expect(realtime.notifyUser).toHaveBeenCalledWith(
      USER_A,
      expect.objectContaining({ type: 'flowboard.graph.saved', boardId: RECORD_B }),
      'tenant_a',
    );
    expect(realtime.notifyUser.mock.calls.every((call: any[]) => call[2] === 'tenant_a')).toBe(true);
    expect(capabilities.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canUpdateFlowboards');
  });

  it('binds an idempotency key to tenant scope, request hash and actor', async () => {
    let stored: any;
    const operation = jest.fn().mockResolvedValue({ id: RECORD_B });
    const manager = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO') && sql.includes('universal_idempotency')) {
          stored ||= { request_hash: params[2], actor_user_id: params[3], response: null };
          return [];
        }
        if (sql.includes('SELECT request_hash')) return [stored];
        if (sql.includes('UPDATE') && sql.includes('universal_idempotency')) {
          stored.response = JSON.parse(params[2]);
          return [];
        }
        return [];
      }),
    } as any;
    const first = await withTenantIdempotency(manager, 'tenant_a', 'message:create', 'same-key', { body: 'x' }, USER_A, operation);
    const replay = await withTenantIdempotency(manager, 'tenant_a', 'message:create', 'same-key', { body: 'x' }, USER_A, operation);
    expect(first).toEqual(replay);
    expect(operation).toHaveBeenCalledTimes(1);
    await expect(withTenantIdempotency(manager, 'tenant_a', 'message:create', 'same-key', { body: 'x' }, USER_B, operation))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('fails LiveKit OFF and identity spoof before any DB or SDK access', async () => {
    const previous = { ...process.env };
    const query = jest.fn();
    const transaction = jest.fn();
    const service = new TenantLivekitService({ query, transaction } as any, request(), capabilityAuthority() as any);
    try {
      process.env.LIVEKIT_ENABLED = 'false';
      await expect(service.token({ conversationId: RECORD_B })).rejects.toBeInstanceOf(ForbiddenException);
      process.env.LIVEKIT_ENABLED = 'true';
      process.env.LIVEKIT_URL = 'wss://livekit.example.test';
      process.env.LIVEKIT_API_KEY = 'test-key';
      process.env.LIVEKIT_API_SECRET = 'test-secret';
      await expect(service.token({ conversationId: RECORD_B, userId: USER_B })).rejects.toBeInstanceOf(BadRequestException);
      expect(query).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      process.env = previous;
    }
  });

  it('denies LiveKit capability before participant lookup when the provider is enabled', async () => {
    const previous = { ...process.env };
    const query = jest.fn();
    const capability = capabilityAuthority(false);
    const service = new TenantLivekitService({ query, transaction: jest.fn() } as any, request(), capability as any);
    try {
      process.env.LIVEKIT_ENABLED = 'true';
      process.env.LIVEKIT_URL = 'wss://livekit.example.test';
      process.env.LIVEKIT_API_KEY = 'test-key';
      process.env.LIVEKIT_API_SECRET = 'test-secret';
      await expect(service.token({ conversationId: RECORD_B })).rejects.toBeInstanceOf(ForbiddenException);
      expect(capability.require).toHaveBeenCalledWith(expect.objectContaining({ schema: 'tenant_a', id: USER_A }), 'canViewProjects');
      expect(query).not.toHaveBeenCalled();
    } finally {
      process.env = previous;
    }
  });

  it('projects the Doflow Bonus wallet and movements exclusively from point_ledger', async () => {
    const period = { id: RECORD_B, label: '2026-08', starts_at: '2026-08-01', ends_at: '2026-08-31', status: 'open' };
    const seed = {
      id: USER_B,
      user_id: USER_A,
      amount: '125',
      state: 'approved',
      reason: 'Seed punti operativo',
      effective_at: '2026-08-20T10:00:00.000Z',
    };
    const query = jest.fn(async (sql: string, _params?: any[]) => {
      if (sql.includes('FROM "doflow".users')) return [{ id: USER_A }];
      if (sql.includes('INSERT INTO "doflow".bonus_periods')) return [period];
      if (sql.includes('SELECT $1::uuid AS user_id')) {
        return [{ user_id: USER_A, authoritative_balance: '125', provisional_points: '20', reserved_points: '0' }];
      }
      if (sql.includes('SELECT l.*') && sql.includes('"doflow".point_ledger')) return [seed];
      if (sql.includes('FROM "doflow".bonus_requests')) return [];
      if (sql.includes('FROM "doflow".bonus_periods')) return [period];
      if (sql.includes('FROM "doflow".point_policies')) {
        return [{ id: RECORD_B, name: 'Policy operativa', current_version: 3, formula: { bonus: { pointEuroCents: 10 } } }];
      }
      return [];
    });
    const capabilities = {
      require: jest.fn().mockResolvedValue(undefined),
      has: jest.fn().mockResolvedValue(false),
    };
    const service = new TenantBonusService({ query } as any, request('doflow', 'owner'), capabilities as any);

    await expect(service.state({})).resolves.toMatchObject({
      wallet: { balance: 125, authoritative_balance: 125, provisional_points: 20 },
      ledger: [expect.objectContaining({ id: USER_B, reason: 'Seed punti operativo' })],
      policy: { rules: { pointEuroCents: 10 } },
    });
    expect(ensureDoflowAutomationPerformanceTables).toHaveBeenCalledWith(expect.anything(), 'doflow');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('"doflow".bonus_wallets'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('"doflow".bonus_ledger'))).toBe(false);
  });

  it('get-or-creates the current open Bonus period idempotently for a fresh tenant', async () => {
    const period = { id: RECORD_B, label: '2026-08', starts_at: '2026-08-01', ends_at: '2026-08-31', status: 'open' };
    const query = jest.fn(async (sql: string, _params?: any[]) => {
      if (sql.includes('FROM "tenant_a".users')) return [{ id: USER_A }];
      if (sql.includes('INSERT INTO "tenant_a".bonus_periods')) return [period];
      if (sql.includes('INSERT INTO "tenant_a".bonus_wallets')) return [];
      if (sql.includes('FROM "tenant_a".bonus_wallets')) return [{ user_id: USER_A, balance: '0' }];
      if (sql.includes('FROM "tenant_a".bonus_periods')) return [period];
      return [];
    });
    const capabilities = {
      require: jest.fn().mockResolvedValue(undefined),
      has: jest.fn().mockResolvedValue(false),
    };
    const service = new TenantBonusService({ query } as any, request(), capabilities as any);

    const first = await service.state({});
    const reload = await service.state({});
    expect(first.periods).toEqual([period]);
    expect(reload.periods).toEqual([period]);
    const upserts = query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO "tenant_a".bonus_periods'));
    expect(upserts).toHaveLength(2);
    expect(upserts[0][0]).toContain('ON CONFLICT (starts_at,ends_at) DO UPDATE');
    expect(upserts[0][1]).toEqual(expect.arrayContaining([expect.stringMatching(/^\d{4}-\d{2}$/)]));
  });

  it('records generic adjustments as provisional and replays them idempotently', async () => {
    let stored: any;
    const period = { id: RECORD_B, status: 'open' };
    const ledger = { id: USER_B, user_id: USER_A, period_id: RECORD_B, amount: 15, entry_type: 'provisional' };
    const manager = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO "tenant_a".bonus_periods')) return [period];
        if (sql.includes('INSERT INTO') && sql.includes('universal_idempotency')) {
          stored ||= { request_hash: params[2], actor_user_id: params[3], response: null };
          return [];
        }
        if (sql.includes('SELECT request_hash')) return [stored];
        if (sql.includes('INSERT INTO "tenant_a".bonus_ledger')) return [ledger];
        if (sql.includes('UPDATE "tenant_a".universal_idempotency')) {
          stored.response = JSON.parse(params[2]);
          return [];
        }
        return [];
      }),
    };
    const query = jest.fn().mockResolvedValue([{ id: USER_A }]);
    const service = new TenantBonusService(
      { query, transaction: (operation: any) => operation(manager) } as any,
      request(),
      capabilityAuthority() as any,
    );

    const first = await service.adjustment({ userId: USER_A, points: 15, reason: 'Premio' }, 'adjust-august');
    const replay = await service.adjustment({ userId: USER_A, points: 15, reason: 'Premio' }, 'adjust-august');
    expect(first).toEqual(ledger);
    expect(replay).toEqual(ledger);
    const inserts = manager.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO "tenant_a".bonus_ledger'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0][0]).toContain("'provisional'");
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('bonus_wallets'))).toBe(false);
  });

  it('writes Doflow Bonus adjustments to point_ledger and never to a parallel Bonus ledger', async () => {
    let stored: any;
    const period = { id: RECORD_B, status: 'open' };
    const pointEntry = { id: USER_B, user_id: USER_A, amount: 7, state: 'adjustment' };
    const manager = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO "doflow".bonus_periods')) return [period];
        if (sql.includes('INSERT INTO') && sql.includes('universal_idempotency')) {
          stored ||= { request_hash: params[2], actor_user_id: params[3], response: null };
          return [];
        }
        if (sql.includes('SELECT request_hash')) return [stored];
        if (sql.includes('FROM "doflow".point_policies')) return [{ id: RECORD_B, current_version: 2, formula: {} }];
        if (sql.includes('INSERT INTO "doflow".point_ledger')) return [pointEntry];
        if (sql.includes('UPDATE "doflow".universal_idempotency')) {
          stored.response = JSON.parse(params[2]);
          return [];
        }
        return [];
      }),
    };
    const query = jest.fn().mockResolvedValue([{ id: USER_A }]);
    const service = new TenantBonusService(
      { query, transaction: (operation: any) => operation(manager) } as any,
      request('doflow'),
      capabilityAuthority() as any,
    );

    await expect(service.adjustment({ userId: USER_A, points: 7, reason: 'Rettifica' }, 'doflow-adjust'))
      .resolves.toEqual(pointEntry);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO "doflow".point_ledger'))).toBe(true);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('"doflow".bonus_ledger'))).toBe(false);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('"doflow".bonus_wallets'))).toBe(false);
  });

  it('consolidates Doflow provisional points in the authoritative point_ledger', async () => {
    let stored: any;
    const manager = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO') && sql.includes('universal_idempotency')) {
          stored ||= { request_hash: params[2], actor_user_id: params[3], response: null };
          return [];
        }
        if (sql.includes('SELECT request_hash')) return [stored];
        if (sql.includes('FROM "doflow".bonus_periods')) {
          return [{ id: RECORD_B, status: 'open', starts_at: '2026-08-01', ends_at: '2026-08-31' }];
        }
        if (sql.includes('UPDATE "doflow".point_ledger')) {
          return [{ id: USER_B, user_id: USER_A, amount: 20 }];
        }
        if (sql.includes('UPDATE "doflow".universal_idempotency')) {
          stored.response = JSON.parse(params[2]);
          return [];
        }
        return [];
      }),
    };
    const service = new TenantBonusService(
      { query: jest.fn(), transaction: (operation: any) => operation(manager) } as any,
      request('doflow'),
      capabilityAuthority() as any,
    );

    await expect(service.consolidatePeriod({ periodId: RECORD_B, reason: 'Chiusura' }, 'close-doflow-august'))
      .resolves.toEqual({ periodId: RECORD_B, status: 'locked', consolidatedEntries: 1, alreadyConsolidated: false });
    const consolidation = manager.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE "doflow".point_ledger'));
    expect(consolidation?.[0]).toContain("SET state='approved'");
    expect(consolidation?.[0]).toContain("WHERE state='provisional'");
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('"doflow".bonus_ledger'))).toBe(false);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('"doflow".bonus_wallets'))).toBe(false);
  });

  it('prevents self-approval of Bonus requests inside the tenant transaction', async () => {
    const manager = {
      query: jest.fn().mockResolvedValueOnce([{
        id: RECORD_B,
        user_id: USER_A,
        status: 'pending',
        points: 10,
        period_id: null,
      }]),
    };
    const transaction = jest.fn(async (operation: any) => operation(manager));
    const capabilities = capabilityAuthority();
    const service = new TenantBonusService({ query: jest.fn(), transaction } as any, request(), capabilities as any);

    await expect(service.decide(RECORD_B, 'approved', { reason: 'self' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.query.mock.calls[0][0]).toContain('"tenant_a".bonus_requests');
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('bonus_ledger'))).toBe(false);
    expect(capabilities.require).toHaveBeenCalledWith(expect.objectContaining({ id: USER_A }), 'canManagePointPolicies');
  });

  it('enforces the active Bonus policy minimum before reserving points', async () => {
    const period = { id: RECORD_B, status: 'open' };
    const manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO "doflow".bonus_periods')) return [period];
        if (sql.includes('SELECT 1 FROM "doflow".bonus_periods')) return [{ exists: true }];
        if (sql.includes('FROM "doflow".point_policies')) {
          return [{ formula: { bonus: { minimumRequestPoints: 25 } } }];
        }
        throw new Error(`Unexpected query after minimum validation: ${sql}`);
      }),
    };
    const transaction = jest.fn(async (operation: any) => operation(manager));
    const service = new TenantBonusService(
      { query: jest.fn(), transaction } as any,
      request('doflow'),
      capabilityAuthority() as any,
    );

    await expect(service.requestBonus({ points: 10, reason: 'Premio sotto soglia' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('bonus_requests (user_id'))).toBe(false);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('point_ledger WHERE user_id'))).toBe(false);
  });

  it('consolidates a Bonus period atomically, tenant-scoped and idempotently', async () => {
    let stored: any;
    const manager = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO') && sql.includes('universal_idempotency')) {
          stored ||= { request_hash: params[2], actor_user_id: params[3], response: null };
          return [];
        }
        if (sql.includes('SELECT request_hash')) return [stored];
        if (sql.includes('FROM "tenant_a".bonus_periods')) return [{ id: RECORD_B, status: 'open' }];
        if (sql.includes('UPDATE "tenant_a".bonus_ledger')) {
          return [
            { id: USER_A, user_id: USER_A, amount: 10 },
            { id: USER_B, user_id: USER_A, amount: 5 },
          ];
        }
        if (sql.includes('UPDATE "tenant_a".universal_idempotency')) {
          stored.response = JSON.parse(params[2]);
          return [];
        }
        return [];
      }),
    };
    const transaction = jest.fn(async (operation: any) => operation(manager));
    const capabilities = capabilityAuthority();
    const service = new TenantBonusService({ query: jest.fn(), transaction } as any, request(), capabilities as any);

    const first = await service.consolidatePeriod({ periodId: RECORD_B, reason: 'Chiusura mensile' }, 'close-august');
    const replay = await service.consolidatePeriod({ periodId: RECORD_B, reason: 'Chiusura mensile' }, 'close-august');
    expect(first).toEqual({ periodId: RECORD_B, status: 'locked', consolidatedEntries: 2, alreadyConsolidated: false });
    expect(replay).toEqual(first);
    expect(manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE "tenant_a".bonus_ledger'))).toHaveLength(1);
    expect(manager.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO "tenant_a".bonus_wallets'))).toHaveLength(1);
    expect(manager.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO "tenant_a".bonus_wallets'))?.[1])
      .toEqual([USER_A, 15]);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('tenant_b'))).toBe(false);
    expect(manager.query.mock.calls.some(([sql]) => String(sql).includes("'bonus_period_consolidated'"))).toBe(true);
    expect(capabilities.require).toHaveBeenCalledWith(expect.objectContaining({ schema: 'tenant_a' }), 'canManagePointPolicies');
  });

  it('denies LiveKit token/end for a non-member in tenant A without leaking tenant B', async () => {
    const previous = { ...process.env };
    try {
      process.env.LIVEKIT_ENABLED = 'true';
      process.env.LIVEKIT_URL = 'wss://livekit.example.test';
      process.env.LIVEKIT_API_KEY = 'test-key';
      process.env.LIVEKIT_API_SECRET = 'test-secret';
      const query = jest.fn().mockResolvedValue([]);
      const manager = { query: jest.fn().mockResolvedValue([]) };
      const transaction = jest.fn(async (operation: any) => operation(manager));
      const service = new TenantLivekitService({ query, transaction } as any, request(), capabilityAuthority() as any);
      await expect(service.token({ conversationId: RECORD_B })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.end(RECORD_B)).rejects.toBeInstanceOf(ForbiddenException);
      expect([...query.mock.calls, ...manager.query.mock.calls].every(([sql]) => !String(sql).includes('tenant_b'))).toBe(true);
    } finally {
      process.env = previous;
    }
  });

  it('ends an authorized LiveKit call atomically and writes the tenant audit', async () => {
    const previous = { ...process.env };
    const deleteRoom = jest.spyOn(RoomServiceClient.prototype, 'deleteRoom').mockResolvedValue(undefined);
    try {
      process.env.LIVEKIT_ENABLED = 'true';
      process.env.LIVEKIT_URL = 'wss://livekit.example.test';
      process.env.LIVEKIT_API_KEY = 'test-key';
      process.env.LIVEKIT_API_SECRET = 'test-secret';
      const manager = {
        query: jest.fn()
          .mockResolvedValueOnce([{
            id: RECORD_B, conversation_id: USER_B, created_by: USER_A,
            participant_role: 'member', status: 'active', ended_at: null,
            room_key: 'tenant-a-conversation-room',
          }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      };
      const transaction = jest.fn(async (operation: any) => operation(manager));
      const service = new TenantLivekitService({ query: jest.fn(), transaction } as any, request(), capabilityAuthority() as any);
      await expect(service.end(RECORD_B)).resolves.toEqual({ callId: RECORD_B, conversationId: USER_B, ended: true });
      expect(deleteRoom).toHaveBeenCalledWith('tenant-a-conversation-room');
      expect(manager.query.mock.calls[1][0]).toContain("status='ended'");
      expect(deleteRoom.mock.invocationCallOrder[0])
        .toBeLessThan(manager.query.mock.invocationCallOrder[1]);
      expect(manager.query.mock.calls[2][0]).toContain("'call_ended'");
      expect(manager.query.mock.calls.every(([sql]) => String(sql).includes('"tenant_a"'))).toBe(true);
    } finally {
      deleteRoom.mockRestore();
      process.env = previous;
    }
  });

  it('fails closed when LiveKit cannot terminate the provider room', async () => {
    const previous = { ...process.env };
    const deleteRoom = jest.spyOn(RoomServiceClient.prototype, 'deleteRoom')
      .mockRejectedValue(new Error('provider unavailable'));
    try {
      process.env.LIVEKIT_ENABLED = 'true';
      process.env.LIVEKIT_URL = 'wss://livekit.example.test';
      process.env.LIVEKIT_API_KEY = 'test-key';
      process.env.LIVEKIT_API_SECRET = 'test-secret';
      const manager = {
        query: jest.fn().mockResolvedValueOnce([{
          id: RECORD_B,
          conversation_id: USER_B,
          created_by: USER_A,
          participant_role: 'member',
          status: 'active',
          ended_at: null,
          room_key: 'tenant-a-conversation-room',
        }]),
      };
      const transaction = jest.fn(async (operation: any) => operation(manager));
      const service = new TenantLivekitService(
        { query: jest.fn(), transaction } as any,
        request(),
        capabilityAuthority() as any,
      );

      await expect(service.end(RECORD_B)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(deleteRoom).toHaveBeenCalledWith('tenant-a-conversation-room');
      expect(manager.query).toHaveBeenCalledTimes(1);
      expect(manager.query.mock.calls.some(([sql]) => String(sql).includes("status='ended'"))).toBe(false);
      expect(manager.query.mock.calls.some(([sql]) => String(sql).includes("'call_ended'"))).toBe(false);
    } finally {
      deleteRoom.mockRestore();
      process.env = previous;
    }
  });

  it('returns provider_unconfigured without manufacturing a Company Intelligence report', async () => {
    const query = jest.fn();
    const enrichment = { isConfigured: jest.fn().mockReturnValue(false), lookupCompany: jest.fn() };
    const service = new TenantCompanyIntelligenceService({ query } as any, enrichment as any, request('tenant_a', 'manager'), capabilityAuthority() as any);
    await expect(service.analyze({ domain: 'example.com' })).resolves.toEqual({
      provider: 'apollo', configured: false, status: 'provider_unconfigured', report: null,
    });
    expect(enrichment.lookupCompany).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps legacy Sales Intelligence endpoints platform-superadmin only', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SalesIntelligenceController) || [];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PlatformSuperadminGuard]));
    const guard = new PlatformSuperadminGuard();
    const context = (user: any) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;
    expect(() => guard.canActivate(context({ role: 'owner', tenantId: 'tenant_a', authStage: 'FULL' })))
      .toThrow(ForbiddenException);
    expect(guard.canActivate(context({ role: 'superadmin', tenantId: 'public', authStage: 'FULL' }))).toBe(true);
  });

  it('uses tenant-qualified notification channels only', async () => {
    const subscriber = { psubscribe: jest.fn().mockResolvedValue(undefined), on: jest.fn() };
    const publisher = { publish: jest.fn().mockResolvedValue(1) };
    const rootClient = { duplicate: jest.fn().mockReturnValueOnce(publisher).mockReturnValueOnce(subscriber) };
    const service = new NotificationsService({ getClient: () => rootClient } as any);
    await service.registerHandler(jest.fn());
    expect(subscriber.psubscribe).toHaveBeenCalledWith('tenant:*');
    expect(subscriber.psubscribe).toHaveBeenCalledWith('tenant-user:*');
    expect(subscriber.psubscribe).not.toHaveBeenCalledWith('user:*');
    await service.notifyUserOrThrow(USER_A, { ok: true }, 'tenant_a');
    expect(publisher.publish).toHaveBeenCalledWith('tenant-user:tenant_a:' + USER_A, JSON.stringify({ ok: true }));
    await expect(service.notifyUserOrThrow(USER_A, {}, '' as any)).rejects.toThrow();
  });

  it('migration provisions every registered non-public tenant and never runs destructive down SQL', async () => {
    const query = jest.fn().mockResolvedValue([{ schema_name: 'tenant_a' }, { schema_name: 'tenant_b' }]);
    const runner = { query } as any;
    const migration = new CreateUniversalTenantFeatures1850000000000();
    await migration.up(runner);
    expect(ensureTenantUniversalFeatureTables).toHaveBeenNthCalledWith(1, runner, 'tenant_a');
    expect(ensureTenantUniversalFeatureTables).toHaveBeenNthCalledWith(2, runner, 'tenant_b');
    query.mockClear();
    await migration.down(runner);
    expect(query).not.toHaveBeenCalled();
  });
});
