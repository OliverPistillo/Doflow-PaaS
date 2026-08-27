"use client"

import { useSearchParams } from "next/navigation"

import { DoflowTeamAccountAdmin } from "@/components/team-space/doflow-team-account-admin"
import { TeamSpacePage } from "@/features/chat/team-space-page"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

export function TeamSpaceRoute() {
  const searchParams = useSearchParams()
  const identity = useDoflowIdentity()
  const currentTenantRole = String(identity.currentUser.tenantRole || "").toLowerCase()
  const canAdministerAccounts = identity.hasCapability("canManageRoles") && ["owner", "admin"].includes(currentTenantRole)
  const requestedTab = searchParams.get("tab")
  const activeTab = requestedTab === "team-accounts" && canAdministerAccounts ? "team-accounts" : "chat"
  const selectionKey = `${searchParams.get("channel") ?? "default"}:${searchParams.get("view") ?? "chat"}`

  if (activeTab === "team-accounts") {
    return <main className="w-full space-y-5 p-4 md:p-6" data-team-space-source="server">
      <DoflowTeamAccountAdmin />
    </main>
  }

  return <div className="h-[calc(100dvh-4rem)] min-h-0 min-w-0 overflow-hidden [&>main]:h-full [&>main]:min-h-0 [&>main]:p-0 [&>main>div]:mx-0 [&>main>div]:h-full [&>main>div]:min-h-0 [&>main>div]:max-w-none [&>main>div]:rounded-none [&>main>div]:border-0 [&>main>div]:shadow-none [&>main>div>aside:first-child]:hidden lg:[&>main>div]:grid-cols-1 xl:[&>main>div:has(>aside:last-child)]:grid-cols-[minmax(0,1fr)_280px]">
    <TeamSpacePage key={selectionKey} />
  </div>
}
