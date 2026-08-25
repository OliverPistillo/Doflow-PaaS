"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Archive, ContactRound, ExternalLink, Eye, Search } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LeadDialog } from "@/features/commercial/components/commercial-dashboard-refined"
import { GoogleContactsExportDialog } from "@/features/commercial/components/google-contacts-export-dialog"
import { LeadQuickSheet } from "@/features/commercial/components/lead-quick-sheet"
import { LeadArchiveDialog } from "@/features/commercial/components/lead-archive-dialog"
import { AccessDenied } from "@/features/identity/access-denied"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { activeCommercialStages, filterCommercialLeadsByPeriod } from "@/features/commercial/commercial-analytics"
import { pipelineStages } from "@/features/commercial/pipeline-stages"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import type { CommercialLead, CommercialPeriod, PipelineStage } from "@/features/commercial/types"
import { formatItalianDate } from "@/lib/date"

const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
type StageFilter = "all" | PipelineStage
type LeadGroupFilter = "all" | "open" | "other"
type LeadSort = "updated-desc" | "updated-asc" | "name-asc" | "name-desc" | "company-asc" | "created-desc" | "created-asc" | "value-desc" | "next-action" | "status" | "owner"
type LeadGrouping = "none" | "status" | "owner" | "source" | "campaign" | "service" | "created-month" | "next-action" | "payment"

const periods: CommercialPeriod[] = ["today", "month", "previous-month", "custom"]
const nextActionDate = (value?: string | null) => formatItalianDate(value) || "Nessuna scadenza"

function readPeriod(searchParams: URLSearchParams) {
  const period = searchParams.get("period")
  return periods.includes(period as CommercialPeriod) ? period as CommercialPeriod : "month"
}

function readRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  return from && to ? { from: new Date(`${from}T12:00:00`), to: new Date(`${to}T12:00:00`) } : undefined
}

const badgeTone: Record<PipelineStage, string> = {
  new: "bg-chart-2/10 text-chart-2",
  qualified: "bg-chart-1/10 text-chart-1",
  proposal: "bg-chart-4/10 text-chart-4",
  negotiation: "bg-chart-5/10 text-chart-5",
  won: "bg-chart-3/10 text-chart-3",
  unqualified: "bg-muted text-muted-foreground",
  "not-interested": "bg-muted text-muted-foreground",
  "follow-up": "bg-chart-2/10 text-chart-2",
  lost: "bg-destructive/10 text-destructive",
}

function stageLabel(stage: PipelineStage) {
  return pipelineStages.find((item) => item.id === stage)?.label ?? stage
}

function compareLeads(left: CommercialLead, right: CommercialLead, sort: LeadSort, events: Array<{ leadId: string; date: string }>) {
  const direction = sort.endsWith("-desc") ? -1 : 1
  if (sort.startsWith("name-")) return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`) * direction
  if (sort === "company-asc") return left.company.localeCompare(right.company)
  if (sort.startsWith("created-")) return left.createdAt.localeCompare(right.createdAt) * direction
  if (sort === "value-desc") return right.value - left.value
  if (sort === "next-action") return left.nextActionAt.localeCompare(right.nextActionAt)
  if (sort === "status") return stageLabel(left.stage).localeCompare(stageLabel(right.stage))
  if (sort === "owner") return left.owner.localeCompare(right.owner)
  const updated = (lead: CommercialLead) => events.filter((event) => event.leadId === lead.id).reduce((latest, event) => event.date > latest ? event.date : latest, lead.lastContact)
  return updated(left).localeCompare(updated(right)) * direction
}

function leadGroupKey(lead: CommercialLead, group: LeadGrouping, store: { customers: Array<{ id: string; sourceLeadId: string }>; orders: Array<{ id: string; customerId: string; archivedAt?: string }>; payments: Array<{ orderId: string; archivedAt?: string; status: string; type: string }> }) {
  if (group === "status") return stageLabel(lead.stage)
  if (group === "owner") return lead.owner
  if (group === "source") return lead.source || "Senza fonte"
  if (group === "campaign") return lead.formSubmission?.utmCampaign || "Senza campagna"
  if (group === "service") return lead.service || "Senza servizio"
  if (group === "created-month") return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(lead.createdAt))
  if (group === "next-action") return nextActionDate(lead.nextActionAt)
  if (group === "payment") { const customer = store.customers.find((item) => item.sourceLeadId === lead.id); const orderIds = new Set(store.orders.filter((item) => item.customerId === customer?.id && !item.archivedAt).map((item) => item.id)); return store.payments.some((item) => orderIds.has(item.orderId) && !item.archivedAt && item.status === "Confermato" && item.type !== "Rimborso") ? "Pagato" : "Non pagato" }
  return "Tutti"
}

function stopRowNavigation(event: React.SyntheticEvent) {
  event.stopPropagation()
}

function LeadAnalyticsSummary({ leads }: { leads: CommercialLead[] }) {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const openLeads = leads.filter((lead) => !["won", "lost", "unqualified", "not-interested"].includes(lead.stage))
  const pipelineValue = openLeads.reduce((total, lead) => total + lead.value, 0)
  const won = leads.filter((lead) => lead.stage === "won").length

  return (
    <aside className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Riepilogo lead</h2>
        <p className="text-sm text-muted-foreground">Distribuzione e risultati commerciali.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="py-4"><CardDescription>Lead del mese</CardDescription><CardTitle className="text-2xl">{leads.filter((lead) => lead.createdAt.startsWith(currentMonth)).length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="py-4"><CardDescription>Tasso di conversione</CardDescription><CardTitle className="text-2xl">{leads.length ? ((won / leads.length) * 100).toFixed(1) : "0.0"}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="py-4"><CardDescription>Valore pipeline</CardDescription><CardTitle className="text-2xl">{money.format(pipelineValue)}</CardTitle></CardHeader></Card>
      </div>
    </aside>
  )
}

export function CommercialLeadsPageLayout() {
  const commercialTeam = useCommercialTeam()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { store, identity, leads } = useAuthorizedCommercial()
  const { addLead } = store
  const [query, setQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [quickLeadId, setQuickLeadId] = useState<string>()
  const [exportOpen, setExportOpen] = useState(false)
  const [archiveLead, setArchiveLead] = useState<CommercialLead>()
  const sort = identity.leadListPreferences.sort as LeadSort
  const grouping = identity.leadListPreferences.group as LeadGrouping

  const statusParam = searchParams.get("status")
  const statusFilter: StageFilter = pipelineStages.some((stage) => stage.id === statusParam) ? statusParam as PipelineStage : "all"
  const groupFilter: LeadGroupFilter = searchParams.get("group") === "open" ? "open" : searchParams.get("group") === "other" ? "other" : "all"
  const period = readPeriod(searchParams)
  const periodRange = readRange(searchParams)

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return filterCommercialLeadsByPeriod(leads, period, periodRange).filter((lead) => {
      const searchable = `${lead.firstName} ${lead.lastName} ${lead.company} ${lead.email}`.toLowerCase()
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && (statusFilter === "all" || lead.stage === statusFilter) && (groupFilter === "all" || groupFilter === "open" && activeCommercialStages.includes(lead.stage) || groupFilter === "other" && !activeCommercialStages.includes(lead.stage))
    }).sort((left, right) => compareLeads(left, right, sort, store.timelineEvents))
  }, [groupFilter, leads, period, periodRange, query, sort, statusFilter, store.timelineEvents])

  const pageCount = Math.max(1, Math.ceil(filteredLeads.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const visibleGroups = useMemo(() => Object.entries(visibleLeads.reduce<Record<string, CommercialLead[]>>((result, lead) => { const key = leadGroupKey(lead, grouping, store); (result[key] ??= []).push(lead); return result }, {})), [grouping, store, visibleLeads])

  const openFullLead = (lead: CommercialLead) => router.push(`/dashboard/commercial/leads/${lead.id}`)
  const openLead = (lead: CommercialLead) => identity.leadOpenMode === "quick" ? setQuickLeadId(lead.id) : openFullLead(lead)
  const updateFilters = (nextStatus: StageFilter, nextGroup: LeadGroupFilter = "all") => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextStatus === "all") params.delete("status"); else params.set("status", nextStatus)
    if (nextGroup === "all") params.delete("group"); else params.set("group", nextGroup)
    router.push(`${pathname}${params.size ? `?${params}` : ""}`)
    setPage(1)
  }
  const changeFilter = (value: StageFilter) => updateFilters(value)
  const resetFilters = () => { setQuery(""); router.push(pathname); setPage(1) }
  const toggleLead = (leadId: string) => setSelectedIds((ids) => ids.includes(leadId) ? ids.filter((id) => id !== leadId) : [...ids, leadId])
  const toggleVisibleLeads = (checked: boolean) => setSelectedIds((ids) => checked ? Array.from(new Set([...ids, ...visibleLeads.map((lead) => lead.id)])) : ids.filter((id) => !visibleLeads.some((lead) => lead.id === id)))
  if (!identity.hasCapability("canViewAllLeads") && !identity.hasCapability("canViewAssignedLeads")) return <AccessDenied resource="ai lead commerciali" />
  return (
    <main className="@container/leads mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 @4xl/leads:flex-row @4xl/leads:items-end @4xl/leads:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">{identity.hasCapability("canViewAllLeads") ? "Tutti i lead" : "I miei lead"}</h1><p className="text-sm text-muted-foreground">Cerca, filtra e gestisci le opportunità autorizzate.</p><p className="mt-1 text-sm text-muted-foreground">{leads.length} lead visibili</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setExportOpen(true)}><ContactRound />Esporta Google Contatti</Button><Button asChild variant="outline"><a href="https://contacts.google.com/" target="_blank" rel="noreferrer"><ExternalLink />Apri Google Contatti</a></Button><LeadDialog onCreate={addLead} /></div>
      </header>

      <Card><CardContent className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Cerca lead" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} /></div>
        <Select value={statusFilter} onValueChange={(value) => changeFilter(value as StageFilter)}><SelectTrigger className="w-44"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{pipelineStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>)}</SelectContent></Select>
        <Select value={identity.leadOpenMode} onValueChange={(value) => identity.setLeadOpenMode(value as "quick" | "full")}><SelectTrigger aria-label="Apertura lead" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quick">Scheda rapida</SelectItem><SelectItem value="full">Scheda completa</SelectItem></SelectContent></Select>
        <Select value={sort} onValueChange={(value) => identity.setLeadListPreferences({ sort: value, group: grouping })}><SelectTrigger aria-label="Ordina lead" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="updated-desc">Modificati di recente</SelectItem><SelectItem value="updated-asc">Meno recenti</SelectItem><SelectItem value="name-asc">Nome A–Z</SelectItem><SelectItem value="name-desc">Nome Z–A</SelectItem><SelectItem value="company-asc">Azienda</SelectItem><SelectItem value="created-desc">Creazione recente</SelectItem><SelectItem value="created-asc">Creazione meno recente</SelectItem><SelectItem value="value-desc">Valore</SelectItem><SelectItem value="next-action">Prossima azione</SelectItem><SelectItem value="status">Stato</SelectItem><SelectItem value="owner">Responsabile</SelectItem></SelectContent></Select>
        <Select value={grouping} onValueChange={(value) => identity.setLeadListPreferences({ sort, group: value })}><SelectTrigger aria-label="Raggruppa lead" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nessun gruppo</SelectItem><SelectItem value="status">Per stato</SelectItem><SelectItem value="owner">Per responsabile</SelectItem><SelectItem value="source">Per fonte</SelectItem><SelectItem value="campaign">Per campagna</SelectItem><SelectItem value="service">Per servizio</SelectItem><SelectItem value="created-month">Per mese creazione</SelectItem><SelectItem value="next-action">Per prossima azione</SelectItem><SelectItem value="payment">Pagato / non pagato</SelectItem></SelectContent></Select>
        <Button variant="outline" onClick={resetFilters}>Azzera filtri</Button>
      </CardContent></Card>

      <div className="flex flex-wrap gap-2"><Button size="sm" variant={statusFilter === "all" && groupFilter === "all" ? "secondary" : "outline"} onClick={() => updateFilters("all")}>Tutti gli stati</Button><Button size="sm" variant={groupFilter === "open" ? "secondary" : "outline"} onClick={() => updateFilters("all", "open")}>Trattative aperte</Button><Button size="sm" variant={groupFilter === "other" ? "secondary" : "outline"} onClick={() => updateFilters("all", "other")}>Altri stati</Button>{pipelineStages.map((filter) => <Button key={filter.id} size="sm" variant={statusFilter === filter.id ? "secondary" : "outline"} onClick={() => changeFilter(filter.id)}>{filter.label}</Button>)}</div>

      {grouping !== "none" && <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Gruppi lead">{visibleGroups.map(([label, entries]) => <details key={label} open className="rounded-lg border bg-card px-3 py-2"><summary className="cursor-pointer font-medium">{label} <span className="text-sm font-normal text-muted-foreground">({entries.length})</span></summary><div className="mt-2 space-y-1">{entries.map((lead) => <button key={lead.id} className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => openLead(lead)}>{lead.firstName} {lead.lastName} · {lead.company}</button>)}</div></details>)}</section>}

      <Card className="min-w-0 overflow-hidden">
        <div className="hidden overflow-x-auto md:block"><Table className="min-w-[960px]"><TableHeader><TableRow><TableHead className="w-10"><Checkbox aria-label="Seleziona i lead della pagina" checked={visibleLeads.length > 0 && visibleLeads.every((lead) => selectedIds.includes(lead.id))} onClick={stopRowNavigation} onCheckedChange={(checked) => toggleVisibleLeads(Boolean(checked))} /></TableHead><TableHead>Lead</TableHead><TableHead>Azienda</TableHead><TableHead>Fonte</TableHead><TableHead>Stato</TableHead><TableHead>Assegnato</TableHead><TableHead>Valore</TableHead><TableHead>Prossima azione</TableHead><TableHead className="w-12 text-right"><span className="sr-only">Apri scheda</span></TableHead></TableRow></TableHeader><TableBody>
          {visibleLeads.map((lead) => { const member = commercialTeam.find((item) => item.id === lead.assigneeId); return <TableRow key={lead.id} role="link" tabIndex={0} aria-label={`Apri ${identity.leadOpenMode === "quick" ? "scheda rapida" : "scheda completa"} di ${lead.firstName} ${lead.lastName}`} className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openLead(lead)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); openLead(lead) } }}><TableCell onClick={stopRowNavigation}><Checkbox aria-label={`Seleziona ${lead.firstName} ${lead.lastName}`} checked={selectedIds.includes(lead.id)} onCheckedChange={() => toggleLead(lead.id)} /></TableCell><TableCell><div className="flex items-center gap-2"><Avatar size="sm"><AvatarFallback>{lead.firstName[0]}{lead.lastName[0]}</AvatarFallback></Avatar><span><span className="block font-medium">{lead.firstName} {lead.lastName}</span><span className="block text-xs text-muted-foreground">{lead.email}</span></span></div></TableCell><TableCell><span className="block font-medium">{lead.company}</span><span className="text-xs text-muted-foreground">{lead.service}</span></TableCell><TableCell className="text-sm">{lead.source}</TableCell><TableCell><Badge className={`border-0 ${badgeTone[lead.stage]}`}>{stageLabel(lead.stage)}</Badge></TableCell><TableCell>{member?.name ?? "—"}</TableCell><TableCell className="tabular-nums">{money.format(lead.value)}</TableCell><TableCell><span className="block text-sm">{lead.nextAction || "Nessuna prossima azione"}</span><span className="text-xs text-muted-foreground">{nextActionDate(lead.nextActionAt)}</span></TableCell><TableCell onClick={stopRowNavigation}><div className="flex justify-end"><Tooltip><TooltipTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Archivia ${lead.firstName} ${lead.lastName}`} onClick={() => setArchiveLead(lead)}><Archive /></Button></TooltipTrigger><TooltipContent>Archivia lead</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Anteprima ${lead.firstName} ${lead.lastName}`} onClick={() => setQuickLeadId(lead.id)}><Eye /></Button></TooltipTrigger><TooltipContent>Scheda rapida</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Apri scheda completa di ${lead.firstName} ${lead.lastName}`} onClick={() => openFullLead(lead)}><ExternalLink /></Button></TooltipTrigger><TooltipContent>Scheda completa</TooltipContent></Tooltip></div></TableCell></TableRow> })}
        </TableBody></Table></div>
        <div className="grid gap-3 p-4 md:hidden">{visibleLeads.map((lead) => <div key={lead.id} role="button" tabIndex={0} className="rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openLead(lead)} onKeyDown={(event) => { if (event.key === "Enter") openLead(lead) }}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{lead.firstName} {lead.lastName}</p><p className="text-sm text-muted-foreground">{lead.company}</p></div><Badge className={`border-0 ${badgeTone[lead.stage]}`}>{stageLabel(lead.stage)}</Badge></div><p className="mt-3 text-sm">{lead.nextAction}</p><p className="mt-1 font-semibold tabular-nums">{money.format(lead.value)}</p><div className="mt-2 flex justify-end gap-1" onClick={stopRowNavigation}><Button size="sm" variant="ghost" onClick={() => setArchiveLead(lead)}><Archive />Archivia</Button><Button size="sm" variant="ghost" onClick={() => setQuickLeadId(lead.id)}><Eye />Rapida</Button><Button size="sm" variant="ghost" onClick={() => openFullLead(lead)}><ExternalLink />Completa</Button></div></div>)}</div>
        {!filteredLeads.length && <CardContent className="py-12 text-center"><CardTitle className="text-base">Nessun lead trovato</CardTitle><CardDescription className="mt-1">Modifica i filtri per vedere le opportunità.</CardDescription><Button className="mt-4" onClick={resetFilters}>Azzera filtri</Button></CardContent>}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{filteredLeads.length} risultati</span><div className="flex items-center gap-2"><Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1) }}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem></SelectContent></Select><Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>Precedente</Button><span className="text-sm tabular-nums">{currentPage}/{pageCount}</span><Button size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>Successiva</Button></div></div>
      <LeadAnalyticsSummary leads={leads} />
      <LeadQuickSheet key={quickLeadId} leadId={quickLeadId} open={Boolean(quickLeadId)} onOpenChange={(next) => { if (!next) setQuickLeadId(undefined) }} />
      <GoogleContactsExportDialog open={exportOpen} onOpenChange={setExportOpen} leads={leads} selectedIds={selectedIds} />
      <LeadArchiveDialog lead={archiveLead} open={Boolean(archiveLead)} onOpenChange={(open) => { if (!open) setArchiveLead(undefined) }} />
    </main>
  )
}
