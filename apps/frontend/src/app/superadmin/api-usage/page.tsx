// apps/frontend/src/app/superadmin/api-usage/page.tsx
// DEPRECATA — redirect permanente alla nuova pagina unificata System Monitor.

import { redirect } from "next/navigation";

export default function ApiUsageLegacyRedirect() {
  redirect("/superadmin/system?tab=api-usage");
}
