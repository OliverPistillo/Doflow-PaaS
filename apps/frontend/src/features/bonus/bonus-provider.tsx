"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { bonusApi, type BonusDashboard } from "@/lib/tenant-feature-api"

export type BonusPolicyDto = { id: string; version: number; pointEuroCents: number; minimumRequestPoints: number; reservePoints: number; monthlyCapPoints: number; collectedEuroPerPoint: number; effectiveFrom: string; effectiveTo?: string | null }
export type BonusWalletDto = { userId: string; provisionalPoints: number; consolidatedPoints: number; availablePoints: number; reservePoints: number; lockedPoints: number; redeemedPoints: number; negativePoints: number; revision: number; lastViewedAt?: string | null; updatedAt: string }
export type BonusLedgerDto = { id: string; userId: string; points: number; bucket: string; rule: string; status: string; reason: string; sourceType: string; sourceId: string; createdBy: string; approvedBy?: string | null; occurredAt: string; createdAt: string }
export type BonusRequestDto = { id: string; code: string; userId: string; points: number; euroCents: number; conversionEuroCents: number; status: string; submittedAt?: string | null; createdAt: string; history: Array<{ id: string; status: string; reason?: string | null; actorId: string; createdAt: string }>; approvals: Array<{ id: string; approverId: string; decision: string; reason?: string | null; createdAt: string }>; payouts: Array<{ id: string; amountCents: number; reference: string; paidBy: string; paidAt: string }> }
export type BonusSnapshot = { policy: BonusPolicyDto; targetUserId: string; wallet: BonusWalletDto | null; periods: Array<{ id: string; userId: string; month: string; status: string; provisional: number; consolidated: number; closedAt?: string | null }>; ledger: BonusLedgerDto[]; requests: BonusRequestDto[]; pendingRequests: BonusRequestDto[]; newPoints: number; canManage: boolean; generatedAt: string; storage: "server-postgresql" }
type Result = { ok: boolean; id?: string; existing?: boolean; message?: string }
type BonusContextValue = { snapshot: BonusSnapshot | null; loading: boolean; error?: string; refresh: (userId?: string) => Promise<void>; action: (body: Record<string, unknown>) => Promise<Result> }

const BonusContext = createContext<BonusContextValue | null>(null)

export function BonusProvider({ children }: { children: React.ReactNode }) {
  const identity = useDoflowIdentity()
  const [snapshot, setSnapshot] = useState<BonusSnapshot | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>()

  const refresh = useCallback(async (userId?: string) => {
    setLoading(true)
    try {
      const payload = await bonusApi.dashboard(userId)
      setSnapshot(mapDashboard(payload, userId ?? identity.currentUserId)); setError(undefined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Portafoglio non disponibile") }
    finally { setLoading(false) }
  }, [identity.currentUserId])
  const policyId = snapshot?.policy.id

  const action = useCallback(async (body: Record<string, unknown>) => {
    try {
      const operation = String(body.action ?? "")
      let result: { id?: string; periodId?: string | null } | null = null
      if (operation === "request") {
        result = await bonusApi.request(Number(body.points), String(body.reason ?? ""))
      } else if (operation === "decide") {
        result = await bonusApi.decide(String(body.requestId ?? ""), body.approve === true ? "approve" : "reject", String(body.reason ?? ""))
      } else if (operation === "adjustment") {
        result = await bonusApi.adjustment(String(body.userId ?? ""), Number(body.points), String(body.reason ?? ""))
      } else if (operation === "policy") {
        const rules = Object.fromEntries(["pointEuroCents", "minimumRequestPoints", "reservePoints", "monthlyCapPoints", "collectedEuroPerPoint"].map((key) => [key, Number(body[key] ?? 0)]))
        result = await bonusApi.policy(policyId ? `Regolamento ${policyId}` : "Regolamento Bonus", rules, "Aggiornamento regolamento")
      } else if (operation === "consolidate") {
        result = await bonusApi.consolidate(String(body.periodId ?? ""), String(body.reason ?? "Consolidamento mensile"))
      } else if (operation === "payout") {
        result = await bonusApi.payout(String(body.requestId ?? ""), String(body.reference ?? ""), String(body.idempotencyKey ?? "") || undefined)
      } else {
        return { ok: false, message: "Operazione Bonus non supportata" }
      }
      await refresh()
      return { ok: true, id: result?.id ?? result?.periodId ?? undefined }
    } catch (cause) {
      return { ok: false, message: cause instanceof Error ? cause.message : "Operazione non riuscita" }
    }
  }, [policyId, refresh])

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  return <BonusContext.Provider value={{ snapshot, loading, error, refresh, action }}>{children}</BonusContext.Provider>
}

function mapDashboard(source: BonusDashboard, targetUserId: string): BonusSnapshot {
  const pointEuroCents = source.policy?.pointEuroCents ?? 0
  const request = (item: BonusDashboard["requests"][number]): BonusRequestDto => ({
    id: item.id,
    code: `BON-${item.id.slice(0, 8).toUpperCase()}`,
    userId: item.userId ?? targetUserId,
    points: item.points,
    euroCents: item.points * pointEuroCents,
    conversionEuroCents: pointEuroCents,
    status: item.status === "pending" ? "submitted" : item.status,
    submittedAt: item.createdAt,
    createdAt: item.createdAt,
    history: item.history ?? [],
    approvals: item.approvals ?? [],
    payouts: (item.payouts ?? []).map((payout) => ({ ...payout, amountCents: item.points * pointEuroCents })),
  })
  const reserved = source.wallet.reservedPoints ?? 0
  return {
    policy: {
      id: source.policy?.id ?? "",
      version: source.policy?.version ?? 0,
      pointEuroCents,
      minimumRequestPoints: source.policy?.minimumRequestPoints ?? 0,
      reservePoints: source.policy?.reservePoints ?? 0,
      monthlyCapPoints: source.policy?.monthlyCapPoints ?? 0,
      collectedEuroPerPoint: source.policy?.collectedEuroPerPoint ?? 0,
      effectiveFrom: source.periods[0]?.startsAt ?? new Date(0).toISOString(),
    },
    targetUserId,
    wallet: {
      userId: targetUserId,
      provisionalPoints: source.wallet.provisionalPoints ?? 0,
      consolidatedPoints: source.wallet.availablePoints + reserved,
      availablePoints: source.wallet.availablePoints,
      reservePoints: source.policy?.reservePoints ?? 0,
      lockedPoints: reserved,
      redeemedPoints: Math.abs(source.ledger.filter((entry) => entry.points < 0).reduce((sum, entry) => sum + entry.points, 0)),
      negativePoints: source.ledger.filter((entry) => entry.points < 0).reduce((sum, entry) => sum + entry.points, 0),
      revision: 0,
      updatedAt: source.ledger[0]?.occurredAt ?? new Date(0).toISOString(),
    },
    periods: source.periods.map((item) => ({ id: item.id, userId: targetUserId, month: item.label, status: item.status, provisional: 0, consolidated: 0 })),
    ledger: source.ledger.map((item) => ({
      id: item.id,
      userId: targetUserId,
      points: item.points,
      bucket: item.bucket ?? "consolidated",
      rule: item.status ?? "movimento",
      status: item.status ?? "registered",
      reason: item.reason,
      sourceType: "point_ledger",
      sourceId: item.id,
      createdBy: targetUserId,
      occurredAt: item.occurredAt,
      createdAt: item.occurredAt,
    })),
    requests: source.requests.map(request),
    pendingRequests: source.pendingRequests.map(request),
    newPoints: 0,
    canManage: source.canManage,
    generatedAt: new Date().toISOString(),
    storage: "server-postgresql",
  }
}

export function useBonus() {
  const value = useContext(BonusContext)
  if (!value) throw new Error("useBonus deve essere usato dentro BonusProvider")
  return value
}
