// apps/frontend/src/app/superadmin/components/super-admin-sidebar.tsx
// Refactored: MENU_GROUPS rimosso, la struttura dati è ora in config/sidebar-config.ts.
// Aggiunto supporto per NavGroup (Collapsible) e NavLeaf con badge.

"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut, Moon, Sun, ChevronsUpDown, BadgeCheck,
  User, Settings, Palette, ChevronRight,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getDoFlowUser, getInitials } from "@/lib/jwt";
import {
  SUPERADMIN_SIDEBAR,
  isNavLeaf,
  isNavGroup,
  type NavLeaf,
  type NavGroup,
} from "../config/sidebar-config";

// ─── Color themes ─────────────────────────────────────────────────────────────

const COLOR_THEMES = [
  { id: "default", label: "Neutro (Default)",       colorClass: "bg-slate-500"   },
  { id: "ocean",   label: "Ocean (Blu/Verde)",       colorClass: "bg-blue-500"    },
  { id: "sunset",  label: "Sunset (Giallo/Arancio)", colorClass: "bg-orange-500"  },
  { id: "emerald", label: "Emerald (Verde Smeraldo)",colorClass: "bg-emerald-500" },
];

function setColorTheme(themeId: string) {
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-color-theme", themeId);
    localStorage.setItem("doflow_color_theme", themeId);
  }
}

// ─── NavLeafItem ──────────────────────────────────────────────────────────────

function NavLeafItem({ item }: { item: NavLeaf }) {
  const pathname = usePathname();
  // Match esatto o prefisso (gestisce rotte nested come /superadmin/sales/*)
  // Eccezione: /superadmin esatto per non attivare tutto il subtree
  const isActive =
    item.href === "/superadmin"
      ? pathname === "/superadmin"
      : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noopener noreferrer" : undefined}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className="flex-1 group-data-[collapsible=icon]:hidden truncate">
            {item.label}
          </span>
          {item.badge && (
            <Badge
              variant="secondary"
              className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold group-data-[collapsible=icon]:hidden"
            >
              {item.badge}
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── NavGroupItem ─────────────────────────────────────────────────────────────

function NavGroupItem({ item }: { item: NavGroup }) {
  const pathname = usePathname();
  const isAnyChildActive = item.items.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + "/")
  );
  const [open, setOpen] = React.useState(item.defaultOpen ?? isAnyChildActive);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.label} isActive={isAnyChildActive}>
            <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className="flex-1 group-data-[collapsible=icon]:hidden truncate">
              {item.label}
            </span>
            <ChevronRight
              className="ml-auto h-4 w-4 text-muted-foreground/50 transition-transform duration-200
                group-data-[state=open]/collapsible:rotate-90
                group-data-[collapsible=icon]:hidden"
              aria-hidden="true"
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenu className="pl-4 mt-0.5">
            {item.items.map((child) => (
              <NavLeafItem key={child.href} item={child} />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ─── SuperAdminSidebar ────────────────────────────────────────────────────────

export function SuperAdminSidebar() {
  const router = useRouter();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { state } = useSidebar();
  const isOpen = state === "expanded";

  const [mounted, setMounted] = React.useState(false);
  const [user, setUser] = React.useState<{
    email: string;
    role: string;
    initials: string;
  } | null>(null);

  React.useEffect(() => {
    setMounted(true);
    const savedColorTheme = localStorage.getItem("doflow_color_theme") || "default";
    setColorTheme(savedColorTheme);
    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:    payload.email ?? "superadmin",
        role:     payload.role  ?? "SUPER_ADMIN",
        initials: getInitials(payload.email),
      });
    }
  }, []);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  const logoSrc =
    mounted && resolvedTheme === "light"
      ? "/logo_doflow_nero.png"
      : "/logo_doflow_bianco.png";

  return (
    <Sidebar collapsible="icon">
      {/* ── HEADER: Logo ─────────────────────────────────────────────── */}
      <SidebarHeader className="h-16 p-0 border-b border-sidebar-border flex flex-col justify-center">
        <div
          className={`flex w-full items-center transition-all duration-300 ${
            isOpen ? "px-4 justify-start" : "px-0 justify-center"
          }`}
        >
          <div
            className={`relative transition-all duration-300 ${
              isOpen ? "h-8 w-36" : "h-8 w-8 shrink-0"
            }`}
          >
            {mounted && (
              <Image
                src={logoSrc}
                alt="DoFlow"
                fill
                priority
                className={`transition-all duration-300 ${
                  isOpen
                    ? "object-contain object-left"
                    : "object-contain object-center"
                }`}
              />
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* ── CONTENT: Nav Groups ──────────────────────────────────────── */}
      <SidebarContent>
        {SUPERADMIN_SIDEBAR.map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  if (isNavLeaf(item)) {
                    return <NavLeafItem key={item.href} item={item} />;
                  }
                  if (isNavGroup(item)) {
                    return <NavGroupItem key={item.label} item={item} />;
                  }
                  return null;
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── FOOTER: User avatar + dropdown ───────────────────────────── */}
      <SidebarFooter className="border-none pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground ${
                    isOpen
                      ? "justify-start px-3"
                      : "w-full justify-center px-0 py-1"
                  }`}
                  aria-label="Menu utente"
                >
                  <Avatar className="h-10 w-10 rounded-nav border border-border shrink-0">
                    <AvatarFallback
                      className="rounded-nav text-base font-bold"
                      style={{
                        background: "hsl(var(--primary) / 0.12)",
                        color: "hsl(var(--primary))",
                      }}
                    >
                      {user?.initials ?? "SA"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-foreground">
                      {user?.email ?? "Superadmin"}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3 text-primary" aria-hidden="true" />
                      {user?.role ?? "SUPER_ADMIN"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50 group-data-[collapsible=icon]:hidden" aria-hidden="true" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-60 rounded-card shadow-card border-border"
                side={isOpen ? "bottom" : "right"}
                align="end"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-10 w-10 rounded-nav">
                      <AvatarFallback
                        className="rounded-nav font-bold"
                        style={{
                          background: "hsl(var(--primary) / 0.12)",
                          color: "hsl(var(--primary))",
                        }}
                      >
                        {user?.initials ?? "SA"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid text-left text-sm leading-tight">
                      <span className="truncate font-bold text-foreground">
                        {user?.email ?? "superadmin"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.role ?? "SUPER_ADMIN"}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/account" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Il mio Account
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="cursor-pointer"
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Passa a {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
                  </DropdownMenuItem>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Palette className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Stile e Colori
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="rounded-card border-border">
                        {COLOR_THEMES.map((ct) => (
                          <DropdownMenuItem
                            key={ct.id}
                            onClick={() => setColorTheme(ct.id)}
                            className="cursor-pointer gap-2"
                          >
                            <div
                              className={`h-3 w-3 rounded-full ${ct.colorClass} ring-1 ring-offset-1 ring-offset-card ring-black/10`}
                            />
                            {ct.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Impostazioni Globali
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-medium"
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Disconnetti in sicurezza
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
