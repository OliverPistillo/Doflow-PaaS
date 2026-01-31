import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { BusinaroSidebar } from "./components/BusinaroSidebar";

export default function BusinaroLayout({ children }: { children: React.ReactNode }) {
  return (
    // 🔥 CLASSE "theme-businaro" applicata SOLO qui.
    // Isola completamente lo stile dal resto dell'app.
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