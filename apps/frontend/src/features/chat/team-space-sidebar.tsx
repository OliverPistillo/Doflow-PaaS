"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowLeft, Hash, Mic, MicOff, Phone, PhoneOff, Search, Settings, ShieldCheck } from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { chatConversationTitle } from "@/features/chat/team-chat"
import { useTeamChat } from "@/features/chat/team-chat-provider"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider"
import { PresenceIndicator } from "@/features/identity/presence-indicator"

function channelHref(id: string, call = false) {
  return `/dashboard/team-space?channel=${encodeURIComponent(id)}${call ? "&view=call" : ""}`
}

export function TeamSpaceSidebarHeader() {
  return <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Torna al Workspace">
        <Link href="/dashboard"><ArrowLeft /><span>Torna al Workspace</span></Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <SidebarMenuButton size="lg" asChild tooltip="doflow Team Space">
        <Link href="/dashboard/team-space" className="min-w-0">
          <span className="flex size-9 shrink-0 items-center justify-center">
            <Image src="/brand/marchio_logo_nero.svg" alt="doflow" width={28} height={28} className="size-7 object-contain dark:hidden" />
            <Image src="/brand/marchio_logo_bianco.svg" alt="doflow" width={28} height={28} className="hidden size-7 object-contain dark:block" />
          </span>
          <span className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <Image src="/brand/logo_doflow_nero.svg" alt="doflow" width={92} height={18} className="h-auto w-[92px] dark:hidden" />
            <Image src="/brand/logo_doflow_bianco.svg" alt="doflow" width={92} height={18} className="hidden h-auto w-[92px] dark:block" />
            <span className="block truncate text-xs text-muted-foreground">Team Space</span>
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
}

export function TeamSpaceSidebarContent() {
  const chat = useTeamChat()
  const identity = useDoflowIdentity()
  const searchParams = useSearchParams()
  const [query, setQuery] = React.useState("")
  const selectedId = searchParams.get("channel") ?? chat.conversations[0]?.id
  const currentTenantRole = String(identity.currentUser.tenantRole || "").toLowerCase()
  const canAdministerAccounts = identity.hasCapability("canManageRoles") && ["owner", "admin"].includes(currentTenantRole)
  const channels = chat.conversations.filter((conversation) => !conversation.archivedAt && conversation.title.toLocaleLowerCase("it-IT").includes(query.trim().toLocaleLowerCase("it-IT")))

  return <>
    <div className="relative px-2 pt-2 group-data-[collapsible=icon]:hidden">
      <Search className="pointer-events-none absolute left-4 top-4 size-4 text-muted-foreground" />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Cerca canali o messaggi" placeholder="Cerca canali…" className="h-8 pl-8" />
    </div>
    <SidebarGroup>
      <SidebarGroupLabel>Conversazioni</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {channels.map((conversation) => {
            const active = selectedId === conversation.id
            const call = chat.calls.find((item) => item.conversationId === conversation.id && !["ended", "failed"].includes(item.status))
            return <SidebarMenuItem key={conversation.id}>
              <SidebarMenuButton asChild isActive={active} tooltip={conversation.title}>
                <Link href={channelHref(conversation.id)}>
                  <Hash />
                  <span className="truncate">{chatConversationTitle(conversation)}</span>
                  {chat.unreadFor(conversation.id) > 0 ? <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground" aria-label={`${chat.unreadFor(conversation.id)} non letti`}>{chat.unreadFor(conversation.id)}</span> : call ? <span className="ml-auto size-2 rounded-full bg-emerald-500" aria-label="Chiamata attiva" /> : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          })}
          {!channels.length ? <li className="px-2 py-3 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Nessun canale trovato.</li> : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
    <SidebarGroup className="mt-auto group-data-[collapsible=icon]:hidden">
      <SidebarGroupContent className="space-y-1">
        {canAdministerAccounts ? <Button asChild variant="ghost" size="sm" className="w-full justify-start"><Link href="/dashboard/team-space?tab=team-accounts"><ShieldCheck />Team e account</Link></Button> : null}
        <Button asChild variant="ghost" size="sm" className="w-full justify-start"><Link href="/dashboard/impostazioni"><Settings />Impostazioni Team Space</Link></Button>
      </SidebarGroupContent>
    </SidebarGroup>
  </>
}

export function TeamSpaceSidebarFooter({ workspace = false }: { workspace?: boolean }) {
  const pathname = usePathname()
  const chat = useTeamChat()
  const identity = useDoflowIdentity()
  const presence = useDoflowPresence()
  const call = chat.currentCall
  const conversation = chat.conversations.find((item) => item.id === call?.conversationId)

  if (workspace && !call) return null
  if (workspace && pathname === "/dashboard/team-space") return null

  return <div className="space-y-2">
    {call ? <div className="rounded-lg border bg-sidebar-accent/50 p-2 group-data-[collapsible=icon]:p-1" aria-label="Mini-player Team Space">
      <Link href={channelHref(call.conversationId, true)} className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-emerald-600"><Phone className="size-4" /></span>
        <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><b className="block truncate text-xs">{conversation?.title ?? "Team Space"}</b><span className="block truncate text-[11px] text-muted-foreground">Chiamata attiva · {chat.participantIds.length} partecipanti</span></span>
      </Link>
      <div className="mt-2 flex gap-1 group-data-[collapsible=icon]:hidden">
        <Button size="icon-xs" variant={chat.microphoneEnabled ? "secondary" : "destructive"} onClick={() => void chat.toggleMicrophone()} aria-label={chat.microphoneEnabled ? "Disattiva microfono" : "Attiva microfono"}>{chat.microphoneEnabled ? <Mic /> : <MicOff />}</Button>
        <Button size="xs" variant="outline" asChild className="flex-1"><Link href={channelHref(call.conversationId, true)}>Ritorna</Link></Button>
        <Button size="icon-xs" variant="ghost" className="text-destructive" onClick={() => void chat.leaveCall()} aria-label="Esci dalla chiamata"><PhoneOff /></Button>
      </div>
    </div> : null}
    {!workspace ? <div className="flex min-w-0 items-center gap-2 px-1">
      <UserAvatar userId={identity.currentUserId} name={identity.currentUser.name} className="size-8" />
      <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><b className="block truncate text-sm">{identity.currentUser.name}</b><PresenceIndicator status={presence.current.status} showDot={false} showLabel /></span>
      {call ? <Button size="icon-xs" variant={chat.microphoneEnabled ? "ghost" : "destructive"} onClick={() => void chat.toggleMicrophone()} aria-label={chat.microphoneEnabled ? "Disattiva microfono" : "Attiva microfono"}>{chat.microphoneEnabled ? <Mic /> : <MicOff />}</Button> : null}
    </div> : null}
  </div>
}
