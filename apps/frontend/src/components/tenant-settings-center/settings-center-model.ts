"use client";

import { apiFetch } from "@/lib/api";
import type { TeamMember, TeamModulePermission } from "@/lib/tenant-team-api";

export const SETTINGS_MODULES = [
  { key: "crm", label: "Commerciale" },
  { key: "projects", label: "Lavoro" },
  { key: "finance", label: "Amministrazione" },
  { key: "team", label: "Risorse" },
  { key: "automations", label: "Automazioni" },
  { key: "settings", label: "Impostazioni" },
] as const;

export type SettingsModuleKey = typeof SETTINGS_MODULES[number]["key"];
export type PermissionState = Pick<TeamModulePermission, "module_key" | "can_view" | "can_create" | "can_update" | "can_delete" | "can_manage">;

const ADMIN_ROLES = new Set(["owner", "admin", "superadmin", "super_admin"]);
const MANAGER_DEFAULTS = new Set(["dashboard", "briefing", "projects", "calendar", "documents", "notifications", "team", "knowledge", "reports"]);
const EMPLOYEE_DEFAULTS = new Set(["dashboard", "projects", "calendar", "documents", "notifications", "knowledge"]);
const NEVER_GRANT_NON_ADMIN = new Set(["finance", "credentials", "settings", "automations"]);

export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietario",
  admin: "Amministratore",
  manager: "Manager",
  editor: "Editor",
  viewer: "Visualizzatore",
  user: "Dipendente",
  superadmin: "Superadmin",
  super_admin: "Superadmin",
};

export const STATUS_META: Record<string, { label: string; tone: "green" | "orange" | "red" | "slate" }> = {
  active: { label: "Attivo", tone: "green" },
  invited: { label: "Invito in attesa", tone: "orange" },
  suspended: { label: "Sospeso", tone: "red" },
  inactive: { label: "Inattivo", tone: "slate" },
  archived: { label: "Archiviato", tone: "slate" },
};

export type TenantAuditEntry = {
  id: string | number;
  action: string;
  actor_email?: string | null;
  actor_role?: string | null;
  target_email?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export const settingsApi = {
  audit: () => apiFetch<{ entries: TenantAuditEntry[] }>("/tenant/admin/audit"),
  changeRole: (userId: string, role: string) => apiFetch<{ status: string }>(`/tenant/admin/users/user:${userId}/role`, {
    method: "POST",
    body: JSON.stringify({ role }),
  }),
};

export function normalizeRole(value?: string | null) {
  return String(value || "user").toLowerCase().trim().replace("super_admin", "superadmin");
}

export function roleLabel(value?: string | null) {
  const role = normalizeRole(value);
  return ROLE_LABELS[role] || role;
}

export function statusMeta(value?: string | null) {
  return STATUS_META[String(value || "inactive").toLowerCase()] || { label: value || "Non disponibile", tone: "slate" as const };
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Non disponibile";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function basePermission(roleValue: string | null | undefined, moduleKey: string): PermissionState {
  const role = normalizeRole(roleValue);
  if (ADMIN_ROLES.has(role)) return { module_key: moduleKey, can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true };
  const allowed = role === "manager" ? MANAGER_DEFAULTS.has(moduleKey) : EMPLOYEE_DEFAULTS.has(moduleKey);
  const readOnly = role === "viewer";
  return {
    module_key: moduleKey,
    can_view: allowed,
    can_create: allowed && !readOnly,
    can_update: allowed && !readOnly,
    can_delete: false,
    can_manage: false,
  };
}

export function effectivePermission(member: TeamMember, moduleKey: string, overrides: PermissionState[]) {
  const base = basePermission(member.tenant_role, moduleKey);
  const role = normalizeRole(member.tenant_role);
  if (ADMIN_ROLES.has(role)) return base;
  const override = overrides.find((item) => item.module_key === moduleKey);
  if (!override) return base;
  if (NEVER_GRANT_NON_ADMIN.has(moduleKey)) {
    return override.can_view === false
      ? { module_key: moduleKey, can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false }
      : base;
  }
  const canView = Boolean(override.can_view);
  return {
    module_key: moduleKey,
    can_view: canView,
    can_create: canView && Boolean(override.can_create),
    can_update: canView && Boolean(override.can_update),
    can_delete: canView && Boolean(override.can_delete),
    can_manage: canView && Boolean(override.can_manage),
  };
}

export function isAdministrativeRole(value?: string | null) {
  return ADMIN_ROLES.has(normalizeRole(value));
}

export function canOverrideModule(roleValue: string | null | undefined, moduleKey: string) {
  return isAdministrativeRole(roleValue) || !NEVER_GRANT_NON_ADMIN.has(moduleKey);
}

export function allowedAreas(member: TeamMember) {
  if (isAdministrativeRole(member.tenant_role)) return "Tutte le aree";
  return SETTINGS_MODULES.filter((item) => basePermission(member.tenant_role, item.key).can_view).map((item) => item.label).join(", ") || "Nessuna area";
}

export function auditLabel(action?: string | null) {
  return String(action || "Attività").replace(/^admin_/, "").replaceAll("_", " ");
}
