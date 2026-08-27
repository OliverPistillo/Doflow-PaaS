"use client"

import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import type { TeamMember } from "@/features/commercial/types"

export function useCommercialTeam(): TeamMember[] {
  const identity = useDoflowIdentity()
  return identity.users
    .filter((user) => user.active !== false)
    .map((user) => ({
      id: user.id,
      name: user.name,
      initials:
        user.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toLocaleUpperCase("it-IT") ?? "")
          .join("") || "?",
    }))
}
