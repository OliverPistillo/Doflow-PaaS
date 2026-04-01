// apps/frontend/src/app/superadmin/system/page.tsx
// Entry point del System Monitor unificato (ex control-tower + system-health + api-usage + audit).
// Legge ?tab=xxx dall'URL per la navigazione diretta.

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { SystemMonitorClient } from "./system-monitor-client";

export const metadata = {
  title: "System Monitor — DoFlow Superadmin",
};

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function SystemPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SystemMonitorClient />
    </Suspense>
  );
}
