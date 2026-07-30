import { ANONYMOUS_CLIENT_IP, getClientIpForRateLimit, normalizeIpAddress, parseTrustProxy } from './client-ip.utils';

function req(options: {
  remoteAddress?: string;
  reqIp?: string;
  cf?: string | string[];
  trusted?: boolean;
}) {
  const headers: Record<string, string | string[]> = {};
  if (options.cf !== undefined) headers['cf-connecting-ip'] = options.cf;
  return {
    headers,
    ip: options.reqIp,
    socket: { remoteAddress: options.remoteAddress },
    app: {
      get: jest.fn((name: string) => {
        if (name !== 'trust proxy fn') return undefined;
        return jest.fn(() => options.trusted === true);
      }),
    },
  } as any;
}

describe('client IP utilities', () => {
  it('usa CF IPv4 valido quando il peer immediato e fidato', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: '203.0.113.10', reqIp: '127.0.0.1' })))
      .toBe('203.0.113.10');
  });

  it('usa CF IPv6 valido quando il peer immediato e fidato', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '::1', trusted: true, cf: '2001:db8::10', reqIp: '::1' })))
      .toBe('2001:db8::10');
  });

  it('normalizza IPv4-mapped IPv6', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '::1', trusted: true, cf: '::ffff:203.0.113.10', reqIp: '::1' })))
      .toBe('203.0.113.10');
  });

  it('scarta CF invalido e usa req.ip', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: 'not-an-ip', reqIp: '198.51.100.4' })))
      .toBe('198.51.100.4');
  });

  it('scarta CF con virgola', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: '203.0.113.10, 203.0.113.11', reqIp: '198.51.100.4' })))
      .toBe('198.51.100.4');
  });

  it('scarta CF array', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: ['203.0.113.10'], reqIp: '198.51.100.4' })))
      .toBe('198.51.100.4');
  });

  it('scarta CF con porta', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: '203.0.113.10:443', reqIp: '198.51.100.4' })))
      .toBe('198.51.100.4');
  });

  it('ignora CF valido se il peer non e fidato', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '198.51.100.20', trusted: false, cf: '203.0.113.10', reqIp: '198.51.100.20' })))
      .toBe('198.51.100.20');
  });

  it('un client diretto non cambia bucket falsificando CF', () => {
    const base = { remoteAddress: '198.51.100.20', trusted: false, reqIp: '198.51.100.20' };
    expect(getClientIpForRateLimit(req({ ...base, cf: '203.0.113.10' }))).toBe(getClientIpForRateLimit(req({ ...base, cf: '203.0.113.11' })));
  });

  it('usa req.ip valido senza CF', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, reqIp: '198.51.100.4' })))
      .toBe('198.51.100.4');
  });

  it('usa socket.remoteAddress se req.ip non e valido', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: '198.51.100.20', trusted: false, reqIp: 'bad-ip' })))
      .toBe('198.51.100.20');
  });

  it('usa fallback anonimo quando nessun IP e valido', () => {
    expect(getClientIpForRateLimit(req({ remoteAddress: 'bad-remote', trusted: true, reqIp: 'bad-ip' })))
      .toBe(ANONYMOUS_CLIENT_IP);
  });

  it('distingue due visitatori CF dietro lo stesso proxy', () => {
    const first = getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: '203.0.113.10', reqIp: '127.0.0.1' }));
    const second = getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: '203.0.113.11', reqIp: '127.0.0.1' }));
    expect(first).not.toBe(second);
  });

  it('mantiene stabile lo stesso visitatore CF', () => {
    const first = getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: '203.0.113.10', reqIp: '127.0.0.1' }));
    const second = getClientIpForRateLimit(req({ remoteAddress: '127.0.0.1', trusted: true, cf: '203.0.113.10', reqIp: '127.0.0.1' }));
    expect(first).toBe(second);
  });

  it('normalizza IPv6 tra parentesi senza porta', () => {
    expect(normalizeIpAddress('[2001:db8::10]')).toBe('2001:db8::10');
  });

  it('parse TRUST_PROXY lista loopback,linklocal,uniquelocal', () => {
    expect(parseTrustProxy('loopback, linklocal, uniquelocal')).toEqual(['loopback', 'linklocal', 'uniquelocal']);
  });

  it('parse TRUST_PROXY numerico', () => {
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('parse TRUST_PROXY false', () => {
    expect(parseTrustProxy('off')).toBe(false);
  });

  it('parse TRUST_PROXY true solo quando esplicito', () => {
    expect(parseTrustProxy('on')).toBe(true);
  });

  it('fallisce in modo comprensibile su TRUST_PROXY invalido', () => {
    expect(() => parseTrustProxy('loopback, nope')).toThrow('TRUST_PROXY non valido');
  });
});
