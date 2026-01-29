"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { LayoutDashboard, Package, Hammer, Wrench, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const items = [
  { label: "Dashboard", href: "/businaro/dashboard", icon: LayoutDashboard },
  { label: "Magazzino", href: "/businaro/magazzino", icon: Package },
  { label: "Macchine Utensili", href: "/businaro/macchine-utensili", icon: Hammer },
  { label: "Assemblaggio", href: "/businaro/assemblaggio", icon: Wrench },
];

export function BusinaroSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="p-4 border-b">
        <div className="font-extrabold tracking-tight text-slate-900 text-xl">
          BUSINARO
        </div>
        <div className="text-xs text-muted-foreground">WMS + Produzione</div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <SidebarMenuItem key={it.href}>
                <SidebarMenuButton asChild isActive={active} size="lg">
                  <Link href={it.href}>
                    <it.icon className="mr-2 h-5 w-5" />
                    <span className="text-base">{it.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        <SidebarSeparator className="my-4" />
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button variant="outline" className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
