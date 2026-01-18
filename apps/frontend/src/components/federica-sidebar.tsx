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
  Settings,
  User,
  Upload,
  Moon,
  Sun,
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
  SidebarSeparator,
  SidebarTrigger,
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
  // Active se è il path esatto o una sottocartella (es. /clienti/123)
  const active =
    pathname === href || (href !== "/federicanerone" && pathname.startsWith(href + "/"));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link href={href}>
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function FedericaSidebar() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  return (
    // 'collapsible="icon"' è la chiave per farla ridurre invece che sparire
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Container per il logo, centrato per apparire bene anche da chiuso */}
        <div className="flex h-12 w-full items-center justify-center py-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-md flex-shrink-0">
            <Image
              src="/federicanerone/favicon.ico"
              alt="Federica Nerone Logo"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          <Item href="/federicanerone" label="Overview" icon={LayoutDashboard} />
          <Item href="/federicanerone/clienti" label="Clienti" icon={Users} />
          <Item href="/federicanerone/trattamenti" label="Trattamenti" icon={Sparkles} />
          <Item href="/federicanerone/appuntamenti" label="Appuntamenti" icon={CalendarDays} />
          <Item href="/federicanerone/documenti" label="Documenti" icon={FileText} />
        </SidebarMenu>

        <SidebarSeparator />
      </SidebarContent>

<SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    {/* Qui potresti leggere l'URL avatar dallo stato globale/user */}
                    <AvatarImage src="" alt="Federica Nerone" />
                    <AvatarFallback className="rounded-lg">FN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Federica Nerone</span>
                    <span className="truncate text-xs">m@example.com</span>
                  </div>
                  <Settings className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src="" alt="Federica Nerone" />
                      <AvatarFallback className="rounded-lg">FN</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Federica Nerone</span>
                      <span className="truncate text-xs">m@example.com</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {/* MODIFICA: Link alla pagina account */}
                  <DropdownMenuItem asChild>
                    <Link href="/federicanerone/account" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  
                  {/* Rimosso "Upload Profile Picture" perché ora è dentro la pagina Account */}
                  
                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    Tema
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-500 hover:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}