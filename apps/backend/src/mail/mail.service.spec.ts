import { mailTimeout } from './mail.module';
import { MailModule } from './mail.module';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createTransport } from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('Mail configuration', () => {
  it('configura timeout SMTP con fallback sicuri', () => {
    const config = { get: jest.fn((key: string) => ({ MAIL_CONNECTION_TIMEOUT_MS: '12000' })[key]) };
    expect(mailTimeout(config as any, 'MAIL_CONNECTION_TIMEOUT_MS', 10000)).toBe(12000);
  });

  it('usa fallback per timeout invalidi e limita a massimo 60s', () => {
    expect(mailTimeout({ get: () => 'abc' } as any, 'MAIL_SOCKET_TIMEOUT_MS', 15000)).toBe(15000);
    expect(mailTimeout({ get: () => '999999' } as any, 'MAIL_SOCKET_TIMEOUT_MS', 15000)).toBe(60000);
    expect(mailTimeout({ get: () => '10' } as any, 'MAIL_SOCKET_TIMEOUT_MS', 15000)).toBe(1000);
  });
});

describe('MailService sanitized diagnostics', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('ritorna false rapidamente se la configurazione SMTP obbligatoria manca', async () => {
    delete process.env.MAIL_HOST;
    delete process.env.MAIL_PORT;
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASSWORD;
    const mailer = { sendMail: jest.fn() };
    const service = new MailService(mailer as any);
    (service as any).logger.warn = jest.fn();

    await expect(service.sendInviteEmail({
      to: 'op@example.com',
      tenantName: 'doflow',
      inviteLink: 'https://app.doflow.it/accept-invite?token=secret-token&tenant=doflow',
    })).resolves.toBe(false);
    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect((service as any).logger.warn.mock.calls[0][0]).not.toContain('secret-token');
  });

  it('logga errori SMTP in forma sanitizzata senza password, token o link', async () => {
    process.env.MAIL_HOST = 'smtp.example.com';
    process.env.MAIL_PORT = '587';
    process.env.MAIL_SECURE = 'false';
    process.env.MAIL_USER = 'user@example.com';
    process.env.MAIL_PASSWORD = 'smtp-password-secret';
    const error = Object.assign(new Error('Connection timeout token=secret-token https://app.doflow.it/accept-invite?token=secret-token'), {
      code: 'ETIMEDOUT',
      command: 'CONN',
      responseCode: 421,
    });
    const service = new MailService({ sendMail: jest.fn().mockRejectedValue(error) } as any);
    (service as any).logger.error = jest.fn();

    await expect(service.sendInviteEmail({
      to: 'op@example.com',
      tenantName: 'doflow',
      inviteLink: 'https://app.doflow.it/accept-invite?token=secret-token&tenant=doflow',
    })).resolves.toBe(false);

    const logLine = String((service as any).logger.error.mock.calls[0][0]);
    expect(logLine).toContain('Invite email failed recipient=[redacted]');
    expect(logLine).toContain('code=ETIMEDOUT');
    expect(logLine).not.toContain('op@example.com');
    expect(logLine).not.toContain('smtp-password-secret');
    expect(logLine).not.toContain('https://app.doflow.it/accept-invite');
    expect(logLine).not.toContain('secret-token');
  });
});

describe('MailModule transport and service agreement', () => {
  const originalEnv = { ...process.env };
  let module: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let service: MailService;
  let sendMail: jest.Mock;

  async function configure(overrides: Record<string, unknown> = {}) {
    // Deliberately no MAIL_* in process.env: the injected source is authoritative.
    for (const key of Object.keys(process.env).filter((key) => key.startsWith('MAIL_'))) delete process.env[key];
    const values: Record<string, unknown> = {
      MAIL_HOST: 'smtp.example.invalid', MAIL_PORT: 465, MAIL_SECURE: true,
      MAIL_USER: 'sender@example.invalid', MAIL_PASSWORD: ' fake-password-with-spaces ',
      ...overrides,
    };
    sendMail = jest.fn().mockResolvedValue({ accepted: ['recipient@example.invalid'], rejected: [] });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    module = await Test.createTestingModule({ imports: [MailModule] })
      .overrideProvider(ConfigService).useValue({ get: (key: string) => values[key] }).compile();
    service = module.get(MailService);
    for (const method of ['log', 'warn', 'error']) (service as any).logger[method] = jest.fn();
  }

  afterEach(async () => {
    await module?.close();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it.each([true, 'TRUE', 'true'])('uses the injected configuration and the same TLS interpretation: %s', async (secure) => {
    await configure({ MAIL_SECURE: secure });
    expect(service.isConfigured()).toBe(true);
    expect(createTransport).toHaveBeenLastCalledWith(expect.objectContaining({
      secure: true,
      auth: { user: 'sender@example.invalid', pass: ' fake-password-with-spaces ' },
    }));
    await expect(service.sendInviteEmail({ to: 'recipient@example.invalid', tenantName: 'fixture', inviteLink: 'https://app.example.invalid/accept-invite?token=fake-token' })).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'sender@example.invalid' }));
  });

  it('allows MAIL_SECURE=false without MAIL_FROM_NAME and preserves reset and generic callers', async () => {
    await configure({ MAIL_SECURE: false, MAIL_PORT: '587' });
    expect(service.isConfigured()).toBe(true);
    await expect(service.sendPasswordResetEmail({ to: 'recipient@example.invalid', resetLink: 'https://app.example.invalid/reset-password?token=fake-reset' })).resolves.toBe(true);
    const attachments = [{ filename: 'invoice.txt', content: 'synthetic invoice' }];
    await expect(service.sendMail({ to: 'recipient@example.invalid', subject: 'Invoice', text: 'Synthetic', attachments })).resolves.toBe(true);
    expect(sendMail).toHaveBeenLastCalledWith(expect.objectContaining({ attachments }));
    await expect(service.sendMailRequired({ to: 'recipient@example.invalid', subject: 'Inbox', text: 'Synthetic' })).resolves.toBeUndefined();
  });

  it.each([{ MAIL_PASSWORD: '' }, { MAIL_PORT: 'bad' }, { MAIL_SECURE: 'invalid' }])('keeps optional SMTP from blocking startup and reports unavailable config: %j', async (override) => {
    await configure(override);
    expect(service.isConfigured()).toBe(false);
    await expect(service.sendMail({ to: 'recipient@example.invalid', subject: 'Synthetic' })).resolves.toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not report complete success for partially rejected recipients', async () => {
    await configure();
    Object.assign(process.env, { MAIL_HOST: 'smtp.example.invalid', MAIL_PORT: '465', MAIL_USER: 'sender@example.invalid', MAIL_PASSWORD: 'fake-password' });
    sendMail.mockResolvedValue({ accepted: ['first@example.invalid'], rejected: ['second@example.invalid'] });
    await expect(service.sendMail({ to: 'first@example.invalid, second@example.invalid', subject: 'Synthetic' })).resolves.toBe(false);
    await expect(service.sendMailRequired({ to: 'first@example.invalid, second@example.invalid', subject: 'Synthetic', text: 'Synthetic' })).rejects.toThrow('SMTP_SEND_FAILED');
  });

  it('omits arbitrary SMTP error messages, recipients, credentials and error fields from diagnostics', async () => {
    await configure();
    sendMail.mockRejectedValue(Object.assign(new Error(' fake-password-with-spaces recipient@example.invalid token=fake-token body contents'), {
      code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535,
      name: 'fake-token', response: 'body contents',
    }));
    await expect(service.sendMail({ to: 'recipient@example.invalid', subject: 'Synthetic', purpose: 'Invite' })).resolves.toBe(false);
    const logs = JSON.stringify((service as any).logger.error.mock.calls);
    expect(logs).toContain('EAUTH');
    for (const secret of ['fake-password', 'fake-token', 'recipient@example.invalid', 'body contents']) expect(logs).not.toContain(secret);
  });
});
