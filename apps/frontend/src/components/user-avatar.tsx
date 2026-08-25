"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

export function UserAvatar({ userId, name, className = "size-8" }: { userId?: string; name?: string; className?: string }) {
  const { users } = useDoflowIdentity()
  const user = users.find((item) => item.id === userId)
  const label = user?.name ?? name ?? "Utente"
  const initials = label.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  return <Avatar className={className}><AvatarImage src={user?.avatarUrl} alt={label} className="object-cover" /><AvatarFallback>{initials}</AvatarFallback></Avatar>
}
