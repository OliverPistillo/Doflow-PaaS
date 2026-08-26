import { automationsApi, type AutomationParams, type AutomationRule, type AutomationRun } from "@/lib/tenant-automations-api";
import { CATEGORY_LABELS, RUN_STATUS_LABELS, TRIGGER_LABELS, label } from "@/components/tenant-automations/automation-utils";
import { useOptionalTenantAccess } from "@/contexts/TenantAccessContext";
import { useOptionalDoflowIdentity } from "@/features/identity/doflow-identity-provider";

export function useAutomationCenterAccess() {
  const tenantAccess = useOptionalTenantAccess();
  const doflowIdentity = useOptionalDoflowIdentity();
  const isDoflow = doflowIdentity !== null;
  const canViewRules = isDoflow
    ? Boolean(doflowIdentity?.hasCapability("canViewAutomations"))
    : Boolean(tenantAccess?.canView("automations"));
  const canManageRules = isDoflow
    ? Boolean(doflowIdentity?.hasCapability("canManageAutomations"))
    : Boolean(tenantAccess?.canUpdate("automations"));
  const canRunRules = isDoflow
    ? Boolean(doflowIdentity?.hasCapability("canRunAutomations"))
    : Boolean(tenantAccess?.canUpdate("automations"));
  const canRetryRuns = isDoflow
    ? Boolean(doflowIdentity?.hasCapability("canRetryAutomations"))
    : Boolean(tenantAccess?.canUpdate("automations"));
  const canViewRuns = isDoflow
    ? Boolean(doflowIdentity?.hasCapability("canViewAutomationErrors"))
    : Boolean(tenantAccess?.canView("automations"));
  const canViewNotifications = isDoflow
    ? Boolean(doflowIdentity?.hasCapability("canReadNotifications"))
    : Boolean(tenantAccess?.canView("notifications"));
  const canViewReports = isDoflow
    ? Boolean(doflowIdentity?.currentUser.roles.includes("administrator"))
    : Boolean(tenantAccess?.canView("reports"));
  const doflowCanView = (moduleKey?: string | null) => {
    if (!moduleKey) return true;
    if (moduleKey === "automations") return canViewRules;
    if (moduleKey === "notifications") return canViewNotifications;
    if (moduleKey === "reports") return canViewReports;
    return false;
  };
  const doflowCanManage = (moduleKey?: string | null) => !moduleKey || (moduleKey === "automations" && canManageRules);
  return {
    canViewRules,
    canManageRules,
    canRunRules,
    canRetryRuns,
    canViewRuns,
    canViewNotifications,
    canViewReports,
    canView: (moduleKey?: string | null) => isDoflow ? doflowCanView(moduleKey) : Boolean(tenantAccess?.canView(moduleKey)),
    canCreate: (moduleKey?: string | null) => isDoflow ? doflowCanManage(moduleKey) : Boolean(tenantAccess?.canCreate(moduleKey)),
    canUpdate: (moduleKey?: string | null) => isDoflow ? doflowCanManage(moduleKey) : Boolean(tenantAccess?.canUpdate(moduleKey)),
  };
}

export function numeric(value: unknown) { const result = Number(value || 0); return Number.isFinite(result) ? result : 0; }
export function formatDuration(value?: number | null) { const ms = numeric(value); if (!ms) return "—"; if (ms < 1000) return `${Math.round(ms)} ms`; return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(ms / 1000)} s`; }
export function formatDateTime(value?: string | null) { if (!value) return "—"; const date = new Date(value); if (!Number.isFinite(date.getTime())) return "—"; return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date); }
export function formatTime(value?: string | null) { if (!value) return "—"; const date = new Date(value); if (!Number.isFinite(date.getTime())) return "—"; return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date); }
export function isToday(value?: string | null) { if (!value) return false; const date = new Date(value); const today = new Date(); return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate(); }
export function terminalRuns(rows: AutomationRun[]) { return rows.filter((row) => ["success", "partial_success", "failed"].includes(row.status)); }
export function successfulRun(row: AutomationRun) { return ["success", "partial_success"].includes(row.status); }
export function successRate(rows: AutomationRun[]) { const terminal = terminalRuns(rows); return terminal.length ? Math.round(terminal.filter(successfulRun).length / terminal.length * 1000) / 10 : null; }
export function runStatus(row?: AutomationRun | null) {
  const status = String(row?.status || "skipped");
  const tone = status === "failed" ? "red" : status === "success" ? "green" : status === "partial_success" ? "orange" : status === "running" ? "violet" : "slate";
  return { label: label(RUN_STATUS_LABELS, status), tone: tone as "red" | "green" | "orange" | "violet" | "slate" };
}
export function ruleStatus(row: AutomationRule) {
  if (row.last_error_at && (!row.last_success_at || new Date(row.last_error_at) > new Date(row.last_success_at))) return { label: "Da controllare", tone: "orange" as const };
  return row.is_enabled ? { label: "Attiva", tone: "green" as const } : { label: "In pausa", tone: "orange" as const };
}
export function ruleArea(row: AutomationRule) { return label(CATEGORY_LABELS, row.category); }
export function triggerLabel(value?: string | null) { return label(TRIGGER_LABELS, value); }
export function actionNames(actions: unknown) {
  if (!Array.isArray(actions)) return [];
  return actions.map((action) => {
    if (typeof action === "string") return action.replaceAll("_", " ");
    if (action && typeof action === "object") {
      const value = String((action as Record<string, unknown>).type || (action as Record<string, unknown>).action_type || (action as Record<string, unknown>).name || "Azione");
      return value.replaceAll("_", " ");
    }
    return "Azione";
  });
}
export function areaGroup(category?: string | null) {
  const value = String(category || "general");
  if (["crm", "sales", "quotes"].includes(value)) return "Commerciale";
  if (["projects", "documents"].includes(value)) return "Lavoro";
  if (["finance", "contracts", "paperwork"].includes(value)) return "Amministrazione";
  if (value === "team") return "Risorse";
  return label(CATEGORY_LABELS, value);
}
export function periodStart(days: number) { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - Math.max(0, days - 1)); return date; }
export function inPeriod(value: string | null | undefined, days: number) { if (!value) return false; const date = new Date(value); return Number.isFinite(date.getTime()) && date >= periodStart(days); }

export async function loadRuns(params: AutomationParams = {}, maximum = 1000) {
  const first = await automationsApi.runs({ ...params, limit: 200, offset: 0 });
  const total = numeric(first.total);
  const items = [...(first.items || [])];
  const capped = Math.min(total, maximum);
  if (items.length < capped) {
    const requests = [];
    for (let offset = items.length; offset < capped; offset += 200) requests.push(automationsApi.runs({ ...params, limit: 200, offset }));
    const pages = await Promise.all(requests);
    pages.forEach((page) => items.push(...(page.items || [])));
  }
  return { items: items.slice(0, maximum), total, truncated: total > maximum };
}

export async function loadRules(maximum = 500) {
  const first = await automationsApi.rules({ limit: 100, offset: 0 });
  const total = numeric(first.total); const items = [...(first.items || [])]; const capped = Math.min(total, maximum);
  if (items.length < capped) {
    const requests = [];
    for (let offset = items.length; offset < capped; offset += 100) requests.push(automationsApi.rules({ limit: 100, offset }));
    const pages = await Promise.all(requests); pages.forEach((page) => items.push(...(page.items || [])));
  }
  return { items: items.slice(0, maximum), total, truncated: total > maximum };
}
