import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Logger } from '@nestjs/common';
import { PublicLeadIntakeDto } from './public-lead-intake.dto';
import { PublicLeadIntakeService, PublicLeadRateLimitException } from './public-lead-intake.service';
import { ensureLeadIntakeSubmissionsTable } from './public-lead-intake-schema';
import { ensureTenantCrmCoreTables } from '../tenant/tenant-crm-schema';

jest.mock('./public-lead-intake-schema', () => ({
  ensureLeadIntakeSubmissionsTable: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../tenant/tenant-crm-schema', () => ({
  ensureTenantCrmCoreTables: jest.fn().mockResolvedValue(undefined),
}));

const validPayload = {
  submission_id: '11111111-1111-4111-8111-111111111111',
  form_version: 'doflow-contact-v1',
  project_type: 'Sito vetrina',
  goals: ['Ricevere più contatti'],
  timeline: 'Sto valutando',
  name: 'Mario Rossi',
  company: 'Acme',
  email: 'MARIO@EXAMPLE.COM',
  phone: '+39 333 1234567',
  province: 'MI',
  privacy_accepted: true,
  website: '',
  landing_url: 'https://doflow.it/contatti',
  referrer: 'https://google.com/',
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'summer',
  utm_content: 'hero',
  utm_term: 'crm',
  completion_seconds: 120,
};

function dto(input: Record<string, unknown> = {}) {
  return plainToInstance(PublicLeadIntakeDto, { ...validPayload, ...input });
}

function makeRedis(minute = 1, day = 1, minuteTtl = 60, dayTtl = 86400) {
  const client = {
    incr: jest.fn()
      .mockResolvedValueOnce(minute)
      .mockResolvedValueOnce(day),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn()
      .mockResolvedValueOnce(minuteTtl)
      .mockResolvedValueOnce(dayTtl),
  };
  return {
    client,
    getClient: () => client,
  };
}

function makeRunner(query: jest.Mock) {
  const wrappedQuery = jest.fn((sql: string, params?: unknown[]) => {
    if (String(sql).includes('pg_advisory_xact_lock')) return Promise.resolve([]);
    return query(sql, params);
  });
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query: wrappedQuery,
  };
}

function makeService(options: {
  dsQuery?: jest.Mock;
  runnerQuery?: jest.Mock;
  redis?: any;
  tenantNotifications?: any;
  realtime?: any;
} = {}) {
  const dsQuery = options.dsQuery || jest.fn().mockResolvedValue([
    { id: 'tenant-1', slug: 'doflow', schema_name: 'doflow', is_active: true },
  ]);
  const runner = makeRunner(options.runnerQuery || jest.fn());
  const dataSource = {
    query: dsQuery,
    createQueryRunner: jest.fn(() => runner),
  };
  const tenantNotifications = options.tenantNotifications || { createNotification: jest.fn().mockResolvedValue({ created: true }) };
  const realtime = options.realtime || { notifyTenant: jest.fn().mockResolvedValue(undefined) };
  const service = new PublicLeadIntakeService(
    dataSource as any,
    (options.redis || makeRedis()) as any,
    tenantNotifications,
    realtime,
  );
  return { service, dataSource, dsQuery, runner, tenantNotifications, realtime };
}

describe('PublicLeadIntakeDto', () => {
  it('accetta un payload valido e normalizza email e trim', async () => {
    const instance = dto({ name: ' Mario Rossi ', email: 'MARIO@EXAMPLE.COM ' });
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
    expect(instance.email).toBe('mario@example.com');
    expect(instance.name).toBe('Mario Rossi');
  });

  it.each([
    ['project type non valido', { project_type: 'App custom' }],
    ['piu di due goals', { goals: ['Ricevere più contatti', 'Vendere online', 'Altro'] }],
    ['timeline non valida', { timeline: 'Domani' }],
    ['email non valida', { email: 'not-an-email' }],
    ['phone non valido', { phone: 'abc' }],
  ])('rifiuta %s', async (_label, override) => {
    const errors = await validate(dto(override));
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('PublicLeadIntakeService security', () => {
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, NODE_ENV: 'test', CORS_PUBLIC_ORIGINS: 'https://doflow.it, https://www.doflow.it' };
  });

  afterAll(() => {
    process.env = env;
  });

  it('rifiuta privacy false', async () => {
    const { service } = makeService();
    await expect(service.submit('doflow', dto({ privacy_accepted: false }), { origin: 'https://doflow.it', ip: '1.2.3.4' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rifiuta origin non consentito', async () => {
    const { service } = makeService();
    await expect(service.submit('doflow', dto(), { origin: 'https://evil.example', ip: '1.2.3.4' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rifiuta origin mancante in produzione', async () => {
    process.env.NODE_ENV = 'production';
    const { service } = makeService();
    await expect(service.submit('doflow', dto(), { origin: null, ip: '1.2.3.4' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rifiuta tenant non consentito', async () => {
    process.env.PUBLIC_LEAD_INTAKE_TENANTS = 'doflow';
    const { service } = makeService();
    await expect(service.submit('other', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rifiuta tenant inesistente o inattivo', async () => {
    const { service } = makeService({ dsQuery: jest.fn().mockResolvedValue([]) });
    await expect(service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deriva lo schema tenant dal DB e passa da safeSchema', async () => {
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'contact-1' }])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockResolvedValueOnce([]);
    const { service } = makeService({ runnerQuery });

    await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });

    expect(ensureTenantCrmCoreTables).toHaveBeenCalledWith(expect.anything(), 'doflow');
    expect(ensureLeadIntakeSubmissionsTable).toHaveBeenCalledWith(expect.anything(), 'doflow');
  });

  it('applica rate limit IP al minuto', async () => {
    const { service } = makeService({ redis: makeRedis(6, 1, 37) });
    await expect(service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' }))
      .rejects.toMatchObject({ retryAfter: 37 });
  });

  it('applica rate limit giornaliero', async () => {
    const { service } = makeService({ redis: makeRedis(5, 31, 60, 4321) });
    await expect(service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' }))
      .rejects.toMatchObject({ retryAfter: 4321 });
  });

  it('usa TTL corretti per minuto e giorno', async () => {
    const redis = makeRedis(1, 1);
    const { service } = makeService({ redis });
    await service.submit('doflow', dto({ website: 'bot' }), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    expect(redis.client.expire).toHaveBeenCalledWith(expect.stringMatching(/:m$/), 60);
    expect(redis.client.expire).toHaveBeenCalledWith(expect.stringMatching(/:d$/), 86400);
  });

  it('separa IP diversi nelle chiavi rate limit', async () => {
    const keys: string[] = [];
    const redis = {
      getClient: () => ({
        incr: jest.fn(async (key: string) => { keys.push(key); return 1; }),
        expire: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(60),
      }),
    };
    const { service } = makeService({ redis });
    await service.submit('doflow', dto({ website: 'bot' }), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    await service.submit('doflow', dto({ website: 'bot', submission_id: '22222222-2222-4222-8222-222222222222' }), { origin: 'https://doflow.it', ip: '5.6.7.8' });
    expect(new Set(keys.filter((key) => key.endsWith(':m'))).size).toBe(2);
    expect(keys.join(' ')).not.toContain('1.2.3.4');
    expect(keys.join(' ')).not.toContain('5.6.7.8');
  });

  it('usa fallback locale quando Redis non e disponibile', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const redis = {
      getClient: () => ({
        incr: jest.fn().mockRejectedValue(new Error('redis down')),
      }),
    };
    const { service } = makeService({ redis });
    for (let i = 0; i < 5; i += 1) {
      await service.submit('doflow', dto({ website: 'bot', submission_id: `11111111-1111-4111-8111-11111111111${i}` }), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    }
    await expect(service.submit('doflow', dto({ website: 'bot', submission_id: '11111111-1111-4111-8111-111111111119' }), { origin: 'https://doflow.it', ip: '1.2.3.4' }))
      .rejects.toBeInstanceOf(PublicLeadRateLimitException);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('1.2.3.4');
    warn.mockRestore();
  });

  it('pota entry locali scadute nel fallback Redis down', () => {
    const { service } = makeService();
    const local = (service as any).localRateLimit as Map<string, { minuteCount: number; minuteReset: number; dayCount: number; dayReset: number }>;
    local.set('expired', { minuteCount: 1, minuteReset: Date.now() - 1000, dayCount: 1, dayReset: Date.now() - 1000 });

    (service as any).assertLocalRateLimit('fresh-hash');

    expect(local.has('expired')).toBe(false);
    expect(local.has('fresh-hash')).toBe(true);
    expect(Array.from(local.keys()).join(' ')).not.toContain('1.2.3.4');
  });

  it('neutralizza honeypot senza creare CRM', async () => {
    const { service, dataSource } = makeService();
    const result = await service.submit('doflow', dto({ website: 'filled' }), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    expect(result).toEqual(expect.objectContaining({ success: true, duplicate: false }));
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('neutralizza compilazione troppo rapida senza bloccare utenti reali', async () => {
    const { service, dataSource } = makeService();
    const result = await service.submit('doflow', dto({ completion_seconds: 1 }), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    expect(result.success).toBe(true);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});

describe('PublicLeadIntakeService CRM transaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.CORS_PUBLIC_ORIGINS = 'https://doflow.it';
    delete process.env.PUBLIC_LEAD_INTAKE_TENANTS;
  });

  it('crea azienda, contatto, lead, opportunity, activity e mapping', async () => {
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'contact-1' }])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockResolvedValueOnce([]);
    const { service, runner } = makeService({ runnerQuery });

    const response = await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });

    expect(response).toEqual({ success: true, reference: validPayload.submission_id, duplicate: false, message: 'Richiesta ricevuta correttamente.' });
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), ['public_lead_contact:mario@example.com']);
    expect(runnerQuery.mock.calls.map(([sql]) => sql)).toEqual(expect.arrayContaining([
      expect.stringContaining('INSERT INTO "doflow".companies'),
      expect.stringContaining('INSERT INTO "doflow".contacts'),
      expect.stringContaining('INSERT INTO "doflow".leads'),
      expect.stringContaining('INSERT INTO "doflow".opportunities'),
      expect.stringContaining('INSERT INTO "doflow".commercial_activities'),
      expect.stringContaining('INSERT INTO "doflow".lead_intake_submissions'),
    ]));
  });

  it('supporta azienda assente senza creare company', async () => {
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'contact-1' }])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockResolvedValueOnce([]);
    const { service } = makeService({ runnerQuery });
    await service.submit('doflow', dto({ company: undefined }), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    expect(runnerQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO "doflow".companies'))).toBe(false);
  });

  it('riusa contatto esistente e non sovrascrive dati curati', async () => {
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([{ id: 'contact-1', phone: '+3902', company_id: 'company-old' }])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockResolvedValueOnce([]);
    const { service } = makeService({ runnerQuery });
    await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    expect(runnerQuery.mock.calls.some(([sql]) => String(sql).startsWith('UPDATE "doflow".contacts'))).toBe(false);
  });

  it('compila dati mancanti sul contatto esistente senza sovrascrivere gli altri', async () => {
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([{ id: 'contact-1', phone: null, company_id: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockResolvedValueOnce([]);
    const { service } = makeService({ runnerQuery });
    await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    expect(runnerQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE "doflow".contacts'), expect.arrayContaining(['+39 333 1234567', 'company-1', 'contact-1']));
  });

  it('duplicate submission idempotente non crea duplicati CRM', async () => {
    const runnerQuery = jest.fn().mockResolvedValueOnce([{ lead_id: 'lead-1', opportunity_id: 'opportunity-1' }]);
    const { service, runner } = makeService({ runnerQuery });
    const response = await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    expect(response.duplicate).toBe(true);
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runnerQuery).toHaveBeenCalledTimes(1);
  });

  it('gestisce submit concorrente con unique constraint senza 500 pubblico', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
    const dsQuery = jest.fn()
      .mockResolvedValueOnce([{ id: 'tenant-1', slug: 'doflow', schema_name: 'doflow', is_active: true }])
      .mockResolvedValueOnce([{ lead_id: 'lead-existing', opportunity_id: 'opportunity-existing' }]);
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'contact-1' }])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockRejectedValueOnce(uniqueViolation);
    const tenantNotifications = { createNotification: jest.fn().mockResolvedValue({ created: true }) };
    const { service, runner } = makeService({ dsQuery, runnerQuery, tenantNotifications });

    const response = await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });

    expect(response).toEqual(expect.objectContaining({ success: true, duplicate: true }));
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(tenantNotifications.createNotification).not.toHaveBeenCalled();
  });

  it('rollbacka quando la transazione fallisce', async () => {
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('db down'));
    const { service, runner } = makeService({ runnerQuery });
    await expect(service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' })).rejects.toThrow('Richiesta non completata');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });

  it('notifica owner e admin post-commit con fingerprint stabile', async () => {
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'contact-1' }])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockResolvedValueOnce([]);
    const { service, tenantNotifications, realtime } = makeService({ runnerQuery });
    await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    await new Promise(process.nextTick);
    expect(tenantNotifications.createNotification).toHaveBeenCalledWith('doflow', expect.objectContaining({
      recipient_role: 'owner',
      type: 'website_lead_received',
      link_url: '/pipeline?stage=new&opportunity=opportunity-1',
      fingerprint: `website_lead_received:${validPayload.submission_id}:role:owner`,
    }));
    expect(tenantNotifications.createNotification).toHaveBeenCalledWith('doflow', expect.objectContaining({ recipient_role: 'admin' }));
    expect(realtime.notifyTenant).toHaveBeenCalledWith('tenant-1', expect.not.objectContaining({ phone: expect.anything(), email: expect.anything() }));
  });

  it('fallimento notifiche non rollbacka il lead gia creato e non logga email o telefono', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'contact-1' }])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockResolvedValueOnce([]);
    const tenantNotifications = { createNotification: jest.fn().mockRejectedValue(new Error('notify down')) };
    const { service, runner } = makeService({ runnerQuery, tenantNotifications });
    const response = await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    await new Promise(process.nextTick);
    expect(response.success).toBe(true);
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).not.toContain('mario@example.com');
    expect(logged).not.toContain('+39 333');
    warn.mockRestore();
  });

  it('response pubblica non espone ID CRM o dati personali', async () => {
    const runnerQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'company-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'contact-1' }])
      .mockResolvedValueOnce([{ id: 'lead-1' }])
      .mockResolvedValueOnce([{ id: 'opportunity-1' }])
      .mockResolvedValueOnce([{ id: 'activity-1' }])
      .mockResolvedValueOnce([]);
    const { service } = makeService({ runnerQuery });
    const response = await service.submit('doflow', dto(), { origin: 'https://doflow.it', ip: '1.2.3.4' });
    expect(JSON.stringify(response)).not.toContain('lead-1');
    expect(JSON.stringify(response)).not.toContain('opportunity-1');
    expect(JSON.stringify(response)).not.toContain('mario@example.com');
    expect(JSON.stringify(response)).not.toContain('+39');
  });
});
