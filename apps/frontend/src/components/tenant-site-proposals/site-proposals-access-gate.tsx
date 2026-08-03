"use client";

import { ShieldAlert } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { getDoFlowUser } from "@/lib/jwt";
import { Skeleton } from "@/components/ui/skeleton";

const ALLOWED_ROLES = new Set(["manager", "admin", "owner", "superadmin", "super_admin"]);

export function SiteProposalsAccessGate({ children }: { children: React.ReactNode }) {
  const { access, loading, canView } = useTenantAccess();
  const user = getDoFlowUser();
  const tenant = String(user?.tenantSlug || user?.tenantId || "").trim().toLowerCase();
  const role = String(user?.role || access?.role || "").trim().toLowerCase();
  if (loading) return <main className="space-y-4 px-4 py-6 sm:px-6 lg:px-8"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></main>;
  if (tenant !== "doflow" || !ALLOWED_ROLES.has(role) || !canView("crm")) {
    return <main className="flex min-h-[50vh] items-center justify-center px-4"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-slate-500" /><h1 className="mt-4 text-lg font-semibold text-slate-950">Modulo non disponibile</h1><p className="mt-2 text-sm text-slate-500">Questa area non è disponibile per l’account corrente.</p></div></main>;
  }
  return <>{children}</>;
}
