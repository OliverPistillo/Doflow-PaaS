// apps/frontend/src/app/superadmin/metrics/page.tsx
// DEPRECATA — i KPI SaaS (MRR, ARR, churn) sono ora nella Control Room.
// Redirect all'overview principale.

import { redirect } from "next/navigation";

export default function MetricsLegacyRedirect() {
  redirect("/superadmin");
}
