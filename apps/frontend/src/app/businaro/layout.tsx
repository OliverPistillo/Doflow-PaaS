import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { BusinaroSidebar } from "./components/BusinaroSidebar";

export default function BusinaroLayout({ children }: { children: React.ReactNode }) {
  return (
    // 🔥 QUESTA CLASSE "theme-businaro" È FONDAMENTALE PER L'ISOLAMENTO
    // Se la rimuovi, il design torna standard. Se c'è, attiva il CSS custom.
    <div className="theme-businaro bg-background min-h-screen transition-colors duration-300">
      <SidebarProvider>
        <BusinaroSidebar />
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}