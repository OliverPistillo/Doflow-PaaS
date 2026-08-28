"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return <SidebarProvider><AppSidebar/><SidebarInset><DashboardHeader/><div className="doflow-page-frame" data-doflow-page-frame>{children}</div></SidebarInset></SidebarProvider>
}
