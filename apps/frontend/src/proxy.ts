import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const MAX_REDIRECTS = 5;
const LOOP_COOKIE = "doflow_loop_guard";

function isValidSlug(value: string) {
  return /^[a-z0-9_]+$/i.test(value);
}

function extractTenantFromPath(pathname: string): string | null {
  const segment = pathname.split("?")[0].split("/").filter(Boolean)[0];
  if (!segment) return null;

  const reserved = new Set([
    "login",
    "logout",
    "signup",
    "superadmin",
    "admin",
    "dashboard",
    "onboarding",
    "forgot-password",
    "reset-password",
    "terms",
    "privacy",
    "auth",
    "meeting",
    "api",
    "_next",
    "favicon.ico",
  ]);

  if (reserved.has(segment) || !isValidSlug(segment)) return null;
  return segment.toLowerCase();
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const headers = new Headers(request.headers);

  // Never trust internal routing headers supplied by the browser.
  headers.delete("x-middleware-subrequest");
  headers.delete("x-middleware-next");

  // The headed visual gate remains same-origin on localhost while Next proxies
  // approved API calls to the remote backend. This flag is off in production.
  if (
    process.env.DOFLOW_VISUAL_SERVER_MODE === "1" &&
    request.nextUrl.pathname.startsWith("/api/")
  ) {
    headers.delete("origin");
  }

  headers.set("x-doflow-pathname", request.nextUrl.pathname);

  const tenantFromPath = extractTenantFromPath(request.nextUrl.pathname);
  if (tenantFromPath) {
    headers.set("x-doflow-tenant-id", tenantFromPath);
  }

  const loopCount = Number.parseInt(
    request.cookies.get(LOOP_COOKIE)?.value || "0",
    10,
  );

  if (loopCount > MAX_REDIRECTS) {
    const telemetryBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (telemetryBaseUrl) {
      event.waitUntil(
        fetch(`${telemetryBaseUrl.replace(/\/$/, "")}/telemetry/log`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            type: "CIRCUIT_BREAKER_TRIP",
            ip: request.headers.get("x-forwarded-for") ?? "unknown",
            path: request.nextUrl.pathname,
          }),
        }).catch(() => undefined),
      );
    }

    return NextResponse.json(
      { error: "Too many redirects", code: "ERR_LOOP" },
      { status: 429 },
    );
  }

  if (request.nextUrl.pathname.startsWith("/api/cron")) {
    const authHeader = request.headers.get("authorization");
    if (
      !process.env.CRON_SECRET ||
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new NextResponse("Unauthorized System Call", { status: 401 });
    }
    return NextResponse.next({ request: { headers } });
  }

  const response = NextResponse.next({ request: { headers } });
  if (loopCount > 0) response.cookies.delete(LOOP_COOKIE);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
