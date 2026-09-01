"use client"

import Link from "next/link"
import { FileText } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerLogo } from "@/features/commercial/components/customer-logo"
import { customerDocumentStatuses, DocumentStatusBadge, documentStatusFilterClass, type CustomerDocumentStatus } from "@/features/commercial/document-status"
import { AccessDenied } from "@/features/identity/access-denied"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"

export function CommercialDocumentsPage() {
  const { identity, customers, projects } = useAuthorizedCommercial()
  const [filter, setFilter] = useState<"Tutti" | CustomerDocumentStatus>("Tutti")
  if (!identity.hasCapability("canViewProjects")) return <AccessDenied resource="ai documenti" />
  const allDocuments = customers.flatMap((customer) => (customer.documents ?? []).filter((document) => (!document.projectId || projects.some((project) => project.id === document.projectId)) && (!document.archivedAt || identity.hasCapability("canManageArchive"))).map((document) => ({ document, customer, status: document.archivedAt ? "Archiviato" as const : document.status })))
  const documents = allDocuments.filter((item) => filter === "Tutti" ? !item.document.archivedAt : item.status === filter)
  const count = (status?: CustomerDocumentStatus) => status ? allDocuments.filter((item) => item.status === status).length : allDocuments.filter((item) => !item.document.archivedAt).length
  return <main className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6"><header><h1 className="text-2xl font-semibold">Documenti</h1><p className="text-sm text-muted-foreground">Metadati documentali dei clienti e progetti autorizzati. Nessun upload simulato.</p></header><section aria-label="Filtri stato documento" className="flex gap-2 overflow-x-auto pb-1"><Button size="sm" variant="outline" aria-pressed={filter === "Tutti"} className={`h-7 shrink-0 rounded-full px-3 text-xs ${filter === "Tutti" ? "border-primary bg-primary/10 text-primary shadow-sm" : ""}`} onClick={() => setFilter("Tutti")}>Tutti <span className="tabular-nums">{count()}</span></Button>{customerDocumentStatuses.map((status) => <Button key={status} size="sm" variant="outline" aria-pressed={filter === status} className={`h-7 shrink-0 rounded-full px-3 text-xs ${documentStatusFilterClass(status, filter === status)}`} onClick={() => setFilter((current) => current === status ? "Tutti" : status)}>{status} <span className="tabular-nums">{count(status)}</span></Button>)}</section><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{documents.map(({ document, customer, status }) => <Card key={document.id}><CardHeader><div className="flex items-start justify-between gap-2"><FileText className="size-5 text-muted-foreground" /><DocumentStatusBadge status={status} /></div><div className="flex items-center gap-2"><CustomerLogo customer={customer} className="size-9" /><div className="min-w-0"><CardTitle className="truncate text-base">{document.name}</CardTitle><CardDescription className="truncate">{customer.profile.company}</CardDescription></div></div></CardHeader><CardContent><Button asChild className="w-full" variant="outline"><Link href={`/dashboard/clienti/${customer.id}?tab=documents`}>Apri nel cliente</Link></Button></CardContent></Card>)}</div>{!documents.length && <Card><CardHeader><CardTitle>Nessun documento visibile</CardTitle><CardDescription>Non risultano metadati documentali per lo stato selezionato nel perimetro corrente.</CardDescription></CardHeader></Card>}</main>
}
