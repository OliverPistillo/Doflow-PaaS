import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';

export const DESKTOP_GOOGLE_FLOW_TTL_SECONDS = 300;
export const DESKTOP_GOOGLE_STATE_PREFIX = 'doflow-desktop-v1.';

export type DesktopGoogleFlow = {
  version: 1;
  nativeState: string;
  callbackPort: number;
  createdAt: string;
};

function flowKey(code: string) {
  return `df:auth:desktop-google:${createHash('sha256').update(code).digest('hex')}`;
}

function validateNativeState(value: unknown) {
  const state = String(value || '').trim();
  if (state.length < 32 || state.length > 128 || !/^[A-Za-z0-9_-]+$/.test(state)) {
    throw new BadRequestException('Desktop OAuth state non valido');
  }
  return state;
}

function validateCallbackPort(value: unknown) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new BadRequestException('Desktop OAuth callback port non valida');
  }
  return port;
}

@Injectable()
export class DesktopGoogleOAuthService {
  constructor(private readonly redis: RedisService) {}

  async create(input: { nativeState: unknown; callbackPort: unknown }) {
    const record: DesktopGoogleFlow = {
      version: 1,
      nativeState: validateNativeState(input.nativeState),
      callbackPort: validateCallbackPort(input.callbackPort),
      createdAt: new Date().toISOString(),
    };
    const flow = randomBytes(32).toString('base64url');
    await this.redis.set(flowKey(flow), JSON.stringify(record), DESKTOP_GOOGLE_FLOW_TTL_SECONDS);
    return {
      flow,
      googleState: `${DESKTOP_GOOGLE_STATE_PREFIX}${flow}`,
      expiresIn: DESKTOP_GOOGLE_FLOW_TTL_SECONDS,
    };
  }

  async consumeGoogleState(stateInput: unknown): Promise<DesktopGoogleFlow> {
    const state = String(stateInput || '').trim();
    if (!state.startsWith(DESKTOP_GOOGLE_STATE_PREFIX)) {
      throw new BadRequestException('Desktop OAuth state non valido');
    }
    const flow = state.slice(DESKTOP_GOOGLE_STATE_PREFIX.length);
    if (flow.length < 32 || flow.length > 128 || !/^[A-Za-z0-9_-]+$/.test(flow)) {
      throw new BadRequestException('Desktop OAuth state non valido');
    }
    const key = flowKey(flow);
    const result = await this.redis.getClient().multi().get(key).del(key).exec();
    const raw = result?.[0]?.[1];
    if (typeof raw !== 'string') {
      throw new UnauthorizedException('Desktop OAuth state scaduto o già utilizzato');
    }
    try {
      const record = JSON.parse(raw) as DesktopGoogleFlow;
      if (
        record.version !== 1
        || validateNativeState(record.nativeState) !== record.nativeState
        || validateCallbackPort(record.callbackPort) !== record.callbackPort
      ) {
        throw new Error('invalid record');
      }
      return record;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new UnauthorizedException('Desktop OAuth state non valido');
    }
  }

  isDesktopState(value: unknown) {
    return String(value || '').startsWith(DESKTOP_GOOGLE_STATE_PREFIX);
  }

  callbackUrl(
    flow: DesktopGoogleFlow,
    result:
      | { handoff: string; tenant: string; kind: 'login' | 'signup' }
      | { error: 'google_no_email' | 'google_email_not_verified' | 'google_callback_failed' },
  ) {
    const callback = new URL(`http://127.0.0.1:${flow.callbackPort}/doflow/oauth/callback`);
    callback.searchParams.set('state', flow.nativeState);
    if ('error' in result) {
      callback.searchParams.set('error', result.error);
    } else {
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(result.handoff)) {
        throw new BadRequestException('Desktop handoff non valido');
      }
      if (!/^[a-z0-9_-]{1,64}$/.test(result.tenant)) {
        throw new BadRequestException('Desktop tenant non valido');
      }
      callback.searchParams.set('handoff', result.handoff);
      callback.searchParams.set('tenant', result.tenant);
      callback.searchParams.set('kind', result.kind);
    }
    return callback.toString();
  }
}
