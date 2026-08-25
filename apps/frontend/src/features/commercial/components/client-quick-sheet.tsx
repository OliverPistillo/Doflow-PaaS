"use client"

import Link from "next/link"
import { useState } from "react"
import { CalendarClock, Camera, ExternalLink, FileSignature, FolderKanban, Mail, MessageCircle, Phone, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { EntityImageDialog } from "@/components/entity-image-dialog"
import { ActivityFormDialog } from "@/features/commercial/components/activity-form-dialog"
import { getCanonicalCustomerActivities } from "@/features/commercial/components/commercial-leads-provider"
import { CustomerLogo } from "@/features/commercial/components/customer-logo"
import { DocumentStatusBadge } from "@/features/commercial/document-status"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { canManageCustomerBranding } from "@/features/identity/permissions"

const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" })
const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })

export function ClientQuickSheet({ clientId, open, onOpenChange }: { clientId?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { store, identity, customers, projects } = useAuthorizedCommercial()
  const [activityOpen, setActivityOpen] = useState(false)
  const [logoOpen, setLogoOpen] = useState(false)
  const customer = customers.find((item) => item.id === clientId)
  if (!customer) return null
  const canEditLogo = canManageCustomerBranding(identity.currentUser, customer, { leads: store.allLeads, customers: store.allCustomers, projects: store.allProjects })
  const contact = customer.contacts?.find((item) => item.id === customer.primaryContactId && !item.archivedAt)
  const activities = getCanonicalCustomerActivities(customer).filter((item) => !item.archivedAt)
  const openActivities = activities.filter((item) => !["Completata", "Annullata"].includes(item.status))
  const nextActivity = [...openActivities].sort((left, right) => (left.dueAt || left.dueDate).localeCompare(right.dueAt || right.dueDate))[0]
  const project = projects.find((item) => item.clientId === customer.id && !item.archivedAt)
  const order = store.orders.find((item) => item.customerId === customer.id && !item.archivedAt)
  const contract = store.contracts.find((item) => item.orderId === order?.id && !item.archivedAt && !item.replacedById)
  const renewal = store.renewals.find((item) => item.customerId === customer.id && !item.archivedAt)
  const financial = order && identity.hasCapability("canViewAdministration") ? { netCollected: order.netCollected ?? 0, residual: order.residual ?? order.total } : undefined
  const documents = (customer.documents ?? []).filter((item) => !item.archivedAt)
  const communication = [...(customer.communications ?? [])].filter((item) => !item.archivedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
  const timeline = store.timelineEvents.filter((event) => event.leadId === customer.sourceLeadId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const phone = contact?.phone || customer.profile.phone
  const email = contact?.email || customer.profile.email
  const criticalDocuments = documents.filter((item) => item.status !== "Firmato")

  return <><Sheet open={open} onOpenChange={onOpenChange}><SheetContent showCloseButton={false} className="flex h-dvh w-full flex-col overflow-hidden p-0 sm:max-w-[520px]"><SheetHeader className="shrink-0 border-b px-5 py-4 text-left"><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_2.25rem_2.25rem] items-start gap-3"><div className="flex min-w-0 gap-3"><CustomerLogo customer={customer} className="size-11" /><div className="min-w-0"><SheetTitle className="line-clamp-2 break-words">{customer.profile.company}</SheetTitle><SheetDescription className="line-clamp-2">{contact?.name || `${customer.profile.firstName} ${customer.profile.lastName}`.trim()} · {customer.profile.service}</SheetDescription></div></div><Badge variant="secondary" className="max-w-32 whitespace-normal text-center">{customer.status}</Badge>{canEditLogo && <Button size="icon-sm" variant="ghost" aria-label="Modifica logo cliente" onClick={() => setLogoOpen(true)}><Camera /></Button>}<SheetClose asChild><Button size="icon-sm" variant="ghost" className="size-9" aria-label="Chiudi scheda cliente"><X /></Button></SheetClose></div><p className="text-xs text-muted-foreground">Responsabile: {customer.profile.owner}</p></SheetHeader><ScrollArea className="min-h-0 flex-1"><div className="space-y-4 px-5 py-4"><div className="grid grid-cols-3 gap-2"><Button asChild size="sm" variant="outline"><a href={`tel:${phone}`}><Phone />Chiama</a></Button><Button asChild size="sm" variant="outline"><a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button><Button asChild size="sm" variant="outline"><a href={`mailto:${email}`}><Mail />Email</a></Button></div><Card><CardHeader className="pb-2"><CardTitle className="text-base">Operatività cliente</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><Value label="Origine" value={customer.profile.source} /><Value label="Ordine" value={order?.code ?? "Non collegato"} /><div><p className="text-xs text-muted-foreground">Contratto</p><DocumentStatusBadge status={contract?.status ?? "Da generare"} /></div><Value label="Progetto" value={project ? `${project.name} · ${project.status}` : "Non collegato"} /><Value label="Attività aperte" value={String(openActivities.length)} /><Value label="Prossima scadenza" value={nextActivity ? dateTime.format(new Date(nextActivity.dueAt || nextActivity.dueDate)) : "Nessuna"} /><Value label="Rinnovo" value={renewal ? `${renewal.status} · ${dateTime.format(new Date(renewal.nextDueAt))}` : "Non previsto"} /><Value label="Ultima comunicazione" value={communication ? `${communication.channel} · ${dateTime.format(new Date(communication.occurredAt))}` : "Nessuna"} />{financial && <><Value label="Incassato netto" value={money.format(financial.netCollected)} /><Value label="Residuo" value={money.format(financial.residual)} /></>}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-base">Documenti critici</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex flex-wrap gap-2"><DocumentStatusBadge status={contract?.status ?? "Da firmare"} />{criticalDocuments.slice(0, 3).map((document) => <DocumentStatusBadge key={document.id} status={document.status} />)}</div><p>{criticalDocuments.length ? `${criticalDocuments.length} documenti ancora da completare` : "Nessun documento bloccante registrato"}</p><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/clienti/${customer.id}?tab=documents`}><FileSignature />Documenti</Link></Button>{project && <Button asChild size="sm" variant="outline"><Link href={`/dashboard/progetti/${project.id}`}><FolderKanban />Progetto</Link></Button>}<Button size="sm" variant="outline" onClick={() => setActivityOpen(true)}><Plus />Crea attività</Button></div></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-base">Timeline recente</CardTitle></CardHeader><CardContent className="space-y-3">{timeline.map((event) => <div key={event.id} className="border-l-2 border-primary/30 pl-3"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{event.title}</p>{event.title.startsWith("Documento ") && <DocumentStatusBadge status={event.title.slice(10)} />}</div><p className="text-xs text-muted-foreground">{event.detail}</p><p className="text-[11px] text-muted-foreground">{dateTime.format(new Date(event.date))}</p></div>)}{!timeline.length && <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>}<Button asChild size="sm" variant="link" className="px-0"><Link href={`/dashboard/clienti/${customer.id}?tab=timeline`}><CalendarClock />Timeline completa</Link></Button></CardContent></Card></div></ScrollArea><Separator /><SheetFooter className="shrink-0 flex-row gap-2 px-5 py-3"><Button asChild className="flex-1"><Link href={`/dashboard/clienti/${customer.id}`}><ExternalLink />Apri scheda completa</Link></Button><Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button></SheetFooter></SheetContent></Sheet>{logoOpen && <EntityImageDialog open={logoOpen} onOpenChange={setLogoOpen} title={`Logo di ${customer.profile.company}`} description="Salvato sul record cliente dal server." currentUrl={customer.logoUrl} fallback={customer.profile.company.slice(0, 2).toUpperCase()} onSave={async (logoUrl) => { const saved = await store.updateCustomerLogo(customer.id, logoUrl); if (saved) toast.success(logoUrl ? "Logo cliente aggiornato" : "Logo cliente rimosso"); return saved }} />}<ActivityFormDialog open={activityOpen} onOpenChange={setActivityOpen} defaultClientId={customer.id} /></>
}

function Value({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words font-medium">{value}</p></div> }
