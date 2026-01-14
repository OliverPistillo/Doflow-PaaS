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

/**
 * Ritorna il path SENZA prefisso /api
 * - "auth/login" -> "/auth/login"
 * - "/auth/login" -> "/auth/login"
 * - "/api/auth/login" -> "/auth/login"
 * - "/api/api/auth/login" -> "/auth/login"
 */
function normalizePathNoApi(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "/";

  let p = raw.startsWith("/") ? raw : `/${raw}`;

  // rimuove uno o più prefissi /api
  while (p === "/api" || p.startsWith("/api/")) {
    p = p === "/api" ? "/" : p.slice(4);
  }

  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Costruisce sempre URL verso /api del backend (una sola volta)
 * - Se NEXT_PUBLIC_API_URL non c'è => usa proxy Next: "/api" + path
 * - Se NEXT_PUBLIC_API_URL è "https://api.doflow.it" => "https://api.doflow.it/api" + path
 * - Se NEXT_PUBLIC_API_URL è "https://api.doflow.it/api" => "https://api.doflow.it/api" + path
 */
function buildApiUrl(pathNoApi: string): string {
  const envBase = getEnvBase();

  const cleanPath = pathNoApi.startsWith("/") ? pathNoApi : `/${pathNoApi}`;
  const apiPrefix = "/api";

  // proxy next (relative)
  if (!envBase) return `${apiPrefix}${cleanPath}`;

  // se envBase include già /api alla fine, lo togliamo e lo rimettiamo (così non duplichiamo mai)
  const origin = envBase.endsWith("/api") ? envBase.slice(0, -4) : envBase;

  return `${origin}${apiPrefix}${cleanPath}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const pathNoApi = normalizePathNoApi(path);

  const headers: Record<string, string> = {
    ...getTenantHeader(),
    ...(options.headers as Record<string, string> | undefined),
  };

  // Content-Type JSON solo se non FormData e non già impostato
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Auth di default ON (a meno che auth:false)
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

  // NOTE: il tuo backend a volte risponde 201 con { error: "..." } (l'hai visto tu)
  // Quindi: errore se !ok O se payload contiene "error".
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

  // se non è JSON, torna testo
  return (json ?? (text as unknown)) as T;
}
