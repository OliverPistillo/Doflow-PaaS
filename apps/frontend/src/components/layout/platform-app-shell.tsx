"use client"

import * as React from "react"
import { Bell } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SuperAdminSidebar } from "@/app/superadmin/components/super-admin-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SearchTriggerButton } from "@/components/ui/global-search"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const PAGE_TITLE_MAP: Record<string, string> = {
  "/superadmin": "Control Room",
  "/superadmin/sales/dashboard": "Sales Dashboard",
  "/superadmin/sales/pipeline": "Pipeline",
  "/superadmin/sales/quote-requests": "Richieste Preventivo",
  "/superadmin/leads": "Lead Management",
  "/superadmin/automations": "Automazioni CRM",
  "/superadmin/sales-intelligence": "Sales Intelligence AI",
  "/superadmin/tenants": "Gestione Tenant",
  "/superadmin/users": "Gestione Utenti",
  "/superadmin/modules": "Moduli & Feature Flags",
  "/superadmin/subscriptions": "Subscription & Revenue",
  "/superadmin/finance/dashboard": "Dashboard Finanziario",
  "/superadmin/finance/invoices": "Gestione Fatture",
  "/superadmin/finance/preventivi": "Gestione Preventivi",
  "/superadmin/delivery/status": "Stato Delivery",
  "/superadmin/delivery/calendar": "Calendario Progetto",
  "/superadmin/system": "System Monitor",
  "/superadmin/storage": "Storage & Backup",
  "/superadmin/notifications": "Centro Notifiche",
  "/superadmin/tickets": "Ticket Supporto",
  "/superadmin/email-templates": "Email Templates",
  "/superadmin/changelog": "Changelog & Release Notes",
  "/superadmin/audit": "Audit Log",
  "/superadmin/settings": "Impostazioni Globali",
  "/superadmin/account": "Il mio Account",
}

function pageTitle(pathname: string) {
  const match = Object.keys(PAGE_TITLE_MAP)
    .filter((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`))
    .sort((left, right) => right.length - left.length)[0]
  return match ? PAGE_TITLE_MAP[match] : "Control Room"
}

function PlatformHeader() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 flex min-h-16 shrink-0 items-center gap-2 border-b bg-[var(--doflow-topbar)] px-2 backdrop-blur-xl transition-[width,height] ease-linear sm:px-4 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <SidebarTrigger className="-ml-1 shrink-0" />
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">{pageTitle(pathname)}</h1>
      <div className="hidden min-w-0 max-w-sm flex-1 sm:block"><SearchTriggerButton context="superadmin" /></div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link href="/superadmin/notifications" aria-label="Notifiche piattaforma">
              <Bell className="size-4" aria-hidden="true" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Notifiche</TooltipContent>
      </Tooltip>
      <ThemeToggle />
    </header>
  )
}

export function PlatformAppShell({ children }: { children: React.ReactNode }) {
  React.useLayoutEffect(() => {
    const root = document.documentElement
    const previousTheme = root.getAttribute("data-tenant-ui")
    root.setAttribute("data-tenant-ui", "universal")
    return () => {
      if (previousTheme === null) root.removeAttribute("data-tenant-ui")
      else root.setAttribute("data-tenant-ui", previousTheme)
    }
  }, [])

  return (
    <SidebarProvider data-app-ui-generation="universal-v1" className="universal-app-shell">
      <SuperAdminSidebar />
      <SidebarInset className="min-w-0 bg-background" data-app-inset="true">
        <PlatformHeader />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6" data-app-shell-ready="true">
          <div className="mx-auto w-full max-w-[1600px] animate-in fade-in">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
