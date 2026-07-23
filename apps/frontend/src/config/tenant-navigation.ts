"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BookTemplate,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileClock,
  FileText,
  FolderKanban,
  FolderOpen,
  Handshake,
  KanbanSquare,
  KeyRound,
  Layers,
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
    moduleKey: "crm",
    children: [
      { id: "commercial-overview", label: "Riepilogo", href: "/commercial", icon: BarChart3, moduleKey: "crm" },
      { id: "pipeline", label: "Pipeline", href: "/pipeline", icon: Layers, moduleKey: "crm" },
      { id: "companies", label: "Clienti", href: "/companies", icon: Building2, moduleKey: "crm" },
      { id: "quotes", label: "Preventivi", href: "/quotes", icon: Send, moduleKey: "quotes" },
    ],
  },
  {
    id: "lavoro",
    label: "Progetti",
    icon: FolderKanban,
    href: "/projects",
    minPlan: "PRO",
    moduleKey: "projects",
    children: [
      { id: "projects", label: "Progetti", href: "/projects", icon: FolderKanban, minPlan: "PRO", moduleKey: "projects" },
      { id: "kanban", label: "Kanban", href: "/projects/kanban", icon: KanbanSquare, minPlan: "PRO", moduleKey: "projects" },
      { id: "tasks", label: "Task", href: "/projects/tasks", icon: CheckSquare, minPlan: "PRO", moduleKey: "projects" },
      { id: "milestones", label: "Milestone", href: "/projects/milestones", icon: ClipboardCheck, minPlan: "PRO", moduleKey: "projects" },
      { id: "calendar", label: "Pianificazione", href: "/calendar", icon: CalendarDays, minPlan: "PRO", moduleKey: "calendar" },
      { id: "agenda", label: "Agenda", href: "/calendar/agenda", icon: Timer, minPlan: "PRO", moduleKey: "calendar" },
      { id: "events", label: "Eventi", href: "/calendar/events", icon: CalendarDays, minPlan: "PRO", moduleKey: "calendar" },
      { id: "deadlines", label: "Scadenze", href: "/calendar/deadlines", icon: FileClock, minPlan: "PRO", moduleKey: "calendar" },
    ],
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    icon: BriefcaseBusiness,
    href: "/contracts",
    minPlan: "PRO",
    moduleKey: "contracts",
    children: [
      { id: "contracts", label: "Contratti", href: "/contracts", icon: FileCheck2, minPlan: "PRO", moduleKey: "contracts" },
      { id: "paperwork", label: "Scartoffie e dossier", href: "/paperwork", icon: ClipboardCheck, minPlan: "PRO", moduleKey: "paperwork" },
      { id: "finance", label: "Finance", href: "/finance", icon: Wallet, minPlan: "PRO", roles: ["owner", "admin", "superadmin"], moduleKey: "finance" },
      { id: "invoices", label: "Fatture", href: "/finance/invoices", icon: Receipt, minPlan: "PRO", roles: ["owner", "admin", "superadmin"], moduleKey: "finance" },
      { id: "payments", label: "Pagamenti", href: "/finance/payments", icon: CreditCard, minPlan: "ENTERPRISE", roles: ["owner", "admin", "superadmin"], moduleKey: "finance" },
      { id: "finance-deadlines", label: "Scadenze finance", href: "/finance/deadlines", icon: FileClock, minPlan: "PRO", roles: ["owner", "admin", "superadmin"], moduleKey: "finance" },
      { id: "renewals", label: "Rinnovi", href: "/finance/renewals", icon: RefreshCw, minPlan: "PRO", roles: ["owner", "admin", "superadmin"], moduleKey: "finance" },
      { id: "credentials", label: "Accessi e credenziali", href: "/credentials", icon: LockKeyhole, minPlan: "PRO", moduleKey: "credentials" },
      { id: "credentials-new", label: "Nuova credenziale", href: "/credentials/new", icon: KeyRound, minPlan: "PRO", moduleKey: "credentials" },
      { id: "credentials-expiring", label: "In scadenza", href: "/credentials/expiring", icon: FileClock, minPlan: "PRO", moduleKey: "credentials" },
      { id: "credentials-rotation", label: "Rotazioni", href: "/credentials/rotation-due", icon: Timer, minPlan: "PRO", moduleKey: "credentials" },
    ],
  },
  {
    id: "risorse",
    label: "Team",
    icon: UsersRound,
    href: "/team",
    moduleKey: "team",
    children: [
      { id: "team", label: "Team", href: "/team", icon: UsersRound, minPlan: "PRO", moduleKey: "team" },
      { id: "members", label: "Membri", href: "/team/members", icon: UserCog, minPlan: "PRO", moduleKey: "team" },
      { id: "workload", label: "Carichi lavoro", href: "/team/workload", icon: BarChart3, minPlan: "PRO", moduleKey: "team" },
      { id: "knowledge", label: "Knowledge", href: "/knowledge", icon: BookOpen, minPlan: "PRO", moduleKey: "knowledge" },
      { id: "articles", label: "Articoli", href: "/knowledge/articles", icon: FileText, minPlan: "PRO", moduleKey: "knowledge" },
      { id: "assets", label: "Asset", href: "/knowledge/assets", icon: FolderOpen, minPlan: "PRO", moduleKey: "knowledge" },
      { id: "templates", label: "Template", href: "/knowledge/templates", icon: BookTemplate, minPlan: "PRO", moduleKey: "knowledge" },
    ],
  },
  {
    id: "documenti",
    label: "Documenti",
    icon: FolderOpen,
    href: "/documents",
    moduleKey: "documents",
  },
  {
    id: "controllo",
    label: "Automazioni",
    icon: Workflow,
    href: "/automations",
    minPlan: "PRO",
    moduleKey: "automations",
    children: [
      { id: "automations", label: "Automazioni", href: "/automations", icon: Workflow, minPlan: "PRO", moduleKey: "automations" },
      { id: "rules", label: "Regole", href: "/automations/rules", icon: Zap, minPlan: "PRO", moduleKey: "automations" },
      { id: "runs", label: "Esecuzioni", href: "/automations/runs", icon: Timer, minPlan: "PRO", moduleKey: "automations" },
      { id: "notifications", label: "Notifiche", href: "/notifications", icon: Bell, moduleKey: "notifications" },
      { id: "notification-rules", label: "Regole notifiche", href: "/notifications/rules", icon: Workflow, minPlan: "PRO", moduleKey: "notifications" },
      { id: "reports", label: "Report", href: "/reports", icon: BarChart3, minPlan: "PRO", moduleKey: "reports" },
      { id: "executive-report", label: "Direzione", href: "/reports/executive", icon: BarChart3, minPlan: "PRO", roles: ["owner", "admin", "superadmin", "manager"], moduleKey: "reports" },
      { id: "targets", label: "Obiettivi KPI", href: "/reports/targets", icon: ShieldCheck, minPlan: "PRO", roles: ["owner", "admin", "superadmin", "manager"], moduleKey: "reports" },
    ],
  },
  {
    id: "impostazioni",
    label: "Impostazioni",
    icon: Settings,
    href: "/settings",
    moduleKey: "settings",
    children: [
      { id: "settings", label: "Panoramica", href: "/settings", icon: Settings, moduleKey: "settings" },
      { id: "users", label: "Utenti e ruoli", href: "/team/roles", icon: UserCog, minPlan: "PRO", moduleKey: "settings" },
      { id: "integrations", label: "Integrazioni", href: "/settings/integrations", icon: Plug, minPlan: "PRO", moduleKey: "settings" },
      { id: "notification-preferences", label: "Preferenze notifiche", href: "/notifications/preferences", icon: Bell, moduleKey: "notifications" },
      { id: "appearance", label: "Aspetto", href: "/settings", icon: Settings, moduleKey: "settings" },
      { id: "security", label: "Sicurezza", href: "/settings/security", icon: ShieldCheck, minPlan: "ENTERPRISE", roles: ["owner", "admin", "superadmin"], moduleKey: "settings" },
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

function hrefMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function moduleKeyForTenantPath(pathname: string): TenantModuleKey | null {
  let match: { moduleKey: TenantModuleKey; length: number } | null = null;
  for (const section of DOFLOW_TENANT_NAVIGATION) {
    if (section.href && section.moduleKey && hrefMatches(pathname, section.href)) {
      match = { moduleKey: section.moduleKey, length: section.href.length };
    }
    for (const child of section.children || []) {
      if (child.moduleKey && hrefMatches(pathname, child.href) && child.href.length >= (match?.length || 0)) {
        match = { moduleKey: child.moduleKey, length: child.href.length };
      }
    }
  }
  return match?.moduleKey || null;
}
