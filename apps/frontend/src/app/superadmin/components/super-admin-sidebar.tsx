"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Activity, 
  ShieldAlert, 
  LogOut,
  BarChart3,
  Box,
  CreditCard,
  FileText,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";

// Definizione dei gruppi di navigazione
const MENU_GROUPS = [
  {
    label: "Business Intelligence",
    items: [
      { label: "Sales Dashboard", href: "/dashboard", icon: BarChart3 }, // Puntiamo alla nuova Home CRM
      { label: "Pipeline", href: "/sales/pipeline", icon: LayoutDashboard },
      { label: "Finanza", href: "/finance/dashboard", icon: CreditCard },
    ],
  },
  {
    label: "Platform Admin",
    items: [
      { label: "Control Tower", href: "/superadmin/control-tower", icon: ShieldAlert },
      { label: "Gestione Tenant", href: "/superadmin/tenants", icon: Building2 },
      { label: "Gestione Utenti", href: "/superadmin/users", icon: Users },
      { label: "Audit Log", href: "/superadmin/audit", icon: Activity },
    ],
  },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem('doflow_token');
        window.location.href = '/login';
    }
  };

  return (
    <aside className="w-64 bg-slate-950 text-white flex flex-col fixed h-full z-20 shadow-2xl border-r border-slate-800">
      {/* HEADER */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900/50">
        <ShieldAlert className="h-6 w-6 text-indigo-500 mr-3" />
        <span className="font-bold text-lg tracking-wide">
          DOFLOW <span className="text-indigo-500">OPS</span>
        </span>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {MENU_GROUPS.map((group, idx) => (
          <div key={idx}>
            <div className="px-2 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                // Gestione active state:
                // Se siamo su /dashboard (Sales) e l'item è quello, è attivo.
                // Se siamo su /superadmin/... e l'item è quello, è attivo.
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium group",
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all w-full text-sm font-medium"
        >
          <LogOut className="h-5 w-5" /> Disconnetti
        </button>
      </div>
    </aside>
  );
}