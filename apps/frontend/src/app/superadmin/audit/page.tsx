// apps/frontend/src/app/superadmin/audit/page.tsx
// DEPRECATA — l'Audit Log è ora una tab del System Monitor unificato.

import { redirect } from "next/navigation";

export default function AuditLegacyRedirect() {
  redirect("/superadmin/system?tab=audit");
}
