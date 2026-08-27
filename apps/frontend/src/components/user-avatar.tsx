"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { useOptionalDoflowPresence } from "@/features/identity/doflow-presence-provider"
import { presenceDotClasses, presenceLabels } from "@/features/identity/presence"

export function UserAvatar({ userId, name, className = "size-8" }: { userId?: string; name?: string; className?: string }) {
  const { users } = useDoflowIdentity()
  const presence = useOptionalDoflowPresence()
  const user = users.find((item) => item.id === userId)
  const label = user?.name ?? name ?? "Utente"
  const initials = label.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  const avatar = <Avatar className={className}><AvatarImage src={user?.avatarUrl} alt={label} className="object-cover" /><AvatarFallback>{initials}</AvatarFallback></Avatar>
  if (!presence || !userId) return avatar
  const status = presence.presenceFor(userId).status
  return <Tooltip><TooltipTrigger asChild><span data-presence-avatar className="relative inline-flex shrink-0 overflow-visible" aria-label={`Avatar di ${label}. Stato: ${presenceLabels[status]}`}>{avatar}<span data-presence-dot aria-hidden="true" className={`pointer-events-none absolute bottom-0 right-0 z-10 size-2.5 rounded-full border-2 border-background ${presenceDotClasses[status]}`} /></span></TooltipTrigger><TooltipContent>Stato: {presenceLabels[status]}</TooltipContent></Tooltip>
}
