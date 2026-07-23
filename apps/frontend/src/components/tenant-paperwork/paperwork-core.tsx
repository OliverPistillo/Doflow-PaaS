"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { listDocumentsForEntity, type TenantDocument } from "@/lib/tenant-documents-api";
import { paperworkApi, type PaperworkActivity, type PaperworkDossier, type PaperworkItem } from "@/lib/tenant-paperwork-api";
import { downloadJson } from "@/components/tenant-contracts/contract-utils";
import { DOSSIER_STATUSES, DOSSIER_TYPES, ITEM_STATUSES, PAPERWORK_CATEGORIES, PRIORITIES, badgeClass, canManageAdminWorkflow, formatDate, formatDateTime, labelFor, toBody } from "./paperwork-utils";
import { PaperworkSummaryCards } from "./paperwork-summary-cards";

type Option = { value: string; label: string };

function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}
function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}
function Header({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{children ? <div className="flex flex-wrap gap-2">{children}</div> : null}</div>;
}
function StateBadge({ value, options }: { value?: string | null; options: Option[] }) {
  return <Badge variant="outline" className={badgeClass(value)}>{labelFor(value, options)}</Badge>;
}
function SelectField({ value, options, placeholder, onChange }: { value?: string; options: Option[]; placeholder: string; onChange: (value: string) => void }) {
  return <Select value={value || "__none__"} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}><SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent><SelectItem value="__none__">{placeholder}</SelectItem>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

export function PaperworkPage() {
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<PaperworkDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const [summaryData, listData] = await Promise.all([paperworkApi.summary().catch(() => null), paperworkApi.list({ limit: 20 }).catch(() => ({ items: [] }))]);
    setSummary(summaryData);
    setRows(listData.items || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Scartoffie" description="Dossier amministrativi, item documentali e attività operative interne."><Button asChild><Link href="/paperwork/new"><Plus className="mr-2 h-4 w-4" /> Nuovo dossier</Link></Button><Button asChild variant="outline"><Link href="/contracts">Contratti</Link></Button></Header><PaperworkSummaryCards summary={summary} />{loading ? <Loading /> : <DossiersList rows={rows} />}</div>;
}

export function DossiersPage() {
  const [rows, setRows] = useState<PaperworkDossier[]>([]);
  const [filters, setFilters] = useState({ search: "", status: "", dossier_type: "", priority: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError(null);
    try { const data = await paperworkApi.list({ ...filters, limit: 100 }); setRows(data.items || []); }
    catch (err) { setError(err instanceof Error ? err.message : "Errore caricamento dossier"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Dossier amministrativi" description="Lista scartoffie e workflow documentali."><Button asChild><Link href="/paperwork/dossiers/new"><Plus className="mr-2 h-4 w-4" /> Nuovo dossier</Link></Button></Header><ErrorBox error={error} /><Card><CardContent className="grid gap-3 p-4 md:grid-cols-5"><div className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Cerca dossier..." value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></div><SelectField value={filters.status} options={DOSSIER_STATUSES} placeholder="Status" onChange={(v) => setFilters((p) => ({ ...p, status: v }))} /><SelectField value={filters.dossier_type} options={DOSSIER_TYPES} placeholder="Tipo" onChange={(v) => setFilters((p) => ({ ...p, dossier_type: v }))} /><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Filtra</Button></CardContent></Card>{loading ? <Loading /> : <DossiersList rows={rows} />}</div>;
}

export function DossiersList({ rows }: { rows: PaperworkDossier[] }) {
  if (rows.length === 0) return <Empty>Nessun dossier amministrativo presente.</Empty>;
  return <Card><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">{["Titolo", "Tipo", "Status", "Priorita", "Scadenza", "Contract", "Project", "Azioni"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{row.title}</td><td className="px-4 py-3">{labelFor(row.dossier_type, DOSSIER_TYPES)}</td><td className="px-4 py-3"><StateBadge value={row.status} options={DOSSIER_STATUSES} /></td><td className="px-4 py-3"><StateBadge value={row.priority} options={PRIORITIES} /></td><td className="px-4 py-3">{formatDate(row.due_date)}</td><td className="px-4 py-3 font-mono text-xs">{row.contract_id || "-"}</td><td className="px-4 py-3 font-mono text-xs">{row.project_id || "-"}</td><td className="px-4 py-3"><Button asChild size="sm" variant="outline"><Link href={`/paperwork/dossiers/${row.id}`}>Apri</Link></Button></td></tr>)}</tbody></table></CardContent></Card>;
}

export function DossierFormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ title: "", dossier_type: "generic", status: "open", priority: "medium" });
  const submit = async () => {
    setSaving(true);
    try { const created = await paperworkApi.create(toBody(form)); toast({ title: "Dossier creato" }); router.push(`/paperwork/dossiers/${created.id}`); }
    catch (err) { toast({ title: "Dossier non creato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Nuovo dossier" description="Crea un dossier amministrativo interno."><Button asChild variant="outline"><Link href="/paperwork/dossiers">Torna</Link></Button></Header><DossierForm form={form} setForm={setForm} /><Button onClick={submit} disabled={saving || !form.title}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Crea dossier</Button></div>;
}

export function DossierForm({ form, setForm }: { form: Record<string, any>; setForm: (fn: any) => void }) {
  const set = (key: string, value: unknown) => setForm((p: any) => ({ ...p, [key]: value }));
  return <Card><CardContent className="grid gap-4 p-4 md:grid-cols-2"><div className="grid gap-2 md:col-span-2"><Label>Titolo</Label><Input value={form.title || ""} onChange={(e) => set("title", e.target.value)} /></div><div className="grid gap-2 md:col-span-2"><Label>Descrizione</Label><Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} /></div><div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.dossier_type} options={DOSSIER_TYPES} placeholder="Tipo" onChange={(v) => set("dossier_type", v)} /></div><div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={DOSSIER_STATUSES} placeholder="Status" onChange={(v) => set("status", v)} /></div><div className="grid gap-2"><Label>Priorita</Label><SelectField value={form.priority} options={PRIORITIES} placeholder="Priorita" onChange={(v) => set("priority", v)} /></div><div className="grid gap-2"><Label>Due date</Label><Input type="date" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></div>{["company_id", "contact_id", "quote_id", "project_id", "contract_id"].map((field) => <div key={field} className="grid gap-2"><Label>{field}</Label><Input value={form[field] || ""} onChange={(e) => set(field, e.target.value)} placeholder="UUID opzionale" /></div>)}</CardContent></Card>;
}

export function DossierDetailPage({ dossierId }: { dossierId: string }) {
  const { toast } = useToast();
  const [dossier, setDossier] = useState<PaperworkDossier | null>(null);
  const [items, setItems] = useState<PaperworkItem[]>([]);
  const [activity, setActivity] = useState<PaperworkActivity[]>([]);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [dossierData, itemData, activityData, documentData] = await Promise.all([
        paperworkApi.get(dossierId),
        paperworkApi.items(dossierId).catch(() => ({ items: [] })),
        paperworkApi.activity(dossierId).catch(() => ({ items: [] })),
        listDocumentsForEntity("paperwork_dossier", dossierId, { limit: 10 }).catch(() => ({ items: [] })),
      ]);
      setDossier(dossierData); setItems(itemData.items || []); setActivity(activityData.items || []); setDocuments(documentData.items || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Errore caricamento dossier"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [dossierId]);
  const exportJson = async () => { const data = await paperworkApi.export(dossierId); downloadJson(`paperwork-${dossierId}.json`, data); };
  if (loading) return <div className="flex-1 p-4 md:p-6"><Loading /></div>;
  if (error || !dossier) return <div className="flex-1 p-4 md:p-6"><ErrorBox error={error || "Dossier non trovato"} /></div>;
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title={dossier.title} description={`${labelFor(dossier.dossier_type, DOSSIER_TYPES)} · ${labelFor(dossier.status, DOSSIER_STATUSES)}`}><Button asChild variant="outline"><Link href="/paperwork/dossiers">Lista</Link></Button><Button variant="outline" onClick={exportJson}><Download className="mr-2 h-4 w-4" /> Export JSON</Button></Header><div className="flex flex-wrap gap-2"><StateBadge value={dossier.status} options={DOSSIER_STATUSES} /><StateBadge value={dossier.priority} options={PRIORITIES} /></div><Tabs defaultValue="overview"><TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="items">Items</TabsTrigger><TabsTrigger value="documents">Documenti</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList><TabsContent value="overview"><DossierOverview dossier={dossier} onReload={load} /></TabsContent><TabsContent value="items"><DossierItems dossierId={dossier.id} rows={items} onReload={load} /></TabsContent><TabsContent value="documents"><DossierDocuments dossierId={dossier.id} rows={documents} /></TabsContent><TabsContent value="activity"><DossierActivityList rows={activity} /></TabsContent></Tabs></div>;
}

function DossierOverview({ dossier, onReload }: { dossier: PaperworkDossier; onReload: () => void }) {
  return <Card><CardContent className="grid gap-4 p-4 md:grid-cols-2"><Info label="Descrizione" value={dossier.description || "-"} wide /><Info label="Company ID" value={dossier.company_id || "-"} /><Info label="Quote ID" value={dossier.quote_id || "-"} /><Info label="Project ID" value={dossier.project_id || "-"} href={dossier.project_id ? `/projects/${dossier.project_id}` : undefined} /><Info label="Contract ID" value={dossier.contract_id || "-"} href={dossier.contract_id ? `/contracts/${dossier.contract_id}` : undefined} /><Info label="Due date" value={formatDate(dossier.due_date)} /><Info label="Completato" value={formatDateTime(dossier.completed_at)} /><div className="md:col-span-2"><DossierStatusActions dossier={dossier} onReload={onReload} /></div></CardContent></Card>;
}
function Info({ label, value, href, wide }: { label: string; value: ReactNode; href?: string; wide?: boolean }) {
  return <div className={wide ? "md:col-span-2" : ""}><p className="text-xs font-semibold text-muted-foreground">{label}</p><div className="mt-1 text-sm">{href ? <Link href={href} className="text-primary hover:underline">{value}</Link> : value}</div></div>;
}

export function DossierStatusActions({ dossier, onReload }: { dossier: PaperworkDossier; onReload: () => void }) {
  const { toast } = useToast();
  return <div className="flex flex-wrap gap-2">{DOSSIER_STATUSES.map((s) => <Button key={s.value} size="sm" variant={dossier.status === s.value ? "default" : "outline"} onClick={async () => { try { await paperworkApi.setStatus(dossier.id, s.value); toast({ title: "Status aggiornato" }); onReload(); } catch (err) { toast({ title: "Status non aggiornato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" }); } }}>{s.label}</Button>)}</div>;
}

export function DossierItems({ dossierId, rows, onReload }: { dossierId: string; rows: PaperworkItem[]; onReload: () => void }) {
  const [open, setOpen] = useState(false);
  return <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Items paperwork</CardTitle><CardDescription>Documenti e passaggi amministrativi richiesti.</CardDescription></div><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nuovo</Button></CardHeader><CardContent className="space-y-3">{rows.length === 0 ? <Empty>Nessun item paperwork.</Empty> : rows.map((row) => <div key={row.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{row.title}</p><p className="text-sm text-muted-foreground">{labelFor(row.category, PAPERWORK_CATEGORIES)} · scadenza {formatDate(row.due_date)} {row.linked_document_id ? `· doc ${row.linked_document_id}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><StateBadge value={row.status} options={ITEM_STATUSES} /><Button size="sm" variant="outline" onClick={async () => { await paperworkApi.completeItem(dossierId, row.id); onReload(); }}>Completa</Button><Button size="sm" variant="outline" onClick={async () => { await paperworkApi.approveItem(dossierId, row.id); onReload(); }}>Approva</Button><Button size="sm" variant="outline" onClick={async () => { await paperworkApi.rejectItem(dossierId, row.id); onReload(); }}>Rifiuta</Button></div></div>)}<ItemDialog open={open} setOpen={setOpen} onSave={async (body) => { await paperworkApi.createItem(dossierId, body); onReload(); }} /></CardContent></Card>;
}

function ItemDialog({ open, setOpen, onSave }: { open: boolean; setOpen: (v: boolean) => void; onSave: (body: Record<string, any>) => Promise<void> }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>({ category: "document", status: "missing" });
  const save = async () => { try { await onSave(toBody(form)); setOpen(false); setForm({ category: "document", status: "missing" }); toast({ title: "Item creato" }); } catch (err) { toast({ title: "Item non creato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" }); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Nuovo item</DialogTitle></DialogHeader><div className="grid gap-3"><InputField label="title" value={form.title || ""} onChange={(v) => setForm((p) => ({ ...p, title: v }))} /><TextField label="description" value={form.description || ""} onChange={(v) => setForm((p) => ({ ...p, description: v }))} /><SelectField value={form.category} options={PAPERWORK_CATEGORIES} placeholder="Categoria" onChange={(v) => setForm((p) => ({ ...p, category: v }))} /><SelectField value={form.status} options={ITEM_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /><InputField label="due_date" value={form.due_date || ""} type="date" onChange={(v) => setForm((p) => ({ ...p, due_date: v }))} /><InputField label="linked_document_id" value={form.linked_document_id || ""} onChange={(v) => setForm((p) => ({ ...p, linked_document_id: v }))} /><Button onClick={save}>Salva</Button></div></DialogContent></Dialog>;
}

export function DossierDocuments({ dossierId, rows }: { dossierId: string; rows: TenantDocument[] }) {
  return <Card><CardHeader><CardTitle>Documenti dossier</CardTitle><CardDescription>Allegati collegati al dossier amministrativo.</CardDescription></CardHeader><CardContent className="space-y-3">{rows.length === 0 ? <Empty>Nessun documento collegato.</Empty> : rows.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><p className="font-semibold">{doc.title || doc.original_filename}</p><p className="text-muted-foreground">{doc.category} · {formatDateTime(doc.created_at)}</p></div><Button asChild size="sm" variant="outline"><Link href={`/documents/${doc.id}`}>Apri</Link></Button></div>)}<Button asChild variant="outline"><Link href={`/documents/upload?entity_type=paperwork_dossier&entity_id=${dossierId}&category=legal`}>Carica documento dossier</Link></Button></CardContent></Card>;
}

export function DossierActivityList({ rows }: { rows: PaperworkActivity[] }) {
  return <Card><CardHeader><CardTitle>Activity dossier</CardTitle></CardHeader><CardContent className="space-y-3">{rows.length === 0 ? <Empty>Nessuna attivita registrata.</Empty> : rows.map((row) => <div key={row.id} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{row.action.replace(/_/g, " ")}</p><p className="text-muted-foreground">{formatDateTime(row.created_at)} · {row.actor_user_id || "sistema"}</p></div>)}</CardContent></Card>;
}

function InputField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <div className="grid gap-2"><Label>{label}</Label><Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} /></div>;
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div className="grid gap-2"><Label>{label}</Label><Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} /></div>;
}
