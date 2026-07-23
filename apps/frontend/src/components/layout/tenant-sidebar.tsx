"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronsUpDown,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PlanBadge } from "@/components/ui/locked-feature";
import { TenantSidebarBrand } from "@/components/layout/tenant-sidebar-brand";
import {
  TenantSidebarSections,
  filterTenantNavigation,
  findActiveTenantSectionId,
} from "@/components/layout/tenant-sidebar-section";
import {
  DOFLOW_TENANT_NAVIGATION,
  normalizeNavigationRole,
  type TenantNavigationRole,
} from "@/config/tenant-navigation";
import { getDoFlowUser, getInitials } from "@/lib/jwt";
import { usePlan } from "@/contexts/PlanContext";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { SIDEBAR_GROUPS, PLAN_META, type PlanTier, planIncludes } from "@/lib/plans";
import { getTenantRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";

type LegacyNavItemProps = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  minPlan: PlanTier;
  moduleKey?: string;
  lockMsg?: string;
  activePlan: PlanTier;
  isInternalTenant: boolean;
};

function useTenantUser() {
  const [user, setUser] = React.useState<{
    email: string;
    role: string;
    initials: string;
    tenantSlug?: string;
    tenantId?: string;
  } | null>(null);

  React.useEffect(() => {
    const payload = getDoFlowUser();
    if (!payload) return;

    setUser({
      email: payload.email ?? "utente",
      role: payload.role ?? "user",
      initials: getInitials(payload.email),
      tenantSlug: payload.tenantSlug,
      tenantId: payload.tenantId,
    });
  }, []);

  return user;
}

function isHrefActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function LegacyNavItem({
  href,
  label,
  icon: Icon,
  minPlan,
  moduleKey,
  lockMsg,
  activePlan,
  isInternalTenant,
}: LegacyNavItemProps) {
  const pathname = usePathname();
  const { activeModules } = usePlan();
  const { setOpenMobile, isMobile } = useSidebar();
  const allowedByPlan = planIncludes(activePlan, minPlan);
  const allowedByModule = !moduleKey || activeModules.has(moduleKey);
  const isLocked = !allowedByPlan || !allowedByModule;
  const active = !isLocked && isHrefActive(pathname, href);

  if (isLocked) {
    return (
      <SidebarMenuItem>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-10 w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground opacity-50">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{label}</span>
                <span className="group-data-[collapsible=icon]:hidden">
                  <PlanBadge plan={minPlan} />
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px] text-xs leading-snug">
              {lockMsg ?? `Disponibile con il piano ${PLAN_META[minPlan].label}`}
              {!isInternalTenant ? (
                <Link href="/billing" className="mt-1.5 flex items-center gap-1 font-semibold text-primary">
                  <Sparkles className="h-3 w-3" />
                  {PLAN_META[minPlan].upgradeLabel ?? "Aggiorna piano"}
                </Link>
              ) : null}
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
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-10 rounded-xl",
          active
            ? "bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
        )}
      >
        <Link href={href} onClick={() => { if (isMobile) setOpenMobile(false); }}>
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function LegacyTenantNavigation({
  activePlan,
  isInternalTenant,
}: {
  activePlan: PlanTier;
  isInternalTenant: boolean;
}) {
  return (
    <>
      {SIDEBAR_GROUPS.map((group) => (
        <SidebarGroup key={group.label} className="py-1">
          <SidebarGroupContent>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 group-data-[collapsible=icon]:sr-only">
              {group.label}
            </div>
            <SidebarMenu className="gap-0.5 px-2">
              {group.modules.map((mod) => (
                <LegacyNavItem
                  key={mod.href}
                  href={mod.href}
                  label={mod.label}
                  icon={mod.icon}
                  minPlan={mod.minPlan}
                  moduleKey={mod.moduleKey}
                  lockMsg={mod.lockMsg}
                  activePlan={activePlan}
                  isInternalTenant={isInternalTenant}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function PlanSummary({
  isInternalTenant,
}: {
  isInternalTenant: boolean;
}) {
  const { meta } = usePlan();

  if (isInternalTenant) return null;

  return (
    <div className="px-3 pb-2 pt-3 group-data-[collapsible=icon]:hidden">
      <Link
        href="/billing"
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80",
          meta.color,
          meta.textColor,
        )}
      >
        <Sparkles className="h-3 w-3 shrink-0" />
        Piano {meta.label}
        {meta.nextPlan ? (
          <span className="ml-auto text-[10px] opacity-70">{meta.upgradeLabel} →</span>
        ) : null}
      </Link>
    </div>
  );
}

function TenantStorageSummary({ isInternalTenant }: { isInternalTenant: boolean }) {
  const { tenantInfo } = usePlan();

  if (!tenantInfo || isInternalTenant) return null;

  const storagePercent = Math.min(
    100,
    (tenantInfo.storageUsedMb / (tenantInfo.storageLimitGb * 1024)) * 100,
  );

  return (
    <div className="mb-1 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
      <p className="truncate text-[10px] font-semibold text-muted-foreground/70">{tenantInfo.name}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-chart-4 transition-all"
            style={{ width: `${storagePercent.toFixed(0)}%` }}
          />
        </div>
        <span className="shrink-0 text-[9px] text-muted-foreground">
          {(tenantInfo.storageUsedMb / 1024).toFixed(1)}GB / {tenantInfo.storageLimitGb}GB
        </span>
      </div>
    </div>
  );
}

function TenantUserMenu({
  user,
  roleLabel,
  onLogout,
}: {
  user: ReturnType<typeof useTenantUser>;
  roleLabel: string;
  onLogout: () => void;
}) {
  const { setTheme, theme } = useTheme();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-12 rounded-xl transition-colors hover:bg-sidebar-accent/60 data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:!h-11"
            >
              <Avatar className="h-8 w-8 rounded-lg border border-border">
                <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {user?.initials ?? "DF"}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-foreground">{user?.email ?? "…"}</span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <BadgeCheck className="h-3 w-3 text-primary" />
                  {roleLabel}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-2">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-bold text-primary">
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
                  Il mio profilo
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="cursor-pointer"
              >
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {theme === "dark" ? "Modalità chiara" : "Modalità scura"}
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
              onClick={onLogout}
              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnetti
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

interface TenantSidebarProps {
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon";
}

export function TenantSidebar({
  variant = "inset",
  collapsible = "icon",
}: TenantSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useTenantUser();
  const { plan, tenantInfo } = usePlan();
  const { canView, loading: accessLoading } = useTenantAccess();
  const role = normalizeNavigationRole(user?.role) as TenantNavigationRole;
  const tenantSlug = String(tenantInfo?.slug || user?.tenantSlug || user?.tenantId || "").toLowerCase();
  const isInternalTenant = tenantSlug === "doflow";
  const roleLabel = getTenantRoleLabel(user?.role);
  const sections = React.useMemo(
    () => filterTenantNavigation(DOFLOW_TENANT_NAVIGATION, role, canView, plan, isInternalTenant),
    [role, canView, plan, isInternalTenant],
  );
  const activeSectionId = React.useMemo(
    () => findActiveTenantSectionId(sections, pathname, role, canView),
    [pathname, role, sections, canView],
  );
  const [openSectionId, setOpenSectionId] = React.useState<string | null>(activeSectionId);

  React.useEffect(() => {
    setOpenSectionId(activeSectionId);
  }, [activeSectionId]);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  return (
    <Sidebar
      variant={variant}
      collapsible={collapsible}
      className={cn("border-r border-border/60", isInternalTenant && "tenant-doflow-sidebar")}
    >
      <SidebarHeader className="h-16 border-b border-border/50 px-4 py-2">
        <TenantSidebarBrand />
      </SidebarHeader>

      <PlanSummary isInternalTenant={isInternalTenant} />

      <SidebarContent className="gap-1 py-3">
        {isInternalTenant && !accessLoading ? (
          <TenantSidebarSections
            sections={sections}
            activePlan={plan}
            pathname={pathname}
            openSectionId={openSectionId}
            setOpenSectionId={setOpenSectionId}
            role={role}
            isDoflowTenant={isInternalTenant}
          />
        ) : isInternalTenant ? null : (
          <LegacyTenantNavigation activePlan={plan} isInternalTenant={isInternalTenant} />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-2.5">
        <TenantStorageSummary isInternalTenant={isInternalTenant} />
        <TenantUserMenu user={user} roleLabel={roleLabel} onLogout={logout} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
