"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, type LucideIcon } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

function GenericTenantSwitcher({ name = "Workspace" }: { name?: string }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip={`Vai alla Panoramica di ${name}`} className="transition-none">
          <Link href="/dashboard" aria-label={`Vai alla Panoramica di ${name}`}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold group-data-[collapsible=icon]:hidden">{name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export type GenericNavigationGroup = {
  label: string
  placement?: "bottom"
  items: Array<{
    title: string
    url: string
    icon?: LucideIcon
    items?: Array<{ title: string; url: string }>
  }>
}

export function GenericTenantSidebar({
  navigationGroups,
  tenantName,
  tenantSlug,
  footer,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  navigationGroups: GenericNavigationGroup[]
  tenantName?: string
  tenantSlug?: string
  footer?: React.ReactNode
}) {
  void tenantSlug
  const normal = navigationGroups.filter((group) => group.placement !== "bottom")
  const bottom = navigationGroups.filter((group) => group.placement === "bottom")

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader><GenericTenantSwitcher name={tenantName} /></SidebarHeader>
      <SidebarContent>
        {normal.map((group) => <NavMain key={group.label} label={group.label} items={group.items} />)}
        {bottom.map((group) => <NavMain key={group.label} label={group.label} items={group.items} className="mt-auto" />)}
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
