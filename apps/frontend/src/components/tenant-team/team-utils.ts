"use client";

import { getDoFlowUser } from "@/lib/jwt";

export const TENANT_ROLE_LABELS: Record<string, string> = {
  owner: "CEO",
  admin: "Admin",
  manager: "Manager",
  editor: "Operativo",
  user: "Dipendente",
  viewer: "Viewer",
  superadmin: "Superadmin",
  super_admin: "Superadmin",
};

export const OPERATIONAL_ROLE_LABELS: Record<string, string> = {
  ceo_label: "CEO",
  project_manager: "Project Manager",
  sales: "Sales",
  designer: "Designer",
  developer: "Developer",
  seo_specialist: "SEO Specialist",
  copywriter: "Copywriter",
  administration: "Amministrazione",
  external_collaborator: "Collaboratore esterno",
  generic: "Generico",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  employee: "Dipendente",
  contractor: "Contractor",
  external: "Esterno",
  intern: "Stagista",
  admin: "Admin",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Disponibile",
  busy: "Occupato",
  unavailable: "Non disponibile",
  vacation: "Ferie",
  sick: "Malattia",
  external_limited: "Esterno limitato",
  remote: "Remoto",
  reduced_hours: "Orario ridotto",
  focus_time: "Focus time",
  external_unavailable: "Esterno non disponibile",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Attivo",
  inactive: "Inattivo",
  invited: "Invitato",
  suspended: "Sospeso",
  archived: "Archiviato",
  draft: "Bozza",
  submitted: "Inviata",
  approved: "Approvata",
  rejected: "Rifiutata",
  confirmed: "Confermata",
  planned: "Pianificata",
  cancelled: "Annullata",
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  design: "Design",
  development: "Sviluppo",
  seo: "SEO",
  copywriting: "Copywriting",
  meeting: "Meeting",
  project_management: "Project management",
  support: "Supporto",
  admin: "Amministrazione",
  research: "Ricerca",
  qa: "QA",
  work: "Lavoro",
};

export function label(map: Record<string, string>, value?: string | null) {
  const key = String(value || "").toLowerCase();
  return map[key] || value || "-";
}

export function canViewTeamCosts(role = getDoFlowUser()?.role) {
  const normalized = String(role || "").toLowerCase().trim();
  return ["owner", "admin", "superadmin", "super_admin"].includes(normalized);
}

export function canManageTeam(role = getDoFlowUser()?.role) {
  return canViewTeamCosts(role);
}

export function canManageTeamOps(role = getDoFlowUser()?.role) {
  const normalized = String(role || "").toLowerCase().trim();
  return ["owner", "admin", "superadmin", "super_admin", "manager"].includes(normalized);
}

export function formatMinutes(value?: number | string | null) {
  const minutes = Number(value || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatCurrencyCents(value?: number | null, currency = "EUR") {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(Number(value || 0) / 100);
}

export function roleBadgeClass(role?: string | null) {
  if (role === "owner" || role === "ceo_label") return "border-primary/30 bg-primary/10 text-primary";
  if (role === "manager" || role === "project_manager") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function availabilityBadgeClass(value?: string | null) {
  if (value === "available") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (value === "busy") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (["unavailable", "vacation", "sick"].includes(String(value))) return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function workloadTone(percent?: number) {
  const value = Number(percent || 0);
  if (value >= 100) return "text-destructive";
  if (value >= 80) return "text-chart-5";
  return "text-foreground";
}
