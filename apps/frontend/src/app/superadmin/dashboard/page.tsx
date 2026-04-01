// apps/frontend/src/app/superadmin/dashboard/page.tsx
// SPOSTATA a /superadmin/sales/dashboard
// Redirect per preservare bookmark e link diretti esistenti.

import { redirect } from "next/navigation";

export default function DashboardLegacyRedirect() {
  redirect("/superadmin/sales/dashboard");
}
