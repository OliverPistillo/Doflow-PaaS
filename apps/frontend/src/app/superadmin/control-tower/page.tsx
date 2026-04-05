// apps/frontend/src/app/superadmin/control-tower/page.tsx
// DEPRECATA — redirect permanente alla nuova pagina unificata System Monitor.
// Preserva compatibilità con eventuali bookmark.

import { redirect } from "next/navigation";

export default function ControlTowerLegacyRedirect() {
  redirect("/superadmin/system?tab=hardware");
}
