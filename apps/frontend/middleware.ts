import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

// Configurazione Circuit Breaker
const MAX_REDIRECTS = 5;
const LOOP_COOKIE = 'doflow_loop_guard';

function isValidSlug(s: string) {
  return /^[a-z0-9_]+$/i.test(s);
}

function extractTenantFromPath(pathname: string): string | null {
  const seg = pathname.split('?')[0].split('/').filter(Boolean)[0];
  if (!seg) return null;

  // reserved
  const reserved = new Set([
    'login',
    'logout',
    'superadmin',
    'admin',
    'dashboard',
    'forgot-password',
    'reset-password',
    'terms',
    'privacy',
    'auth',
    'api',
    '_next',
    'favicon.ico',
  ]);

  if (reserved.has(seg)) return null;
  if (!isValidSlug(seg)) return null;

  return seg.toLowerCase();
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const headers = new Headers(req.headers);

  // 🛡️ 1. SECURITY FIX: CVE-2025-29927
  headers.delete('x-middleware-subrequest');
  headers.delete('x-middleware-next');

  // ✅ Hint pathname per SSR tenant resolution
  headers.set('x-doflow-pathname', req.nextUrl.pathname);

  // ✅ Se stai usando path-mode (/businaro/...), setta slug header
  const tenantFromPath = extractTenantFromPath(req.nextUrl.pathname);
  if (tenantFromPath) {
    headers.set('x-doflow-tenant-id', tenantFromPath);
  }

  // 🔄 2. Circuit Breaker per Redirect Loop
  const loopCount = parseInt(req.cookies.get(LOOP_COOKIE)?.value || '0', 10);

  if (loopCount > MAX_REDIRECTS) {
    event.waitUntil(
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/telemetry/log`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'CIRCUIT_BREAKER_TRIP',
          ip: req.headers.get('x-forwarded-for') ?? 'unknown',
          path: req.nextUrl.pathname,
        }),
      }),
    );

    return new NextResponse(
      JSON.stringify({ error: 'Too many redirects', code: 'ERR_LOOP' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 🚦 3. Emergency Mode & System Bypass List
  const isSystemPath = req.nextUrl.pathname.startsWith('/api/cron');
  const authHeader = req.headers.get('Authorization');

  if (isSystemPath) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized System Call', { status: 401 });
    }
    return NextResponse.next({ request: { headers } });
  }

  const res = NextResponse.next({ request: { headers } });

  if (loopCount > 0) {
    res.cookies.delete(LOOP_COOKIE);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
