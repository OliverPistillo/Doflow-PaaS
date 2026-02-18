"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
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
import { getDoFlowUser, getInitials } from "@/lib/jwt";

// ─── Menu ─────────────────────────────────────────────────────────────────────

const MENU_GROUPS = [
  {
    label: "Performance commerciali",
    items: [
      { label: "Sales Dashboard",  href: "/superadmin/dashboard",       icon: BarChart3  },
      { label: "Gestione offerte", href: "/superadmin/sales/pipeline",  icon: ListTodo   },
    ],
  },
  {
    label: "Consegna del servizio",
    items: [
      { label: "Stato del servizio",       href: "/superadmin/delivery/status",   icon: Truck       },
      { label: "Calendario del progetto",  href: "/superadmin/delivery/calendar", icon: CalendarDays },
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

// ─── Item ─────────────────────────────────────────────────────────────────────

function Item({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        className={`gap-3 pl-3 transition-all duration-200 ${
          active
            ? "font-semibold bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-indigo-500 rounded-l-none"
            : "text-muted-foreground hover:text-foreground"
        }`}
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

export function SuperAdminSidebar() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [user, setUser] = React.useState<{ email: string; role: string; initials: string } | null>(null);

  React.useEffect(() => {
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

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/40 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 [&_[data-sidebar=sidebar]]:bg-transparent"
    >
      {/* HEADER */}
      <SidebarHeader className="h-20 border-b border-slate-800/60 p-0 overflow-hidden">
        <div className="flex h-full w-full items-center justify-center">

          {/* Logo aperto */}
          <div className="flex group-data-[collapsible=icon]:hidden items-center gap-3 px-5 w-full">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50 text-white font-black text-lg shrink-0">
              D
            </div>
            <div className="leading-tight">
              <div className="font-black text-white tracking-wide text-base">DOFLOW</div>
              <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest">OPS</div>
            </div>
          </div>

          {/* Logo chiuso */}
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full h-full">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50 text-white font-black text-lg">
              D
            </div>
          </div>

        </div>
      </SidebarHeader>

      {/* CONTENT */}
      <SidebarContent className="pt-2 [&_[data-sidebar=group-label]]:text-slate-500">
        {MENU_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => (
                  <Item key={item.href} href={item.href} label={item.label} icon={item.icon} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t border-slate-800/60 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-slate-800 hover:bg-slate-800/70 transition-colors text-slate-200"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-slate-700">
                    <AvatarFallback className="rounded-lg bg-indigo-900 text-indigo-200 font-bold text-sm">
                      {user?.initials ?? "SA"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                    <span className="truncate font-semibold text-slate-100">{user?.email ?? "Superadmin"}</span>
                    <span className="truncate text-xs text-slate-400 font-medium flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3 text-indigo-400" />
                      {user?.role}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-slate-500" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm">
                        {user?.initials ?? "SA"}
                      </AvatarFallback>
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
                    {theme === "dark"
                      ? <Sun className="mr-2 h-4 w-4" />
                      : <Moon className="mr-2 h-4 w-4" />
                    }
                    Cambia Tema
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/users" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      Il mio Account
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={logout}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnetti
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
