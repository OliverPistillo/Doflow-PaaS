import { getApiBaseUrl } from "./api";

export const CLIENT_PORTAL_TOKEN_KEY = "doflow_client_portal_token";
const CLIENT_PORTAL_TENANT = "doflow";

export function getClientPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLIENT_PORTAL_TOKEN_KEY);
}

export function setClientPortalToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENT_PORTAL_TOKEN_KEY, token);
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
    if (token) headers.Authorization = `Bearer ${token}`;
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
    throw new Error(String(msg));
  }

  return (json ?? (text as unknown)) as T;
}
