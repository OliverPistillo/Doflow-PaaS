import type { NextFetchEvent, NextRequest } from "next/server";

import { middleware as applicationMiddleware } from "../middleware";

// Next selects src/middleware.ts when the application uses a src/ tree.
// Delegate to the canonical application middleware so the local visual gate
// cannot replace production security and tenant-routing behavior.
export function middleware(request: NextRequest, event: NextFetchEvent) {
  return applicationMiddleware(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
