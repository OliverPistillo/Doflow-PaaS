import { createHash } from 'crypto';

export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export const INVITE_TOKEN_DIGEST_PREFIX = 'sha256:';

export function storedInviteToken(rawToken: string): string {
  return `${INVITE_TOKEN_DIGEST_PREFIX}${hashInviteToken(rawToken)}`;
}
