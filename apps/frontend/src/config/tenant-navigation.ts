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
  Contact,
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
  UserPlus,
  UsersRound,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";

import type { PlanTier } from "@/lib/plans";

export type TenantNavigationRole = "owner" | "admin" | "superadmin" | "manager" | "user" | "editor" | "viewer";
export type TenantVisibility = "all" | "doflow" | "external";

export type TenantNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  minPlan?: PlanTier;
  moduleKey?: string;
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
  children?: TenantNavigationItem[];
};

export const DOFLOW_TENANT_NAVIGATION: TenantNavigationSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: BarChart3,
    href: "/dashboard",
  },
  {
    id: "commerciale",
    label: "Commerciale",
    icon: Handshake,
    href: "/companies",
    children: [
      { id: "companies", label: "Aziende", href: "/companies", icon: Building2 },
      { id: "contacts", label: "Contatti", href: "/contacts", icon: Contact },
      { id: "leads", label: "Lead", href: "/leads", icon: UserPlus },
      { id: "deals", label: "Opportunità", href: "/deals", icon: Handshake },
      { id: "pipeline", label: "Pipeline", href: "/pipeline", icon: Layers },
      { id: "briefings", label: "Briefing", href: "/briefings", icon: FileText },
      { id: "quotes", label: "Preventivi", href: "/quotes", icon: Send },
    ],
  },
  {
    id: "lavoro",
    label: "Lavoro e consegne",
    icon: FolderKanban,
    href: "/projects",
    minPlan: "PRO",
    children: [
      { id: "projects", label: "Progetti", href: "/projects", icon: FolderKanban, minPlan: "PRO" },
      { id: "kanban", label: "Kanban", href: "/projects/kanban", icon: KanbanSquare, minPlan: "PRO" },
      { id: "tasks", label: "Task", href: "/projects/tasks", icon: CheckSquare, minPlan: "PRO" },
      { id: "milestones", label: "Milestone", href: "/projects/milestones", icon: ClipboardCheck, minPlan: "PRO" },
      { id: "calendar", label: "Pianificazione", href: "/calendar", icon: CalendarDays, minPlan: "PRO" },
      { id: "agenda", label: "Agenda", href: "/calendar/agenda", icon: Timer, minPlan: "PRO" },
      { id: "events", label: "Eventi", href: "/calendar/events", icon: CalendarDays, minPlan: "PRO" },
      { id: "deadlines", label: "Scadenze", href: "/calendar/deadlines", icon: FileClock, minPlan: "PRO" },
      { id: "documents", label: "Documenti", href: "/documents", icon: FolderOpen, moduleKey: "docs.files" },
    ],
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    icon: BriefcaseBusiness,
    href: "/contracts",
    minPlan: "PRO",
    children: [
      { id: "contracts", label: "Contratti", href: "/contracts", icon: FileCheck2, minPlan: "PRO" },
      { id: "paperwork", label: "Scartoffie e dossier", href: "/paperwork", icon: ClipboardCheck, minPlan: "PRO" },
      { id: "finance", label: "Finance", href: "/finance", icon: Wallet, minPlan: "PRO", roles: ["owner", "admin", "superadmin"] },
      { id: "invoices", label: "Fatture", href: "/finance/invoices", icon: Receipt, minPlan: "PRO", roles: ["owner", "admin", "superadmin"] },
      { id: "payments", label: "Pagamenti", href: "/finance/payments", icon: CreditCard, minPlan: "ENTERPRISE", roles: ["owner", "admin", "superadmin"] },
      { id: "finance-deadlines", label: "Scadenze finance", href: "/finance/deadlines", icon: FileClock, minPlan: "PRO", roles: ["owner", "admin", "superadmin"] },
      { id: "renewals", label: "Rinnovi", href: "/finance/renewals", icon: RefreshCw, minPlan: "PRO", roles: ["owner", "admin", "superadmin"] },
      { id: "credentials", label: "Accessi e credenziali", href: "/credentials", icon: LockKeyhole, minPlan: "PRO" },
      { id: "credentials-new", label: "Nuova credenziale", href: "/credentials/new", icon: KeyRound, minPlan: "PRO" },
      { id: "credentials-expiring", label: "In scadenza", href: "/credentials/expiring", icon: FileClock, minPlan: "PRO" },
      { id: "credentials-rotation", label: "Rotazioni", href: "/credentials/rotation-due", icon: Timer, minPlan: "PRO" },
    ],
  },
  {
    id: "risorse",
    label: "Risorse",
    icon: UsersRound,
    href: "/team",
    children: [
      { id: "team", label: "Team", href: "/team", icon: UsersRound, minPlan: "PRO" },
      { id: "members", label: "Membri", href: "/team/members", icon: UserCog, minPlan: "PRO" },
      { id: "workload", label: "Carichi lavoro", href: "/team/workload", icon: BarChart3, minPlan: "PRO" },
      { id: "knowledge", label: "Knowledge", href: "/knowledge", icon: BookOpen, minPlan: "PRO" },
      { id: "articles", label: "Articoli", href: "/knowledge/articles", icon: FileText, minPlan: "PRO" },
      { id: "assets", label: "Asset", href: "/knowledge/assets", icon: FolderOpen, minPlan: "PRO" },
      { id: "templates", label: "Template", href: "/knowledge/templates", icon: BookTemplate, minPlan: "PRO" },
    ],
  },
  {
    id: "controllo",
    label: "Automazioni e controllo",
    icon: Workflow,
    href: "/automations",
    minPlan: "PRO",
    children: [
      { id: "automations", label: "Automazioni", href: "/automations", icon: Workflow, minPlan: "PRO" },
      { id: "rules", label: "Regole", href: "/automations/rules", icon: Zap, minPlan: "PRO" },
      { id: "runs", label: "Esecuzioni", href: "/automations/runs", icon: Timer, minPlan: "PRO" },
      { id: "notifications", label: "Notifiche", href: "/notifications", icon: Bell },
      { id: "notification-rules", label: "Regole notifiche", href: "/notifications/rules", icon: Workflow, minPlan: "PRO" },
      { id: "reports", label: "Report", href: "/reports", icon: BarChart3, minPlan: "PRO" },
      { id: "executive-report", label: "Direzione", href: "/reports/executive", icon: BarChart3, minPlan: "PRO", roles: ["owner", "admin", "superadmin", "manager"] },
      { id: "targets", label: "Obiettivi KPI", href: "/reports/targets", icon: ShieldCheck, minPlan: "PRO", roles: ["owner", "admin", "superadmin", "manager"] },
    ],
  },
  {
    id: "impostazioni",
    label: "Impostazioni",
    icon: Settings,
    href: "/settings",
    children: [
      { id: "settings", label: "Panoramica", href: "/settings", icon: Settings },
      { id: "users", label: "Utenti e ruoli", href: "/team/roles", icon: UserCog, minPlan: "PRO" },
      { id: "integrations", label: "Integrazioni", href: "/settings/integrations", icon: Plug, minPlan: "PRO" },
      { id: "notification-preferences", label: "Preferenze notifiche", href: "/notifications/preferences", icon: Bell },
      { id: "appearance", label: "Aspetto", href: "/settings", icon: Settings },
      { id: "security", label: "Sicurezza", href: "/settings/security", icon: ShieldCheck, minPlan: "ENTERPRISE", roles: ["owner", "admin", "superadmin"] },
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
