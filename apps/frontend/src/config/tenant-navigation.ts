"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckSquare,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileClock,
  FolderKanban,
  FolderOpen,
  Handshake,
  KeyRound,
  Layers,
  LayoutTemplate,
  LockKeyhole,
  Plug,
  Receipt,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Timer,
  UserCog,
  UsersRound,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";

import type { PlanTier } from "@/lib/plans";
import type { TenantModuleKey } from "@/lib/tenant-access-api";

export type TenantNavigationRole = "owner" | "admin" | "superadmin" | "manager" | "user" | "editor" | "viewer";
export type TenantVisibility = "all" | "doflow" | "external";

export type TenantNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  minPlan?: PlanTier;
  moduleKey?: TenantModuleKey;
  roles?: TenantNavigationRole[];
  visibility?: TenantVisibility;
};

export type TenantNavigationSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  minPlan?: PlanTier;
  roles?: TenantNavigationRole[];
  visibility?: TenantVisibility;
  moduleKey?: TenantModuleKey;
  activeHrefs?: string[];
  inactiveHrefs?: string[];
  children?: TenantNavigationItem[];
};

export const DOFLOW_TENANT_NAVIGATION: TenantNavigationSection[] = [
  {
    id: "dashboard",
    label: "Panoramica",
    icon: BarChart3,
    href: "/dashboard",
    moduleKey: "dashboard",
  },
  {
    id: "commerciale",
    label: "Commerciale",
    icon: Handshake,
    href: "/commercial",
    inactiveHrefs: ["/commercial/site-proposals"],
    moduleKey: "crm",
    children: [
      { id: "commercial-overview", label: "Riepilogo", href: "/commercial", icon: BarChart3, moduleKey: "crm" },
      { id: "pipeline", label: "Pipeline", href: "/pipeline", icon: Layers, moduleKey: "crm" },
      { id: "companies", label: "Clienti", href: "/companies", icon: Building2, moduleKey: "crm" },
      { id: "quotes", label: "Preventivi", href: "/quotes", icon: Send, moduleKey: "quotes" },
    ],
  },
  {
    id: "builder",
    label: "Builder",
    icon: LayoutTemplate,
    href: "/commercial/site-proposals",
    roles: ["owner", "admin", "superadmin", "manager"],
    visibility: "doflow",
    moduleKey: "crm",
  },
  {
    id: "projects",
    label: "Progetti",
    icon: FolderKanban,
    href: "/projects",
    activeHrefs: ["/work", "/calendar", "/projects/milestones"],
    minPlan: "PRO",
    moduleKey: "projects",
    children: [
      { id: "projects-overview", label: "Panoramica", href: "/projects", icon: BarChart3, minPlan: "PRO", moduleKey: "projects" },
      { id: "projects-flow", label: "Flusso", href: "/projects/timeline", icon: Workflow, minPlan: "PRO", moduleKey: "projects" },
      { id: "tasks", label: "Attività", href: "/projects/tasks", icon: CheckSquare, minPlan: "PRO", moduleKey: "projects" },
      { id: "project-files", label: "File", href: "/projects/files", icon: FolderOpen, minPlan: "PRO", moduleKey: "projects" },
    ],
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    icon: BriefcaseBusiness,
    href: "/finance",
    minPlan: "PRO",
    children: [
      { id: "finance-overview", label: "Riepilogo", href: "/finance", icon: BarChart3, minPlan: "PRO", roles: ["owner", "admin", "superadmin"], moduleKey: "finance" },
      { id: "invoices", label: "Fatture e incassi", href: "/finance/invoices", icon: Receipt, minPlan: "PRO", roles: ["owner", "admin", "superadmin"], moduleKey: "finance" },
      { id: "contracts", label: "Contratti", href: "/contracts", icon: FileCheck2, minPlan: "PRO", moduleKey: "contracts" },
      { id: "renewals", label: "Rinnovi", href: "/finance/renewals", icon: RefreshCw, minPlan: "PRO", roles: ["owner", "admin", "superadmin"], moduleKey: "finance" },
    ],
  },
  {
    id: "risorse",
    label: "Risorse",
    icon: UsersRound,
    href: "/resources",
    children: [
      { id: "resources-overview", label: "Riepilogo", href: "/resources", icon: BarChart3, minPlan: "PRO", moduleKey: "team" },
      { id: "team", label: "Team", href: "/team", icon: UsersRound, minPlan: "PRO", moduleKey: "team" },
      { id: "workload", label: "Carichi", href: "/team/workload", icon: BarChart3, minPlan: "PRO", moduleKey: "team" },
      { id: "knowledge", label: "Knowledge", href: "/knowledge", icon: BookOpen, minPlan: "PRO", moduleKey: "knowledge" },
    ],
  },
  {
    id: "controllo",
    label: "Automazioni e controllo",
    icon: Workflow,
    href: "/automations",
    minPlan: "PRO",
    children: [
      { id: "automation-overview", label: "Riepilogo", href: "/automations", icon: BarChart3, minPlan: "PRO", moduleKey: "automations" },
      { id: "rules", label: "Automazioni", href: "/automations/rules", icon: Zap, minPlan: "PRO", moduleKey: "automations" },
      { id: "runs", label: "Monitoraggio", href: "/automations/runs", icon: Timer, minPlan: "PRO", moduleKey: "automations" },
      { id: "reports", label: "Report e KPI", href: "/reports", icon: BarChart3, minPlan: "PRO", moduleKey: "reports" },
    ],
  },
  {
    id: "impostazioni",
    label: "Impostazioni",
    icon: Settings,
    href: "/settings",
    children: [
      { id: "settings", label: "Generali", href: "/settings", icon: Settings, moduleKey: "settings" },
      { id: "users", label: "Utenti e permessi", href: "/settings/users", icon: UserCog, minPlan: "PRO", moduleKey: "settings" },
      { id: "integrations", label: "Integrazioni", href: "/settings/integrations", icon: Plug, minPlan: "PRO", moduleKey: "settings" },
      { id: "security", label: "Sicurezza e accessi", href: "/settings/security", icon: ShieldCheck, roles: ["owner", "admin", "superadmin"], moduleKey: "settings" },
    ],
  },
];

export function isNavigationRole(value: string | undefined | null): value is TenantNavigationRole {
  return ["owner", "admin", "superadmin", "manager", "user", "editor", "viewer"].includes(
    String(value || "").toLowerCase(),
  );
}

export function normalizeNavigationRole(value: string | undefined | null): TenantNavigationRole {
  const role = String(value || "user").toLowerCase().replace("super_admin", "superadmin");
  return isNavigationRole(role) ? role : "user";
}

export function navigationVisibilityMatchesTenant(
  visibility: TenantVisibility | undefined,
  isDoflowTenant: boolean,
): boolean {
  if (!visibility || visibility === "all") return true;
  return visibility === "doflow" ? isDoflowTenant : !isDoflowTenant;
}

function hrefMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Access control is intentionally independent from the tenant's visible menu.
// Hidden legacy routes stay mapped so direct access still enforces capabilities.
export const TENANT_ROUTE_MODULES: Array<[string, TenantModuleKey]> = [
  ["/dashboard", "dashboard"],
  ["/commercial/site-proposals", "crm"],
  ["/commercial", "crm"],
  ["/pipeline", "crm"],
  ["/companies", "crm"],
  ["/quotes", "quotes"],
  ["/projects/milestones", "projects"],
  ["/projects", "projects"],
  ["/work", "projects"],
  ["/calendar", "calendar"],
  ["/finance", "finance"],
  ["/contracts", "contracts"],
  ["/resources", "team"],
  ["/team", "team"],
  ["/knowledge", "knowledge"],
  ["/documents", "documents"],
  ["/automations", "automations"],
  ["/reports", "reports"],
  ["/settings", "settings"],
  ["/paperwork", "paperwork"],
  ["/credentials", "credentials"],
  ["/notifications", "notifications"],
];

export function moduleKeyForTenantPath(pathname: string): TenantModuleKey | null {
  let match: { moduleKey: TenantModuleKey; length: number } | null = null;
  for (const [href, moduleKey] of TENANT_ROUTE_MODULES) {
    if (hrefMatches(pathname, href) && href.length >= (match?.length || 0)) {
      match = { moduleKey, length: href.length };
    }
  }
  return match?.moduleKey || null;
}
