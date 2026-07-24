import { mailTimeout } from './mail.module';
import { MailService } from './mail.service';

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
    expect(logLine).toContain('Invite email failed recipient=op@example.com');
    expect(logLine).toContain('code=ETIMEDOUT');
    expect(logLine).toContain('host=smtp.example.com');
    expect(logLine).toContain('port=587');
    expect(logLine).not.toContain('smtp-password-secret');
    expect(logLine).not.toContain('https://app.doflow.it/accept-invite');
    expect(logLine).not.toContain('secret-token');
  });
});
