"use client"

import { useMemo } from "react"

import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import type { TeamMember } from "@/features/commercial/types"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

/** Team operativo reale caricato dal backend; non contiene identità o account dimostrativi. */
export function useCommercialTeam(): TeamMember[] {
  const { users } = useDoflowIdentity()
  return useMemo(
    () => users.map((user) => ({ id: user.id, name: user.name, initials: initials(user.name) })),
    [users],
  )
}
