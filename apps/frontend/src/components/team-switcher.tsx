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
        <SidebarMenuButton asChild size="lg" tooltip={name} className="h-[50px] px-1 hover:bg-transparent data-[active=true]:bg-transparent">
          <Link href="/dashboard" aria-label={`Vai alla Panoramica di ${name}`}>
            {isDoflow ? (
              <>
                <span className="hidden size-8 shrink-0 items-center justify-center group-data-[collapsible=icon]:flex">
                  <Image src="/icon-192.png" alt="Doflow" width={30} height={30} className="size-8 object-contain" />
                </span>
                <span className="flex min-w-0 items-center group-data-[collapsible=icon]:hidden">
                  <Image src="/logo_doflow_nero.png" alt="Doflow" width={120} height={24} className="object-contain dark:hidden" loading="eager" />
                  <Image src="/logo_doflow_bianco.png" alt="" aria-hidden="true" width={120} height={24} className="hidden object-contain dark:block" loading="eager" />
                </span>
              </>
            ) : (
              <>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate font-semibold group-data-[collapsible=icon]:hidden">{name}</span>
              </>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
