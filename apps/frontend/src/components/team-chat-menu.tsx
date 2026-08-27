"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Loader2, MessageCircle, UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { collaborationApi, type CollaborationConversation } from "@/lib/tenant-feature-api"

type TeamChatMenuProps = { open?: boolean; onOpenChange?: (open: boolean) => void }

export function TeamChatMenu({ open: controlledOpen, onOpenChange }: TeamChatMenuProps) {
  const identity = useDoflowIdentity()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [items, setItems] = React.useState<CollaborationConversation[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const open = controlledOpen ?? internalOpen
  const loadConversations = React.useCallback(() => {
    if (loading || items.length) return
    setLoading(true)
    void collaborationApi.conversations({ limit: 30 })
      .then((page) => {
        setItems(page.items)
        setError("")
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Team Space non disponibile."))
      .finally(() => setLoading(false))
  }, [items.length, loading])
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value)
    onOpenChange?.(value)
    if (value) loadConversations()
  }
  React.useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(loadConversations, 0)
    return () => window.clearTimeout(timer)
  }, [loadConversations, open])

  if (!identity.hasCapability("canViewProjects")) return null
  const unread = items.reduce((total, item) => total + (item.unreadCount ?? 0), 0)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              data-topbar-action="chat"
              variant="ghost"
              className="relative inline-flex h-9 shrink-0 items-center gap-1.5 px-2"
              aria-label={"Apri Team Space" + (unread ? ", " + unread + " non letti" : "")}
            >
              <MessageCircle className="size-4" />
              {unread > 0 ? <span className="inline-flex h-[18px] min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span> : null}
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>Team Space</TooltipContent>
      </Tooltip>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle className="flex items-center gap-2"><MessageCircle className="size-5 text-primary" />Team Space</SheetTitle>
          <SheetDescription>Conversazioni del tenant corrente.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Caricamento conversazioni…</p> : null}
          {!loading && error ? <p role="alert" className="m-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          {!loading && !error && !items.length ? <p className="p-8 text-center text-sm text-muted-foreground">Nessuna conversazione disponibile.</p> : null}
          {items.map((conversation) => (
            <Link
              key={conversation.id}
              href={"/dashboard/team-space?channel=" + encodeURIComponent(conversation.id)}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-500/10 text-violet-600"><UsersRound className="size-4" /></span>
              <span className="min-w-0 flex-1"><b className="block truncate text-sm">{conversation.title}</b><span className="block truncate text-xs text-muted-foreground">{conversation.lastMessage?.body || "Nessun messaggio"}</span></span>
              {conversation.unreadCount ? <Badge>{conversation.unreadCount}</Badge> : null}
            </Link>
          ))}
        </div>
        <div className="border-t p-3"><Button asChild variant="outline" className="w-full"><Link href="/dashboard/team-space" onClick={() => setOpen(false)}>Apri Team Space<ArrowRight /></Link></Button></div>
      </SheetContent>
    </Sheet>
  )
}
