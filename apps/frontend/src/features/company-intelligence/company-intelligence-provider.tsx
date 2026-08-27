"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { usePlan } from "@/contexts/PlanContext"
import type {
  CompanyIntelligenceReport,
  IntelligenceSnapshot,
  IntelligenceStatus,
  ReportPermission,
} from "@/features/company-intelligence/company-intelligence-types"
import {
  companyIntelligenceApi,
  type CompanyIntelligenceReport as ServerCompanyReport,
} from "@/lib/tenant-feature-api"

type AnalysisInput = { requestedUrl: string; companyName?: string; linkedInUrl?: string; leadId?: string; customerId?: string; deep?: boolean; force?: boolean; serviceCatalog?: Array<{ id: string; name: string; active?: boolean }> }
type ActionResult = { ok: boolean; id?: string; message?: string; existing?: boolean; filename?: string; exported?: unknown }
type ContextValue = IntelligenceSnapshot & { loading: boolean; error?: string; refresh: () => Promise<void>; analyze: (input: AnalysisInput) => Promise<{ ok: boolean; id?: string; message?: string; recent?: boolean }>; share: (reportId: string, targetUserId: string, permission: ReportPermission) => Promise<ActionResult>; revokeShare: (reportId: string, targetUserId: string) => Promise<ActionResult>; addCompetitor: (reportId: string, requestedUrl: string, companyName?: string) => Promise<ActionResult>; removeCompetitor: (reportId: string, competitorId: string) => Promise<ActionResult>; exportReport: (reportId: string) => Promise<ActionResult>; remove: (reportId: string) => Promise<boolean>; getReport: (id?: string | null) => CompanyIntelligenceReport | undefined }

const empty: IntelligenceSnapshot = {
  reports: [],
  providers: [],
  policy: { cacheTtlHours: 0, retentionDays: 0, monthlyTokenBudget: 0, perAnalysisTokenLimit: 0, usedTokens: 0, remainingTokens: 0, aiConfigured: false, month: "" },
  notifications: [],
  transport: "server-postgresql",
  productionReady: true,
}
const Context = createContext<ContextValue | null>(null)
const statuses: IntelligenceStatus[] = ["queued", "collecting", "technical", "ai", "completed", "completed_without_ai", "partial", "failed", "cancelled"]

function reportStatus(value: string): IntelligenceStatus {
  return statuses.includes(value as IntelligenceStatus) ? value as IntelligenceStatus : "partial"
}

function score(value: unknown) {
  const number = Number(value ?? 0)
  return { value: Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0, explanation: "Valore restituito dal servizio di analisi" }
}

function mapReport(source: ServerCompanyReport, currentUserId: string): CompanyIntelligenceReport {
  const requested = source.requestedUrl || ""
  let domain = requested
  try { domain = new URL(requested).hostname } catch { domain = requested.replace(/^https?:\/\//, "").split("/")[0] }
  const findings = (source.findings ?? []).map((item, index) => ({
    id: item.id ?? `${source.id}:finding:${index}`,
    label: item.title,
    value: item.description ?? "Dato disponibile",
    status: (item.confidence ?? 0) >= 0.75 ? "positive" as const : "neutral" as const,
    evidenceId: item.sourceUrl ? `${source.id}:evidence:${index}` : undefined,
  }))
  const evidence: CompanyIntelligenceReport["evidence"] = (source.findings ?? []).filter((item) => item.sourceUrl).map((item, index) => ({
    id: `${source.id}:evidence:${index}`,
    title: item.title,
    source: item.sourceUrl ?? requested,
    url: item.sourceUrl,
    acquiredAt: source.completedAt ?? source.updatedAt ?? source.createdAt,
    excerpt: item.description ?? "",
    kind: item.evidenceKind === "declared" || item.evidenceKind === "estimate" || item.evidenceKind === "ai_suggestion" || item.evidenceKind === "unavailable" ? item.evidenceKind : "verified" as const,
    confidence: (item.confidence ?? 0) >= 0.75 ? "high" as const : (item.confidence ?? 0) >= 0.45 ? "medium" as const : "low" as const,
    available: true,
  }))
  const scores = source.scores ?? {}
  const strategy = source.strategy ?? {}
  const timestamp = source.updatedAt ?? source.completedAt ?? source.createdAt
  return {
    id: source.id,
    ownerId: currentUserId,
    sharedUserIds: (source.shares ?? []).map((item) => item.userId),
    shares: source.shares ?? [],
    companyName: source.companyName || domain,
    requestedUrl: requested,
    domain,
    finalUrl: source.finalUrl,
    linkedInUrl: source.linkedinUrl,
    leadId: source.leadId,
    customerId: source.customerId,
    status: reportStatus(source.status),
    deep: source.deep === true,
    createdAt: source.createdAt,
    updatedAt: timestamp,
    completedAt: source.completedAt ?? undefined,
    expiresAt: timestamp,
    retentionUntil: timestamp,
    error: source.error ?? undefined,
    summary: source.summary ?? source.shortDescription,
    aiAvailable: source.aiAvailable === true,
    evidence,
    findings,
    publicContacts: {
      emails: source.publicContacts?.emails ?? [],
      phones: source.publicContacts?.phones ?? [],
      socials: source.publicContacts?.socials ?? [],
    },
    pages: source.pages ?? [],
    technologies: source.techStack ?? [],
    scores: {
      technical: score(scores.technical),
      digitalPresence: score(scores.digitalPresence ?? scores.digital_presence),
      commercialOpportunity: score(scores.commercialOpportunity ?? scores.commercial_opportunity),
      dataReliability: score(scores.dataReliability ?? scores.data_reliability),
    },
    opportunities: (source.opportunities ?? []).map((item) => ({ serviceName: item.title, reason: item.description ?? "" })),
    strategy: {
      approach: strategy.approach ?? [],
      questions: strategy.questions ?? [],
      avoidClaims: strategy.avoidClaims ?? [],
      firstMessage: strategy.firstMessage,
      email: strategy.email,
      followUp: strategy.followUp,
    },
    competitors: (source.competitors ?? []).map((item) => {
      let competitorDomain = item.requestedUrl
      try { competitorDomain = new URL(item.requestedUrl).hostname } catch { competitorDomain = item.requestedUrl.replace(/^https?:\/\//, "").split("/")[0] }
      return { id: item.id, domain: competitorDomain, requestedUrl: item.requestedUrl, finalUrl: item.requestedUrl, companyName: item.companyName ?? competitorDomain, addedAt: timestamp, addedBy: currentUserId, findings: [], evidence: [], publicContacts: { emails: [], phones: [], socials: [] }, technologies: [], scores: { technical: score(0), digitalPresence: score(0), dataReliability: score(0) } }
    }),
    audit: [],
    access: "view",
  }
}

export function CompanyIntelligenceProvider({ children }: { children: React.ReactNode }) {
  const identity = useDoflowIdentity()
  const { activeModules, loading: planLoading } = usePlan()
  const canView = identity.hasCapability("canViewCompanyIntelligence") && !planLoading && activeModules.has("crm.sales-intel")
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    if (!canView) {
      setSnapshot(empty)
      setError(undefined)
      setLoading(false)
      return
    }
    try {
      const page = await companyIntelligenceApi.list({ limit: 200 })
      const reports = page.items.map((item) => mapReport(item, identity.currentUserId))
      const providerMap = new Map<string, { id: "website"; label: string; configured: boolean; detail: string }>()
      for (const report of page.items) {
        for (const provider of report.providers ?? []) {
          providerMap.set(provider.provider, { id: "website", label: provider.provider, configured: provider.configured, detail: provider.message ?? provider.status ?? "" })
        }
      }
      setSnapshot((current) => ({
        ...current,
        reports,
        providers: [...providerMap.values()],
        policy: { ...current.policy, aiConfigured: page.items.some((item) => item.aiAvailable === true) },
      }))
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analisi azienda non disponibile")
    } finally {
      setLoading(false)
    }
  }, [canView, identity.currentUserId])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const poll = canView ? window.setInterval(() => void refresh(), 15_000) : undefined
    return () => { window.clearTimeout(initial); if (poll !== undefined) window.clearInterval(poll) }
  }, [canView, refresh])
  const action = useCallback(async (operation: () => Promise<unknown>, fallback: string): Promise<ActionResult> => {
    try {
      const result = await operation()
      await refresh()
      return { ok: true, ...((result && typeof result === "object") ? result : {}) }
    } catch (cause) {
      return { ok: false, message: cause instanceof Error ? cause.message : fallback }
    }
  }, [refresh])

  const analyze = useCallback(async (input: AnalysisInput) => {
    try {
      const report = await companyIntelligenceApi.analyze(input)
      if (!report) return { ok: false, message: "Provider di analisi non configurato" }
      await refresh()
      return { ok: true, id: report.id }
    } catch (cause) {
      return { ok: false, message: cause instanceof Error ? cause.message : "Analisi non avviata" }
    }
  }, [refresh])
  const value = useMemo<ContextValue>(() => ({
    ...snapshot,
    loading,
    error,
    refresh,
    analyze,
    share: (reportId, targetUserId, permission) => action(() => companyIntelligenceApi.share(reportId, targetUserId, permission), "Condivisione non riuscita"),
    revokeShare: (reportId, targetUserId) => action(() => companyIntelligenceApi.revokeShare(reportId, targetUserId), "Revoca non riuscita"),
    addCompetitor: (reportId, requestedUrl, companyName) => action(() => companyIntelligenceApi.addCompetitor(reportId, requestedUrl, companyName), "Competitor non aggiunto"),
    removeCompetitor: (reportId, competitorId) => action(() => companyIntelligenceApi.removeCompetitor(reportId, competitorId), "Competitor non rimosso"),
    exportReport: (reportId) => action(() => companyIntelligenceApi.exportReport(reportId), "Export non riuscito"),
    remove: async (reportId) => (await action(() => companyIntelligenceApi.remove(reportId), "Report non rimosso")).ok,
    getReport: (id) => snapshot.reports.find((item) => item.id === id),
  }), [action, analyze, error, loading, refresh, snapshot])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useCompanyIntelligence() {
  const value = useContext(Context)
  if (!value) throw new Error("useCompanyIntelligence deve essere usato nel CompanyIntelligenceProvider")
  return value
}
