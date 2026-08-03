"use client";

import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { getTenantHeader } from "@/lib/tenant-fetch";

export type JsonObject = Record<string, unknown>;
export type ProposalStatus = "draft" | "ready" | "generated" | "error" | "archived";
export type ImportStatus = "preview" | "confirmed" | "generated" | "partial" | "failed";
export type GenerationStatus = "running" | "completed" | "failed";

export type SiteProposalTemplateManifest = {
  name: string; slug: string; version: string; versione?: string; schemaVersion: string; layoutLocked: boolean;
  fixedCounts: { treatmentCards: number; productPoints: number; reviews: number; faqs: number };
  textLimits: JsonObject; imageSlots: string[]; routes: string[]; categoryTags: string[]; updatedAt: string; sourceSha256: string;
};
export type SiteProposalTemplate = { slug: string; name: string; version: string; schemaVersion: string; manifest: SiteProposalTemplateManifest; isActive?: boolean };
export type SiteProposalImportError = { code: string; message: string; path?: string; original?: unknown; used?: unknown; limit?: number };
export type SiteProposalImportWarning = SiteProposalImportError;
export type SiteConfig = JsonObject & {
  template: JsonObject; editingContract: JsonObject; sourceWebsite: JsonObject; brand: JsonObject; business: JsonObject; seo: JsonObject;
  palette: Array<{ variable: string; value: string; role: string }>; routing: JsonObject; images: Record<string, JsonObject>; content: JsonObject; textLimits: Record<string, number>;
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
  row_count: number; valid_count: number; invalid_count: number; rows: SiteProposalImportRow[]; errors: SiteProposalImportError[]; created_at?: string; confirmed_at?: string | null; generated_at?: string | null;
};
export type CommercialAnalysis = JsonObject & { mode?: string; status?: string; strengths?: JsonObject[]; improvementAreas?: JsonObject[]; benefits?: string[]; desktopExperience?: string[]; mobileFirstExperience?: string[]; rationale?: string[]; evidence?: JsonObject[]; requiresManualReview?: boolean };
export type SiteProposal = {
  id: string; import_batch_id?: string | null; source_row_index?: number | null; template_slug: string; template_version: string; status: ProposalStatus; display_name: string;
  company_id?: string | null; contact_id?: string | null; lead_id?: string | null; opportunity_id?: string | null; current_version: number; last_generated_at?: string | null; updated_at?: string | null; created_at?: string | null;
  source_data?: JsonObject; site_config?: SiteConfig; validation_warnings?: SiteProposalImportWarning[]; commercial_analysis?: CommercialAnalysis; email_subject?: string | null; email_body?: string | null;
};
export type SiteProposalDetail = { proposal: SiteProposal; latestGeneration?: SiteProposalGeneration | null; versionCount: number; activityCount: number };
export type SiteProposalVersion = { id: string; proposal_id: string; version: number; site_config: SiteConfig; commercial_analysis: CommercialAnalysis; email_subject?: string | null; email_body?: string | null; reason?: string | null; created_by?: string | null; created_at?: string | null };
export type SiteProposalGeneration = { id: string; proposal_id: string; proposal_version: number; template_slug: string; template_version: string; status: GenerationStatus; html_sha256?: string | null; zip_sha256?: string | null; html_size?: number | string | null; zip_size?: number | string | null; error_message?: string | null; created_at?: string | null; started_at?: string | null; completed_at?: string | null };
export type SiteProposalActivity = { id: string; action: string; metadata?: JsonObject; actor_user_id?: string | null; actor_email?: string | null; created_at?: string | null };
export type PaginatedResponse<T> = { items: T[]; total: number; limit: number; offset: number };
export type SiteProposalListQuery = { search?: string; status?: ProposalStatus; templateSlug?: string; companyId?: string; importBatchId?: string; limit?: number; offset?: number; sortBy?: "updated_at" | "created_at" | "display_name" | "status"; sortOrder?: "asc" | "desc" };
export type SiteProposalUpdate = { displayName?: string; status?: ProposalStatus; siteConfig?: SiteConfig; commercialAnalysis?: CommercialAnalysis; emailSubject?: string; emailBody?: string; companyId?: string | null; contactId?: string | null; leadId?: string | null; opportunityId?: string | null };

const LIST_KEYS = new Set(["search", "status", "templateSlug", "companyId", "importBatchId", "limit", "offset", "sortBy", "sortOrder"]);
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
    const token = window.localStorage.getItem("doflow_token");
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
export function previewImport(file: File, templateSlug: string) { const form = new FormData(); form.append("file", file); form.append("templateSlug", templateSlug); return apiFetch<{ batch: SiteProposalImportBatch; rows: SiteProposalImportRow[] }>(endpoint("/imports/preview"), { method: "POST", body: form }); }
export function getImportBatch(id: string) { return apiFetch<SiteProposalImportBatch>(endpoint(`/imports/${encodeURIComponent(id)}`)); }
export function confirmImport(id: string) { return apiFetch<{ batch: SiteProposalImportBatch; proposals: SiteProposal[]; idempotent: boolean }>(endpoint(`/imports/${encodeURIComponent(id)}/confirm`), { method: "POST" }); }
export function generateImportBatch(id: string) { return apiFetch<{ total: number; success: number; failed: number; results: SiteProposalGeneration[] }>(endpoint(`/imports/${encodeURIComponent(id)}/generate`), { method: "POST" }); }
export function listSiteProposals(query: SiteProposalListQuery = {}) { return apiFetch<PaginatedResponse<SiteProposal>>(endpoint(queryString(query, LIST_KEYS))); }
export function createSiteProposal(payload: { templateSlug?: string; displayName: string; sourceData: Record<string, string> }) { return apiFetch<SiteProposal>(endpoint(""), { method: "POST", body: JSON.stringify(payload) }); }
export function getSiteProposal(id: string) { return apiFetch<SiteProposalDetail>(endpoint(`/${encodeURIComponent(id)}`)); }
export function updateSiteProposal(id: string, payload: SiteProposalUpdate) { return apiFetch<SiteProposal>(endpoint(`/${encodeURIComponent(id)}`), { method: "PATCH", body: JSON.stringify(payload) }); }
export function archiveSiteProposal(id: string) { return apiFetch<SiteProposal>(endpoint(`/${encodeURIComponent(id)}/archive`), { method: "PATCH" }); }
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
export async function fetchSiteProposalPreviewHtml(id: string, generationId?: string) { const result = await binaryRequest(endpoint(`/${encodeURIComponent(id)}/preview${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ""}`), "index.html"); return result.blob.text(); }
export function downloadSiteProposalHtml(id: string, generationId?: string) { return binaryRequest(endpoint(`/${encodeURIComponent(id)}/download/html${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ""}`), "index.html"); }
export function downloadSiteProposalZip(id: string, generationId?: string) { return binaryRequest(endpoint(`/${encodeURIComponent(id)}/download/zip${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ""}`), "demo.zip"); }
