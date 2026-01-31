"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, Package, Hammer, Wrench, LogOut, Layers, PieChart,
  ChevronsUpDown, User, BadgeCheck, Bell
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const items = [
  { label: "Overview", href: "/businaro/dashboard", icon: LayoutGrid },
  { label: "WMS Magazzino", href: "/businaro/magazzino", icon: Package },
  { label: "Macchine Utensili", href: "/businaro/macchine-utensili", icon: Hammer },
  { label: "Assemblaggio", href: "/businaro/assemblaggio", icon: Wrench },
  { label: "Analytics", href: "#", icon: PieChart },
];

export function BusinaroSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { setTheme, theme } = useTheme();

  const user = {
    name: "Master Officina",
    role: "Admin",
    avatar: "https://github.com/shadcn.png",
    initials: "MO",
  };

  const logout = () => {
    // Logica logout
    document.cookie = "doflow_token=; Max-Age=0; path=/;";
    router.push("/login");
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-border bg-card"
    >
      {/* HEADER LOGO */}
      <SidebarHeader className="h-16 border-b border-border/10 flex items-center justify-center">
        <div className="flex items-center gap-3 px-2 w-full group-data-[collapsible=icon]:justify-center">
          <div className="shrink-0 h-9 w-9 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(204,243,47,0.4)] text-primary-foreground">
             <Layers className="h-5 w-5" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden transition-all">
            <span className="font-bold tracking-tight text-lg leading-none">Businaro</span>
            <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Prod. System</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
           <SidebarGroupLabel className="uppercase tracking-widest font-bold text-[10px] text-muted-foreground mb-2 group-data-[collapsible=icon]:hidden">
             Menu Principale
           </SidebarGroupLabel>
           <SidebarMenu className="gap-2">
            {items.map((it) => {
              const active = pathname === it.href;
              return (
                <SidebarMenuItem key={it.href}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={active} 
                    tooltip={it.label}
                    className={`
                      rounded-xl px-3 py-5 transition-all duration-200
                      ${active 
                        ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }
                    `}
                  >
                    <Link href={it.href}>
                      <it.icon className={active ? "text-primary-foreground" : ""} />
                      <span>{it.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER UTENTE */}
      <SidebarFooter className="p-2 border-t border-border/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-muted transition-colors rounded-xl"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-border">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground font-bold">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-2 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-foreground">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3 text-primary" />
                      {user.role}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-xl border-border bg-card"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="rounded-lg">{user.initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.role}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="cursor-pointer">
                    <Bell className="mr-2 h-4 w-4" />
                    Notifiche
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profilo
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer font-bold">
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