"use client"

import { UserAvatar } from "@/components/user-avatar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider"
import { PresenceIndicator } from "@/features/identity/presence-indicator"
import { roleLabels } from "@/features/identity/permissions"

export function PresenceUserOption({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const identity = useDoflowIdentity(); const presence = useDoflowPresence(); const user = identity.users.find((item) => item.id === userId)
  if (!user) return <span>Utente non disponibile</span>
  const record = presence.presenceFor(userId)
  return <span className="flex min-w-0 items-center gap-2"><UserAvatar userId={user.id} name={user.name} className={compact ? "size-5" : "size-7"} /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{user.name}</span>{!compact && <span className="block truncate text-[10px] text-muted-foreground">{user.roles.map((role) => roleLabels[role]).join(" · ")}</span>}</span><PresenceIndicator status={record.status} showLabel showDot={false} /></span>
}
