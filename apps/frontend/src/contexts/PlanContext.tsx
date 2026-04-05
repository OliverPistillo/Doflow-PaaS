"use client";
/**
 * PlanContext — Stato globale del piano del tenant corrente.
 * Legge planTier dal JWT (immediato) e lo arricchisce da /tenant/me.
 *
 * USO:
 *   const { plan, tenantInfo, can } = usePlan();
 *   if (!can("PRO")) return <LockedFeature minPlan="PRO" />;
 */

import * as React from "react";
import { getDoFlowUser } from "@/lib/jwt";
import { planIncludes, PLAN_META, type PlanTier } from "@/lib/plans";
import { apiFetch } from "@/lib/api";

export interface TenantInfo {
  id:             string | null;
  name:           string;
  slug:           string;
  planTier:       PlanTier;
  isActive:       boolean;
  maxUsers:       number;
  storageUsedMb:  number;
  storageLimitGb: number;
  adminEmail?:    string;
  createdAt?:     string;
}

interface PlanContextValue {
  plan:       PlanTier;
  tenantInfo: TenantInfo | null;
  loading:    boolean;
  can:        (minPlan: PlanTier) => boolean;
  meta:       typeof PLAN_META[PlanTier];
}

const PlanContext = React.createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = React.useState<PlanTier>(() => {
    if (typeof window === "undefined") return "STARTER";
    return getDoFlowUser()?.planTier ?? "STARTER";
  });

  const [tenantInfo, setTenantInfo] = React.useState<TenantInfo | null>(null);
  const [loading, setLoading]       = React.useState(true);

  React.useEffect(() => {
    apiFetch<TenantInfo>("/tenant/me")
      .then((data) => {
        setTenantInfo(data);
        if (data.planTier && data.planTier !== plan) setPlan(data.planTier);
      })
      .catch(() => { /* fallback silenzioso: piano da JWT */ })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const can = React.useCallback(
    (minPlan: PlanTier) => planIncludes(plan, minPlan),
    [plan],
  );

  return (
    <PlanContext.Provider value={{ plan, tenantInfo, loading, can, meta: PLAN_META[plan] }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = React.useContext(PlanContext);
  if (!ctx) throw new Error("usePlan() deve essere usato dentro <PlanProvider>");
  return ctx;
}
