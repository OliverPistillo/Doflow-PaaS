"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Download, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LeadDialog } from "@/features/commercial/components/commercial-dashboard-refined"
import { CommercialPipelineBoard } from "@/features/commercial/components/commercial-pipeline-board"
import { AccessDenied } from "@/features/identity/access-denied"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { activeCommercialStages, filterCommercialLeadsByPeriod, pipelineStages } from "@/features/commercial/data/commercial-fixtures"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import type { CommercialPeriod, PipelineStage } from "@/features/commercial/types"

const validPeriods: CommercialPeriod[] = ["today", "month", "previous-month", "custom"]

function getPeriod(searchParams: URLSearchParams) {
  const value = searchParams.get("period")
  return validPeriods.includes(value as CommercialPeriod) ? value as CommercialPeriod : "month"
}

function getRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  return from && to ? { from: new Date(`${from}T12:00:00`), to: new Date(`${to}T12:00:00`) } : undefined
}

export function CommercialFullPipelinePage() {
  const commercialTeam = useCommercialTeam()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { store, identity, leads } = useAuthorizedCommercial()
  const { addLead } = store
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState<"all" | PipelineStage>("all")
  const [assignee, setAssignee] = useState("all")
  const period = getPeriod(searchParams)
  const range = getRange(searchParams)
  const group = searchParams.get("group")

  const visibleLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it-IT")
    return filterCommercialLeadsByPeriod(leads, period, range).filter((lead) => {
      const matchesQuery = !normalizedQuery || `${lead.company} ${lead.firstName} ${lead.lastName} ${lead.email}`.toLocaleLowerCase("it-IT").includes(normalizedQuery)
      const matchesStage = stage === "all" || lead.stage === stage
      const matchesAssignee = assignee === "all" || lead.assigneeId === assignee
      const matchesGroup = group !== "open" || activeCommercialStages.includes(lead.stage)
      return matchesQuery && matchesStage && matchesAssignee && matchesGroup
    })
  }, [assignee, group, leads, period, query, range, stage])

  const setPeriod = (nextPeriod: Exclude<CommercialPeriod, "custom">) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", nextPeriod)
    params.delete("from")
    params.delete("to")
    router.replace(`${pathname}?${params}`)
  }
  const resetFilters = () => {
    setQuery("")
    setStage("all")
    setAssignee("all")
    router.replace(pathname)
  }
  const exportCsv = () => {
    const rows = [["Lead", "Azienda", "Stato", "Valore"], ...visibleLeads.map((lead) => [ `${lead.firstName} ${lead.lastName}`, lead.company, pipelineStages.find((item) => item.id === lead.stage)?.label ?? lead.stage, lead.value ])]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "doflow-pipeline-commerciale.csv"
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Pipeline esportata")
  }

  if (!identity.hasCapability("canViewAllLeads") && !identity.hasCapability("canViewAssignedLeads")) return <AccessDenied resource="alla pipeline commerciale" />
  return <main className="@container/pipeline mx-auto flex w-full min-w-0 max-w-none flex-1 flex-col gap-6 p-4 md:p-6">
    <header data-flow-tour="flow-pipeline" className="flex flex-col gap-4 @5xl/pipeline:flex-row @5xl/pipeline:items-end @5xl/pipeline:justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Pipeline commerciale</h1><p className="text-sm text-muted-foreground">Gestisci le opportunità nelle fasi commerciali e aggiorna gli stati con il trascinamento.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportCsv}><Download />Esporta</Button><LeadDialog onCreate={addLead} /></div>
    </header>

    <Card><CardContent className="flex flex-wrap items-center gap-2 p-3">
      <div className="relative min-w-52 flex-1"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca lead, azienda o email" aria-label="Cerca nella pipeline" /></div>
      <Select value={assignee} onValueChange={setAssignee}><SelectTrigger className="w-40"><SelectValue placeholder="Responsabile" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i responsabili</SelectItem>{commercialTeam.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select>
      <Select value={stage} onValueChange={(value) => setStage(value as "all" | PipelineStage)}><SelectTrigger className="w-40"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{pipelineStages.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select>
      <Select value={period === "custom" ? "month" : period} onValueChange={(value) => setPeriod(value as Exclude<CommercialPeriod, "custom">)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Oggi</SelectItem><SelectItem value="month">Questo mese</SelectItem><SelectItem value="previous-month">Mese scorso</SelectItem></SelectContent></Select>
      <Button variant="outline" onClick={resetFilters}>Azzera filtri</Button>
    </CardContent></Card>

    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{visibleLeads.length} lead visualizzati</span><span className="hidden @lg/pipeline:inline">Trascina una card in una colonna oppure usa il menu “Sposta in”.</span></div>

    <Card data-flow-tour="flow-pipeline-stages" className="min-h-[min(680px,calc(100dvh-16rem))] min-w-0 flex-1 overflow-hidden"><CardContent className="h-full min-h-[min(680px,calc(100dvh-16rem))] p-0"><CommercialPipelineBoard visibleLeads={visibleLeads} dndContextId="commercial-full-pipeline" enhancedCards /></CardContent></Card>
  </main>
}
