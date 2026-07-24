"use client";

import * as React from "react";
import { getCurrentTenantAccess, type EffectiveTenantAccess, type TenantModuleKey } from "@/lib/tenant-access-api";

type TenantAccessContextValue = {
  access: EffectiveTenantAccess | null;
  loading: boolean;
  error: string | null;
  canView: (moduleKey?: string | null) => boolean;
  canCreate: (moduleKey?: string | null) => boolean;
  canUpdate: (moduleKey?: string | null) => boolean;
  canDelete: (moduleKey?: string | null) => boolean;
  canManage: (moduleKey?: string | null) => boolean;
};

const TenantAccessContext = React.createContext<TenantAccessContextValue | null>(null);

function capability(access: EffectiveTenantAccess | null, moduleKey?: string | null) {
  if (!moduleKey) return { can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true };
  return access?.modules[moduleKey as TenantModuleKey] || { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false };
}

export function TenantAccessProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = React.useState<EffectiveTenantAccess | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCurrentTenantAccess()
      .then((data) => {
        if (!cancelled) {
          setAccess(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Permessi non disponibili");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const value = React.useMemo<TenantAccessContextValue>(() => ({
    access,
    loading,
    error,
    canView: (moduleKey) => capability(access, moduleKey).can_view,
    canCreate: (moduleKey) => capability(access, moduleKey).can_create,
    canUpdate: (moduleKey) => capability(access, moduleKey).can_update,
    canDelete: (moduleKey) => capability(access, moduleKey).can_delete,
    canManage: (moduleKey) => capability(access, moduleKey).can_manage,
  }), [access, loading, error]);

  return <TenantAccessContext.Provider value={value}>{children}</TenantAccessContext.Provider>;
}

export function useTenantAccess() {
  const context = React.useContext(TenantAccessContext);
  if (!context) throw new Error("useTenantAccess deve essere usato dentro TenantAccessProvider");
  return context;
}

export function useOptionalTenantAccess() {
  return React.useContext(TenantAccessContext);
}
