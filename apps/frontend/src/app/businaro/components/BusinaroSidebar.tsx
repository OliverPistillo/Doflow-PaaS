"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, Package, Hammer, Wrench, LogOut, Layers, PieChart,
  ChevronsUpDown, User, Bell
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarRail, SidebarGroup,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
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

  const user = {
    name: "Master Officina",
    role: "Admin",
    avatar: "https://github.com/shadcn.png",
    initials: "MO",
  };

  const logout = () => {
    document.cookie = "doflow_token=; Max-Age=0; path=/;";
    router.push("/login");
  };

  return (
    // SIDEBAR CON EFFETTO VETRO
    <Sidebar collapsible="icon" className="glass border-r-0 shadow-xl">
      <SidebarHeader className="h-16 flex items-center justify-center bg-transparent border-b border-white/10 dark:border-white/5">
        <div className="flex items-center gap-3 px-2 w-full group-data-[collapsible=icon]:justify-center">
          {/* Logo con gradiente */}
          <div className="shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg text-white">
             <Layers className="h-6 w-6" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden transition-all">
            <span className="font-bold tracking-tight text-lg leading-none">Businaro</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-3 bg-transparent">
        <SidebarGroup>
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
                      rounded-2xl px-4 py-6 transition-all duration-300 font-medium
                      ${active 
                        ? "bg-gradient-to-r from-blue-500/90 to-purple-500/90 text-white shadow-md" 
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }
                    `}
                  >
                    <Link href={it.href} className="flex items-center gap-3">
                      <it.icon className="h-5 w-5" />
                      <span>{it.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 bg-transparent border-t border-white/10 dark:border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-accent/50 hover:bg-accent/50 transition-colors rounded-2xl"
                >
                  <Avatar className="h-9 w-9 rounded-xl border border-white/20">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 text-white font-bold">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-3 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-bold text-foreground">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.role}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-60 rounded-2xl shadow-xl glass p-2"
                side="bottom"
                align="end"
                sideOffset={8}
              >
                 {/* ... (contenuto dropdown menu uguale a prima, ma dentro un container glass) ... */}
                 <DropdownMenuGroup>
                  <DropdownMenuItem className="cursor-pointer rounded-xl hover:bg-accent/50 focus:bg-accent/50">
                    <User className="mr-2 h-4 w-4" /> Profilo
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer rounded-xl hover:bg-accent/50 focus:bg-accent/50">
                     <Bell className="mr-2 h-4 w-4" /> Notifiche
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-white/10 dark:bg-white/5" />
                <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer font-bold rounded-xl">
                  <LogOut className="mr-2 h-4 w-4" /> Disconnetti
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