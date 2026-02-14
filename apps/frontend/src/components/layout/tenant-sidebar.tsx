"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LayoutDashboard, Users, ShoppingCart, Settings, 
  BarChart, Package, Truck, Layers, FileText, 
  CreditCard, LifeBuoy
} from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  const sidebarItems = [
    {
      heading: "Panoramica",
      items: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { label: "Analisi", icon: BarChart, href: "/analytics" },
      ],
    },
    {
      heading: "Gestione",
      items: [
        { label: "Clienti", icon: Users, href: "/customers" },
        { label: "Prodotti", icon: Package, href: "/products" },
        { label: "Ordini", icon: ShoppingCart, href: "/orders" },
        { label: "Fatture", icon: FileText, href: "/invoices" },
      ],
    },
    {
      heading: "Operazioni",
      items: [
        { label: "Logistica", icon: Truck, href: "/logistics" },
        { label: "Progetti", icon: Layers, href: "/projects" },
      ],
    },
    {
      heading: "Sistema",
      items: [
        { label: "Impostazioni", icon: Settings, href: "/settings" },
        { label: "Pagamenti", icon: CreditCard, href: "/billing" },
      ],
    },
  ];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* BRAND HEADER */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-2 font-bold text-xl text-white tracking-tight">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/50">D</div>
          DoFlow
        </div>
      </div>

      {/* MENU SCROLLABILE */}
      <ScrollArea className="flex-1 py-4">
        <div className="px-3 space-y-6">
          {sidebarItems.map((group, i) => (
            <div key={i}>
              <h3 className="mb-2 px-4 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                {group.heading}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start h-10",
                          isActive 
                            ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md" 
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        )}
                      >
                        <item.icon className={cn("mr-2 h-4 w-4", isActive ? "text-white" : "text-slate-500")} />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* FOOTER */}
      <div className="p-4 border-t border-slate-800">
        <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800">
            <LifeBuoy className="mr-2 h-4 w-4" /> Supporto
        </Button>
      </div>
    </div>
  );
}