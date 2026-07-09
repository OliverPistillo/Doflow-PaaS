import { getApiBaseUrl } from "./api";

export const CLIENT_PORTAL_TOKEN_KEY = "doflow_client_portal_token";
const CLIENT_PORTAL_TENANT = "doflow";
const INVALID_STORED_TOKENS = new Set(["", "undefined", "null"]);

function normalizeClientPortalToken(value: unknown): string | null {
  const token = typeof value === "string" ? value.trim() : "";
  if (INVALID_STORED_TOKENS.has(token.toLowerCase())) return null;
  return token;
}

export function getClientPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = normalizeClientPortalToken(window.localStorage.getItem(CLIENT_PORTAL_TOKEN_KEY));
  if (!token) {
    window.localStorage.removeItem(CLIENT_PORTAL_TOKEN_KEY);
    return null;
  }
  return token;
}

export function setClientPortalToken(token: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeClientPortalToken(token);
  if (!normalized) {
    window.localStorage.removeItem(CLIENT_PORTAL_TOKEN_KEY);
    throw new Error("Token portale cliente mancante nella risposta.");
  }
  window.localStorage.setItem(CLIENT_PORTAL_TOKEN_KEY, normalized);
}

export function clearClientPortalToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLIENT_PORTAL_TOKEN_KEY);
}

export function buildClientInviteLink(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = new URL("/client/accept-invite", origin || "https://app.doflow.it");
  url.searchParams.set("token", token);
  return url.toString();
}

export function getClientPortalSessionExpiredMessage() {
  if (typeof window === "undefined") return "";
  const reason = new URLSearchParams(window.location.search).get("reason");
  return reason === "session-expired" ? "Sessione cliente scaduta o non valida. Accedi di nuovo." : "";
}

export function extractClientPortalAccessToken(response: unknown): string {
  const data = response as { accessToken?: unknown };
  const token = normalizeClientPortalToken(data?.accessToken);
  if (!token) throw new Error("La risposta del portale cliente non contiene accessToken.");
  return token;
}

function redirectToClientLoginAfterAuthFailure() {
  clearClientPortalToken();
  if (typeof window === "undefined") return;
  const currentPath = window.location.pathname;
  if (currentPath === "/client/login") return;
  window.location.assign("/client/login?reason=session-expired");
}

export async function clientPortalFetch<T = unknown>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${cleanPath.startsWith("/api/") ? cleanPath.slice(4) : cleanPath}`;
  const headers: Record<string, string> = {
    "x-doflow-tenant-id": CLIENT_PORTAL_TENANT,
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth !== false) {
    const token = getClientPortalToken();
    if (!token) {
      if (process.env.NODE_ENV === "development") {
        console.info("[client-portal] client portal token present: false");
      }
      redirectToClientLoginAfterAuthFailure();
      throw new Error("Sessione cliente scaduta o non valida.");
    }
    if (process.env.NODE_ENV === "development") {
      console.info("[client-portal] client portal token present: true");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    // Risposte testuali legacy.
  }

  if (!res.ok) {
    const msg = json?.message ?? json?.error ?? text ?? `HTTP ${res.status}`;
    if (res.status === 401 && options.auth !== false) {
      redirectToClientLoginAfterAuthFailure();
      throw new Error("Sessione cliente scaduta o non valida.");
    }
    throw new Error(String(msg));
  }

  return (json ?? (text as unknown)) as T;
}
