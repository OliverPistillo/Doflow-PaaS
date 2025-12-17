import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";

export default function SuperadminLayout({ children }: { children: ReactNode }) {
  // per ora: fallback. Se vuoi lo rendiamo dinamico leggendo il token lato client con un wrapper.
  return (
    <DashboardLayout role="SUPER_ADMIN" userEmail="superadmin">
      {children}
    </DashboardLayout>
  );
}
