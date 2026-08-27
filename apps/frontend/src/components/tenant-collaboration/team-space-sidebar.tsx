"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Activity, ArrowLeft, Hash, ListTodo, Search, Settings, ShieldCheck } from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { Input } from "@/components/ui/input"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { collaborationApi, type CollaborationConversation } from "@/lib/tenant-feature-api"

function channelHref(id: string) {
  return "/dashboard/team-space?channel=" + encodeURIComponent(id)
}

export function TeamSpaceSidebarHeader() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Torna al Workspace">
          <Link href="/dashboard"><ArrowLeft /><span>Torna al Workspace</span></Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild tooltip="Doflow Team Space" className="transition-none">
          <Link href="/dashboard/team-space" className="min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center">
              <Image src="/icon-192.png" alt="Doflow" width={28} height={28} className="size-7 object-contain" />
            </span>
            <span className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <Image src="/logo_doflow_nero.png" alt="Doflow" width={92} height={18} className="h-auto w-[92px] dark:hidden" />
              <Image src="/logo_doflow_bianco.png" alt="" aria-hidden="true" width={92} height={18} className="hidden h-auto w-[92px] dark:block" />
              <span className="block truncate text-xs text-muted-foreground">Team Space</span>
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function TeamSpaceSidebarContent() {
  const identity = useDoflowIdentity()
  const searchParams = useSearchParams()
  const [query, setQuery] = React.useState("")
  const [conversations, setConversations] = React.useState<CollaborationConversation[]>([])
  const selectedId = searchParams.get("channel") ?? conversations[0]?.id
  const currentTenantRole = String(identity.currentUser.tenantRole || "").toLowerCase()
  const canAdministerAccounts = identity.hasCapability("canManageRoles") && ["owner", "admin"].includes(currentTenantRole)

  React.useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void collaborationApi.conversations({ limit: 50 }).then((page) => {
        if (active) setConversations(page.items)
      }).catch(() => {
        if (active) setConversations([])
      })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  const normalizedQuery = query.trim().toLocaleLowerCase("it-IT")
  const channels = conversations.filter((conversation) => (
    !normalizedQuery || conversation.title.toLocaleLowerCase("it-IT").includes(normalizedQuery)
  ))

  return (
    <>
      <div className="relative px-2 pt-2 group-data-[collapsible=icon]:hidden">
        <Search className="pointer-events-none absolute left-4 top-4 size-4 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Cerca conversazioni" placeholder="Cerca canali…" className="h-8 pl-8" />
      </div>
      <SidebarGroup>
        <SidebarGroupLabel>Conversazioni</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {channels.map((conversation) => (
              <SidebarMenuItem key={conversation.id}>
                <SidebarMenuButton asChild isActive={selectedId === conversation.id} tooltip={conversation.title}>
                  <Link href={channelHref(conversation.id)}>
                    <Hash />
                    <span className="truncate">{conversation.title}</span>
                  </Link>
                </SidebarMenuButton>
                {conversation.unreadCount ? <SidebarMenuBadge>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            ))}
            {!channels.length ? <li className="px-2 py-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Nessun canale trovato.</li> : null}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="mt-auto">
        <SidebarGroupLabel>Operatività</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem><SidebarMenuButton asChild tooltip="Presenze"><Link href="/dashboard/team-space?tab=presence"><Activity /><span>Presenze</span></Link></SidebarMenuButton></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton asChild tooltip="Carico di lavoro"><Link href="/dashboard/team-space?tab=workload"><ListTodo /><span>Carico di lavoro</span></Link></SidebarMenuButton></SidebarMenuItem>
            {canAdministerAccounts ? <SidebarMenuItem><SidebarMenuButton asChild tooltip="Team e account"><Link href="/dashboard/team-space?tab=team-accounts"><ShieldCheck /><span>Team e account</span></Link></SidebarMenuButton></SidebarMenuItem> : null}
            <SidebarMenuItem><SidebarMenuButton asChild tooltip="Impostazioni Team Space"><Link href="/dashboard/impostazioni"><Settings /><span>Impostazioni Team Space</span></Link></SidebarMenuButton></SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

export function TeamSpaceSidebarFooter() {
  return <NavUser />
}
