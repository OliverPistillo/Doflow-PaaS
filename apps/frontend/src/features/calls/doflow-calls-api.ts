import { apiFetch, getApiBaseUrl } from "@/lib/api";

export type DoflowCallType = "audio" | "video";
export type DoflowCallStatus =
  | "created"
  | "ringing"
  | "accepted"
  | "connecting"
  | "active"
  | "rejected"
  | "cancelled"
  | "missed"
  | "busy"
  | "failed"
  | "ended";

export type DoflowCallContextKind = "company" | "contact" | "opportunity" | "project";
export type DoflowCallContext = { kind: DoflowCallContextKind; id: string };

export type DoflowCall = {
  id: string;
  callId: string;
  type: DoflowCallType;
  status: DoflowCallStatus;
  callerUserId: string;
  calleeUserId: string | null;
  callerName: string;
  calleeName: string | null;
  guestDisplayName: string | null;
  guestMode: boolean;
  conversationId: string | null;
  context: DoflowCallContext | null;
  createdAt: string | null;
  ringingAt: string | null;
  acceptedAt: string | null;
  connectingAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  expiresAt: string | null;
  durationSeconds: number | null;
  outcome: string | null;
  terminationReason: string | null;
  version: number;
};

export type DoflowCallsStatus = {
  enabled: boolean;
  configured: boolean;
  tenantEnabled: boolean;
  guestEnabled: boolean;
  browserInternalCalls: false;
  reason: "ready" | "disabled" | "tenant-disabled" | "provider-unconfigured";
  userId: string;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsScreenShare: boolean;
  supportsGuest: boolean;
  bridgeMinimumVersion: number;
  stateMachineVersion: number;
};

export type DoflowCallAccess = {
  token: string;
  serverUrl: string;
  expiresInSeconds: number;
  call: DoflowCall;
};

export type GuestInviteResult = {
  call: DoflowCall;
  invite: null | { id: string; expiresAt: string; url: string };
};

function mutation(method: "POST" | "DELETE", body: Record<string, unknown>, idempotencyKey?: string): RequestInit {
  return {
    method,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    body: JSON.stringify(body),
  };
}

function key(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

export const doflowCallsApi = {
  status: () => apiFetch<DoflowCallsStatus>("/tenant/collaboration/calls/status"),
  heartbeat: (deviceId: string) => apiFetch<{ connected: true }>("/tenant/collaboration/calls/presence", mutation("POST", { deviceId })),
  disconnect: (deviceId: string) => apiFetch<{ connected: false }>("/tenant/collaboration/calls/presence/disconnect", mutation("POST", { deviceId })),
  incoming: (deviceId: string) => apiFetch<{ items: DoflowCall[] }>(`/tenant/collaboration/calls/incoming?deviceId=${encodeURIComponent(deviceId)}`),
  detail: (callId: string, deviceId: string) => apiFetch<DoflowCall>(`/tenant/collaboration/calls/${encodeURIComponent(callId)}?deviceId=${encodeURIComponent(deviceId)}`),
  create: (input: { calleeUserId: string; type: DoflowCallType; deviceId: string; conversationId?: string; context?: DoflowCallContext }) =>
    apiFetch<DoflowCall>("/tenant/collaboration/calls", mutation("POST", input, key("desktop-call"))),
  accept: (callId: string, deviceId: string) => apiFetch<DoflowCall>(`/tenant/collaboration/calls/${encodeURIComponent(callId)}/accept`, mutation("POST", { deviceId })),
  reject: (callId: string, deviceId: string) => apiFetch<DoflowCall>(`/tenant/collaboration/calls/${encodeURIComponent(callId)}/reject`, mutation("POST", { deviceId })),
  cancel: (callId: string, deviceId: string) => apiFetch<DoflowCall>(`/tenant/collaboration/calls/${encodeURIComponent(callId)}/cancel`, mutation("POST", { deviceId })),
  end: (callId: string, deviceId: string, reason?: string) => apiFetch<DoflowCall>(`/tenant/collaboration/calls/${encodeURIComponent(callId)}/end`, mutation("POST", { deviceId, reason })),
  fail: (callId: string, deviceId: string, reason?: string) => apiFetch<DoflowCall>(`/tenant/collaboration/calls/${encodeURIComponent(callId)}/fail`, mutation("POST", { deviceId, reason })),
  token: (callId: string, deviceId: string) => apiFetch<DoflowCallAccess>(`/tenant/collaboration/calls/${encodeURIComponent(callId)}/token`, mutation("POST", { deviceId })),
  createGuest: (input: { type: DoflowCallType; deviceId: string; context?: DoflowCallContext }) =>
    apiFetch<GuestInviteResult>("/tenant/collaboration/calls/guest-invites", mutation("POST", input, key("desktop-guest"))),
  revokeGuest: (inviteId: string, deviceId: string) => apiFetch<{ inviteId: string; revoked: true }>(`/tenant/collaboration/calls/guest-invites/${encodeURIComponent(inviteId)}`, mutation("DELETE", { deviceId })),
};

async function publicCallRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  const value = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(value.message || value.error || "Invito non disponibile"));
  return value as T;
}

export type GuestPreview = {
  inviteId: string;
  callId: string;
  callType: DoflowCallType;
  hostName: string;
  status: DoflowCallStatus;
  expiresAt: string;
  alreadyUsed: boolean;
};
export type GuestCallAccess = {
  token: string;
  serverUrl: string;
  expiresInSeconds: number;
  inviteId: string;
  guestSession: string;
  call: { id: string; type: DoflowCallType; status: DoflowCallStatus };
};

export const publicDoflowCallsApi = {
  preview: (inviteToken: string) => publicCallRequest<GuestPreview>("/public/desktop-calls/guest/resolve", { inviteToken }),
  join: (inviteToken: string, displayName: string) => publicCallRequest<GuestCallAccess>("/public/desktop-calls/guest/token", { inviteToken, displayName }),
  renew: (inviteId: string, guestSession: string) => publicCallRequest<Omit<GuestCallAccess, "guestSession">>("/public/desktop-calls/guest/token/renew", { inviteId, guestSession }),
};
