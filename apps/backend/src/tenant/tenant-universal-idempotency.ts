import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function withTenantIdempotency<T>(
  manager: EntityManager,
  schema: string,
  scope: string,
  keyValue: unknown,
  payload: unknown,
  actorUserId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = String(keyValue || '').trim();
  if (!key) return operation();
  if (key.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new BadRequestException('Idempotency-Key non valida');
  }
  const requestHash = createHash('sha256').update(stable(payload)).digest('hex');
  await manager.query(
    `INSERT INTO "${schema}".universal_idempotency
       (scope, idempotency_key, request_hash, actor_user_id, created_at)
     VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (scope,idempotency_key) DO NOTHING`,
    [scope, key, requestHash, actorUserId],
  );
  const rows = await manager.query(
    `SELECT request_hash,response,actor_user_id FROM "${schema}".universal_idempotency
     WHERE scope=$1 AND idempotency_key=$2 FOR UPDATE`,
    [scope, key],
  );
  const record = rows[0];
  if (!record || String(record.actor_user_id) !== actorUserId || record.request_hash !== requestHash) {
    throw new ConflictException('Idempotency-Key gia usata con una richiesta diversa');
  }
  if (record.response !== null && record.response !== undefined) return record.response as T;
  const result = await operation();
  await manager.query(
    `UPDATE "${schema}".universal_idempotency SET response=$3::jsonb
     WHERE scope=$1 AND idempotency_key=$2`,
    [scope, key, JSON.stringify(result)],
  );
  return result;
}
