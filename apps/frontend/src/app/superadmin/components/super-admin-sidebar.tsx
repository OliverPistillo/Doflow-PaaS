"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Activity,
  ShieldAlert,
  LogOut,
  BarChart3,
  ListTodo,
  Truck,
  CalendarDays,
  Wallet,
  Receipt,
  Moon,
  Sun,
  ChevronsUpDown,
  BadgeCheck,
  User,
  Settings,
  Palette,
  Bell,
  Check,
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
  SidebarGroupLabel,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDoFlowUser, getInitials } from "@/lib/jwt";

// ─── Menu Structure ───────────────────────────────────────────────────────────

const MENU_GROUPS = [
  {
    label: "Performance commerciali",
    items: [
      { label: "Sales Dashboard",  href: "/superadmin/dashboard",      icon: BarChart3  },
      { label: "Gestione offerte", href: "/superadmin/sales/pipeline", icon: ListTodo   },
    ],
  },
  {
    label: "Consegna del servizio",
    items: [
      { label: "Stato del servizio",      href: "/superadmin/delivery/status",   icon: Truck      },
      { label: "Calendario del progetto", href: "/superadmin/delivery/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Fatturazione",
    items: [
      { label: "Dashboard finanziario",    href: "/superadmin/finance/dashboard", icon: Wallet  },
      { label: "Gestione fatture",         href: "/superadmin/finance/invoices",  icon: Receipt },
    ],
  },
  {
    label: "Platform Admin",
    items: [
      { label: "Control Tower",    href: "/superadmin/control-tower", icon: ShieldAlert },
      { label: "Gestione Tenant",  href: "/superadmin/tenants",       icon: Building2   },
      { label: "Gestione Utenti",  href: "/superadmin/users",         icon: Users       },
      { label: "Audit Log",        href: "/superadmin/audit",         icon: Activity    },
    ],
  },
];

// ─── Color Themes ─────────────────────────────────────────────────────────────

const COLOR_THEMES = [
  { id: "default",  label: "Neutro",          color: "#8B8B8B" },
  { id: "ocean",    label: "Ocean",           color: "#3B82F6" },
  { id: "sunset",   label: "Sunset",          color: "#F59E0B" },
  { id: "emerald",  label: "Emerald",         color: "#10B981" },
];

function setColorTheme(themeId: string) {
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-color-theme", themeId);
    localStorage.setItem("doflow_color_theme", themeId);
  }
}

function getColorTheme(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("doflow_color_theme") || "default";
  }
  return "default";
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  expanded,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  expanded: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  const button = (
    <Link
      href={href}
      className={`
        flex items-center gap-3 rounded-xl px-3 h-11 transition-all duration-200 relative group/item
        ${active
          ? "sidebar-active-indicator bg-sidebar-accent text-sidebar-primary font-semibold"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
        }
      `}
    >
      <Icon className={`h-[20px] w-[20px] shrink-0 transition-colors ${active ? "text-sidebar-primary" : ""}`} />
      <span
        className={`
          text-[13px] whitespace-nowrap transition-all duration-300 overflow-hidden
          ${expanded ? "opacity-100 translate-x-0 w-auto" : "opacity-0 -translate-x-1 w-0"}
        `}
      >
        {label}
      </span>
    </Link>
  );

  // Show tooltip only when collapsed
  if (!expanded) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

// ─── Main Sidebar Component ───────────────────────────────────────────────────

export function SuperAdminSidebar() {
  const router = useRouter();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { state } = useSidebar();

  const [mounted, setMounted] = React.useState(false);
  const [user, setUser] = React.useState<{ email: string; role: string; initials: string } | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [currentColorTheme, setCurrentColorTheme] = React.useState("default");

  React.useEffect(() => {
    setMounted(true);
    const savedColorTheme = getColorTheme();
    setColorTheme(savedColorTheme);
    setCurrentColorTheme(savedColorTheme);

    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:    payload.email ?? "superadmin",
        role:     payload.role  ?? "superadmin",
        initials: getInitials(payload.email),
      });
    }
  }, []);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  const handleColorTheme = React.useCallback((id: string) => {
    setColorTheme(id);
    setCurrentColorTheme(id);
  }, []);

  const expanded = state === "expanded" || isHovered;
  const logoSrc = mounted && resolvedTheme === "light" ? "/logo_doflow_nero.png" : "/logo_doflow_bianco.png";

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        glass-sidebar z-50 sidebar-hover-expand
        ${state === "collapsed" && isHovered ? "w-[--sidebar-width]" : ""}
      `}
    >
      {/* ── Header / Logo ──────────────────────────────────────────────── */}
      <SidebarHeader className="h-16 border-b border-sidebar-border/50 p-0 overflow-hidden shrink-0 flex items-center">
        <div
          className={`
            flex h-full w-full items-center transition-all duration-300
            ${expanded ? "px-5 justify-start" : "px-0 justify-center"}
          `}
        >
          <div className={`relative h-8 transition-all duration-300 ease-out ${expanded ? "w-32" : "w-8"}`}>
            {mounted && (
              <Image
                src={logoSrc}
                alt="DoFlow"
                fill
                priority
                className={`object-contain object-left transition-opacity duration-300 ${expanded ? "opacity-100" : "opacity-80"}`}
              />
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <SidebarContent className="pt-3 px-2 scrollbar-none overflow-y-auto overflow-x-hidden">
        {MENU_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="mb-1">
            {/* Group label — visible only when expanded */}
            <SidebarGroupLabel
              className={`
                text-[10px] uppercase tracking-[0.12em] font-bold text-sidebar-foreground/40
                transition-all duration-300 whitespace-nowrap overflow-hidden px-3
                ${expanded ? "opacity-100 h-7 mb-1" : "opacity-0 h-0 mb-0 p-0"}
              `}
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <NavItem
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      expanded={expanded}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <SidebarFooter className="border-t border-sidebar-border/50 p-2">
        <SidebarMenu>
          {/* Notification bell */}
          <SidebarMenuItem>
            <div
              className={`
                flex items-center gap-3 rounded-xl px-3 h-10 text-sidebar-foreground/50
                hover:text-sidebar-foreground hover:bg-sidebar-accent/60 cursor-pointer transition-all duration-200
              `}
            >
              <Bell className="h-[20px] w-[20px] shrink-0" />
              <span
                className={`
                  text-[13px] whitespace-nowrap transition-all duration-300 overflow-hidden
                  ${expanded ? "opacity-100 w-auto" : "opacity-0 w-0"}
                `}
              >
                Notifiche
              </span>
            </div>
          </SidebarMenuItem>

          {/* User menu */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent hover:bg-sidebar-accent/60 transition-colors rounded-xl h-12 px-2"
                >
                  <Avatar className="h-9 w-9 rounded-xl shrink-0 border border-sidebar-border">
                    <AvatarFallback className="rounded-xl bg-sidebar-primary/10 text-sidebar-primary font-bold text-xs">
                      {user?.initials ?? "SA"}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`
                      grid flex-1 text-left text-sm leading-tight ml-2
                      transition-all duration-300 overflow-hidden whitespace-nowrap
                      ${expanded ? "w-[120px] opacity-100" : "w-0 opacity-0"}
                    `}
                  >
                    <span className="truncate font-semibold text-sidebar-foreground text-[13px]">
                      {user?.email ?? "Superadmin"}
                    </span>
                    <span className="truncate text-[10px] text-sidebar-foreground/50 font-bold flex items-center gap-1 uppercase">
                      <BadgeCheck className="h-3 w-3 text-sidebar-primary" />
                      {user?.role}
                    </span>
                  </div>
                  {expanded && <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/40 shrink-0" />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-[260px] rounded-xl shadow-2xl glass-card p-1"
                side={state === "collapsed" && !isHovered ? "right" : "top"}
                align="end"
                sideOffset={10}
              >
                {/* User info */}
                <DropdownMenuLabel className="p-3 font-normal">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-xl">
                      <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold">
                        {user?.initials ?? "SA"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 leading-tight">
                      <span className="truncate font-bold text-sm">{user?.email}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.role}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="bg-border/50" />

                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/users" className="cursor-pointer py-2.5 px-3 rounded-lg">
                      <User className="mr-2.5 h-4 w-4 text-muted-foreground" />
                      Il mio Account
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/settings" className="cursor-pointer py-2.5 px-3 rounded-lg">
                      <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
                      Impostazioni Globali
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="bg-border/50" />

                {/* Tema chiaro / scuro */}
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="cursor-pointer py-2.5 px-3 rounded-lg"
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="mr-2.5 h-4 w-4" />
                    ) : (
                      <Moon className="mr-2.5 h-4 w-4" />
                    )}
                    Passa a {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
                  </DropdownMenuItem>

                  {/* Colori Primari — Sub‑menu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="py-2.5 px-3 rounded-lg cursor-pointer">
                      <Palette className="mr-2.5 h-4 w-4 text-muted-foreground" />
                      Stile e Colori
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="glass-card rounded-xl border-border/40 ml-2 p-1 min-w-[180px]">
                        {COLOR_THEMES.map((ct) => (
                          <DropdownMenuItem
                            key={ct.id}
                            onClick={() => handleColorTheme(ct.id)}
                            className="cursor-pointer py-2.5 px-3 flex items-center gap-3 rounded-lg"
                          >
                            <div
                              className="h-4 w-4 rounded-full shrink-0"
                              style={{ backgroundColor: ct.color, boxShadow: `0 0 0 1.5px hsl(var(--card)), 0 0 0 3px ${ct.color}40` }}
                            />
                            <span className="flex-1">{ct.label}</span>
                            {currentColorTheme === ct.id && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="bg-border/50" />

                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer py-2.5 px-3 rounded-lg font-medium"
                >
                  <LogOut className="mr-2.5 h-4 w-4" />
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