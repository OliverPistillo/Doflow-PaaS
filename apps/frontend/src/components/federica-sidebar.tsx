"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Sparkles, CalendarDays, FileText, LogOut } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

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
  const active = pathname === href || (href !== "/federicanerone" && pathname.startsWith(href + "/"));

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

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  return (
    // 'collapsible="icon"' è la chiave per farla ridurre invece che sparire
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Container per il logo, centrato per apparire bene anche da chiuso */}
        <div className="flex h-12 items-center justify-center py-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-md">
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
            {/* Usiamo SidebarMenuButton anche qui per gestire l'icon-only mode automaticamente */}
            <SidebarMenuButton 
              onClick={logout} 
              tooltip="Logout"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}