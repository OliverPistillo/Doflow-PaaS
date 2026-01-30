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
import { LayoutDashboard, Package, Hammer, Wrench, LogOut, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

const items = [
  { label: "Control Plane", href: "/businaro/dashboard", icon: LayoutDashboard },
  { label: "WMS Magazzino", href: "/businaro/magazzino", icon: Package },
  { label: "Macchine Utensili", href: "/businaro/macchine-utensili", icon: Hammer },
  { label: "Assemblaggio", href: "/businaro/assemblaggio", icon: Wrench },
];

export function BusinaroSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" className="border-r border-businaro-border bg-businaro-panel">
      <SidebarHeader className="p-6 border-b border-businaro-border">
        <div className="flex items-center gap-2">
          {/* Logo Minimalista */}
          <div className="h-8 w-8 bg-businaro-red rounded flex items-center justify-center shadow-[0_0_15px_rgba(225,29,72,0.4)]">
             <Layers className="text-white h-5 w-5" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-white text-lg leading-none">
              BUSINARO
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider mt-1">
              PRODUCTION SYSTEM
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <SidebarMenu>
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <SidebarMenuItem key={it.href}>
                <SidebarMenuButton 
                  asChild 
                  isActive={active} 
                  size="lg"
                  className={`
                    transition-all duration-200 
                    ${active 
                      ? "bg-businaro-red text-white shadow-lg hover:bg-red-700 hover:text-white" 
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                    }
                  `}
                >
                  <Link href={it.href}>
                    <it.icon className={`mr-3 h-5 w-5 ${active ? "text-white" : "text-slate-500"}`} />
                    <span className="font-medium">{it.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        <div className="mt-auto px-2">
          <div className="rounded-lg bg-businaro-dark border border-businaro-border p-4">
             <div className="text-xs text-slate-500 font-mono mb-2">SERVER STATUS</div>
             <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Operational
             </div>
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-businaro-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20"
          onClick={() => {
             // Gestione logout
             window.localStorage.removeItem("doflow_token");
             window.location.href = "/login";
          }}
        >
          <LogOut className="h-4 w-4" />
          Disconnetti
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}