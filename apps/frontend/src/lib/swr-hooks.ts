// apps/frontend/src/lib/swr-hooks.ts
// Reusable SWR hooks for tenant data — provides intelligent caching,
// revalidation on focus, and dedupe across components.

import useSWR, { SWRConfiguration } from "swr";
import { apiFetch } from "./api";

const fetcher = <T>(url: string) => apiFetch<T>(url);

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 30_000,
};

export function useTenantPlan() {
  return useSWR<{
    tenantId: string;
    name: string;
    slug: string;
    planTier: "STARTER" | "PRO" | "ENTERPRISE";
    monthlyPrice: number;
    maxUsers: number;
    storageUsedMb: number;
    storageLimitGb: number;
    isActive: boolean;
    createdAt: string;
  }>("/tenant/self-service/plan", fetcher, defaultConfig);
}

export function useTenantModules() {
  return useSWR<{
    active: Array<{
      key: string;
      name: string;
      category: string;
      status: string;
      assignedAt: string;
      trialEndsAt: string | null;
    }>;
    available: Array<{
      key: string;
      name: string;
      description: string;
      category: string;
      minTier: "STARTER" | "PRO" | "ENTERPRISE";
      priceMonthly: number;
      isBeta: boolean;
      isActive: boolean;
    }>;
  }>("/tenant/self-service/modules", fetcher, defaultConfig);
}

export function useOnboardingStatus() {
  return useSWR<{
    completed: boolean;
    sector?: string;
    selectedModules?: string[];
    completedAt?: string;
  }>("/tenant/self-service/onboarding/status", fetcher, defaultConfig);
}

export function useNotifications() {
  return useSWR<Array<{
    id: string;
    title: string;
    message: string;
    targetTenantId: string | null;
    isRead: boolean;
    createdAt: string;
  }>>("/tenant/self-service/notifications", fetcher, {
    ...defaultConfig,
    refreshInterval: 60_000, // poll every minute
  });
}
