"use client"

import Image from "next/image"
import Link from "next/link"
import { Building2 } from "lucide-react"

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

type TeamSwitcherProps = {
  name?: string
  slug?: string
}

export function TeamSwitcher({ name = "Doflow", slug = "doflow" }: TeamSwitcherProps) {
  const isDoflow = slug.toLowerCase() === "doflow"
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip={`Vai alla Panoramica di ${name}`} className="transition-none">
          <Link href="/dashboard" aria-label={`Vai alla Panoramica di ${name}`}>
            {isDoflow ? (
              <>
                <span className="hidden size-9 shrink-0 items-center justify-center group-data-[collapsible=icon]:flex">
                  <Image src="/icon-192.png" alt="Doflow" width={28} height={28} className="size-7 object-contain" />
                </span>
                <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <Image src="/logo_doflow_nero.png" alt="Doflow" width={120} height={24} className="h-auto w-[120px] object-contain dark:hidden" priority />
                  <Image src="/logo_doflow_bianco.png" alt="" aria-hidden="true" width={120} height={24} className="hidden h-auto w-[120px] object-contain dark:block" priority />
                </span>
              </>
            ) : (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold group-data-[collapsible=icon]:hidden">{name}</span>
              </>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
