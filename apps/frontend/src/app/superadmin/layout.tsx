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
  Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { label: "Control Tower", href: "/superadmin/dashboard", icon: LayoutDashboard },
    { label: "Gestione Tenant", href: "/superadmin/tenants", icon: Building2 },
    { label: "Gestione Utenti", href: "/superadmin/users", icon: Users }, // Nuova richiesta
    { label: "Audit Log", href: "/superadmin/audit", icon: Activity },    // Nuova richiesta
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* SIDEBAR FISSA */}
      <aside className="w-64 bg-slate-950 text-white flex flex-col fixed h-full z-20 shadow-2xl border-r border-slate-800">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900/50">
          <ShieldAlert className="h-6 w-6 text-indigo-500 mr-3" />
          <span className="font-bold text-lg tracking-wide">DOFLOW <span className="text-indigo-500">OPS</span></span>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest">Platform</div>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium group",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => window.location.href = '/login'}
            className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-all w-full text-sm font-medium"
          >
            <LogOut className="h-5 w-5" /> Disconnetti
          </button>
        </div>
      </aside>

      {/* CONTENUTO PRINCIPALE */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen bg-slate-50">
        <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
           {children}
        </div>
      </main>
    </div>
  );
}