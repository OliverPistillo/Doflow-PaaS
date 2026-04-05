import * as React from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { BusinaroSidebar } from "./components/BusinaroSidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function BusinaroLayout({ children }: { children: React.ReactNode }) {
  return (
    // APPLICA SFONDO AURORA QUI
    <div className="theme-businaro min-h-screen transition-colors duration-300 bg-background" style={{ backgroundImage: 'var(--aurora-bg)', backgroundAttachment: 'fixed', backgroundSize: 'cover' }}>
      <SidebarProvider>
        <BusinaroSidebar />
        <SidebarInset className="overflow-hidden flex flex-col bg-transparent">
          
          {/* HEADER EFFETTO VETRO */}
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 sticky top-0 z-20 glass">
            <SidebarTrigger className="-ml-1 hover:bg-accent/50" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <div className="flex-1 flex items-center justify-between">
               <span className="text-sm font-medium text-muted-foreground">Businaro Production OS</span>
               <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
          
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}