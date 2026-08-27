export type IntelligenceStatus = "queued" | "collecting" | "technical" | "ai" | "completed" | "completed_without_ai" | "partial" | "failed" | "cancelled"
export type EvidenceKind = "verified" | "declared" | "estimate" | "ai_suggestion" | "unavailable"
export type IntelligenceEvidence = { id: string; title: string; source: string; url?: string; acquiredAt: string; excerpt: string; kind: EvidenceKind; confidence: "high" | "medium" | "low"; available: boolean }
export type ProviderState = { id: "website" | "pagespeed" | "search" | "places" | "reviews" | "linkedin" | "openai"; label: string; configured: boolean; detail: string }
export type IntelligenceScore = { value: number; explanation: string }
export type TechnicalFinding = { id: string; label: string; value: string; status: "positive" | "attention" | "neutral"; evidenceId?: string }
export type ReportPermission = "view" | "edit"
export type ReportShare = { userId: string; permission: ReportPermission; sharedAt: string; sharedBy: string }
export type ReportAuditEntry = { id: string; action: "created" | "completed" | "shared" | "share_updated" | "share_revoked" | "competitor_added" | "competitor_removed" | "exported"; authorId: string; date: string; detail: string }
export type IntelligenceCompetitor = { id: string; domain: string; requestedUrl: string; finalUrl: string; companyName: string; addedAt: string; addedBy: string; findings: TechnicalFinding[]; evidence: IntelligenceEvidence[]; publicContacts: { emails: string[]; phones: string[]; socials: string[] }; technologies: string[]; scores: { technical: IntelligenceScore; digitalPresence: IntelligenceScore; dataReliability: IntelligenceScore } }
export type CompanyIntelligenceReport = {
  id: string; ownerId: string; sharedUserIds: string[]; shares: ReportShare[]; companyName: string; requestedUrl: string; domain: string; finalUrl?: string; linkedInUrl?: string; linkedInConfirmedAt?: string; linkedInConfirmedBy?: string; leadId?: string; customerId?: string
  status: IntelligenceStatus; deep: boolean; createdAt: string; updatedAt: string; completedAt?: string; expiresAt: string; retentionUntil: string; cacheHit?: boolean; error?: string; diagnosticCode?: string; errorSuggestion?: string; attemptCount?: number; summary?: string; aiAvailable: boolean; aiModel?: string
  evidence: IntelligenceEvidence[]; findings: TechnicalFinding[]; publicContacts: { emails: string[]; phones: string[]; socials: string[] }; pages: string[]; technologies: string[]
  scores: { technical: IntelligenceScore; digitalPresence: IntelligenceScore; commercialOpportunity: IntelligenceScore; dataReliability: IntelligenceScore }
  opportunities: Array<{ serviceId?: string; serviceName: string; reason: string }>; strategy: { approach: string[]; questions: string[]; avoidClaims: string[]; firstMessage?: string; email?: string; followUp?: string }
  competitors: IntelligenceCompetitor[]; usage?: { inputTokens: number; outputTokens: number; totalTokens: number }; audit: ReportAuditEntry[]; access: ReportPermission
}
export type IntelligencePolicy = { cacheTtlHours: number; retentionDays: number; monthlyTokenBudget: number; perAnalysisTokenLimit: number; usedTokens: number; remainingTokens: number; aiConfigured: boolean; month: string }
export type IntelligenceNotification = { id: string; recipientId: string; reportId: string; title: string; detail: string; createdAt: string; readAt?: string }
export type IntelligenceSnapshot = { reports: CompanyIntelligenceReport[]; providers: ProviderState[]; policy: IntelligencePolicy; notifications: IntelligenceNotification[]; transport: "server-postgresql"; productionReady: true }
export const intelligenceStatusLabels: Record<IntelligenceStatus, string> = { queued: "In attesa", collecting: "Raccolta dati", technical: "Analisi tecnica", ai: "Sintesi AI", completed: "Completata", completed_without_ai: "Completata senza AI", partial: "Parziale", failed: "Non riuscita", cancelled: "Annullata" }
