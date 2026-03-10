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
  Palette
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
import { getDoFlowUser, getInitials } from "@/lib/jwt";

// ─── Menu ─────────────────────────────────────────────────────────────────────

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

// ─── Theming Logic ─────────────────────────────────────────────────────────────

const COLOR_THEMES = [
  { id: "default", label: "Neutro (Default)", colorClass: "bg-slate-500" },
  { id: "ocean", label: "Ocean (Blu/Verde)", colorClass: "bg-blue-500" },
  { id: "sunset", label: "Sunset (Giallo/Arancio)", colorClass: "bg-orange-500" },
];

function setColorTheme(themeId: string) {
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-color-theme", themeId);
    localStorage.setItem("doflow_color_theme", themeId);
  }
}

// ─── Item ─────────────────────────────────────────────────────────────────────

function Item({
  href,
  label,
  icon: Icon,
  isHovered
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isHovered: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        className={`gap-3 pl-3 mb-1 transition-all duration-200 overflow-hidden ${
          active
            ? "font-semibold bg-primary/10 text-primary border-l-4 border-primary rounded-l-none"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <Link href={href} className="flex items-center w-full">
          <Icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} />
          <span className={`ml-2 whitespace-nowrap transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}>
            {label}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function SuperAdminSidebar() {
  const router = useRouter();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { state } = useSidebar();
  
  const [mounted, setMounted] = React.useState(false);
  const [user, setUser] = React.useState<{ email: string; role: string; initials: string } | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
    const savedColorTheme = localStorage.getItem("doflow_color_theme") || "default";
    setColorTheme(savedColorTheme);

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

  const showDetails = state === "expanded" || isHovered;
  const logoSrc = mounted && resolvedTheme === 'light' ? '/logo_doflow_nero.png' : '/logo_doflow_bianco.png';

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`glass-sidebar border-r border-border/40 z-50 sidebar-hover-expand ${
        state === "collapsed" && isHovered ? "w-[--sidebar-width]" : ""
      }`}
    >
      {/* HEADER WITH DYNAMIC LOGO */}
      <SidebarHeader className="h-20 border-b border-border/40 p-0 overflow-hidden shrink-0 flex items-center relative transition-[padding] duration-300">
        <div className={`flex h-full w-full items-center relative transition-all duration-300 ${showDetails ? 'px-5 justify-start' : 'px-0 justify-center'}`}>
          {/* FIX APPLICATO QUI: ease-out usato al posto di cubic-bezier per non far rompere la build */}
          <div className={`relative h-10 transition-all duration-300 ease-out ${showDetails ? 'w-40' : 'w-10'}`}>
            {mounted && (
              <Image
                src={logoSrc}
                alt="DoFlow Logo"
                fill
                priority
                className={`object-contain object-left transition-opacity duration-300 ${showDetails ? 'opacity-100' : 'opacity-90'}`}
              />
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* CONTENT */}
      <SidebarContent className="pt-4 scrollbar-none">
        {MENU_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="mb-2">
            <SidebarGroupLabel className={`text-muted-foreground text-[10px] uppercase tracking-widest font-bold transition-all duration-300 whitespace-nowrap overflow-hidden ${showDetails ? "opacity-100 px-2" : "opacity-0 h-0 p-0"}`}>
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => (
                  <Item key={item.href} href={item.href} label={item.label} icon={item.icon} isHovered={showDetails} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t border-border/40 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-muted hover:bg-muted/80 transition-colors rounded-xl h-12"
                >
                  <Avatar className="h-9 w-9 rounded-lg border-2 border-primary/20 shrink-0">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold text-sm">
                      {user?.initials ?? "SA"}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`grid flex-1 text-left text-sm leading-tight ml-2 transition-all duration-300 overflow-hidden whitespace-nowrap ${showDetails ? "w-[120px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-2"}`}>
                    <span className="truncate font-semibold text-foreground">{user?.email ?? "Superadmin"}</span>
                    <span className="truncate text-[10px] text-muted-foreground font-bold flex items-center gap-1 uppercase">
                      <BadgeCheck className="h-3 w-3 text-primary" />
                      {user?.role}
                    </span>
                  </div>
                  {showDetails && <ChevronsUpDown className="ml-auto size-4 text-muted-foreground shrink-0" />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-[240px] rounded-xl shadow-2xl border-border/40 glass-card"
                side={state === "collapsed" && !isHovered ? "right" : "bottom"}
                align="end"
                sideOffset={10}
              >
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex items-center gap-3 text-left text-sm">
                    <Avatar className="h-10 w-10 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold">
                        {user?.initials ?? "SA"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-bold">{user?.email}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.role}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="bg-border/50" />

                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/users" className="cursor-pointer py-2 rounded-lg">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      Il mio Account
                    </Link>
                  </DropdownMenuItem>
                  
                  {/* Opzioni: Tema Chiaro/Scuro */}
                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="cursor-pointer py-2 rounded-lg">
                    {resolvedTheme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    Passa a {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
                  </DropdownMenuItem>

                  {/* Opzioni: Colori Primari */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="py-2 rounded-lg cursor-pointer">
                      <Palette className="mr-2 h-4 w-4 text-muted-foreground" />
                      Stile e Colori
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="glass-card rounded-xl border-border/40 ml-2">
                        {COLOR_THEMES.map((ct) => (
                          <DropdownMenuItem 
                            key={ct.id} 
                            onClick={() => setColorTheme(ct.id)}
                            className="cursor-pointer py-2 flex items-center gap-2"
                          >
                            <div className={`h-3 w-3 rounded-full ${ct.colorClass} ring-1 ring-offset-1 ring-offset-card ring-${ct.colorClass.replace('bg-', '')}/30`} />
                            {ct.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/settings" className="cursor-pointer py-2 rounded-lg">
                      <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                      Impostazioni Globali
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="bg-border/50" />

                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer py-2 mt-1 rounded-lg font-medium"
                >
                  <LogOut className="mr-2 h-4 w-4" />
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