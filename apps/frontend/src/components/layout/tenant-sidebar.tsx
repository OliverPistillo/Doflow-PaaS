"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck, BarChart3, Bell, BookTemplate,
  Building2, CalendarDays, CheckSquare, ChevronsUpDown, ClipboardCheck,
  Clock, Contact, CreditCard, FileCheck2, FileClock, FileText,
  FolderKanban, FolderOpen, Handshake, KanbanSquare, Layers,
  LifeBuoy, LockKeyhole, LogOut, MailCheck, Moon,
  Plug, Receipt, Send, Settings, Sparkles, Sun, Timer, User,
  UserCog, UserPlus, Users, UsersRound, Wallet, Workflow, Zap, RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getDoFlowUser, getInitials } from "@/lib/jwt";
import { usePlan } from "@/contexts/PlanContext";
import { SIDEBAR_GROUPS, PLAN_META, type PlanTier, planIncludes } from "@/lib/plans";
import { getTenantRoleLabel } from "@/lib/roles";
import { PlanBadge } from "@/components/ui/locked-feature";
import { cn } from "@/lib/utils";
import { getTenantNotificationSummary } from "@/lib/tenant-notifications-api";

type AgencyAudience = "executive" | "manager" | "employee" | "sales";

type AgencyNavItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  minPlan?: PlanTier;
  moduleKey?: string;
  lockMsg?: string;
  comingSoon?: boolean;
  badgeCount?: number;
};

type AgencyNavGroup = {
  label: string;
  modules: AgencyNavItem[];
};

const EXISTING_TENANT_ROUTES = new Set([
  "/activity",
  "/analytics",
  "/billing",
  "/briefings",
  "/briefings/incomplete",
  "/briefings/new",
  "/briefings/templates",
  "/calendar",
  "/campaigns",
  "/changelog",
  "/companies",
  "/contacts",
  "/customers",
  "/dashboard",
  "/deals",
  "/documents",
  "/documents/folders",
  "/documents/upload",
  "/email-templates",
  "/expenses",
  "/finance",
  "/finance/deadlines",
  "/finance/invoices",
  "/finance/invoices/new",
  "/finance/payments",
  "/finance/projects",
  "/finance/recurring-services",
  "/finance/renewals",
  "/finance/reports",
  "/forms",
  "/inbox",
  "/invoices",
  "/leads",
  "/my-plan",
  "/notifications",
  "/notifications/digest",
  "/notifications/preferences",
  "/notifications/rules",
  "/payments",
  "/pipeline",
  "/projects",
  "/projects/files",
  "/projects/kanban",
  "/projects/milestones",
  "/projects/new",
  "/projects/tasks",
  "/projects/timeline",
  "/quotes",
  "/quotes/accepted",
  "/quotes/drafts",
  "/quotes/new",
  "/quotes/rejected",
  "/quotes/sent",
  "/quotes/service-templates",
  "/settings",
  "/settings/automations",
  "/settings/company",
  "/settings/integrations",
  "/settings/notifications",
  "/settings/security",
  "/support",
  "/tasks",
  "/tasks/board",
  "/team",
  "/team/roles",
  "/timesheet",
  "/activities",
]);

function dashboardAudienceFromRole(role?: string): AgencyAudience {
  const r = String(role ?? "").toLowerCase().trim();

  if (r === "owner" || r === "admin" || r === "superadmin" || r === "super_admin") {
    return "executive";
  }
  if (r === "manager") return "manager";

  // Futuro mapping sales: quando esisterà un ruolo tecnico o una capability sales,
  // instradarlo qui verso "sales" senza cambiare la struttura del menu.
  return "employee";
}

function item(
  label: string,
  href: string | undefined,
  icon: LucideIcon,
  options: Omit<AgencyNavItem, "label" | "href" | "icon"> = {},
): AgencyNavItem {
  return { label, href, icon, minPlan: "STARTER", ...options };
}

const AGENCY_MENUS: Record<AgencyAudience, AgencyNavGroup[]> = {
  executive: [
    { label: "Dashboard", modules: [item("Dashboard", "/dashboard", BarChart3)] },
    {
      label: "CRM",
      modules: [
        item("Aziende", "/companies", Building2),
        item("Contatti", "/contacts", Contact),
        item("Lead", "/leads", UserPlus),
        item("Opportunità", "/deals", Handshake),
        item("Pipeline", "/pipeline", Layers),
        item("Attività commerciali", "/activities", ClipboardCheck),
      ],
    },
    {
      label: "Briefing",
      modules: [
        item("Tutti i briefing", "/briefings", FileText),
        item("Nuovo briefing", "/briefings/new", FileCheck2),
        item("Incompleti", "/briefings/incomplete", FileClock),
        item("Template briefing", "/briefings/templates", BookTemplate),
      ],
    },
    {
      label: "Preventivi",
      modules: [
        item("Tutti", "/quotes", Send),
        item("Bozze", "/quotes/drafts", FileText),
        item("Inviati", "/quotes/sent", MailCheck),
        item("Accettati", "/quotes/accepted", FileCheck2),
        item("Rifiutati", "/quotes/rejected", FileClock),
        item("Template servizi", "/quotes/service-templates", BookTemplate),
      ],
    },
    {
      label: "Progetti",
      modules: [
        item("Tutti i progetti", "/projects", FolderKanban, { minPlan: "PRO" }),
        item("Nuovo progetto", "/projects/new", FileCheck2, { minPlan: "PRO" }),
        item("Kanban", "/projects/kanban", KanbanSquare, { minPlan: "PRO" }),
        item("Timeline", "/projects/timeline", Clock, { minPlan: "PRO" }),
        item("Calendario", "/calendar", CalendarDays),
        item("Milestone", "/projects/milestones", ClipboardCheck, { minPlan: "PRO" }),
        item("Task", "/projects/tasks", CheckSquare, { minPlan: "PRO" }),
        item("File progetto", "/projects/files", FolderOpen, { minPlan: "PRO" }),
      ],
    },
    {
      label: "Clienti",
      modules: [
        item("Clienti attivi", "/companies", Users),
        item("Materiali richiesti", "/briefings/incomplete", FolderOpen),
      ],
    },
    {
      label: "Documenti",
      modules: [
        item("Tutti", "/documents", FileText, { moduleKey: "docs.files" }),
        item("Cartelle", "/documents/folders", FolderOpen, { moduleKey: "docs.files" }),
        item("Carica", "/documents/upload", FileCheck2, { moduleKey: "docs.files" }),
      ],
    },
    {
      label: "Supporto",
      modules: [
        item("Ticket", "/support", LifeBuoy),
        item("Manutenzioni", undefined, Workflow, { comingSoon: true }),
        item("Rinnovi", undefined, Clock, { comingSoon: true }),
        item("Report cliente", undefined, FileText, { comingSoon: true }),
      ],
    },
    {
      label: "Team",
      modules: [
        item("Dipendenti", "/team", UsersRound, { minPlan: "PRO" }),
        item("Ruoli", "/team/roles", UserCog, { minPlan: "PRO" }),
        item("Carichi lavoro", undefined, BarChart3, { minPlan: "PRO", comingSoon: true }),
        item("Ore lavorate", "/timesheet", Timer, { minPlan: "PRO" }),
        item("Calendario team", "/calendar", CalendarDays),
      ],
    },
    {
      label: "Finance",
      modules: [
        item("Dashboard finance", "/finance", Wallet, { minPlan: "PRO" }),
        item("Fatture", "/finance/invoices", Receipt, { minPlan: "PRO" }),
        item("Pagamenti", "/finance/payments", CreditCard, { minPlan: "ENTERPRISE" }),
        item("Scadenze", "/finance/deadlines", FileClock, { minPlan: "PRO" }),
        item("Servizi ricorrenti", "/finance/recurring-services", RefreshCw, { minPlan: "PRO" }),
        item("Rinnovi", "/finance/renewals", Clock, { minPlan: "PRO" }),
        item("Stato progetti", "/finance/projects", FolderKanban, { minPlan: "ENTERPRISE" }),
        item("Report economici", "/finance/reports", BarChart3, { minPlan: "ENTERPRISE" }),
        item("Margini", undefined, Wallet, { minPlan: "ENTERPRISE", comingSoon: true }),
      ],
    },
    {
      label: "Automazioni",
      modules: [
        item("Commerciali", "/settings/automations", Zap, { minPlan: "PRO" }),
        item("Progetto", "/settings/automations", Workflow, { minPlan: "PRO" }),
        item("Cliente", "/settings/automations", Workflow, { minPlan: "PRO" }),
        item("Finance", "/settings/automations", Wallet, { minPlan: "PRO" }),
      ],
    },
    {
      label: "Notifiche",
      modules: [
        item("Tutte", "/notifications", Bell),
        item("Regole", "/notifications/rules", Workflow, { minPlan: "PRO" }),
        item("Digest", "/notifications/digest", FileText),
        item("Preferenze", "/notifications/preferences", Settings),
      ],
    },
    {
      label: "Impostazioni",
      modules: [
        item("Utenti", "/team", UsersRound, { minPlan: "PRO" }),
        item("Permessi", "/team/roles", LockKeyhole, { minPlan: "PRO" }),
        item("Template", "/email-templates", BookTemplate),
        item("Integrazioni", "/settings/integrations", Plug, { minPlan: "PRO" }),
      ],
    },
  ],
  manager: [
    { label: "Dashboard", modules: [item("Dashboard", "/dashboard", BarChart3)] },
    {
      label: "CRM",
      modules: [
        item("Aziende", "/companies", Building2),
        item("Contatti", "/contacts", Contact),
        item("Lead", "/leads", UserPlus),
        item("Opportunità", "/deals", Handshake),
        item("Pipeline", "/pipeline", Layers),
      ],
    },
    {
      label: "Briefing",
      modules: [
        item("Tutti i briefing", "/briefings", FileText),
        item("Incompleti", "/briefings/incomplete", FileClock),
      ],
    },
    {
      label: "Preventivi",
      modules: [
        item("Tutti", "/quotes", Send),
        item("Inviati", "/quotes/sent", MailCheck),
        item("Accettati", "/quotes/accepted", FileCheck2),
      ],
    },
    {
      label: "Progetti",
      modules: [
        item("Tutti i progetti", "/projects", FolderKanban, { minPlan: "PRO" }),
        item("Kanban", "/projects/kanban", KanbanSquare, { minPlan: "PRO" }),
        item("Timeline", "/projects/timeline", Clock, { minPlan: "PRO" }),
        item("Calendario", "/calendar", CalendarDays),
        item("Milestone", "/projects/milestones", ClipboardCheck, { minPlan: "PRO" }),
        item("Task", "/projects/tasks", CheckSquare, { minPlan: "PRO" }),
        item("File progetto", "/projects/files", FolderOpen, { minPlan: "PRO" }),
      ],
    },
    {
      label: "Clienti",
      modules: [
        item("Clienti attivi", "/companies", Users),
        item("Materiali richiesti", "/briefings/incomplete", FolderOpen),
      ],
    },
    {
      label: "Documenti",
      modules: [
        item("Tutti", "/documents", FileText, { moduleKey: "docs.files" }),
        item("Cartelle", "/documents/folders", FolderOpen, { moduleKey: "docs.files" }),
        item("Carica", "/documents/upload", FileCheck2, { moduleKey: "docs.files" }),
      ],
    },
    {
      label: "Supporto",
      modules: [
        item("Ticket", "/support", LifeBuoy),
        item("Manutenzioni", undefined, Workflow, { comingSoon: true }),
        item("Rinnovi", undefined, Clock, { comingSoon: true }),
      ],
    },
    {
      label: "Team",
      modules: [
        item("Carichi lavoro", undefined, BarChart3, { minPlan: "PRO", comingSoon: true }),
        item("Calendario team", "/calendar", CalendarDays),
      ],
    },
    {
      label: "Notifiche",
      modules: [
        item("Tutte", "/notifications", Bell),
        item("Regole", "/notifications/rules", Workflow, { minPlan: "PRO" }),
        item("Digest", "/notifications/digest", FileText),
        item("Preferenze", "/notifications/preferences", Settings),
      ],
    },
  ],
  employee: [
    { label: "Dashboard", modules: [item("Dashboard", "/dashboard", BarChart3)] },
    {
      label: "Progetti",
      modules: [
        item("Progetti assegnati", "/projects", FolderKanban, { minPlan: "PRO" }),
        item("Kanban", "/projects/kanban", KanbanSquare, { minPlan: "PRO" }),
        item("Task", "/projects/tasks", CheckSquare, { minPlan: "PRO" }),
        item("File progetto", "/projects/files", FolderOpen, { minPlan: "PRO" }),
      ],
    },
    {
      label: "Clienti",
      modules: [
        item("Materiali richiesti", undefined, FolderOpen, { comingSoon: true }),
        item("Approvazioni", undefined, ClipboardCheck, { comingSoon: true }),
      ],
    },
    {
      label: "Documenti",
      modules: [
        item("Tutti", "/documents", FileText, { moduleKey: "docs.files" }),
        item("Cartelle", "/documents/folders", FolderOpen, { moduleKey: "docs.files" }),
        item("Carica", "/documents/upload", FileCheck2, { moduleKey: "docs.files" }),
      ],
    },
    {
      label: "Supporto",
      modules: [
        item("Ticket", "/support", LifeBuoy),
      ],
    },
    {
      label: "Team",
      modules: [
        item("Calendario team", "/calendar", CalendarDays),
      ],
    },
    {
      label: "Notifiche",
      modules: [
        item("Tutte", "/notifications", Bell),
        item("Digest", "/notifications/digest", FileText),
        item("Preferenze", "/notifications/preferences", Settings),
      ],
    },
  ],
  sales: [
    { label: "Dashboard", modules: [item("Dashboard", "/dashboard", BarChart3)] },
    {
      label: "CRM",
      modules: [
        item("Lead", "/leads", UserPlus),
        item("Opportunità", "/deals", Handshake),
        item("Pipeline", "/pipeline", Layers),
        item("Attività commerciali", "/activities", ClipboardCheck),
      ],
    },
    {
      label: "Briefing",
      modules: [
        item("Tutti i briefing", "/briefings", FileText),
      ],
    },
    {
      label: "Preventivi",
      modules: [
        item("Tutti", "/quotes", Send),
      ],
    },
    {
      label: "Notifiche",
      modules: [
        item("Tutte", "/notifications", Bell),
        item("Regole", "/notifications/rules", Workflow, { minPlan: "PRO" }),
        item("Digest", "/notifications/digest", FileText),
        item("Preferenze", "/notifications/preferences", Settings),
      ],
    },
  ],
};

// ─── NavItem con lock ─────────────────────────────────────────────────────────

function NavItem({
  href, label, icon: Icon, minPlan, moduleKey, lockMsg, activePlan,
}: {
  href:       string;
  label:      string;
  icon:       React.ComponentType<{ className?: string }>;
  minPlan:    PlanTier;
  moduleKey?: string;
  lockMsg?:   string;
  activePlan: PlanTier;
}) {
  const pathname = usePathname();
  const { activeModules } = usePlan();
  const allowedByPlan = planIncludes(activePlan, minPlan);
  const allowedByModule = !moduleKey || activeModules.has(moduleKey);
  const isLocked = !allowedByPlan || !allowedByModule;
  const active   = !isLocked && (pathname === href || pathname.startsWith(href + "/"));

  if (isLocked) {
    return (
      <SidebarMenuItem>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 pl-3 pr-2 py-2 rounded-lg cursor-not-allowed opacity-40 select-none w-full">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">{label}</span>
                <span className="group-data-[collapsible=icon]:hidden">
                  <PlanBadge plan={minPlan} />
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px] text-xs leading-snug">
              {lockMsg ?? `Disponibile con il piano ${PLAN_META[minPlan].label}`}
              <div className="mt-1.5">
                <a href="/billing" className="text-primary font-semibold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {PLAN_META[minPlan].upgradeLabel ?? "Aggiorna piano"}
                </a>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        className={cn(
          "gap-3 transition-all duration-150 rounded-nav",
          active
            ? "font-semibold bg-gradient-to-r from-primary/15 to-chart-4/10 text-primary shadow-sm"
            : "text-muted-foreground hover:text-primary hover:bg-primary/10",
        )}
      >
        <Link href={href}>
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AgencyNavItem({
  item,
  activePlan,
}: {
  item: AgencyNavItem;
  activePlan: PlanTier;
}) {
  const pathname = usePathname();
  const { activeModules } = usePlan();
  const Icon = item.icon;
  const minPlan = item.minPlan ?? "STARTER";
  const routeExists = Boolean(item.href && EXISTING_TENANT_ROUTES.has(item.href));
  const allowedByPlan = planIncludes(activePlan, minPlan);
  const allowedByModule = !item.moduleKey || activeModules.has(item.moduleKey);
  const isComingSoon = item.comingSoon || !routeExists;
  const isLocked = !allowedByPlan || !allowedByModule || isComingSoon;
  const active = Boolean(item.href && !isLocked && (pathname === item.href || pathname.startsWith(item.href + "/")));

  const disabledReason = isComingSoon
    ? "In arrivo"
    : !allowedByModule
      ? "Modulo non attivo"
      : item.lockMsg ?? `Disponibile con il piano ${PLAN_META[minPlan].label}`;

  if (isLocked) {
    return (
      <SidebarMenuSubItem>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground/60 opacity-70 select-none">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="group-data-[collapsible=icon]:hidden rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold">
                  {isComingSoon ? "In arrivo" : !allowedByModule ? "Modulo" : PLAN_META[minPlan].label}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[240px] text-xs leading-snug">
              {disabledReason}
              {!isComingSoon && allowedByModule ? (
                <div className="mt-1.5">
                  <a href="/billing" className="text-primary font-semibold flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {PLAN_META[minPlan].upgradeLabel ?? "Aggiorna piano"}
                  </a>
                </div>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={active}
        className={cn(
          active
            ? "font-semibold bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-primary hover:bg-primary/10",
        )}
      >
        <Link href={item.href!}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badgeCount && item.badgeCount > 0 ? (
            <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {item.badgeCount > 99 ? "99+" : item.badgeCount}
            </span>
          ) : null}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function AgencyMenuGroup({
  group,
  activePlan,
  notificationUnreadCount = 0,
}: {
  group: AgencyNavGroup;
  activePlan: PlanTier;
  notificationUnreadCount?: number;
}) {
  const pathname = usePathname();
  const first = group.modules[0];
  const GroupIcon = first?.icon ?? FolderOpen;
  const hasActiveChild = group.modules.some((mod) => (
    mod.href &&
    EXISTING_TENANT_ROUTES.has(mod.href) &&
    (pathname === mod.href || pathname.startsWith(mod.href + "/"))
  ));

  if (group.modules.length === 1 && first) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            <NavItem
              href={first.href ?? "/dashboard"}
              label={first.label}
              icon={first.icon}
              minPlan={first.minPlan ?? "STARTER"}
              moduleKey={first.moduleKey}
              lockMsg={first.lockMsg}
              activePlan={activePlan}
            />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        className={cn(
          "text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-3",
          hasActiveChild && "text-primary/80",
        )}
      >
        <GroupIcon className="mr-1.5 h-3.5 w-3.5" />
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuSub className="mx-2.5 border-l-border/70">
            {group.modules.map((mod) => (
              <AgencyNavItem
                key={`${group.label}-${mod.label}`}
                item={{
                  ...mod,
                  badgeCount: mod.href === "/notifications" ? notificationUnreadCount : mod.badgeCount,
                }}
                activePlan={activePlan}
              />
            ))}
          </SidebarMenuSub>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ─── Props (variant e collapsible passati dal layout) ─────────────────────────

interface TenantSidebarProps {
  variant?:     "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function TenantSidebar({
  variant    = "inset",
  collapsible = "icon",
}: TenantSidebarProps) {
  const router          = useRouter();
  const { setTheme, theme } = useTheme();
  const { plan, meta, tenantInfo } = usePlan();
  const [user, setUser] = React.useState<{
    email: string; role: string; initials: string; tenantSlug?: string; tenantId?: string;
  } | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = React.useState(0);

  React.useEffect(() => {
    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:      payload.email      ?? "utente",
        role:       payload.role       ?? "user",
        initials:   getInitials(payload.email),
        tenantSlug: payload.tenantSlug,
        tenantId:   payload.tenantId,
      });
    }
  }, []);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  const tenantSlug = String(tenantInfo?.slug || user?.tenantSlug || user?.tenantId || "").toLowerCase();
  const isDoflowTenant = tenantSlug === "doflow";
  const agencyAudience = dashboardAudienceFromRole(user?.role);
  const agencyGroups = AGENCY_MENUS[agencyAudience];
  const roleLabel = getTenantRoleLabel(user?.role);

  React.useEffect(() => {
    if (!isDoflowTenant) {
      setNotificationUnreadCount(0);
      return;
    }

    let active = true;
    getTenantNotificationSummary()
      .then((summary) => {
        if (active) setNotificationUnreadCount(Number(summary.unreadNotifications || 0));
      })
      .catch(() => {
        if (active) setNotificationUnreadCount(0);
      });

    return () => {
      active = false;
    };
  }, [isDoflowTenant]);

  return (
    <Sidebar
      variant={variant}
      collapsible={collapsible}
      className="border-r border-border/40"
    >
      {/* ── LOGO ── */}
      <SidebarHeader className="h-[57px] border-b border-border/40 p-0">
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex group-data-[collapsible=icon]:hidden items-center w-full h-full p-4">
            <div className="relative w-full h-full max-w-[130px]">
              <Image src="/logo-doflow.svg" alt="DoFlow" fill className="object-contain" priority />
            </div>
          </div>
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full h-full">
            <div className="h-8 w-8 bg-gradient-to-br from-primary to-chart-4 rounded-xl flex items-center justify-center text-white font-black text-sm select-none shadow-button">
              D
            </div>
          </div>
        </div>
      </SidebarHeader>

      {/* ── PIANO BADGE ── */}
      <div className="px-3 pt-3 pb-1 group-data-[collapsible=icon]:hidden">
        <a
          href="/billing"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
            meta.color, meta.textColor, "hover:opacity-80",
          )}
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          Piano {meta.label}
          {meta.nextPlan && (
            <span className="ml-auto opacity-60 text-[10px]">{meta.upgradeLabel} →</span>
          )}
        </a>
      </div>

      {/* ── NAVIGAZIONE ── */}
      <SidebarContent className="pt-1">
        {isDoflowTenant ? (
          agencyGroups.map((group) => (
            <AgencyMenuGroup
              key={group.label}
              group={group}
              activePlan={plan}
              notificationUnreadCount={notificationUnreadCount}
            />
          ))
        ) : (
          SIDEBAR_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-3">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.modules.map((mod) => (
                    <NavItem
                      key={mod.href}
                      href={mod.href}
                      label={mod.label}
                      icon={mod.icon}
                      minPlan={mod.minPlan}
                      moduleKey={mod.moduleKey}
                      lockMsg={mod.lockMsg}
                      activePlan={plan}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      {/* ── FOOTER ── */}
      <SidebarFooter className="border-t border-border/40 p-2">
        {/* Storage tenant */}
        {tenantInfo && (
          <div className="px-2 py-1.5 mb-1 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] font-semibold text-muted-foreground/70 truncate">{tenantInfo.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-chart-4 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (tenantInfo.storageUsedMb / (tenantInfo.storageLimitGb * 1024)) * 100).toFixed(0)}%`,
                  }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground shrink-0">
                {(tenantInfo.storageUsedMb / 1024).toFixed(1)}GB / {tenantInfo.storageLimitGb}GB
              </span>
            </div>
          </div>
        )}

        {/* User menu */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent hover:bg-sidebar-accent/50 transition-colors"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-border">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      {user?.initials ?? "DF"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                    <span className="truncate font-semibold text-foreground">{user?.email ?? "…"}</span>
                    <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3 text-primary" />{roleLabel}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg"
                side="bottom" align="end" sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-2 py-2">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold text-xs">
                        {user?.initials ?? "DF"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.email}</span>
                      <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      Il mio Profilo
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="cursor-pointer"
                  >
                    {theme === "dark"
                      ? <Sun className="mr-2 h-4 w-4" />
                      : <Moon className="mr-2 h-4 w-4" />}
                    {theme === "dark" ? "Modalità Chiara" : "Modalità Scura"}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                      Impostazioni
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />Disconnetti
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
