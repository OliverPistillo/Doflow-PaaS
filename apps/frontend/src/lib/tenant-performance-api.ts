"use client";

import { apiFetch } from "@/lib/api";
import type { PointLedgerEntry, PointPolicy } from "@/features/commercial/commercial-collaboration";
import type { CommercialGoal, RankingConfig, RankingRole, RankingSnapshot } from "@/features/commercial/commercial-provider-types";

export type MissionGoal = CommercialGoal & { currentValue: number | null; progress: number | null; redacted: boolean };
export type PerformanceState = {
  pointPolicy: PointPolicy | null;
  policy: { id: string; version: number; name: string; formula: Record<string, number> } | null;
  pointLedger: PointLedgerEntry[];
  rankingConfigs: Array<RankingConfig & { formulaVersion: number; optimisticVersion: number }>;
  rankingSnapshots: RankingSnapshot[];
  goals: CommercialGoal[];
  mission: { items: MissionGoal[] };
  adapters: Array<{ name: string; enabled: boolean; configured: boolean; synthetic: boolean; required_secret_names: string[]; health_state: string; last_error?: string | null }>;
  permissions: { admin: boolean; canViewFinance: boolean; canViewGlobalPoints: boolean; canManagePolicy: boolean; canManageRankings: boolean; canManageGoals: boolean };
};

export type RankingPreview = {
  period: string;
  role: RankingRole;
  formulaVersion: number;
  rows: Array<{ userId: string; name: string; score: number; position: number; tied: boolean; metrics: Record<string, number> }>;
};

export const performanceApi = {
  state: (signal?: AbortSignal) =>
    apiFetch<PerformanceState>("/tenant/doflow/performance", { signal }),
  updatePolicy: (formula: PointPolicy, reason: string) => apiFetch<{ pointPolicy: PointPolicy; version: number }>("/tenant/doflow/performance/point-policy", { method: "PATCH", body: JSON.stringify({ formula, reason }) }),
  adjustPoints: (body: { userId: string; amount: number; reason: string }, idempotencyKey: string) => apiFetch<PointLedgerEntry>("/tenant/doflow/performance/point-ledger/adjustments", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) }),
  updateRankingConfig: (role: RankingRole, metrics: RankingConfig["metrics"], optimisticVersion: number) => apiFetch<RankingConfig & { formulaVersion: number; optimisticVersion: number }>(`/tenant/doflow/performance/rankings/configs/${role}`, { method: "PATCH", body: JSON.stringify({ metrics, optimisticVersion }) }),
  previewRanking: (period: string, role: RankingRole) => apiFetch<RankingPreview>(`/tenant/doflow/performance/rankings/preview?period=${encodeURIComponent(period)}&role=${encodeURIComponent(role)}`),
  consolidateRanking: (period: string, role: RankingRole, reason?: string) => apiFetch<RankingSnapshot>(`/tenant/doflow/performance/rankings/${period}/${role}/consolidate`, { method: "POST", body: JSON.stringify({ reason }) }),
  recalculateRanking: (snapshot: RankingSnapshot, reason: string) => apiFetch<RankingSnapshot>(`/tenant/doflow/performance/rankings/snapshots/${snapshot.id}/recalculate`, { method: "POST", body: JSON.stringify({ period: snapshot.period, role: snapshot.role, reason }) }),
  revokeRanking: (snapshotId: string, reason: string) => apiFetch<Partial<RankingSnapshot>>(`/tenant/doflow/performance/rankings/snapshots/${snapshotId}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }),
  setSyntheticAdapter: (enabled: boolean) => apiFetch<Record<string, unknown>>("/tenant/doflow/performance/adapters/acceptance-synthetic", { method: "PATCH", body: JSON.stringify({ enabled }) }),
};
