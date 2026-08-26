"use client"

import Image from "next/image"
import Link from "next/link"

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

export function TeamSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip="Doflow" className="h-[50px] px-1 hover:bg-transparent data-[active=true]:bg-transparent">
          <Link href="/dashboard" aria-label="Vai alla Panoramica">
            <span className="hidden min-w-0 flex-1 items-center group-data-[collapsible=icon]:flex">
              <Image src="/icon-192.png" alt="Doflow" width={30} height={30} className="size-8 object-contain" />
            </span>
            <Image src="/logo_doflow_nero.png" alt="Doflow" width={121} height={30} className="h-auto w-[121px] object-contain group-data-[collapsible=icon]:hidden" loading="eager" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
