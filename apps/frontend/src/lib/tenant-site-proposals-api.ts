"use client";

import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { getTenantHeader } from "@/lib/tenant-fetch";
import { getAuthToken } from "@/lib/auth-storage";

export type JsonObject = Record<string, unknown>;
export type ProposalStatus = "draft" | "ready" | "generated" | "error" | "archived";
export type ImportStatus = "preview" | "confirmed" | "generated" | "partial" | "failed";
export type GenerationStatus = "running" | "completed" | "failed";
export type PersonalizationStatus = "idle" | "running" | "completed" | "fallback" | "failed";
export type PreparationStatus = "idle" | "pending" | "queued" | "running" | "ready" | "fallback" | "failed";
export type ThemeImageMode = "theme" | "website" | "hybrid" | "manual";
export type PreparationProgress = { preparationRunId?: string | null; preparationStatus?: PreparationStatus; progressPercent?: number; progressStage?: string; progressMessage?: string; progressUpdatedAt?: string | null; heartbeatAt?: string | null; provider?: "gemini" | "local" | null; canPreview?: boolean; canGenerate?: boolean; queueState?: string | null; workerReady?: boolean; stalled?: boolean; stalledReason?: string | null; canRetryDispatch?: boolean; lastHeartbeatAt?: string | null };

export type SiteProposalTemplateManifest = {
  name: string; slug: string; version: string; versione?: string; schemaVersion: string; layoutLocked: boolean;
  fixedCounts: { treatmentCards?: number; productPoints?: number; reviews?: number; services?: number; trustItems?: number; faqs: number };
  textLimits: JsonObject; imageSlots: string[]; routes: string[]; categoryTags: string[]; updatedAt: string; sourceSha256: string;
};
export type SiteProposalTemplate = { slug: string; name: string; version: string; latestVersion?: string; versions?: string[]; categoryTags?: string[]; schemaVersion: string; manifest: SiteProposalTemplateManifest; isActive?: boolean };
export type SiteProposalImportError = { code: string; message: string; path?: string; original?: unknown; used?: unknown; limit?: number };
export type SiteProposalImportWarning = SiteProposalImportError;
export type SiteConfig = JsonObject & {
  template: JsonObject; editingContract: JsonObject; sourceWebsite: JsonObject; brand: JsonObject; business: JsonObject; seo: JsonObject;
  palette: Array<{ variable: string; value: string; role: string }> | JsonObject; routing: JsonObject; images: Record<string, JsonObject>; content: JsonObject; textLimits: Record<string, number>; personalization?: JsonObject;
};
export type SiteProposalImportCanonicalInput = JsonObject & {
  businessName?: string; category?: string; city?: string; publicContactName?: string; professionalTitle?: string;
  phone?: string; email?: string; websiteUrl?: string; services?: string[]; extra?: Record<string, string>;
};
export type SiteProposalImportRow = {
  rowIndex: number; valid: boolean; errors: SiteProposalImportError[]; warnings: SiteProposalImportWarning[];
  canonical?: SiteProposalImportCanonicalInput; sourceRow?: Record<string, string>; sourceRowHash?: string; fingerprint?: string; siteConfig?: SiteConfig; displayName?: string;
};
export type SiteProposalImportBatch = {
  id: string; template_slug: string; template_version: string; original_filename: string; content_type?: string | null; source_sha256: string; status: ImportStatus;
  row_count: number; valid_count: number; invalid_count: number; rows: SiteProposalImportRow[]; errors: SiteProposalImportError[]; created_at?: string; confirmed_at?: string | null; generated_at?: string | null; proposalProgress?: Array<PreparationProgress & { id?: string; source_row_index?: number; display_name?: string }>;
};
export type CommercialAnalysis = JsonObject & { mode?: string; status?: string; strengths?: JsonObject[]; improvementAreas?: JsonObject[]; benefits?: string[]; desktopExperience?: string[]; mobileFirstExperience?: string[]; rationale?: string[]; evidence?: JsonObject[]; requiresManualReview?: boolean };
export type SiteProposal = PreparationProgress & {
  id: string; import_batch_id?: string | null; source_row_index?: number | null; template_slug: string; template_version: string; status: ProposalStatus; display_name: string;
  company_id?: string | null; contact_id?: string | null; lead_id?: string | null; opportunity_id?: string | null; current_version: number; last_generated_at?: string | null; updated_at?: string | null; created_at?: string | null;
  archived_from_status?: ProposalStatus | null; deleted_at?: string | null;
  personalization_status?: PersonalizationStatus | null; latest_personalization_id?: string | null; last_personalized_at?: string | null;
  preparation_status?: PreparationStatus | null; preparation_error?: string | null; preparation_queued_at?: string | null; preparation_started_at?: string | null; preparation_completed_at?: string | null; latest_preparation_job_id?: string | null;
  image_mode?: ThemeImageMode;
  source_data?: JsonObject; site_config?: SiteConfig; validation_warnings?: SiteProposalImportWarning[]; commercial_analysis?: CommercialAnalysis; email_subject?: string | null; email_body?: string | null;
  readiness?: { complete: boolean; reasons: string[] };
};
export type SiteProposalDetail = { proposal: SiteProposal; latestGeneration?: SiteProposalGeneration | null; versionCount: number; activityCount: number };
export type SiteProposalVersion = { id: string; proposal_id: string; version: number; site_config: SiteConfig; commercial_analysis: CommercialAnalysis; email_subject?: string | null; email_body?: string | null; reason?: string | null; created_by?: string | null; created_at?: string | null };
export type SiteProposalGeneration = { id: string; proposal_id: string; proposal_version: number; template_slug: string; template_version: string; status: GenerationStatus; html_sha256?: string | null; zip_sha256?: string | null; html_size?: number | string | null; zip_size?: number | string | null; error_message?: string | null; created_at?: string | null; started_at?: string | null; completed_at?: string | null };
export type SiteProposalActivity = { id: string; action: string; metadata?: JsonObject; actor_user_id?: string | null; actor_email?: string | null; created_at?: string | null };
export type PaginatedResponse<T> = { items: T[]; total: number; limit: number; offset: number };
export type SiteProposalListQuery = { scope?: "active" | "archived"; search?: string; status?: ProposalStatus; templateSlug?: string; companyId?: string; importBatchId?: string; limit?: number; offset?: number; sortBy?: "updated_at" | "created_at" | "display_name" | "status"; sortOrder?: "asc" | "desc" };
export type SiteProposalUpdate = { displayName?: string; status?: ProposalStatus; siteConfig?: SiteConfig; commercialAnalysis?: CommercialAnalysis; emailSubject?: string; emailBody?: string; companyId?: string | null; contactId?: string | null; leadId?: string | null; opportunityId?: string | null; imageMode?: ThemeImageMode; applyThemeImages?: boolean; resetThemeImageSlot?: "hero" | "consultation" | "feature" };

export type SiteProposalBulkResult = { requested: number; affected: number; items: Array<{ id: string; status: ProposalStatus; deleted_at?: string | null }> };
export type SiteProposalBulkDeleteResult = { requested: number; deleted: number; deletedIds: string[]; failed: Array<{ id: string; message: string }> };
export type SiteProposalDeleteResult = { deleted: true; id: string; storageObjectsDeleted: number };
export type SiteProposalPersonalization = { id: string; status: PersonalizationStatus; provider?: string | null; model?: string | null; source_url?: string | null; final_url?: string | null; snapshot_hash?: string | null; website_analysis?: CommercialAnalysis; brand_assets?: JsonObject; warnings?: string[]; error_message?: string | null; started_at?: string | null; completed_at?: string | null; created_at?: string | null };
export type SiteProposalPersonalizationResult = { cached: boolean; status: "completed" | "fallback"; provider?: string; personalizationId?: string; proposalVersion?: number; warnings?: string[]; personalization?: SiteProposalPersonalization };
export type ProposalTheme = {
  id: string; theme_id?: string; version_id?: string; slug: string; name: string; description?: string | null; source_kind: "builtin" | "uploaded"; is_active: boolean; default_version?: string | null; categories: string[];
  version: string; schema_version: string; contract_version: string; content_profile: "proposal-basic-v2" | "colsova-conversion-v1" | "colsova-legacy-v1" | "beauty-editorial-v1" | "beauty-conversion-v1"; status: "draft" | "active" | "disabled" | "retired"; is_builtin: boolean; is_immutable: boolean; deleted_at?: string | null; default_image_mode?: ThemeImageMode;
  template_sha256: string; template_size: number | string; zip_sha256?: string | null; zip_size?: number | string | null; validation_report?: JsonObject; usages?: number; version_created_at?: string;
  source_format?: "standalone" | "modular"; format_version?: string | null; compiled_sha256?: string | null; compiled_size?: number | string | null; runtime_adapter_status?: "ready" | "pending"; manifest?: JsonObject;
  builtIn?: boolean; sourceType?: "builtin" | "uploaded"; active?: boolean; isDefault?: boolean; usageCount?: number; historicalUsageCount?: number; obsolete?: boolean; canDelete?: boolean; deletionMode?: "purge" | "retire" | null; deleteReason?: string;
};
export type ThemeUploadResult = { manifest: JsonObject; format?: "standalone" | "modular"; runtimeAdapterStatus?: "ready" | "pending"; hash: { template: string; zip: string; compiled?: string }; sizes: { template: number; zip: number; compiled?: number }; contentProfile: string; validationReport: JsonObject; warnings: string[]; status: "draft"; previewUrl: string };

const LIST_KEYS = new Set(["scope", "search", "status", "templateSlug", "companyId", "importBatchId", "limit", "offset", "sortBy", "sortOrder"]);
const ACTIVITY_KEYS = new Set(["limit", "offset"]);

function queryString(query: Record<string, string | number | undefined | null>, allowed: Set<string>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (!allowed.has(key) || value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

function endpoint(path: string) { return `/tenant/commercial/site-proposals${path}`; }

function binaryHeaders() {
  const headers: Record<string, string> = { ...getTenantHeader() };
  if (typeof window !== "undefined") {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function safeFilename(value: string | null, fallback: string) {
  const match = value?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match?.[1]) return fallback;
  try { return decodeURIComponent(match[1]).replace(/[\\/:*?"<>|]/g, "_"); } catch { return fallback; }
}

async function binaryRequest(path: string, fallbackName: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { headers: binaryHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(await response.text().catch(() => "") || `Download fallito (${response.status})`);
  return { blob: await response.blob(), filename: safeFilename(response.headers.get("Content-Disposition"), fallbackName) };
}

export function listTemplates() { return apiFetch<SiteProposalTemplate[]>(endpoint("/templates")); }
export function getTemplate(slug: string, version?: string) { return apiFetch<SiteProposalTemplate>(endpoint(`/templates/${encodeURIComponent(slug)}${version ? `?version=${encodeURIComponent(version)}` : ""}`)); }
export function previewImport(file: File, templateSlug: string, templateVersion?: string) { const form = new FormData(); form.append("file", file); form.append("templateSlug", templateSlug); if (templateVersion) form.append("templateVersion", templateVersion); return apiFetch<{ batch: SiteProposalImportBatch; rows: SiteProposalImportRow[] }>(endpoint("/imports/preview"), { method: "POST", body: form }); }
export function getImportBatch(id: string) { return apiFetch<SiteProposalImportBatch>(endpoint(`/imports/${encodeURIComponent(id)}`)); }
export function confirmImport(id: string) { return apiFetch<{ batch: SiteProposalImportBatch; proposals: SiteProposal[]; created: number; queued: number; pendingDispatch: number; failed: number; proposalIds: string[]; idempotent: boolean }>(endpoint(`/imports/${encodeURIComponent(id)}/confirm`), { method: "POST" }); }
export function generateImportBatch(id: string) { return apiFetch<{ total: number; success: number; failed: number; results: SiteProposalGeneration[] }>(endpoint(`/imports/${encodeURIComponent(id)}/generate`), { method: "POST" }); }
export function listSiteProposals(query: SiteProposalListQuery = {}) { return apiFetch<PaginatedResponse<SiteProposal>>(endpoint(queryString(query, LIST_KEYS))); }
export function createSiteProposal(payload: { templateSlug?: string; templateVersion?: string; displayName: string; sourceData: Record<string, string> }) { return apiFetch<SiteProposal>(endpoint(""), { method: "POST", body: JSON.stringify(payload) }); }
export function getSiteProposal(id: string) { return apiFetch<SiteProposalDetail>(endpoint(`/${encodeURIComponent(id)}`)); }
export function updateSiteProposal(id: string, payload: SiteProposalUpdate) { return apiFetch<SiteProposal>(endpoint(`/${encodeURIComponent(id)}`), { method: "PATCH", body: JSON.stringify(payload) }); }
export function archiveSiteProposal(id: string) { return apiFetch<SiteProposal>(endpoint(`/${encodeURIComponent(id)}/archive`), { method: "PATCH" }); }
export function archiveSiteProposals(ids: string[]) { return apiFetch<SiteProposalBulkResult>(endpoint("/bulk/archive"), { method: "POST", body: JSON.stringify({ ids }) }); }
export function restoreSiteProposal(id: string) { return apiFetch<SiteProposal>(endpoint(`/${encodeURIComponent(id)}/restore`), { method: "PATCH" }); }
export function restoreSiteProposals(ids: string[]) { return apiFetch<SiteProposalBulkResult>(endpoint("/bulk/restore"), { method: "POST", body: JSON.stringify({ ids }) }); }
export function deleteSiteProposal(id: string) { return apiFetch<SiteProposalDeleteResult>(endpoint(`/${encodeURIComponent(id)}`), { method: "DELETE" }); }
export function deleteSiteProposals(ids: string[]) { return apiFetch<SiteProposalBulkDeleteResult>(endpoint("/bulk"), { method: "DELETE", body: JSON.stringify({ ids }) }); }
export function personalizeSiteProposal(id: string, force = false, upgradeTemplate = false) { return apiFetch<SiteProposalPersonalizationResult>(endpoint(`/${encodeURIComponent(id)}/personalize`), { method: "POST", body: JSON.stringify({ force, upgradeTemplate }) }); }
export function prepareSiteProposal(id: string, payload: { force?: boolean; targetTemplateSlug?: string; targetTemplateVersion?: string } = {}) { return apiFetch<{ queued: boolean; idempotent: boolean; status: PreparationStatus; jobId?: string }>(endpoint(`/${encodeURIComponent(id)}/prepare`), { method: "POST", body: JSON.stringify(payload) }); }
export function getSiteProposalPreparation(id: string) { return apiFetch<PreparationProgress>(endpoint(`/${encodeURIComponent(id)}/preparation`)); }
export function prepareImportBatch(id: string, force = false) { return apiFetch<{ total: number; queued: number }>(endpoint(`/imports/${encodeURIComponent(id)}/prepare`), { method: "POST", body: JSON.stringify({ force }) }); }
export function listSiteProposalPersonalizations(id: string) { return apiFetch<SiteProposalPersonalization[]>(endpoint(`/${encodeURIComponent(id)}/personalizations`)); }
export function upgradeSiteProposalTemplate(id: string, targetVersion?: string, targetSlug?: string) { return apiFetch<{ proposal?: SiteProposal; queued?: unknown; idempotent: boolean }>(endpoint(`/${encodeURIComponent(id)}/template-upgrade`), { method: "POST", body: JSON.stringify({ ...(targetVersion ? { targetVersion } : {}), ...(targetSlug ? { targetSlug } : {}) }) }); }
export function listSiteProposalVersions(id: string) { return apiFetch<SiteProposalVersion[]>(endpoint(`/${encodeURIComponent(id)}/versions`)); }
export function restoreSiteProposalVersion(id: string, version: number) { return apiFetch<SiteProposal>(endpoint(`/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/restore`), { method: "POST" }); }
export async function generateSiteProposal(id: string) {
  const result = await apiFetch<SiteProposalGeneration>(endpoint(`/${encodeURIComponent(id)}/generate`), { method: "POST" });
  if (result.status === "completed") return result;
  if (result.status === "failed") throw new Error(result.error_message || "Generazione non riuscita.");
  throw new Error("La generazione non è stata completata.");
}
export function listSiteProposalGenerations(id: string) { return apiFetch<SiteProposalGeneration[]>(endpoint(`/${encodeURIComponent(id)}/generations`)); }
export function listSiteProposalActivity(id: string, query: { limit?: number; offset?: number } = {}) { return apiFetch<PaginatedResponse<SiteProposalActivity>>(endpoint(`/${encodeURIComponent(id)}/activity${queryString(query, ACTIVITY_KEYS)}`)); }
export async function fetchSiteProposalPreview(id: string, generationId?: string): Promise<{ status: "completed"; html: string } | ({ status: "preparing"; retryAfterSeconds: number } & PreparationProgress)> {
  const response = await fetch(`${getApiBaseUrl()}${endpoint(`/${encodeURIComponent(id)}/preview${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ""}`)}`, { headers: binaryHeaders(), cache: "no-store" });
  if (response.status === 202) return response.json();
  if (!response.ok) throw new Error(await response.text().catch(() => "") || `Anteprima non disponibile (${response.status})`);
  return { status: "completed", html: await response.text() };
}
export function downloadSiteProposalHtml(id: string, generationId?: string) { return binaryRequest(endpoint(`/${encodeURIComponent(id)}/download/html${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ""}`), "index.html"); }
export function downloadSiteProposalZip(id: string, generationId?: string) { return binaryRequest(endpoint(`/${encodeURIComponent(id)}/download/zip${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ""}`), "demo.zip"); }

export function listProposalThemes(status: "active" | "disabled" | "deleted" | "all" = "active") { return apiFetch<ProposalTheme[]>(endpoint(`/themes?status=${encodeURIComponent(status)}`)); }
export function getProposalTheme(slug: string, version: string) { return apiFetch<ProposalTheme>(endpoint(`/themes/${encodeURIComponent(slug)}/${encodeURIComponent(version)}`)); }
export function uploadProposalTheme(file: File) { const form = new FormData(); form.append("file", file); return apiFetch<ThemeUploadResult>(endpoint("/themes/upload"), { method: "POST", body: form }); }
export function activateProposalTheme(slug: string, version: string) { return apiFetch<ProposalTheme>(endpoint(`/themes/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/activate`), { method: "POST" }); }
export function disableProposalTheme(slug: string, version: string) { return apiFetch<ProposalTheme>(endpoint(`/themes/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/disable`), { method: "PATCH" }); }
export function setDefaultProposalTheme(slug: string, version: string) { return apiFetch<ProposalTheme>(endpoint(`/themes/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/default`), { method: "POST" }); }
export function deleteProposalTheme(slug: string, version: string) { return apiFetch<{ deleted: true; deletionMode: "purged" | "retired"; fallbackDefault?: { slug: string; version: string } | null; affectedProposals: number; storageCleanupStatus: string }>(endpoint(`/themes/${encodeURIComponent(slug)}/${encodeURIComponent(version)}`), { method: "DELETE" }); }
export function downloadProposalTheme(slug: string, version: string) { return binaryRequest(endpoint(`/themes/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/download`), `${slug}-${version}.zip`); }
export async function fetchProposalThemePreview(slug: string, version: string) { const result = await binaryRequest(endpoint(`/themes/${encodeURIComponent(slug)}/${encodeURIComponent(version)}/preview`), "preview.html"); return result.blob.text(); }
