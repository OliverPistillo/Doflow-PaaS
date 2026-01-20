"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Sparkles,
  CalendarDays,
  FileText,
  LogOut,
  User,
  Moon,
  Sun,
  Megaphone,
  ChevronsUpDown,
  BadgeCheck,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Componente singolo Item personalizzato
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
  const active =
    pathname === href || (href !== "/federicanerone" && pathname.startsWith(href + "/"));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={label}
        // gap-3 e pl-3 spostano il testo a destra quando aperta
        className={`gap-3 pl-3 transition-all duration-200 ${
          active 
            ? "font-semibold bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-indigo-500 rounded-l-none" 
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Link href={href}>
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function FedericaSidebar() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  const user = {
    name: "Federica Nerone",
    role: "Owner", 
    avatar: "", 
    initials: "FN",
  };

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
      
      {/* HEADER DINAMICO */}
      <SidebarHeader className="h-16 border-b border-sidebar-border/50 p-0 overflow-hidden">
        <div className="flex h-full w-full items-center justify-center">

          {/* 1. LOGO APERTO (logo_nerone.png) */}
          {/* Visibile SOLO quando la sidebar è espansa */}
          <div className="flex group-data-[collapsible=icon]:hidden items-center justify-center w-full h-full p-4 transition-all duration-300">
             <div className="relative w-full h-full max-w-[140px]">
               <Image
                src="/federicanerone/logo_nerone.png"
                alt="Federica Nerone"
                fill
                className="object-contain"
                priority
              />
             </div>
          </div>

          {/* 2. LOGO CHIUSO (logo_trigger_nerone.png) */}
          {/* Visibile SOLO quando la sidebar è collapsata (icon mode) */}
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full h-full transition-all duration-300">
             <div className="relative w-8 h-8">
               <Image
                src="/federicanerone/logo_trigger_nerone.png"
                alt="Logo"
                fill
                className="object-contain"
              />
             </div>
          </div>

        </div>
      </SidebarHeader>

      <SidebarContent className="pt-4">
        {/* Gruppo Piattaforma */}
        <SidebarGroup>
          <SidebarGroupLabel>Piattaforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <Item href="/federicanerone" label="Dashboard" icon={LayoutDashboard} />
              <Item href="/federicanerone/appuntamenti" label="Appuntamenti" icon={CalendarDays} />
              <Item href="/federicanerone/clienti" label="Clienti" icon={Users} />
              <Item href="/federicanerone/trattamenti" label="Trattamenti" icon={Sparkles} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Gruppo Gestione */}
        <SidebarGroup>
          <SidebarGroupLabel>Gestione</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <Item href="/federicanerone/leads" label="Campagne Lead" icon={Megaphone} />
              <Item href="/federicanerone/documenti" label="Documenti" icon={FileText} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter className="border-t border-sidebar-border/50 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-border">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg bg-indigo-100 text-indigo-700 font-bold">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                    <span className="truncate font-semibold text-foreground">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3 text-indigo-500" />
                      {user.role}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl shadow-lg border-border/60"
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
                  <DropdownMenuItem asChild>
                    <Link href="/federicanerone/account" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      Il mio Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="cursor-pointer">
                     {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                     Cambia Tema
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer">
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