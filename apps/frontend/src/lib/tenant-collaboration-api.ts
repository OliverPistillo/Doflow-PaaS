import { apiFetch } from '@/lib/api';

type RecordComment = Record<string, unknown> & { id: string };
type MutationHeaders = { idempotencyKey?: string; correlationId?: string };

function mutationHeaders(input: MutationHeaders = {}) {
  return {
    'Idempotency-Key': input.idempotencyKey || `ui-${crypto.randomUUID()}`,
    'X-Correlation-Id': input.correlationId || crypto.randomUUID(),
  };
}

export const collaborationApi = {
  list(recordType: string, recordId: string) {
    const query = new URLSearchParams({ recordType, recordId });
    return apiFetch<{ items: RecordComment[] }>(`/tenant/doflow/collaboration/comments?${query}`);
  },
  create(body: {
    recordType: string; recordId: string; text: string; parentCommentId?: string;
    mentionUserIds?: string[]; attachments?: Array<{ reference?: string }>;
  }, options?: MutationHeaders) {
    return apiFetch<RecordComment>('/tenant/doflow/collaboration/comments', {
      method: 'POST', headers: mutationHeaders(options), body: JSON.stringify(body),
    });
  },
  update(id: string, body: { text: string; mentionUserIds?: string[]; expectedVersion: number }, options?: MutationHeaders) {
    return apiFetch<RecordComment>(`/tenant/doflow/collaboration/comments/${id}`, {
      method: 'PATCH', headers: mutationHeaders(options), body: JSON.stringify(body),
    });
  },
  remove(id: string, body: { expectedVersion: number; reason?: string }, options?: MutationHeaders) {
    return apiFetch<RecordComment>(`/tenant/doflow/collaboration/comments/${id}`, {
      method: 'DELETE', headers: mutationHeaders(options), body: JSON.stringify(body),
    });
  },
  resolve(id: string, body: { resolved: boolean; expectedVersion: number }, options?: MutationHeaders) {
    return apiFetch<RecordComment>(`/tenant/doflow/collaboration/comments/${id}/resolve`, {
      method: 'PATCH', headers: mutationHeaders(options), body: JSON.stringify(body),
    });
  },
  reaction(id: string, emoji: string, options?: MutationHeaders) {
    return apiFetch<RecordComment>(`/tenant/doflow/collaboration/comments/${id}/reactions`, {
      method: 'POST', headers: mutationHeaders(options), body: JSON.stringify({ emoji }),
    });
  },
  attachmentAccess(id: string) {
    return apiFetch<{ url: string; expiresInSeconds: number }>(`/tenant/doflow/collaboration/attachments/${id}/access`, { method: 'POST' });
  },
};
