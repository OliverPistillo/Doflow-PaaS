"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Moon, Sun, User, ChevronsUpDown, BadgeCheck, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getDoFlowUser, getInitials } from "@/lib/jwt";
import { usePlan } from "@/contexts/PlanContext";
import { SIDEBAR_GROUPS, PLAN_META, type PlanTier } from "@/lib/plans";
import { PlanBadge } from "@/components/ui/locked-feature";
import { cn } from "@/lib/utils";

// ─── Item con lock ─────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  minPlan,
  lockMsg,
  activePlan,
}: {
  href:       string;
  label:      string;
  icon:       React.ComponentType<{ className?: string }>;
  minPlan:    PlanTier;
  lockMsg?:   string;
  activePlan: PlanTier;
}) {
  const pathname = usePathname();
  const isLocked = !([...["STARTER","PRO","ENTERPRISE"]].slice(
    ["STARTER","PRO","ENTERPRISE"].indexOf(activePlan)
  ).includes(minPlan));
  const active   = !isLocked && (pathname === href || pathname.startsWith(href + "/"));

  // LOCKED → mostra voce greyed con badge piano e tooltip
  if (isLocked) {
    return (
      <SidebarMenuItem>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 pl-3 pr-2 py-2 rounded-lg cursor-not-allowed opacity-50 select-none w-full">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">{label}</span>
                <span className="group-data-[collapsible=icon]:hidden">
                  <PlanBadge plan={minPlan} />
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px] text-xs leading-snug">
              {lockMsg ?? `Disponibile con il piano ${PLAN_META[minPlan].label}`}
              <div className="mt-1.5">
                <a href="/billing" className="text-indigo-400 font-semibold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />{PLAN_META[minPlan].upgradeLabel ?? "Aggiorna piano"}
                </a>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarMenuItem>
    );
  }

  // UNLOCKED → voce normale con active state
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        className={cn(
          "gap-3 pl-3 transition-all duration-200",
          active
            ? "font-semibold bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-indigo-500 rounded-l-none"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Link href={href}>
          <Icon className="h-5 w-5 shrink-0" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function TenantSidebar() {
  const router       = useRouter();
  const { setTheme, theme } = useTheme();
  const { plan, meta, tenantInfo } = usePlan();
  const [user, setUser] = React.useState<{ email: string; role: string; initials: string } | null>(null);

  React.useEffect(() => {
    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:    payload.email    ?? "utente",
        role:     payload.role     ?? "user",
        initials: getInitials(payload.email),
      });
    }
  }, []);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/40 bg-gradient-to-b from-muted/30 to-sidebar backdrop-blur supports-[backdrop-filter]:bg-sidebar/60"
    >
      {/* HEADER */}
      <SidebarHeader className="h-20 border-b-0 p-0 overflow-hidden bg-transparent">
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex group-data-[collapsible=icon]:hidden items-center justify-center w-full h-full p-4">
            <div className="relative w-full h-full max-w-[140px]">
              <Image src="/logo-doflow.svg" alt="DoFlow" fill className="object-contain drop-shadow-sm" priority />
            </div>
          </div>
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full h-full">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-black text-base select-none">D</div>
          </div>
        </div>
      </SidebarHeader>

      {/* PIANO BADGE — visibile solo espansa */}
      <div className="px-3 pb-1 group-data-[collapsible=icon]:hidden">
        <a href="/billing" className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
          meta.color, meta.textColor, "hover:opacity-80",
        )}>
          <Sparkles className="h-3 w-3" />
          Piano {meta.label}
          {meta.nextPlan && (
            <span className="ml-auto opacity-60">{meta.upgradeLabel} →</span>
          )}
        </a>
      </div>

      {/* MENU */}
      <SidebarContent className="pt-1">
        {SIDEBAR_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.modules.map((mod) => (
                  <NavItem
                    key={mod.href}
                    href={mod.href}
                    label={mod.label}
                    icon={mod.icon}
                    minPlan={mod.minPlan}
                    lockMsg={mod.lockMsg}
                    activePlan={plan}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t border-sidebar-border/50 p-2 bg-sidebar/50">
        {/* Info tenant (solo espansa) */}
        {tenantInfo && (
          <div className="px-2 py-1.5 mb-1 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] font-semibold text-muted-foreground truncate">{tenantInfo.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (tenantInfo.storageUsedMb / (tenantInfo.storageLimitGb * 1024)) * 100).toFixed(0)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground shrink-0">
                {(tenantInfo.storageUsedMb / 1024).toFixed(1)}GB / {tenantInfo.storageLimitGb}GB
              </span>
            </div>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent hover:bg-sidebar-accent/50 transition-colors">
                  <Avatar className="h-8 w-8 rounded-lg border border-border">
                    <AvatarFallback className="rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm">{user?.initials ?? "DF"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                    <span className="truncate font-semibold text-foreground">{user?.email ?? "..."}</span>
                    <span className="truncate text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3 text-indigo-500" />{user?.role ?? ""}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg border-border/60" side="bottom" align="end" sideOffset={4}>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm">{user?.initials ?? "DF"}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.email}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.role}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="cursor-pointer">
                    {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    Cambia Tema
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />Il mio Account
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer">
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
