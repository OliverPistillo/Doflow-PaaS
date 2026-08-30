import { BadRequestException, ConflictException } from '@nestjs/common';

export const CALL_TYPES = ['audio', 'video'] as const;
export type TenantCallType = (typeof CALL_TYPES)[number];

export const CALL_STATES = [
  'created',
  'ringing',
  'accepted',
  'connecting',
  'active',
  'rejected',
  'cancelled',
  'missed',
  'busy',
  'failed',
  'ended',
] as const;
export type TenantCallState = (typeof CALL_STATES)[number];

export const TERMINAL_CALL_STATES = [
  'rejected',
  'cancelled',
  'missed',
  'busy',
  'failed',
  'ended',
] as const satisfies readonly TenantCallState[];

export type TenantCallContextKind = 'company' | 'contact' | 'opportunity' | 'project';

const TRANSITIONS: Readonly<Record<TenantCallState, readonly TenantCallState[]>> = {
  created: ['ringing'],
  ringing: ['accepted', 'rejected', 'cancelled', 'missed', 'busy'],
  accepted: ['connecting', 'failed', 'ended'],
  connecting: ['active', 'failed', 'ended'],
  active: ['failed', 'ended'],
  rejected: [],
  cancelled: [],
  missed: [],
  busy: [],
  failed: [],
  ended: [],
};

export function isTerminalCallState(value: string): value is (typeof TERMINAL_CALL_STATES)[number] {
  return (TERMINAL_CALL_STATES as readonly string[]).includes(value);
}

export function parseCallState(value: unknown): TenantCallState {
  const state = String(value || '').trim().toLowerCase();
  if (!(CALL_STATES as readonly string[]).includes(state)) {
    throw new BadRequestException('Stato chiamata non valido');
  }
  return state as TenantCallState;
}

export function parseCallType(value: unknown): TenantCallType {
  const type = String(value || '').trim().toLowerCase();
  if (!(CALL_TYPES as readonly string[]).includes(type)) {
    throw new BadRequestException('Tipo chiamata non valido');
  }
  return type as TenantCallType;
}

export function assertCallTransition(fromValue: unknown, toValue: unknown): TenantCallState {
  const from = parseCallState(fromValue);
  const to = parseCallState(toValue);
  if (from === to) return to;
  if (!TRANSITIONS[from].includes(to)) {
    throw new ConflictException({
      error: 'CALL_TRANSITION_INVALID',
      message: `Transizione chiamata non consentita: ${from} -> ${to}`,
    });
  }
  return to;
}

export function callOutcomeForState(stateValue: unknown): string {
  const state = parseCallState(stateValue);
  switch (state) {
    case 'rejected': return 'rejected';
    case 'cancelled': return 'cancelled';
    case 'missed': return 'missed';
    case 'busy': return 'busy';
    case 'failed': return 'failed';
    case 'ended': return 'completed';
    default: return 'in_progress';
  }
}

export function parseDesktopDeviceId(value: unknown): string {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
    throw new BadRequestException('Identificatore Desktop non valido');
  }
  return id;
}

export function parseCallIdempotencyKey(value: unknown): string {
  const key = String(value || '').trim();
  if (!key || key.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new BadRequestException('Idempotency-Key non valida');
  }
  return key;
}

export function parseCallContext(
  value: unknown,
  uuid: (value: unknown, label?: string) => string,
): { kind: TenantCallContextKind; id: string } | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Contesto CRM non valido');
  }
  const input = value as Record<string, unknown>;
  const rawKind = String(input.kind || input.type || '').trim().toLowerCase();
  const kind = rawKind === 'client' ? 'company' : rawKind;
  if (!['company', 'contact', 'opportunity', 'project'].includes(kind)) {
    throw new BadRequestException('Tipo contesto CRM non valido');
  }
  return { kind: kind as TenantCallContextKind, id: uuid(input.id, 'context.id') };
}

export function sanitizeGuestDisplayName(value: unknown): string {
  const name = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2 || name.length > 80) {
    throw new BadRequestException('Nome ospite non valido');
  }
  return name;
}
