import { TenantCustomerInboxMailService } from './tenant-customer-inbox-mail.service';
import { ImapFlow } from 'imapflow';

jest.mock('./tenant-customer-inbox-mail-schema', () => ({
  ensureTenantCustomerInboxMailTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('imapflow', () => ({ ImapFlow: jest.fn() }));

describe('TenantCustomerInboxMailService', () => {
  const actorId = '11111111-1111-4111-8111-111111111111';
  const companyId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CUSTOMER_INBOX_MAIL_TENANTS = 'tenant_mail';
  });

  afterEach(() => {
    delete process.env.CUSTOMER_INBOX_MAIL_TENANTS;
    for (const key of ['CUSTOMER_INBOX_IMAP_TENANT_SCHEMA', 'CUSTOMER_INBOX_IMAP_HOST', 'CUSTOMER_INBOX_IMAP_PORT', 'CUSTOMER_INBOX_IMAP_SECURE', 'CUSTOMER_INBOX_IMAP_USER', 'CUSTOMER_INBOX_IMAP_PASSWORD', 'CUSTOMER_INBOX_IMAP_MAILBOX']) delete process.env[key];
  });

  it('resolves the recipient server-side and sends once for the same idempotency key', async () => {
    let saved = false;
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('COALESCE(NULLIF(primary_contact.email')) return [{ name: 'Cliente', recipient_email: 'cliente@example.test', contact_id: null }];
      if (sql.includes('INSERT INTO "tenant_mail".commercial_communications')) {
        if (saved) return [];
        saved = true;
        return [{ id: '33333333-3333-4333-8333-333333333333', status: 'sending' }];
      }
      if (sql.includes("SET status='sent'")) return [{ id: '33333333-3333-4333-8333-333333333333', status: 'sent' }];
      if (sql.includes('WHERE idempotency_key=$1')) return [{ id: '33333333-3333-4333-8333-333333333333', status: 'sent' }];
      return [];
    });
    const mail = { isConfigured: jest.fn(() => true), sendMailRequired: jest.fn().mockResolvedValue(undefined) };
    const service = new TenantCustomerInboxMailService({ query } as never, mail as never);

    const input = { schema: 'tenant_mail', actorId, companyId, text: 'Messaggio', idempotencyKey: 'send-once' };
    await expect(service.sendEmail(input)).resolves.toMatchObject({ existing: false });
    await expect(service.sendEmail(input)).resolves.toMatchObject({ existing: true });
    expect(mail.sendMailRequired).toHaveBeenCalledTimes(1);
    expect(mail.sendMailRequired).toHaveBeenCalledWith(expect.objectContaining({ to: 'cliente@example.test' }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('customer_inbox_drafts'))).toBe(false);
  });

  it('records SMTP failure without a fake sent state or draft deletion', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('COALESCE(NULLIF(primary_contact.email')) return [{ name: 'Cliente', recipient_email: 'cliente@example.test', contact_id: null }];
      if (sql.includes('INSERT INTO "tenant_mail".commercial_communications')) return [{ id: '33333333-3333-4333-8333-333333333333', status: 'sending' }];
      return [];
    });
    const mail = { isConfigured: jest.fn(() => true), sendMailRequired: jest.fn().mockRejectedValue(new Error('synthetic SMTP failure')) };
    const service = new TenantCustomerInboxMailService({ query } as never, mail as never);

    await expect(service.sendEmail({ schema: 'tenant_mail', actorId, companyId, text: 'Messaggio', idempotencyKey: 'failure' }))
      .rejects.toThrow('La bozza è stata conservata');
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status='failed'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET status='sent'"))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('customer_inbox_drafts'))).toBe(false);
  });

  it('matches incoming email inside one tenant and ignores a duplicate import', async () => {
    let inserted = false;
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM "tenant_mail".companies c') && sql.includes('lower(c.email)')) {
        return [{ company_id: companyId, contact_id: null, name: 'Cliente' }];
      }
      if (sql.includes('INSERT INTO "tenant_mail".commercial_communications')) {
        if (inserted) return [];
        inserted = true;
        return [{ id: '44444444-4444-4444-8444-444444444444' }];
      }
      return [];
    });
    const service = new TenantCustomerInboxMailService({ query } as never, { isConfigured: () => false } as never);
    const message = { uid: 9, uidValidity: '77', messageId: '<mail-9@example.test>', from: 'CLIENTE@EXAMPLE.TEST', to: ['inbox@example.test'], subject: 'Richiesta', occurredAt: new Date('2026-08-28T08:00:00Z'), text: 'Corpo', inReplyTo: null, references: [], attachmentCount: 0 };

    await expect(service.importMessage('tenant_mail', message)).resolves.toMatchObject({ matched: true, duplicate: false, companyId });
    await expect(service.importMessage('tenant_mail', message)).resolves.toMatchObject({ matched: true, duplicate: true, companyId });
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO "tenant_mail".commercial_communications'))).toHaveLength(2);
    expect(query.mock.calls.every(([sql]) => !String(sql).includes('tenant_other'))).toBe(true);
  });

  it.each([
    ['unmatched', []],
    ['ambiguous', [
      { company_id: companyId, contact_id: null, name: 'Cliente A' },
      { company_id: '55555555-5555-4555-8555-555555555555', contact_id: null, name: 'Cliente B' },
    ]],
  ])('stores %s inbound safely instead of assigning it randomly', async (expected, matches) => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM "tenant_mail".companies c') && sql.includes('lower(c.email)')) return matches;
      if (sql.includes('customer_inbox_unmatched_messages')) return [{ id: '66666666-6666-4666-8666-666666666666' }];
      return [];
    });
    const service = new TenantCustomerInboxMailService({ query } as never, { isConfigured: () => false } as never);
    await expect(service.importMessage('tenant_mail', { uid: 10, uidValidity: '77', messageId: '<mail-10@example.test>', from: 'unknown@example.test', to: [], subject: 'Unknown', occurredAt: new Date(), text: 'Corpo', inReplyTo: null, references: [], attachmentCount: 0 }))
      .resolves.toMatchObject({ matched: false, status: expected });
  });

  it('resets the UID checkpoint safely when IMAP UIDVALIDITY changes', async () => {
    Object.assign(process.env, {
      CUSTOMER_INBOX_IMAP_TENANT_SCHEMA: 'tenant_mail',
      CUSTOMER_INBOX_IMAP_HOST: 'imap.example.test',
      CUSTOMER_INBOX_IMAP_PORT: '993',
      CUSTOMER_INBOX_IMAP_SECURE: 'true',
      CUSTOMER_INBOX_IMAP_USER: 'inbox@example.test',
      CUSTOMER_INBOX_IMAP_PASSWORD: 'synthetic-test-only',
    });
    const release = jest.fn();
    const search = jest.fn().mockResolvedValue([1]);
    const fetchAll = jest.fn().mockResolvedValue([{ uid: 1, source: Buffer.from('From: unknown@example.test\r\nTo: inbox@example.test\r\nMessage-ID: <reset-1@example.test>\r\nSubject: Reset\r\n\r\nBody') }]);
    (ImapFlow as unknown as jest.Mock).mockImplementation(() => ({
      mailbox: { uidValidity: 'new-validity' },
      connect: jest.fn().mockResolvedValue(undefined),
      getMailboxLock: jest.fn().mockResolvedValue({ release }),
      search,
      fetchAll,
      logout: jest.fn().mockResolvedValue(undefined),
    }));
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT uid_validity,last_uid')) return [{ uid_validity: 'old-validity', last_uid: 500 }];
      if (sql.includes('FROM "tenant_mail".companies c')) return [];
      if (sql.includes('customer_inbox_unmatched_messages')) return [{ id: '77777777-7777-4777-8777-777777777777' }];
      return [];
    });
    const service = new TenantCustomerInboxMailService({ query } as never, { isConfigured: () => false } as never);

    await expect(service.syncConfiguredMailbox()).resolves.toEqual({ configured: true, imported: 1 });
    expect(search).toHaveBeenCalledWith({ uid: '1:*' }, { uid: true });
    expect(release).toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => String(sql).includes('IS DISTINCT FROM EXCLUDED.uid_validity') && String(sql).includes('EXCLUDED.last_uid'))).toBe(true);
  });
});
