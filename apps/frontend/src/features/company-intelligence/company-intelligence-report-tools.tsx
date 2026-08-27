"use client"

import { Download, Scale, Share2, Trash2, UserRoundCheck } from "lucide-react"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useCompanyIntelligence } from "@/features/company-intelligence/company-intelligence-provider"
import type { CompanyIntelligenceReport, ReportPermission } from "@/features/company-intelligence/company-intelligence-types"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { canEditLead } from "@/features/identity/permissions"

export function CompanyIntelligenceReportTools({ report }: { report: CompanyIntelligenceReport }) {
  const intelligence = useCompanyIntelligence(); const identity = useDoflowIdentity(); const commercial = useCommercialLeads()
  const [targetUserId, setTargetUserId] = useState(""); const [permission, setPermission] = useState<ReportPermission>("view"); const [competitorUrl, setCompetitorUrl] = useState(""); const [busy, setBusy] = useState(false)
  const editable = report.access === "edit"
  const linkedLead = report.leadId ? commercial.allLeads.find((lead) => lead.id === report.leadId) : undefined
  const leadCanChange = linkedLead && canEditLead(identity.currentUser, linkedLead)
  const suggestedCompany = report.companyName.trim(); const suggestedEmail = report.publicContacts.emails[0]?.trim(); const suggestedPhone = report.publicContacts.phones[0]?.trim()
  const leadProposal = linkedLead ? { ...(suggestedCompany && suggestedCompany !== linkedLead.company ? { company: suggestedCompany } : {}), ...(suggestedEmail && suggestedEmail !== linkedLead.email ? { email: suggestedEmail } : {}), ...(suggestedPhone && suggestedPhone !== linkedLead.phone ? { phone: suggestedPhone } : {}) } : {}
  const hasLeadProposal = Boolean(leadCanChange && Object.keys(leadProposal).length)
  const shareCandidates = identity.users.filter((user) => user.id !== report.ownerId && !report.shares.some((share) => share.userId === user.id))
  const run = async (task: () => Promise<{ ok: boolean; message?: string }>, success: string) => { setBusy(true); try { const result = await task(); if (result.ok) toast.success(success); else toast.error(result.message || "Operazione non riuscita") } finally { setBusy(false) } }
  const exportReport = async () => {
    const result = await intelligence.exportReport(report.id)
    if (!result.ok || !result.exported || !result.filename) return toast.error(result.message || "Esportazione non riuscita")
    const blob = new Blob([JSON.stringify(result.exported, null, 2)], { type: "application/json;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url); toast.success("Report e audit fonti esportati")
  }
  return <section className="grid gap-4 lg:grid-cols-2">
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Share2 className="size-4"/>Condivisione autorizzata</CardTitle><CardDescription>Visualizza consente la sola lettura; Modifica abilita condivisioni e confronti. La revoca è immediata.</CardDescription></CardHeader><CardContent className="space-y-3">
      {report.shares.length ? report.shares.map((share) => <div key={share.userId} className="flex flex-wrap items-center gap-2 rounded-lg border p-2"><span className="min-w-0 flex-1 text-sm">{identity.users.find((user) => user.id === share.userId)?.name ?? share.userId}</span><Badge variant="secondary">{share.permission === "edit" ? "Modifica" : "Visualizza"}</Badge>{editable && <Button size="icon-sm" variant="ghost" aria-label="Revoca condivisione" disabled={busy} onClick={() => void run(() => intelligence.revokeShare(report.id, share.userId), "Condivisione revocata")}><Trash2/></Button>}</div>) : <p className="text-sm text-muted-foreground">Report non condiviso.</p>}
      {editable && shareCandidates.length > 0 && <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]"><Select value={targetUserId} onValueChange={setTargetUserId}><SelectTrigger aria-label="Utente da autorizzare"><SelectValue placeholder="Seleziona utente"/></SelectTrigger><SelectContent>{shareCandidates.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select><Select value={permission} onValueChange={(value) => setPermission(value as ReportPermission)}><SelectTrigger aria-label="Permesso report"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="view">Visualizza</SelectItem><SelectItem value="edit">Modifica</SelectItem></SelectContent></Select><Button disabled={!targetUserId || busy} onClick={() => void run(async () => { const result = await intelligence.share(report.id, targetUserId, permission); if (result.ok) setTargetUserId(""); return result }, "Report condiviso")}>Condividi</Button></div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="size-4"/>Confronto concorrenti</CardTitle><CardDescription>Ogni concorrente viene acquisito separatamente con le proprie fonti pubbliche verificabili.</CardDescription></CardHeader><CardContent className="space-y-3">
      {editable && <div className="flex gap-2"><Input aria-label="URL concorrente" value={competitorUrl} onChange={(event) => setCompetitorUrl(event.target.value)} placeholder="concorrente.it"/><Button disabled={!competitorUrl.trim() || busy} onClick={() => void run(async () => { const result = await intelligence.addCompetitor(report.id, competitorUrl.trim()); if (result.ok) setCompetitorUrl(""); return result }, "Concorrente analizzato")}>Confronta</Button></div>}
      <div className="space-y-2">{report.competitors.length ? report.competitors.map((competitor) => <div key={competitor.id} className="rounded-lg border p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{competitor.companyName}</p><p className="truncate text-xs text-muted-foreground">{competitor.domain}</p></div><Badge variant="outline">Tecnico {competitor.scores.technical.value}/100</Badge>{editable && <Button size="icon-sm" variant="ghost" aria-label="Rimuovi concorrente" onClick={() => void run(() => intelligence.removeCompetitor(report.id, competitor.id), "Concorrente rimosso")}><Trash2/></Button>}</div><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Presenza {competitor.scores.digitalPresence.value}/100</span><span>Affidabilità {competitor.scores.dataReliability.value}/100</span><span>{competitor.evidence.length} fonti</span></div>{competitor.evidence[0]?.url && <a className="mt-2 inline-block text-xs text-primary underline" href={competitor.evidence[0].url} target="_blank" rel="noreferrer">Apri fonte verificata</a>}</div>) : <p className="text-sm text-muted-foreground">Nessun concorrente aggiunto.</p>}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRoundCheck className="size-4"/>Proposte per il Lead</CardTitle><CardDescription>I dati commerciali non vengono mai modificati automaticamente.</CardDescription></CardHeader><CardContent>{linkedLead ? <div className="space-y-3"><p className="text-sm"><span className="text-muted-foreground">Azienda:</span> {linkedLead.company} {leadProposal.company && <>→ <b>{leadProposal.company}</b></>}</p><p className="text-sm"><span className="text-muted-foreground">Email:</span> {linkedLead.email} {leadProposal.email && <>→ <b>{leadProposal.email}</b></>}</p><p className="text-sm"><span className="text-muted-foreground">Telefono:</span> {linkedLead.phone} {leadProposal.phone && <>→ <b>{leadProposal.phone}</b></>}</p>{hasLeadProposal ? <Button disabled={!leadCanChange} onClick={() => { if (!window.confirm("Applicare al Lead esclusivamente i valori pubblici proposti?")) return; commercial.updateLead(linkedLead.id, leadProposal); toast.success("Lead aggiornato dopo conferma manuale") }}>Conferma aggiornamento Lead</Button> : <Badge variant="secondary">Nessuna modifica proposta</Badge>}</div> : <p className="text-sm text-muted-foreground">Nessun Lead collegato.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Budget, cache e conservazione</CardTitle><CardDescription>Nessuna chiave o token sensibile viene inviato al browser.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div className="grid grid-cols-2 gap-2"><div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Consumo AI mensile</p><p className="font-medium">{intelligence.policy.usedTokens.toLocaleString("it-IT")} / {intelligence.policy.monthlyTokenBudget.toLocaleString("it-IT")} token</p></div><div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Cache</p><p className="font-medium">{intelligence.policy.cacheTtlHours} ore</p></div><div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Scadenza cache</p><p className="font-medium">{new Date(report.expiresAt).toLocaleString("it-IT")}</p></div><div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Conservazione</p><p className="font-medium">fino al {new Date(report.retentionUntil).toLocaleDateString("it-IT")}</p></div></div><Button variant="outline" onClick={() => void exportReport()}><Download/>Esporta report e audit fonti</Button></CardContent></Card>
    <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">Timeline e audit del report</CardTitle><CardDescription>Un solo evento per modifica effettiva; aperture e ricalcoli senza cambiamenti non generano eventi.</CardDescription></CardHeader><CardContent className="space-y-2">{report.audit.map((entry) => <div key={entry.id} className="flex flex-col gap-1 border-b py-2 text-sm last:border-0 sm:flex-row sm:items-center"><span className="flex-1">{entry.detail}</span><span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleString("it-IT")}</span></div>)}</CardContent></Card>
  </section>
}

export function CompanyIntelligenceReportToolsFromRoute() {
  const params = useSearchParams()
  const intelligence = useCompanyIntelligence()
  const report = intelligence.getReport(params.get("report"))
  if (!report) return null
  return <div className="mx-auto w-full max-w-[1500px] px-4 pb-6 md:px-6"><CompanyIntelligenceReportTools report={report}/></div>
}
