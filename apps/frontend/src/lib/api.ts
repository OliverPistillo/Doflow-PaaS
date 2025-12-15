// src/lib/api.ts
import { getTenantHeader } from './tenant-fetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.doflow.it';

type ApiFetchOptions = RequestInit & { auth?: boolean };

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...getTenantHeader(),
    ...(options.headers as Record<string, string> | undefined),
  };

  // Se stai inviando JSON e non hai già Content-Type
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false && typeof window !== 'undefined') {
    const token = window.localStorage.getItem('doflow_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
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
    } catch {}
    throw new Error(message);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
