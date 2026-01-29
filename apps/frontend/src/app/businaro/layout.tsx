import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { BusinaroSidebar } from "./components/BusinaroSidebar";

export default function BusinaroLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <BusinaroSidebar />
      <SidebarInset>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-7xl p-4 md:p-8">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
