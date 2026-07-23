"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, Download, FileJson, FileText, Loader2, Plus, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
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
import { contractsApi, type Contract, type ContractActivity, type ContractChecklistItem, type ContractSigner, type ContractTemplate, type ContractVersion } from "@/lib/tenant-contracts-api";
import { paperworkApi } from "@/lib/tenant-paperwork-api";
import {
  CHECKLIST_CATEGORIES, CHECKLIST_STATUSES, CONTRACT_STATUSES, CONTRACT_TYPES, PRIORITIES,
  SIGNATURE_STATUSES, SIGNER_STATUSES, SIGNER_TYPES, VERSION_STATUSES, badgeClass,
  canAdminTemplates, canManageAdminWorkflow, canViewFinanceValues, downloadJson, formatDate,
  formatDateTime, labelFor, money, toBody,
} from "./contract-utils";
import { ContractsSummaryCards } from "./contracts-summary-cards";

type Row = Record<string, any>;
type Option = { value: string; label: string };

function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

function StateBadge({ value, options }: { value?: string | null; options: Option[] }) {
  return <Badge variant="outline" className={badgeClass(value)}>{labelFor(value, options)}</Badge>;
}

function SelectField({ value, options, placeholder, onChange }: { value?: string; options: Option[]; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || "__none__"} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{placeholder}</SelectItem>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Header({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function ContractsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<Contract[]>([]);
  const [filters, setFilters] = useState({ search: "", status: "", signature_status: "", contract_type: "", priority: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, listData] = await Promise.all([
        contractsApi.summary().catch(() => null),
        contractsApi.list({ ...filters, limit: 100 }),
      ]);
      setSummary(summaryData);
      setRows(listData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento contratti");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Contratti" description="Contratti, stati firma, checklist documentale e collegamenti amministrativi interni.">
        <Button asChild><Link href="/contracts/new"><Plus className="mr-2 h-4 w-4" /> Nuovo contratto</Link></Button>
        <Button asChild variant="outline"><Link href="/contracts/templates">Template</Link></Button>
        <Button asChild variant="outline"><Link href="/paperwork">Scartoffie</Link></Button>
      </Header>
      <ErrorBox error={error} />
      <ContractsSummaryCards summary={summary} />
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Cerca contratto..." value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></div>
          <SelectField value={filters.status} options={CONTRACT_STATUSES} placeholder="Tutti gli status" onChange={(value) => setFilters((p) => ({ ...p, status: value }))} />
          <SelectField value={filters.signature_status} options={SIGNATURE_STATUSES} placeholder="Firma" onChange={(value) => setFilters((p) => ({ ...p, signature_status: value }))} />
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Filtra</Button>
        </CardContent>
      </Card>
      {loading ? <Loading /> : <ContractsList rows={rows} />}
    </div>
  );
}

export function ContractsList({ rows }: { rows: Contract[] }) {
  const canFinance = canViewFinanceValues();
  if (rows.length === 0) return <Empty>Nessun contratto presente.</Empty>;
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[960px] text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">{["Numero", "Titolo", "Status", "Firma", "Tipo", "Priorita", "Scadenza", "Rinnovo", ...(canFinance ? ["Importo"] : []), "Azioni"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{row.contract_number}</td>
                <td className="px-4 py-3 font-medium">{row.title}</td>
                <td className="px-4 py-3"><StateBadge value={row.status} options={CONTRACT_STATUSES} /></td>
                <td className="px-4 py-3"><StateBadge value={row.signature_status} options={SIGNATURE_STATUSES} /></td>
                <td className="px-4 py-3">{labelFor(row.contract_type, CONTRACT_TYPES)}</td>
                <td className="px-4 py-3"><StateBadge value={row.priority} options={PRIORITIES} /></td>
                <td className="px-4 py-3">{formatDate(row.due_date)}</td>
                <td className="px-4 py-3">{formatDate(row.renewal_date)}</td>
                {canFinance ? <td className="px-4 py-3">{row.amount == null ? "-" : money(row.amount, row.currency || "EUR")}</td> : null}
                <td className="px-4 py-3"><Button asChild size="sm" variant="outline"><Link href={`/contracts/${row.id}`}>Apri</Link></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function ContractFormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const canFinance = canViewFinanceValues();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ title: "", contract_type: "generic", status: "draft", signature_status: "not_started", priority: "medium", currency: "EUR" });

  useEffect(() => { contractsApi.listTemplates({ limit: 100 }).then((r) => setTemplates(r.items || [])).catch(() => undefined); }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const created = await contractsApi.create(toBody(form));
      toast({ title: "Contratto creato" });
      router.push(`/contracts/${created.id}`);
    } catch (err) {
      toast({ title: "Contratto non creato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Nuovo contratto" description="Crea una bozza contrattuale interna tenant-scoped."><Button asChild variant="outline"><Link href="/contracts">Torna</Link></Button></Header>
      <ContractForm form={form} setForm={setForm} templates={templates} canFinance={canFinance} />
      <Button onClick={submit} disabled={saving || !form.title}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Crea contratto</Button>
    </div>
  );
}

export function ContractForm({ form, setForm, templates, canFinance }: { form: Record<string, any>; setForm: (fn: any) => void; templates: ContractTemplate[]; canFinance: boolean }) {
  const set = (key: string, value: unknown) => setForm((p: any) => ({ ...p, [key]: value }));
  return (
    <Card><CardContent className="grid gap-4 p-4 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Titolo</Label><Input value={form.title || ""} onChange={(e) => set("title", e.target.value)} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Descrizione</Label><Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} /></div>
      <div className="grid gap-2"><Label>Template</Label><SelectField value={form.template_id} options={templates.map((t) => ({ value: t.id, label: t.name }))} placeholder="Nessun template" onChange={(v) => set("template_id", v)} /></div>
      <div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.contract_type} options={CONTRACT_TYPES} placeholder="Tipo" onChange={(v) => set("contract_type", v)} /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={CONTRACT_STATUSES} placeholder="Status" onChange={(v) => set("status", v)} /></div>
      <div className="grid gap-2"><Label>Firma</Label><SelectField value={form.signature_status} options={SIGNATURE_STATUSES} placeholder="Firma" onChange={(v) => set("signature_status", v)} /></div>
      <div className="grid gap-2"><Label>Priorita</Label><SelectField value={form.priority} options={PRIORITIES} placeholder="Priorita" onChange={(v) => set("priority", v)} /></div>
      <div className="grid gap-2"><Label>Due date</Label><Input type="date" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></div>
      <div className="grid gap-2"><Label>Start date</Label><Input type="date" value={form.start_date || ""} onChange={(e) => set("start_date", e.target.value)} /></div>
      <div className="grid gap-2"><Label>End date</Label><Input type="date" value={form.end_date || ""} onChange={(e) => set("end_date", e.target.value)} /></div>
      <div className="grid gap-2"><Label>Renewal date</Label><Input type="date" value={form.renewal_date || ""} onChange={(e) => set("renewal_date", e.target.value)} /></div>
      {["company_id", "contact_id", "quote_id", "project_id", "opportunity_id"].map((field) => <div key={field} className="grid gap-2"><Label>{field}</Label><Input value={form[field] || ""} onChange={(e) => set(field, e.target.value)} placeholder="UUID opzionale" /></div>)}
      {canFinance ? <>
        <div className="grid gap-2"><Label>Importo</Label><Input type="number" value={form.amount || ""} onChange={(e) => set("amount", e.target.value)} /></div>
        <div className="grid gap-2"><Label>Currency</Label><Input value={form.currency || "EUR"} onChange={(e) => set("currency", e.target.value)} /></div>
        <div className="grid gap-2 md:col-span-2"><Label>Termini pagamento</Label><Textarea value={form.payment_terms || ""} onChange={(e) => set("payment_terms", e.target.value)} /></div>
        <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => set("internal_notes", e.target.value)} /></div>
      </> : null}
      <div className="grid gap-2 md:col-span-2"><Label>Note pubbliche</Label><Textarea value={form.public_notes || ""} onChange={(e) => set("public_notes", e.target.value)} /></div>
    </CardContent></Card>
  );
}

export function ContractDetailPage({ contractId }: { contractId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const canFinance = canViewFinanceValues();
  const canManage = canManageAdminWorkflow();
  const [contract, setContract] = useState<Contract | null>(null);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [signers, setSigners] = useState<ContractSigner[]>([]);
  const [checklist, setChecklist] = useState<ContractChecklistItem[]>([]);
  const [activity, setActivity] = useState<ContractActivity[]>([]);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractData, versionData, signerData, checklistData, activityData, documentData] = await Promise.all([
        contractsApi.get(contractId),
        contractsApi.versions(contractId).catch(() => ({ items: [] })),
        contractsApi.signers(contractId).catch(() => ({ items: [] })),
        contractsApi.checklist(contractId).catch(() => ({ items: [] })),
        contractsApi.activity(contractId).catch(() => ({ items: [] })),
        listDocumentsForEntity("contract", contractId, { limit: 10 }).catch(() => ({ items: [] })),
      ]);
      setContract(contractData);
      setVersions(versionData.items || []);
      setSigners(signerData.items || []);
      setChecklist(checklistData.items || []);
      setActivity(activityData.items || []);
      setDocuments(documentData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento contratto");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [contractId]);

  const createDossier = async () => {
    if (!contract) return;
    try {
      const dossier = await paperworkApi.fromContract(contract.id);
      toast({ title: "Dossier creato", description: "Apro il dossier amministrativo collegato." });
      router.push(`/paperwork/dossiers/${dossier.id}`);
    } catch (err) {
      toast({ title: "Dossier non creato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const exportJson = async () => {
    if (!contract) return;
    const data = await contractsApi.export(contract.id);
    downloadJson(`contract-${contract.contract_number || contract.id}.json`, data);
  };
  if (loading) return <div className="flex-1 p-4 md:p-6"><Loading /></div>;
  if (error || !contract) return <div className="flex-1 p-4 md:p-6"><ErrorBox error={error || "Contratto non trovato"} /></div>;
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title={contract.title} description={`${contract.contract_number} · ${labelFor(contract.contract_type, CONTRACT_TYPES)}`}>
        <Button asChild variant="outline"><Link href="/contracts">Lista</Link></Button>
        <Button variant="outline" onClick={exportJson}><Download className="mr-2 h-4 w-4" /> Export JSON</Button>
        {canManage ? <Button variant="outline" onClick={createDossier}><FileText className="mr-2 h-4 w-4" /> Crea dossier</Button> : null}
      </Header>
      <div className="flex flex-wrap gap-2"><StateBadge value={contract.status} options={CONTRACT_STATUSES} /><StateBadge value={contract.signature_status} options={SIGNATURE_STATUSES} /><StateBadge value={contract.priority} options={PRIORITIES} /></div>
      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="versions">Versioni</TabsTrigger><TabsTrigger value="signers">Firmatari</TabsTrigger><TabsTrigger value="checklist">Checklist</TabsTrigger><TabsTrigger value="documents">Documenti</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><ContractOverview contract={contract} canFinance={canFinance} onReload={load} /></TabsContent>
        <TabsContent value="versions"><ContractVersions contractId={contract.id} rows={versions} onReload={load} /></TabsContent>
        <TabsContent value="signers"><ContractSigners contractId={contract.id} rows={signers} onReload={load} /></TabsContent>
        <TabsContent value="checklist"><ContractChecklist contractId={contract.id} rows={checklist} onReload={load} /></TabsContent>
        <TabsContent value="documents"><ContractDocuments contractId={contract.id} rows={documents} /></TabsContent>
        <TabsContent value="activity"><ContractActivityList rows={activity} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ContractOverview({ contract, canFinance, onReload }: { contract: Contract; canFinance: boolean; onReload: () => void }) {
  return (
    <Card><CardContent className="grid gap-4 p-4 md:grid-cols-2">
      <Info label="Descrizione" value={contract.description || "-"} wide />
      <Info label="Company ID" value={contract.company_id || "-"} />
      <Info label="Contact ID" value={contract.contact_id || "-"} />
      <Info label="Quote ID" value={contract.quote_id || "-"} href={contract.quote_id ? `/quotes` : undefined} />
      <Info label="Project ID" value={contract.project_id || "-"} href={contract.project_id ? `/projects/${contract.project_id}` : undefined} />
      <Info label="Due date" value={formatDate(contract.due_date)} />
      <Info label="Rinnovo" value={formatDate(contract.renewal_date)} />
      <Info label="Inizio" value={formatDate(contract.start_date)} />
      <Info label="Fine" value={formatDate(contract.end_date)} />
      {canFinance ? <><Info label="Importo" value={contract.amount == null ? "-" : money(contract.amount, contract.currency || "EUR")} /><Info label="Termini pagamento" value={contract.payment_terms || "-"} /><Info label="Note interne" value={contract.internal_notes || "-"} wide /></> : null}
      <Info label="Note pubbliche" value={contract.public_notes || "-"} wide />
      <div className="md:col-span-2"><ContractStatusActions contract={contract} onReload={onReload} /></div>
    </CardContent></Card>
  );
}

function Info({ label, value, href, wide }: { label: string; value: ReactNode; href?: string; wide?: boolean }) {
  const content = href ? <Link className="text-primary hover:underline" href={href}>{value}</Link> : value;
  return <div className={wide ? "md:col-span-2" : ""}><p className="text-xs font-semibold text-muted-foreground">{label}</p><div className="mt-1 text-sm">{content}</div></div>;
}

export function ContractStatusActions({ contract, onReload }: { contract: Contract; onReload: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const setStatus = async (status: string) => {
    setBusy(true);
    try { await contractsApi.setStatus(contract.id, status); toast({ title: "Status aggiornato" }); onReload(); }
    catch (err) { toast({ title: "Status non aggiornato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" }); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap gap-2">{CONTRACT_STATUSES.map((s) => <Button key={s.value} size="sm" variant={contract.status === s.value ? "default" : "outline"} disabled={busy} onClick={() => setStatus(s.value)}>{s.label}</Button>)}</div>;
}

export function ContractVersions({ contractId, rows, onReload }: { contractId: string; rows: ContractVersion[]; onReload: () => void }) {
  const [open, setOpen] = useState(false);
  return <CrudPanel title="Versioni" empty="Nessuna versione." onCreate={() => setOpen(true)}>
    <div className="grid gap-3">{rows.map((row) => <Card key={row.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">v{row.version_number} · {row.title}</p><p className="text-sm text-muted-foreground">{labelFor(row.status, VERSION_STATUSES)} · {formatDateTime(row.created_at)}</p></div><StateBadge value={row.status} options={VERSION_STATUSES} /></div><pre className="mt-3 max-h-44 overflow-auto rounded bg-muted/50 p-3 text-xs whitespace-pre-wrap">{row.body_markdown}</pre></CardContent></Card>)}</div>
    <SimpleCreateDialog open={open} setOpen={setOpen} title="Nuova versione" fields={["title", "body_markdown", "change_note"]} select={{ status: VERSION_STATUSES }} onSave={async (body) => { await contractsApi.createVersion(contractId, body); onReload(); }} />
  </CrudPanel>;
}

export function ContractSigners({ contractId, rows, onReload }: { contractId: string; rows: ContractSigner[]; onReload: () => void }) {
  const [open, setOpen] = useState(false);
  return <CrudPanel title="Firmatari" empty="Nessun firmatario." onCreate={() => setOpen(true)}>
    <div className="grid gap-3 md:grid-cols-2">{rows.map((row) => <Card key={row.id}><CardContent className="space-y-2 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.name}</p><p className="text-sm text-muted-foreground">{row.email || "-"} · {labelFor(row.signer_type, SIGNER_TYPES)}</p></div><StateBadge value={row.status} options={SIGNER_STATUSES} /></div><SignerQuickStatus contractId={contractId} row={row} onReload={onReload} /></CardContent></Card>)}</div>
    <SimpleCreateDialog open={open} setOpen={setOpen} title="Nuovo firmatario" fields={["name", "email", "role_title", "notes"]} select={{ signer_type: SIGNER_TYPES, status: SIGNER_STATUSES }} onSave={async (body) => { await contractsApi.createSigner(contractId, body); onReload(); }} />
  </CrudPanel>;
}

function SignerQuickStatus({ contractId, row, onReload }: { contractId: string; row: ContractSigner; onReload: () => void }) {
  return <div className="flex flex-wrap gap-2">{["viewed", "signed", "declined", "not_required"].map((status) => <Button key={status} size="sm" variant="outline" onClick={async () => { await contractsApi.updateSigner(contractId, row.id, { status }); onReload(); }}>{labelFor(status, SIGNER_STATUSES)}</Button>)}</div>;
}

export function ContractChecklist({ contractId, rows, onReload }: { contractId: string; rows: ContractChecklistItem[]; onReload: () => void }) {
  const [open, setOpen] = useState(false);
  return <CrudPanel title="Checklist" empty="Nessun item checklist." onCreate={() => setOpen(true)}>
    <div className="grid gap-3">{rows.map((row) => <Card key={row.id}><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{row.title}</p><p className="text-sm text-muted-foreground">{labelFor(row.category, CHECKLIST_CATEGORIES)} · scadenza {formatDate(row.due_date)} {row.linked_document_id ? `· doc ${row.linked_document_id}` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><StateBadge value={row.status} options={CHECKLIST_STATUSES} /><Button size="sm" variant="outline" onClick={async () => { await contractsApi.completeChecklistItem(contractId, row.id); onReload(); }}>Completa</Button><Button size="sm" variant="outline" onClick={async () => { await contractsApi.approveChecklistItem(contractId, row.id); onReload(); }}>Approva</Button><Button size="sm" variant="outline" onClick={async () => { await contractsApi.rejectChecklistItem(contractId, row.id); onReload(); }}>Rifiuta</Button></div></CardContent></Card>)}</div>
    <SimpleCreateDialog open={open} setOpen={setOpen} title="Nuovo item" fields={["title", "description", "due_date", "linked_document_id", "notes"]} select={{ category: CHECKLIST_CATEGORIES, status: CHECKLIST_STATUSES }} onSave={async (body) => { await contractsApi.createChecklistItem(contractId, body); onReload(); }} />
  </CrudPanel>;
}

export function ContractDocuments({ contractId, rows }: { contractId: string; rows: TenantDocument[] }) {
  return <Card><CardHeader><CardTitle>Documenti contratto</CardTitle><CardDescription>Allegati collegati al contratto dal modulo Documenti.</CardDescription></CardHeader><CardContent className="space-y-3">{rows.length === 0 ? <Empty>Nessun documento collegato.</Empty> : rows.map((doc) => <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><p className="font-semibold">{doc.title || doc.original_filename}</p><p className="text-muted-foreground">{doc.category} · {formatDateTime(doc.created_at)}</p></div><Button asChild size="sm" variant="outline"><Link href={`/documents/${doc.id}`}>Apri</Link></Button></div>)}<Button asChild variant="outline"><Link href={`/documents/upload?entity_type=contract&entity_id=${contractId}&category=contract`}>Carica documento contratto</Link></Button></CardContent></Card>;
}

export function ContractActivityList({ rows }: { rows: ContractActivity[] }) {
  return <Card><CardHeader><CardTitle>Activity contratto</CardTitle></CardHeader><CardContent className="space-y-3">{rows.length === 0 ? <Empty>Nessuna attivita registrata.</Empty> : rows.map((row) => <div key={row.id} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{row.action.replace(/_/g, " ")}</p><p className="text-muted-foreground">{formatDateTime(row.created_at)} · {row.actor_user_id || "sistema"}</p></div>)}</CardContent></Card>;
}

function CrudPanel({ title, empty, onCreate, children }: { title: string; empty: string; onCreate: () => void; children: ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>{title}</CardTitle><CardDescription>{empty}</CardDescription></div><Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" /> Nuovo</Button></CardHeader><CardContent>{children}</CardContent></Card>;
}

function SimpleCreateDialog({ open, setOpen, title, fields, select, onSave }: { open: boolean; setOpen: (v: boolean) => void; title: string; fields: string[]; select?: Record<string, Option[]>; onSave: (body: Record<string, any>) => Promise<void> }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>({});
  const save = async () => { try { await onSave(toBody(form)); setForm({}); setOpen(false); toast({ title: "Salvato" }); } catch (err) { toast({ title: "Errore", description: err instanceof Error ? err.message : "Operazione non riuscita", variant: "destructive" }); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="grid gap-3">{Object.entries(select || {}).map(([key, options]) => <div key={key} className="grid gap-2"><Label>{key}</Label><SelectField value={form[key]} options={options} placeholder={key} onChange={(v) => setForm((p) => ({ ...p, [key]: v }))} /></div>)}{fields.map((field) => <div key={field} className="grid gap-2"><Label>{field}</Label>{field.includes("body") || field.includes("note") || field === "description" ? <Textarea value={form[field] || ""} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} /> : <Input type={field.includes("date") ? "date" : "text"} value={form[field] || ""} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} />}</div>)}<Button onClick={save}>Salva</Button></div></DialogContent></Dialog>;
}

export function ContractTemplatesPage({ templateId, createMode = false }: { templateId?: string; createMode?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const canAdmin = canAdminTemplates();
  const [rows, setRows] = useState<ContractTemplate[]>([]);
  const [selected, setSelected] = useState<ContractTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const data = await contractsApi.listTemplates({ limit: 100 });
    setRows(data.items || []);
    if (templateId) setSelected(await contractsApi.getTemplate(templateId));
    setLoading(false);
  };
  useEffect(() => { void load(); }, [templateId]);
  const seed = async () => { await contractsApi.seedTemplates(); toast({ title: "Template base sincronizzati" }); await load(); };
  if (createMode) return <TemplateEditor onSave={async (body) => { const created = await contractsApi.createTemplate(body); router.push(`/contracts/templates/${created.id}`); }} />;
  if (templateId && selected) return <TemplateEditor template={selected} onSave={async (body) => { await contractsApi.updateTemplate(selected.id, body); toast({ title: "Template aggiornato" }); await load(); }} />;
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Template contratti" description="Template markdown operativi per contratti interni."><Button asChild><Link href="/contracts/templates/new"><Plus className="mr-2 h-4 w-4" /> Nuovo template</Link></Button>{canAdmin ? <Button variant="outline" onClick={seed}>Seed base</Button> : null}</Header>{loading ? <Loading /> : rows.length === 0 ? <Empty>Nessun template contratto.</Empty> : <div className="grid gap-3 md:grid-cols-2">{rows.map((row) => <Card key={row.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.name}</p><p className="text-sm text-muted-foreground">{row.slug} · {labelFor(row.category, CONTRACT_TYPES)}</p></div><Badge variant="outline">{row.is_active ? "Attivo" : "Disattivo"}</Badge></div><Button asChild className="mt-3" size="sm" variant="outline"><Link href={`/contracts/templates/${row.id}`}>Apri</Link></Button></CardContent></Card>)}</div>}</div>;
}

export function TemplateEditor({ template, onSave }: { template?: ContractTemplate; onSave: (body: Record<string, any>) => Promise<void> }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>({
    name: template?.name || "",
    slug: template?.slug || "",
    category: template?.category || "generic",
    description: template?.description || "",
    body_markdown: template?.body_markdown || "",
    variables: JSON.stringify(template?.variables || [], null, 2),
    default_checklist: JSON.stringify(template?.default_checklist || [], null, 2),
    is_active: template?.is_active !== false,
    version_label: template?.version_label || "",
  });
  const save = async () => {
    try {
      await onSave({ ...form, variables: JSON.parse(form.variables || "[]"), default_checklist: JSON.parse(form.default_checklist || "[]") });
    } catch (err) {
      toast({ title: "Template non salvato", description: err instanceof Error ? err.message : "JSON non valido o errore backend", variant: "destructive" });
    }
  };
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title={template ? "Modifica template" : "Nuovo template"} description="Body markdown e variabili operative."><Button asChild variant="outline"><Link href="/contracts/templates">Torna</Link></Button></Header><Card><CardContent className="grid gap-4 p-4 md:grid-cols-2"><InputField label="name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} /><InputField label="slug" value={form.slug} onChange={(v) => setForm((p) => ({ ...p, slug: v }))} /><div className="grid gap-2"><Label>category</Label><SelectField value={form.category} options={CONTRACT_TYPES} placeholder="Categoria" onChange={(v) => setForm((p) => ({ ...p, category: v }))} /></div><InputField label="version_label" value={form.version_label} onChange={(v) => setForm((p) => ({ ...p, version_label: v }))} /><TextField label="description" value={form.description} onChange={(v) => setForm((p) => ({ ...p, description: v }))} /><TextField label="body_markdown" value={form.body_markdown} onChange={(v) => setForm((p) => ({ ...p, body_markdown: v }))} wide /><TextField label="variables JSON" value={form.variables} onChange={(v) => setForm((p) => ({ ...p, variables: v }))} /><TextField label="default_checklist JSON" value={form.default_checklist} onChange={(v) => setForm((p) => ({ ...p, default_checklist: v }))} /></CardContent></Card><Button onClick={save}>Salva template</Button></div>;
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div className="grid gap-2"><Label>{label}</Label><Input value={value || ""} onChange={(e) => onChange(e.target.value)} /></div>;
}
function TextField({ label, value, onChange, wide }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return <div className={wide ? "grid gap-2 md:col-span-2" : "grid gap-2"}><Label>{label}</Label><Textarea className="min-h-32" value={value || ""} onChange={(e) => onChange(e.target.value)} /></div>;
}
