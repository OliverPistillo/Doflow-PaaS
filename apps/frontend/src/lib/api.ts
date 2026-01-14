// apps/frontend/src/lib/api.ts
import { getTenantHeader } from './tenant-fetch';

type ApiFetchOptions = RequestInit & { auth?: boolean };

/**
 * Decide il base URL in modo robusto:
 * - Se NEXT_PUBLIC_API_URL è definita (es. https://api.doflow.it) => usa quella
 * - Altrimenti usa /api (proxy Next verso backend)
 */
function getApiBase(): string {
  // Evita di affidarti a process in runtime browser: Next sostituisce a build-time,
  // ma qui lo usiamo solo come stringa statica "iniettata".
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase && typeof envBase === 'string' && envBase.trim().length > 0) {
    return envBase.replace(/\/+$/, '');
  }
  return '/api';
}

/**
 * Normalizza il path:
 * - accetta "auth/login", "/auth/login", "/api/auth/login"
 * - restituisce sempre "/auth/login" (senza prefissi duplicati)
 */
function normalizePath(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '/';

  let p = raw.startsWith('/') ? raw : `/${raw}`;

  // elimina prefissi ripetuti "/api"
  // es: "/api/auth/login" -> "/auth/login"
  // es: "/api/api/auth/login" -> "/auth/login"
  while (p.startsWith('/api/')) p = p.slice(4); // rimuove "/api"
  if (p === '/api') p = '/';

  return p;
}

/**
 * Se base è "/api" e path è "/auth/login" => "/api/auth/login"
 * Se base è "https://api.doflow.it" => "https://api.doflow.it/auth/login"
 */
function buildUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const base = getApiBase();
  const normalizedPath = normalizePath(path);

  const headers: Record<string, string> = {
    ...getTenantHeader(),
    ...(options.headers as Record<string, string> | undefined),
  };

  // Content-Type JSON solo se non FormData e non già impostato
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Auth di default ON (a meno che auth:false)
  if (options.auth !== false && typeof window !== 'undefined') {
    const token = window.localStorage.getItem('doflow_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = buildUrl(base, normalizedPath);

  const res = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const text = await res.text();

  if (!res.ok) {
    let message = text || `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
