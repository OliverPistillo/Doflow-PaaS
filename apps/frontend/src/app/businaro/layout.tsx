import * as React from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { BusinaroSidebar } from "./components/BusinaroSidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function BusinaroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-businaro bg-background min-h-screen transition-colors duration-300">
      <SidebarProvider>
        <BusinaroSidebar />
        <SidebarInset className="overflow-hidden flex flex-col">
          
          {/* HEADER FISSO PER TUTTE LE PAGINE */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/40 bg-card/50 backdrop-blur-sm px-4 sticky top-0 z-20">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <div className="flex-1 flex items-center justify-between">
               {/* Breadcrumb o Titolo dinamico qui se volessi */}
               <span className="text-sm font-medium text-muted-foreground">Tenant: Businaro SpA</span>
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