"use client"

import * as React from "react"
import Link from "next/link"
import { Activity, FolderKanban, ListTodo, MessageCircle, ShieldCheck, UsersRound } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DoflowTeamAccountAdmin } from "@/components/team-space/doflow-team-account-admin"
import { FlowAssistant, FlowOnboardingLauncher, ReleaseIndicator } from "@/components/flow-experience/flow-experience"
import { TeamSpaceCollaboration } from "@/components/tenant-collaboration/team-space-collaboration"
import { TeamSpacePresence } from "@/components/tenant-collaboration/team-space-presence"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"

const teamSpaceTourSteps = [
  {
    id: "team-space-overview",
    title: "Il tuo Team Space",
    description: "Qui trovi collaborazione, presenze e carico di lavoro nel perimetro autorizzato.",
    selector: "[data-flow-tour='team-space-header']",
  },
  {
    id: "team-space-sections",
    title: "Sezioni operative",
    description: "Passa tra chat, presenze, carico di lavoro e amministrazione account quando autorizzato.",
    selector: "[data-flow-tour='team-space-tabs']",
  },
]

export default function TeamSpacePage() {
  return (
    <React.Suspense fallback={<main className="w-full p-4 md:p-6"><p className="text-sm text-muted-foreground">Caricamento Team Space…</p></main>}>
      <TeamSpaceContent />
    </React.Suspense>
  )
}

function TeamSpaceContent() {
  const identity = useDoflowIdentity()
  const { projects, activities } = useAuthorizedCommercial()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTenantRole = String(identity.currentUser.tenantRole || "").toLowerCase()
  const canAdministerAccounts = identity.hasCapability("canManageRoles") && ["owner", "admin"].includes(currentTenantRole)
  const requestedTab = searchParams.get("tab")
  const activeTab = requestedTab === "team-accounts" && canAdministerAccounts
    ? "team-accounts"
    : requestedTab === "presence" || requestedTab === "workload"
      ? requestedTab
      : "chat"

  const changeTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "team-accounts" && canAdministerAccounts) params.set("tab", value)
    else if (value === "presence" || value === "workload") params.set("tab", value)
    else params.delete("tab")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  if (activeTab === "chat") {
    return (
      <main className="min-w-0 p-2 sm:p-4" data-team-space-source="server" data-flow-tour="flow-team-space-call">
        <div className="mx-auto max-w-[1600px]">
          <TeamSpaceCollaboration sidebarMode />
        </div>
      </main>
    )
  }

  return (
    <main className="w-full space-y-5 p-4 md:p-6" data-team-space-source="server">
      <header className="flex items-start justify-between gap-4" data-flow-tour="team-space-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Space</h1>
          <p className="text-sm text-muted-foreground">Persone, lavoro e progetti nel perimetro autorizzato.</p>
        </div>
        <div className="flex gap-2">
          <FlowOnboardingLauncher tourId="team-space" steps={teamSpaceTourSteps} />
          <ReleaseIndicator />
          <FlowAssistant context="Team Space" />
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={changeTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start" data-flow-tour="team-space-tabs">
          <TabsTrigger value="chat" className="gap-2"><MessageCircle className="size-4" />Chat</TabsTrigger>
          <TabsTrigger value="presence" className="gap-2">
            <Activity className="size-4" />Presenze
          </TabsTrigger>
          <TabsTrigger value="workload" className="gap-2">
            <ListTodo className="size-4" />Carico di lavoro
          </TabsTrigger>
          {canAdministerAccounts ? (
            <TabsTrigger value="team-accounts" className="gap-2">
              <ShieldCheck className="size-4" />Team e account
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="presence" className="mt-0">
          <TeamSpacePresence />
        </TabsContent>

        <TabsContent value="workload" className="mt-0">
          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UsersRound className="size-5" />Team</CardTitle>
                <CardDescription>{identity.users.length} persone autorizzate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {identity.users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{user.name.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.roles.join(" · ")}</p>
                    </div>
                    {user.id === identity.currentUser.id ? <Badge variant="secondary" className="ml-auto">Tu</Badge> : null}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FolderKanban className="size-5" />Progetti condivisi</CardTitle>
                <CardDescription>Dati Delivery Core autorizzati</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {projects.slice(0, 8).map((project) => (
                  <Link key={project.id} href={`/dashboard/progetti/${project.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40">
                    <span className="truncate text-sm font-medium">{project.name}</span>
                    <Badge variant="outline">{project.status}</Badge>
                  </Link>
                ))}
                {!projects.length ? <p className="text-sm text-muted-foreground">Nessun progetto condiviso.</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListTodo className="size-5" />Attività del team</CardTitle>
                <CardDescription>Assegnazioni visibili dal workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {activities.slice(0, 8).map(({ activity, customer }) => (
                  <Link key={activity.id} href={`/dashboard/attivita?activityId=${activity.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                    <p className="truncate text-sm font-medium">{activity.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{customer.profile.company} · {activity.status}</p>
                  </Link>
                ))}
                {!activities.length ? <p className="text-sm text-muted-foreground">Nessuna attività autorizzata.</p> : null}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        {canAdministerAccounts ? (
          <TabsContent value="team-accounts" className="mt-0">
            <DoflowTeamAccountAdmin />
          </TabsContent>
        ) : null}
      </Tabs>
    </main>
  )
}
