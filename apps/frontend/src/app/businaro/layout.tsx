import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { BusinaroSidebar } from "./components/BusinaroSidebar";

export default function BusinaroLayout({ children }: { children: React.ReactNode }) {
  return (
    // 1. "dark": Attiva il modo scuro di Tailwind (colori base)
    // 2. "theme-businaro": Attiva la scrollbar custom definita in globals.css
    // 3. "bg-businaro-dark": Imposta il colore di sfondo specifico (definito in tailwind.config)
    <div className="dark theme-businaro bg-businaro-dark min-h-screen text-slate-200 selection:bg-businaro-red selection:text-white">
      <SidebarProvider>
        <BusinaroSidebar />
        <SidebarInset>
          {/* Background scuro profondo per l'area contenuti */}
          <div className="min-h-screen bg-businaro-dark">
            <div className="mx-auto w-full p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}