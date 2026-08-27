"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarCheck2, Copy, ExternalLink, KeyRound, Link2Off, RefreshCw, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { backendContractsApi } from "@/lib/tenant-backend-contracts-api"

const categoryOptions = [
  ["activity", "Attività"], ["appointment", "Appuntamenti"], ["project", "Progetti e consegne"], ["contract", "Contratti"], ["quote", "Preventivi"], ["payment", "Pagamenti"], ["renewal", "Rinnovi"], ["support", "Supporto"],
] as const

type IntegrationStatus = { hasIcsFeed: boolean; icsToken?: string; tokenCreatedAt?: string; categories: string[]; eventCount: number; lastSuccessfulSyncAt?: string; google: { configured: boolean; connected: boolean; reconnectRequired: boolean; state: string; missingConfiguration?: string[] } }
type ProjectionEvent = { id: string; title: string; startsAt: string; endsAt?: string; category: string; status?: string; description?: string }
const readableUpdate = (value?: string) => { const timestamp = value ? Date.parse(value) : Number.NaN; return Number.isFinite(timestamp) && timestamp > 0 ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp)) : "Mai aggiornato" }

export function CalendarIntegrationSettings() {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const [status, setStatus] = useState<IntegrationStatus>()
  const [busy, setBusy] = useState(false)
  const [origin] = useState(() => typeof window === "undefined" ? "" : window.location.origin)

  const events = useMemo<ProjectionEvent[]>(() => {
    const activities = store.leadActivities.filter((item) => !item.archivedAt).map((item) => ({ id: `activity:${item.id}`, title: item.title, startsAt: item.dueAt || item.dueDate, category: "activity", status: item.status, description: item.description }))
    const appointments = store.appointments.filter((item) => !item.archivedAt).map((item) => ({ id: `appointment:${item.id}`, title: item.title, startsAt: item.startsAt, endsAt: item.endsAt, category: "appointment", status: item.status, description: item.notes }))
    const projects = store.projects.flatMap((project) => [project.dueDate ? { id: `project:${project.id}`, title: `Scadenza · ${project.name}`, startsAt: project.dueDate, category: "project", status: project.status, description: project.description } : null, ...project.phases.filter((phase) => phase.dueDate).map((phase) => ({ id: `project-phase:${project.id}:${phase.id}`, title: `${project.name} · ${phase.name}`, startsAt: phase.dueDate!, category: "project", status: phase.status, description: phase.description }))].filter(Boolean) as ProjectionEvent[])
    const contracts = store.contracts.filter((item) => !item.archivedAt && item.signatureDueAt).map((item) => ({ id: `contract:${item.id}`, title: `Contratto ${item.code}`, startsAt: item.signatureDueAt!, category: "contract", status: item.status }))
    const quotes = store.quotes.filter((item) => !item.archivedAt && item.validUntil).map((item) => ({ id: `quote:${item.id}`, title: `Preventivo ${item.code}`, startsAt: item.validUntil, category: "quote", status: item.status }))
    const payments = store.payments.filter((item) => !item.archivedAt && !["Fallito", "Annullato"].includes(item.status)).map((item) => ({ id: `payment:${item.id}`, title: `${item.type} ordine`, startsAt: item.effectiveDate ?? item.date, category: "payment", status: item.status }))
    const renewals = store.renewals.filter((item) => !item.archivedAt).map((item) => ({ id: `renewal:${item.id}`, title: `Rinnovo ${item.planName}`, startsAt: item.nextDueAt, category: "renewal", status: item.status }))
    const support = store.supportTickets.filter((item) => !item.archivedAt && item.dueAt).map((item) => ({ id: `support:${item.id}`, title: item.title, startsAt: item.dueAt!, category: "support", status: item.status, description: item.description }))
    return [...activities, ...appointments, ...projects, ...contracts, ...quotes, ...payments, ...renewals, ...support]
  }, [store.appointments, store.contracts, store.leadActivities, store.payments, store.projects, store.quotes, store.renewals, store.supportTickets])

  const request = useCallback(async (action?: string, payload?: { events?: ProjectionEvent[]; categories?: string[] }) => {
    setBusy(true)
    try {
      let next: Record<string, unknown>
      if (action === "sync-projection") next = await backendContractsApi.calendar.sync(payload?.events ?? [], payload?.categories ?? [])
      else if (action === "regenerate-ics") next = await backendContractsApi.calendar.rotateIcsToken()
      else if (action === "revoke-ics") next = await backendContractsApi.calendar.revokeIcsToken()
      else if (action === "disconnect-google") next = await backendContractsApi.calendar.disconnectGoogle()
      else next = await backendContractsApi.calendar.get()
      const normalized = next as IntegrationStatus
      setStatus(normalized)
      return normalized
    } finally { setBusy(false) }
  }, [])

  useEffect(() => {
    let active = true
    backendContractsApi.calendar.get().then((next) => { if (active) setStatus(next as IntegrationStatus) }).catch(() => toast.error("Stato calendari non disponibile"))
    return () => { active = false }
  }, [identity.currentUserId])
  const syncProjection = async (categories = status?.categories ?? categoryOptions.map(([id]) => id)) => { await request("sync-projection", { events, categories }); toast.success("Calendario personale aggiornato") }
  const toggleCategory = async (category: string, checked: boolean) => { const categories = checked ? Array.from(new Set([...(status?.categories ?? []), category])) : (status?.categories ?? []).filter((item) => item !== category); await syncProjection(categories) }
  const feedUrl = status?.icsToken && origin ? `${origin}/api/calendar-integrations/ics/${status.icsToken}` : ""
  const maskedFeedUrl = status?.icsToken && origin ? `${origin}/api/calendar-integrations/ics/••••••••${status.icsToken.slice(-6)}` : ""
  const administrator = identity.currentUser.roles.includes("administrator")

  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarCheck2 className="size-4" />Calendari e sincronizzazione</CardTitle><CardDescription>Scegli quali impegni autorizzati includere nel tuo calendario personale.</CardDescription></CardHeader><CardContent className="space-y-5">
    <div className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b>Google Calendar</b><Badge variant={status?.google.connected && !status.google.reconnectRequired ? "default" : "secondary"}>{status?.google.state ?? "Verifica…"}</Badge>{status && !status.google.configured && <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200" variant="outline">Configurazione server necessaria</Badge>}</div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">OAuth 2.0 server-side. Le credenziali e i token restano esclusivamente sul server.</p></div>{status?.google.connected && !status.google.reconnectRequired ? <Button variant="outline" disabled={busy} onClick={() => request("disconnect-google").then(() => toast.success("Google Calendar scollegato"))}><Link2Off />Disconnetti</Button> : status?.google.configured ? <Button asChild disabled={busy}><a href={`/api/calendar-integrations/google/connect?userId=${encodeURIComponent(identity.currentUserId)}`}><ExternalLink />{status.google.reconnectRequired ? "Ricollega" : "Collega Google Calendar"}</a></Button> : null}</div>{status && !status.google.configured && <div role="status" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100"><div className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><p>{administrator ? "Google Calendar richiede una configurazione sul server prima di poter essere collegato." : "Google Calendar non è ancora disponibile. Contatta un amministratore."}</p></div>{administrator && status.google.missingConfiguration?.length ? <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Mostra dettagli tecnici</summary><ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs">{status.google.missingConfiguration.map((name) => <li key={name}>{name}</li>)}</ul></details> : null}</div>}</div>
    <div className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b>Apple Calendar · feed personale ICS</b><Badge variant="outline">Sola lettura</Badge></div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Feed unidirezionale DoFlow → Apple. Le modifiche fatte in Apple non tornano in DoFlow.</p></div><div className="flex flex-wrap gap-2">{status?.hasIcsFeed ? <><Button variant="outline" disabled={busy} onClick={() => syncProjection()}><RefreshCw />Aggiorna feed</Button><Button variant="outline" disabled={busy || !feedUrl} onClick={() => navigator.clipboard.writeText(feedUrl).then(() => toast.success("Link copiato"))}><Copy />Copia link</Button><Button variant="destructive" disabled={busy} onClick={() => request("revoke-ics").then(() => toast.success("Feed ICS revocato"))}><Link2Off />Revoca link</Button></> : <Button disabled={busy} onClick={() => request("regenerate-ics").then(() => toast.success("Feed ICS creato"))}><KeyRound />Crea link</Button>}</div></div>{maskedFeedUrl && <div className="mt-3 min-w-0 rounded-md bg-muted px-3 py-2 text-xs"><span className="font-medium">Link personale attivo:</span> <code className="break-all">{maskedFeedUrl}</code></div>}<p className="mt-2 text-xs text-muted-foreground">In Apple Calendar: File → Nuova iscrizione calendario → usa “Copia link”. Il link è una credenziale personale: revocalo se viene condiviso per errore.</p></div>
    <div><p className="mb-2 text-sm font-medium">Categorie incluse</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{categoryOptions.map(([id, label]) => <Label key={id} className="flex items-center gap-2 rounded-md border p-2 font-normal"><Checkbox checked={status?.categories.includes(id) ?? true} disabled={busy} onCheckedChange={(checked) => void toggleCategory(id, checked === true)} />{label}</Label>)}</div></div>
    <p className="text-xs text-muted-foreground">{status ? `${status.eventCount} eventi inclusi · ${readableUpdate(status.lastSuccessfulSyncAt)}` : "Caricamento…"}</p>
  </CardContent></Card>
}
