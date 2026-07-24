import type { TeamMember, TeamWorkloadItem } from "@/lib/tenant-team-api";
import type { AssetItem, KnowledgeArticle, OperationalTemplate } from "@/lib/tenant-knowledge-api";

export function numberOf(value: unknown) { const result = Number(value || 0); return Number.isFinite(result) ? result : 0; }
export function hours(minutes: unknown) { return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(numberOf(minutes) / 60)}h`; }
export function dateLabel(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—"; const date = new Date(value); if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", options || { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
export function roleLabel(member?: TeamMember | null) { return member?.job_title || member?.operational_role?.replaceAll("_", " ") || member?.tenant_role?.replaceAll("_", " ") || "Ruolo non indicato"; }
export function availabilityMeta(value?: string | null) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "available") return { label: "Disponibile", tone: "green" as const };
  if (["vacation", "sick", "unavailable", "external_unavailable"].includes(normalized)) return { label: normalized === "vacation" ? "In ferie" : normalized === "sick" ? "Assente" : "Non disponibile", tone: "red" as const };
  if (["busy", "external_limited", "reduced_hours", "focus_time"].includes(normalized)) return { label: "Parziale", tone: "orange" as const };
  if (normalized === "remote") return { label: "Da remoto", tone: "blue" as const };
  return { label: "Non impostata", tone: "slate" as const };
}
export function averageLoad(workload: TeamWorkloadItem[]) { return workload.length ? Math.round(workload.reduce((sum, item) => sum + numberOf(item.utilizationPercent), 0) / workload.length) : null; }

export type KnowledgeRow = { id: string; kind: "article" | "asset" | "template"; title: string; category: string; status?: string | null; ownerUserId?: string | null; usage?: number | null; updatedAt?: string | null; reviewDueAt?: string | null; href: string };
export function knowledgeRows(articles: KnowledgeArticle[], assets: AssetItem[], templates: OperationalTemplate[]): KnowledgeRow[] {
  return [
    ...articles.map((item) => ({ id: item.id, kind: "article" as const, title: item.title, category: item.category_name || item.article_type || "Articolo", status: item.status, ownerUserId: item.owner_user_id, usage: item.view_count, updatedAt: item.updated_at, reviewDueAt: item.review_due_at, href: `/knowledge/articles/${item.id}` })),
    ...assets.map((item) => ({ id: item.id, kind: "asset" as const, title: item.name, category: item.collection_name || item.asset_type || "Asset", status: item.status, ownerUserId: item.owner_user_id, usage: null, updatedAt: item.updated_at, reviewDueAt: null, href: `/knowledge/assets/${item.id}` })),
    ...templates.map((item) => ({ id: item.id, kind: "template" as const, title: item.name, category: item.category || item.template_type || "Template", status: item.status, ownerUserId: null, usage: item.usage_count, updatedAt: item.updated_at, reviewDueAt: null, href: `/knowledge/templates/${item.id}` })),
  ];
}
export function isDueForReview(row: KnowledgeRow) { if (!row.reviewDueAt || row.status === "archived") return false; const value = new Date(row.reviewDueAt).getTime(); return Number.isFinite(value) && value <= Date.now(); }
