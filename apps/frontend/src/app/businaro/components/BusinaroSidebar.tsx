"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { LayoutGrid, Package, Hammer, Wrench, LogOut, Layers, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";

const items = [
  { label: "Overview", href: "/businaro/dashboard", icon: LayoutGrid },
  { label: "WMS Magazzino", href: "/businaro/magazzino", icon: Package },
  { label: "Macchine Utensili", href: "/businaro/macchine-utensili", icon: Hammer },
  { label: "Assemblaggio", href: "/businaro/assemblaggio", icon: Wrench },
  { label: "Analytics", href: "#", icon: PieChart },
];

export function BusinaroSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" className="border-r border-border bg-card">
      <SidebarHeader className="p-6 pb-2">
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-3 hover:rotate-0 transition-transform">
             <Layers className="text-primary-foreground h-6 w-6" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-xl leading-none">Businaro</div>
            <div className="text-[10px] text-muted-foreground font-bold tracking-widest mt-1 uppercase">Production OS</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4 space-y-1">
        <div className="text-xs font-bold text-muted-foreground px-4 py-2 uppercase tracking-widest">Menu</div>
        <SidebarMenu>
          {items.map((it) => {
            const active = pathname === it.href;
            return (
              <SidebarMenuItem key={it.href}>
                <SidebarMenuButton 
                  asChild 
                  isActive={active} 
                  className={`
                    rounded-2xl px-4 py-6 transition-all duration-200 group
                    ${active ? "bg-foreground text-background font-bold shadow-md" : "text-muted-foreground hover:bg-muted hover:text-foreground"}
                  `}
                >
                  <Link href={it.href} className="flex items-center gap-3">
                    <it.icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                    <span className="text-sm">{it.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-6 border-t border-border">
         <div className="bg-muted/50 rounded-2xl p-4 mb-4 border border-border">
            <div className="flex justify-between items-center mb-2">
               <span className="text-xs font-bold uppercase text-muted-foreground">Storage</span>
               <span className="text-xs font-bold text-primary">78%</span>
            </div>
            <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
               <div className="h-full w-[78%] bg-primary rounded-full" />
            </div>
         </div>
         
        <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
          <LogOut className="h-4 w-4" /> Disconnetti
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}