"use client";

import type { ReactNode } from "react";

export function CredentialsEmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}
