import { InternalServerErrorException } from '@nestjs/common';
import { buildFrontendPath, resolveFrontendUrl } from './public-url.utils';

describe('public frontend URL resolver', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('usa FRONTEND_URL come variabile canonica in produzione', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.doflow.it/';
    process.env.APP_URL = 'https://legacy.example.test';

    expect(resolveFrontendUrl()).toBe('https://app.doflow.it');
    expect(buildFrontendPath('/accept-invite', { token: 'abc', tenant: 'doflow' }))
      .toBe('https://app.doflow.it/accept-invite?token=abc&tenant=doflow');
  });

  it('in produzione senza URL valido fallisce chiuso', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;

    expect(() => resolveFrontendUrl()).toThrow(InternalServerErrorException);
    expect(() => resolveFrontendUrl()).toThrow('URL frontend pubblico non configurato.');
  });

  it('in produzione rifiuta localhost e credenziali URL', () => {
    process.env.NODE_ENV = 'production';

    process.env.FRONTEND_URL = 'http://localhost:3000';
    expect(() => resolveFrontendUrl()).toThrow('URL frontend pubblico non configurato.');

    process.env.FRONTEND_URL = 'https://user:pass@app.doflow.it';
    expect(() => resolveFrontendUrl()).toThrow('URL frontend pubblico non configurato.');
  });

  it('in development/test consente il fallback localhost', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.FRONTEND_URL;
    delete process.env.APP_URL;

    expect(resolveFrontendUrl()).toBe('http://localhost:3000');
  });
});
