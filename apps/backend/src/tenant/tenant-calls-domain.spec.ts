import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  assertCallTransition,
  callOutcomeForState,
  parseCallContext,
  parseCallIdempotencyKey,
  parseDesktopDeviceId,
  sanitizeGuestDisplayName,
} from './tenant-calls-domain';
import { livekitConfigured, tenantCallsConfig } from './tenant-calls-config';

describe('tenant calls domain', () => {
  it('accepts the authoritative lifecycle and rejects skipped or terminal transitions', () => {
    expect(assertCallTransition('created', 'ringing')).toBe('ringing');
    expect(assertCallTransition('ringing', 'accepted')).toBe('accepted');
    expect(assertCallTransition('accepted', 'connecting')).toBe('connecting');
    expect(assertCallTransition('connecting', 'active')).toBe('active');
    expect(assertCallTransition('active', 'ended')).toBe('ended');
    expect(() => assertCallTransition('ringing', 'active')).toThrow(ConflictException);
    expect(() => assertCallTransition('ringing', 'failed')).toThrow(ConflictException);
    expect(() => assertCallTransition('accepted', 'active')).toThrow(ConflictException);
    expect(() => assertCallTransition('rejected', 'active')).toThrow(ConflictException);
    expect(callOutcomeForState('missed')).toBe('missed');
    expect(callOutcomeForState('ended')).toBe('completed');
  });

  it('validates device, idempotency, CRM context and guest display name without trusting client identity', () => {
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(parseDesktopDeviceId('desktop-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toContain('desktop-');
    expect(() => parseDesktopDeviceId('../other-profile')).toThrow(BadRequestException);
    expect(parseCallIdempotencyKey('desktop-call:valid.1')).toBe('desktop-call:valid.1');
    expect(() => parseCallIdempotencyKey('contains whitespace')).toThrow(BadRequestException);
    expect(parseCallContext({ kind: 'client', id: uuid }, (value) => String(value))).toEqual({ kind: 'company', id: uuid });
    expect(() => parseCallContext({ kind: 'tenant', id: uuid }, (value) => String(value))).toThrow(BadRequestException);
    expect(sanitizeGuestDisplayName('  Mario\n   Rossi  ')).toBe('Mario Rossi');
    expect(() => sanitizeGuestDisplayName('x')).toThrow(BadRequestException);
  });

  it('keeps calls unavailable until both rollout flags and provider configuration are present', () => {
    const disabled = tenantCallsConfig({
      LIVEKIT_ENABLED: 'false',
      DESKTOP_CALLS_ENABLED: 'true',
      LIVEKIT_URL: 'wss://calls.example.test',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'secret',
    });
    expect(disabled.masterEnabled).toBe(false);
    expect(livekitConfigured(disabled)).toBe(true);
    const ready = tenantCallsConfig({
      LIVEKIT_ENABLED: 'true',
      DESKTOP_CALLS_ENABLED: 'true',
      DESKTOP_CALLS_GUEST_ENABLED: 'true',
      LIVEKIT_URL: 'wss://calls.example.test',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'secret',
      LIVEKIT_TOKEN_TTL_SECONDS: '99999',
    });
    expect(ready).toMatchObject({ masterEnabled: true, guestEnabled: true, tokenTtlSeconds: 900, connectTimeoutSeconds: 90 });
    expect(livekitConfigured(tenantCallsConfig({ LIVEKIT_ENABLED: 'true', DESKTOP_CALLS_ENABLED: 'true' }))).toBe(false);
    expect(livekitConfigured(tenantCallsConfig({
      LIVEKIT_URL: 'ws://provider.example.test',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'secret',
    }))).toBe(false);
    expect(livekitConfigured(tenantCallsConfig({
      LIVEKIT_URL: 'ws://127.0.0.1:7880',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'secret',
    }))).toBe(true);
  });
});
