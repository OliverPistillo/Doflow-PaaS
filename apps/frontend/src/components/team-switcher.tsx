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
            <span className="hidden size-8 shrink-0 items-center justify-center group-data-[collapsible=icon]:flex">
              <Image src="/icon-192.png" alt="Doflow" width={30} height={30} className="size-8 object-contain" />
            </span>
            <span className="flex min-w-0 items-center group-data-[collapsible=icon]:hidden">
              <Image src="/logo_doflow_nero.png" alt="Doflow" width={120} height={24} className="object-contain dark:hidden" loading="eager" />
              <Image src="/logo_doflow_bianco.png" alt="" aria-hidden="true" width={120} height={24} className="hidden object-contain dark:block" loading="eager" />
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
