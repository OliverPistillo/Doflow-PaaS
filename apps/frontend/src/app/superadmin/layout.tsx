import React from "react";
import { SuperAdminSidebar } from "./components/super-admin-sidebar"; // ✅ Importa il nuovo componente

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* 1. SIDEBAR DEDICATA */}
      <SuperAdminSidebar />

      {/* 2. CONTENUTO PRINCIPALE */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen bg-slate-50">
        <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
           {children}
        </div>
      </main>
    </div>
  );
}