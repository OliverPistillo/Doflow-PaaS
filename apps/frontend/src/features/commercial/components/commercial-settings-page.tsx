"use client"

import { ShieldCheck, UserRound } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { UserAvatar } from "@/components/user-avatar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { doflowRoles, roleLabels, type DoflowCapability, type DoflowRole } from "@/features/identity/permissions"

const supervisionCapabilities: Array<{ id: DoflowCapability; label: string }> = [
  { id: "canApproveProjectWork", label: "Approva lavoro progetto" },
  { id: "canPublishClientUpdate", label: "Pubblica aggiornamenti cliente" },
]

export function CommercialSettingsPage() {
  const identity = useDoflowIdentity()
  const canManageRoles = identity.hasCapability("canManageRoles")

  const toggleRole = (userId: string, role: DoflowRole, enabled: boolean) => {
    const user = identity.users.find((item) => item.id === userId)
    if (!user) return
    if (!enabled && role === "administrator" && identity.users.filter((item) => item.roles.includes("administrator")).length === 1) {
      toast.error("Deve rimanere almeno un amministratore")
      return
    }
    identity.updateUserRoles(userId, enabled ? [...user.roles, role] : user.roles.filter((item) => item !== role))
    toast.success("Ruoli aggiornati")
  }

  return <main className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
    <header><h1 className="text-2xl font-semibold">Impostazioni</h1><p className="text-sm text-muted-foreground">Account, ruoli operativi e autorizzazioni del workspace Doflow.</p></header>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4" />Account attivo</CardTitle><CardDescription>L’identità deriva dalla sessione autenticata e non può essere sostituita dal browser.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><UserAvatar userId={identity.currentUser.id} name={identity.currentUser.name} className="size-12" /><div className="min-w-0 flex-1"><p className="font-medium">{identity.currentUser.name}</p><p className="truncate text-sm text-muted-foreground">{identity.currentUser.email}</p></div><div className="flex flex-wrap gap-1">{identity.currentUser.roles.map((role) => <Badge key={role} variant="secondary">{roleLabels[role]}</Badge>)}</div></CardContent></Card>
    {canManageRoles ? <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" />Ruoli e autorizzazioni</CardTitle><CardDescription>Le modifiche sono validate dal backend, limitate al tenant doflow e registrate nell’audit.</CardDescription></CardHeader><CardContent className="space-y-4">{identity.users.map((user) => <section key={user.id} className="rounded-lg border p-4"><div className="mb-3 flex items-center gap-3"><UserAvatar userId={user.id} name={user.name} className="size-10" /><div className="min-w-0 flex-1"><p className="font-medium">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div></div><div className="grid gap-3 sm:grid-cols-2">{doflowRoles.map((role) => { const id = `${user.id}-${role}`; return <Label key={role} htmlFor={id} className="flex items-center gap-2 rounded-md border p-3 font-normal"><Checkbox id={id} checked={user.roles.includes(role)} onCheckedChange={(checked) => toggleRole(user.id, role, checked === true)} /><span>{roleLabels[role]}</span></Label> })}</div><div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">{supervisionCapabilities.map((capability) => { const id = `${user.id}-${capability.id}`; const enabled = user.roles.includes("administrator") || user.capabilities?.includes(capability.id); return <Label key={capability.id} htmlFor={id} className="flex items-center gap-2 rounded-md border p-3 font-normal"><Checkbox id={id} disabled={user.roles.includes("administrator")} checked={enabled} onCheckedChange={(checked) => { const current = user.capabilities ?? []; identity.updateUserCapabilities(user.id, checked === true ? [...current, capability.id] : current.filter((item) => item !== capability.id)); toast.success("Autorizzazione aggiornata") }} /><span>{capability.label}</span></Label> })}</div></section>)}</CardContent></Card> : null}
  </main>
}
