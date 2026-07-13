"use client";

export const ARTICLE_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  published: "Pubblicato",
  archived: "Archiviato",
};

export const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  active: "Attivo",
  archived: "Archiviato",
};

export const ASSET_STATUS_LABELS: Record<string, string> = {
  active: "Attivo",
  archived: "Archiviato",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  private: "Privato",
  team: "Team",
  admin: "Admin",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const ARTICLE_TYPE_LABELS: Record<string, string> = {
  article: "Articolo",
  procedure: "Procedura",
  checklist: "Checklist",
  guide: "Guida",
  policy: "Policy",
  note: "Nota",
  faq: "FAQ",
  troubleshooting: "Troubleshooting",
  playbook: "Playbook",
};

export function labelFor(map: Record<string, string>, value?: string | null) {
  if (!value) return "-";
  return map[value] || value.replace(/_/g, " ");
}

export function badgeClass(value?: string | null) {
  const key = value || "default";
  if (["published", "active", "medium", "team"].includes(key)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["draft", "private", "low"].includes(key)) return "border-slate-200 bg-slate-50 text-slate-700";
  if (["review", "high", "admin"].includes(key)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["archived", "urgent"].includes(key)) return "border-red-200 bg-red-50 text-red-700";
  return "border-border bg-muted text-muted-foreground";
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

export function formatBytes(value?: number | null) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function parseJsonField(value: string, fallback: unknown = {}) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return JSON.parse(trimmed);
}

export function jsonText(value: unknown, fallback = "{}") {
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

export function compactJson(value: unknown) {
  if (value === undefined || value === null || value === "") return "-";
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  } catch {
    return String(value);
  }
}

export function cleanPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined),
  ) as Partial<T>;
}

export function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function routeForTarget(targetType?: string | null, targetId?: string | null) {
  if (!targetType || !targetId) return null;
  if (targetType === "article") return `/knowledge/articles/${targetId}`;
  if (targetType === "asset") return `/knowledge/assets/${targetId}`;
  if (targetType === "operational_template" || targetType === "template") return `/knowledge/templates/${targetId}`;
  return null;
}

export function canViewFinance(role?: string | null, explicit?: boolean) {
  if (explicit) return true;
  const normalized = (role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin"].includes(normalized);
}

export function scrubFinanceText(value?: string | null, allowed = false) {
  if (!value) return value;
  return allowed ? value : value.replace(/\b(finance|fattur|incass|pagament|revenue|margine|costo|tariff)\w*/gi, "[contenuto riservato]");
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
