// apps/frontend/src/lib/api.ts
import { getTenantHeader } from "./tenant-fetch";

type ApiFetchOptions = RequestInit & { auth?: boolean };

function getEnvBase(): string | null {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase && typeof envBase === "string" && envBase.trim().length > 0) {
    return envBase.replace(/\/+$/, "");
  }
  return null;
}

function normalizePathNoApi(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "/";

  let p = raw.startsWith("/") ? raw : `/${raw}`;

  while (p === "/api" || p.startsWith("/api/")) {
    p = p === "/api" ? "/" : p.slice(4);
  }

  return p.startsWith("/") ? p : `/${p}`;
}

function buildApiUrl(pathNoApi: string): string {
  const envBase = getEnvBase();
  const cleanPath = pathNoApi.startsWith("/") ? pathNoApi : `/${pathNoApi}`;
  const apiPrefix = "/api";

  if (!envBase) return `${apiPrefix}${cleanPath}`;

  const origin = envBase.endsWith("/api") ? envBase.slice(0, -4) : envBase;
  return `${origin}${apiPrefix}${cleanPath}`;
}

function isNoTenantHeaderPath(pathNoApi: string): boolean {
  // auth routes: MAI tenant header
  if (pathNoApi === "/auth/login") return true;
  if (pathNoApi.startsWith("/auth/")) return true;

  // health/telemetry eventuali
  if (pathNoApi === "/health" || pathNoApi.startsWith("/health/")) return true;
  if (pathNoApi.startsWith("/telemetry/")) return true;

  return false;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const pathNoApi = normalizePathNoApi(path);

  const headers: Record<string, string> = {
    ...(isNoTenantHeaderPath(pathNoApi) ? {} : getTenantHeader()),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth !== false && typeof window !== "undefined") {
    const token = window.localStorage.getItem("doflow_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = buildApiUrl(pathNoApi);

  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (json && typeof json === "object" && json.error) {
    throw new Error(json.error);
  }

  return (json ?? (text as unknown)) as T;
}
