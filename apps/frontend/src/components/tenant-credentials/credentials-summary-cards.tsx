"use client";

import type { CredentialsDashboard } from "@/lib/tenant-credentials-types";
import { MetricCard } from "./credentials-shared";

export function CredentialsSummaryCards({ summary }: { summary?: CredentialsDashboard | null }) {
  const data = summary || {
    totalCredentials: 0,
    activeCredentials: 0,
    archivedCredentials: 0,
    expiringCredentials: 0,
    renewalsDue: 0,
    rotationDue: 0,
    expiredCredentials: 0,
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <MetricCard label="Totali" value={data.totalCredentials || 0} />
      <MetricCard label="Attive" value={data.activeCredentials || 0} tone={(data.activeCredentials || 0) > 0 ? "success" : "default"} />
      <MetricCard label="In scadenza" value={data.expiringCredentials || 0} tone={(data.expiringCredentials || 0) > 0 ? "warning" : "default"} />
      <MetricCard label="Scadute" value={data.expiredCredentials || 0} tone={(data.expiredCredentials || 0) > 0 ? "danger" : "default"} />
      <MetricCard label="Rinnovi dovuti" value={data.renewalsDue || 0} tone={(data.renewalsDue || 0) > 0 ? "warning" : "default"} />
      <MetricCard label="Rotazioni dovute" value={data.rotationDue || 0} tone={(data.rotationDue || 0) > 0 ? "warning" : "default"} />
    </div>
  );
}

