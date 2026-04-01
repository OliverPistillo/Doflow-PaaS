// apps/frontend/src/app/superadmin/system-health/page.tsx
// DEPRECATA — redirect permanente alla nuova pagina unificata System Monitor.

import { redirect } from "next/navigation";

export default function SystemHealthLegacyRedirect() {
  redirect("/superadmin/system?tab=services");
}
