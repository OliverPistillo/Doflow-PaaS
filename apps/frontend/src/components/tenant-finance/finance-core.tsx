"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Banknote, CalendarClock, CheckCircle2, Clock, Edit3,
  FileClock, FileText, Loader2, Plus, Receipt, RefreshCw, Search, Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { getDoFlowUser } from "@/lib/jwt";
import { money, shortDate } from "@/components/tenant-crm/crm-core";
import { useToast } from "@/hooks/use-toast";

type Row = Record<string, any>;
type ListResponse<T = Row> = { items: T[]; total?: number; limit?: number; offset?: number };
type Option = { value: string; label: string };

const INVOICE_TYPES: Option[] = [
  { value: "standard", label: "Standard" },
  { value: "deposit", label: "Acconto" },
  { value: "balance", label: "Saldo" },
  { value: "recurring", label: "Ricorrente" },
  { value: "renewal", label: "Rinnovo" },
  { value: "credit_note", label: "Nota credito" },
  { value: "proforma", label: "Proforma" },
];

const INVOICE_STATUSES: Option[] = [
  { value: "draft", label: "Bozza" },
  { value: "issued", label: "Emessa" },
  { value: "sent", label: "Inviata" },
  { value: "paid", label: "Pagata" },
  { value: "partially_paid", label: "Parz. pagata" },
  { value: "overdue", label: "Scaduta" },
  { value: "cancelled", label: "Annullata" },
  { value: "void", label: "Void" },
];

const PAYMENT_STATUSES: Option[] = [
  { value: "pending", label: "In attesa" },
  { value: "recorded", label: "Registrato" },
  { value: "confirmed", label: "Confermato" },
  { value: "failed", label: "Fallito" },
  { value: "refunded", label: "Rimborsato" },
  { value: "cancelled", label: "Annullato" },
];

const PAYMENT_METHODS: Option[] = [
  { value: "bank_transfer", label: "Bonifico" },
  { value: "cash", label: "Contanti" },
  { value: "card", label: "Carta" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Altro" },
];

const DEADLINE_TYPES: Option[] = [
  { value: "deposit", label: "Acconto" },
  { value: "balance", label: "Saldo" },
  { value: "invoice_due", label: "Scadenza fattura" },
  { value: "renewal", label: "Rinnovo" },
  { value: "recurring_fee", label: "Canone ricorrente" },
  { value: "payment", label: "Pagamento" },
  { value: "other", label: "Altro" },
];

const DEADLINE_STATUSES: Option[] = [
  { value: "open", label: "Aperta" },
  { value: "completed", label: "Completata" },
  { value: "overdue", label: "Scaduta" },
  { value: "cancelled", label: "Annullata" },
];

const RECURRING_STATUSES: Option[] = [
  { value: "active", label: "Attivo" },
  { value: "paused", label: "In pausa" },
  { value: "cancelled", label: "Annullato" },
  { value: "expired", label: "Scaduto" },
];

const BILLING_CYCLES: Option[] = [
  { value: "monthly", label: "Mensile" },
  { value: "quarterly", label: "Trimestrale" },
  { value: "yearly", label: "Annuale" },
  { value: "one_time", label: "Una tantum" },
];

const RENEWAL_STATUSES: Option[] = [
  { value: "upcoming", label: "In arrivo" },
  { value: "reminded", label: "Promemoria inviato" },
  { value: "invoiced", label: "Fatturato" },
  { value: "paid", label: "Pagato" },
  { value: "cancelled", label: "Annullato" },
  { value: "expired", label: "Scaduto" },
];

const PROJECT_PAYMENT_STATUSES: Option[] = [
  { value: "not_started", label: "Non avviato" },
  { value: "deposit_due", label: "Acconto da richiedere" },
  { value: "deposit_paid", label: "Acconto incassato" },
  { value: "partially_paid", label: "Parziale" },
  { value: "paid", label: "Pagato" },
  { value: "overdue", label: "Scaduto" },
];

function canViewFinance() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "superadmin", "super_admin"].includes(role);
}

export function canUseFinanceFrontend() {
  return canViewFinance();
}

function labelFor(value: string | undefined, options: Option[]) {
  return options.find((option) => option.value === value)?.label || value || "-";
}

function toBody(form: Record<string, any>) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "" && value !== undefined));
}

async function loadList(path: string, params?: URLSearchParams) {
  const query = params?.toString();
  return apiFetch<ListResponse>(`${path}${query ? `?${query}` : ""}`);
}

function AccessDenied() {
  return (
    <div className="flex-1 p-4 md:p-6">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Finance riservato</CardTitle>
          <CardDescription>Fatture, pagamenti, scadenze economiche e report sono visibili solo a CEO/Admin.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">{children}</div>;
}

function StateBadge({ value, options }: { value?: string; options: Option[] }) {
  const tone = value === "overdue" || value === "failed"
    ? "border-destructive/30 text-destructive"
    : value === "paid" || value === "completed" || value === "confirmed" || value === "active"
      ? "border-emerald-500/30 text-emerald-600"
      : value === "draft" || value === "pending" || value === "upcoming"
        ? "border-border text-muted-foreground"
        : "border-primary/30 text-primary";
  return <Badge variant="outline" className={tone}>{labelFor(value, options)}</Badge>;
}

function SelectField({
  value,
  options,
  placeholder,
  onChange,
}: {
  value?: string;
  options: Option[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
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

function RelationSelect({
  value,
  rows,
  placeholder,
  onChange,
}: {
  value?: string;
  rows: Row[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || "__none__"} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{placeholder}</SelectItem>
        {rows.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.invoice_number || row.quote_number || row.name || row.title || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function useFinanceRelations() {
  const [relations, setRelations] = useState<Record<string, Row[]>>({
    companies: [],
    contacts: [],
    quotes: [],
    projects: [],
    invoices: [],
    recurringServices: [],
  });

  const load = async () => {
    const [companies, contacts, quotes, projects, invoices, recurringServices] = await Promise.all([
      loadList("/tenant/crm/companies?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/crm/contacts?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/quotes?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/projects?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/finance/invoices?limit=100").catch(() => ({ items: [] })),
      loadList("/tenant/finance/recurring-services?limit=100").catch(() => ({ items: [] })),
    ]);
    setRelations({
      companies: companies.items || [],
      contacts: contacts.items || [],
      quotes: quotes.items || [],
      projects: projects.items || [],
      invoices: invoices.items || [],
      recurringServices: recurringServices.items || [],
    });
  };

  useEffect(() => {
    if (canViewFinance()) void load();
  }, []);

  return { relations, reloadRelations: load };
}

function FinanceHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
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

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: ReactNode; icon: any; tone?: "danger" | "success" | "warning" }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className={["mt-1 text-xl font-bold tabular-nums", tone === "danger" ? "text-destructive" : tone === "success" ? "text-emerald-600" : tone === "warning" ? "text-chart-5" : ""].filter(Boolean).join(" ")}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinanceDashboardPage() {
  const [summary, setSummary] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await apiFetch<Row>("/tenant/finance/summary"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento finance");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewFinance()) void load();
  }, []);

  if (!canViewFinance()) return <AccessDenied />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <FinanceHeader title="Finance" description="Dashboard economica tenant-scoped riservata a CEO/Admin. Tutti i valori arrivano dal backend Finance V2.">
        <Button asChild><Link href="/finance/invoices/new"><Plus className="mr-2 h-4 w-4" /> Nuova fattura</Link></Button>
        <Button asChild variant="outline"><Link href="/finance/payments">Registra pagamento</Link></Button>
        <Button asChild variant="outline"><Link href="/finance/deadlines">Nuova scadenza</Link></Button>
        <Button asChild variant="outline"><Link href="/finance/recurring-services">Nuovo servizio ricorrente</Link></Button>
        <Button asChild variant="outline"><Link href="/finance/renewals">Vai rinnovi</Link></Button>
      </FinanceHeader>
      <ErrorBox error={error} />
      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>
      ) : summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Fatture totali" value={summary.invoices_total_count || 0} icon={Receipt} />
            <SummaryCard label="Fatture draft" value={summary.invoices_draft_count || 0} icon={FileText} />
            <SummaryCard label="Emesse/Inviate" value={summary.invoices_issued_count || 0} icon={FileClock} />
            <SummaryCard label="Pagate" value={summary.invoices_paid_count || 0} icon={CheckCircle2} tone="success" />
            <SummaryCard label="Scadute" value={summary.invoices_overdue_count || 0} icon={AlertTriangle} tone={(summary.invoices_overdue_count || 0) > 0 ? "danger" : undefined} />
            <SummaryCard label="Totale fatturato" value={money(summary.total_invoiced || 0)} icon={Wallet} />
            <SummaryCard label="Totale incassato" value={money(summary.total_paid || 0)} icon={Banknote} tone="success" />
            <SummaryCard label="Da incassare" value={money(summary.total_outstanding || 0)} icon={Clock} tone={(summary.total_outstanding || 0) > 0 ? "warning" : undefined} />
            <SummaryCard label="Incassi mese" value={money(summary.payments_this_month || 0)} icon={Banknote} />
            <SummaryCard label="Scadenze aperte" value={summary.deadlines_open || 0} icon={CalendarClock} />
            <SummaryCard label="Scadenze scadute" value={summary.deadlines_overdue || 0} icon={AlertTriangle} tone={(summary.deadlines_overdue || 0) > 0 ? "danger" : undefined} />
            <SummaryCard label="Rinnovi 30 giorni" value={summary.renewals_upcoming_30d || 0} icon={RefreshCw} />
            <SummaryCard label="Servizi ricorrenti attivi" value={summary.recurring_active_count || 0} icon={Receipt} />
          </div>
          <Card className="border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Margini e report avanzati restano in arrivo: questa vista mostra solo dati persistenti Finance V2 gia disponibili.
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState>Summary finance non disponibile. Nessun numero viene simulato.</EmptyState>
      )}
    </div>
  );
}

function InvoiceForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.type} options={INVOICE_TYPES} placeholder="Tipo fattura" onChange={(v) => setForm((p) => ({ ...p, type: v }))} /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={INVOICE_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
      <div className="grid gap-2"><Label>Contatto</Label><RelationSelect value={form.contact_id} rows={relations.contacts} placeholder="Nessun contatto" onChange={(v) => setForm((p) => ({ ...p, contact_id: v }))} /></div>
      <div className="grid gap-2"><Label>Preventivo</Label><RelationSelect value={form.quote_id} rows={relations.quotes} placeholder="Nessun preventivo" onChange={(v) => setForm((p) => ({ ...p, quote_id: v }))} /></div>
      <div className="grid gap-2"><Label>Progetto</Label><RelationSelect value={form.project_id} rows={relations.projects} placeholder="Nessun progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <div className="grid gap-2"><Label>Data emissione</Label><Input type="date" value={form.issue_date || ""} onChange={(e) => setForm((p) => ({ ...p, issue_date: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Scadenza</Label><Input type="date" value={form.due_date || ""} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Metodo pagamento</Label><Input value={form.payment_method || ""} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Numero fattura</Label><Input value={form.invoice_number || ""} onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))} placeholder="Opzionale" /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note cliente</Label><Textarea value={form.client_notes || ""} onChange={(e) => setForm((p) => ({ ...p, client_notes: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
    </div>
  );
}

function InvoiceItemsPanel({ invoice, onReload }: { invoice: Row; onReload: () => Promise<void> }) {
  const [form, setForm] = useState<Row>({ name: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 0 });

  const add = async () => {
    await apiFetch(`/tenant/finance/invoices/${invoice.id}/items`, { method: "POST", body: JSON.stringify(toBody(form)) });
    setForm({ name: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 0 });
    await onReload();
  };
  const remove = async (item: Row) => {
    if (!window.confirm("Eliminare questa riga fattura?")) return;
    await apiFetch(`/tenant/finance/invoices/${invoice.id}/items/${item.id}`, { method: "DELETE" });
    await onReload();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 font-semibold">Righe fattura</h3>
        {(invoice.items || []).length === 0 ? <EmptyState>Nessuna riga fattura reale.</EmptyState> : (
          <div className="space-y-2">
            {(invoice.items || []).map((item: Row) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div><p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.description || "Riga fattura"} · qta {item.quantity}</p></div>
                <div className="flex items-center gap-2"><span className="font-semibold">{money(item.total || 0)}</span><Button size="sm" variant="outline" onClick={() => remove(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
        <div className="grid gap-2 md:col-span-3"><Label>Nome riga *</Label><Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
        <div className="grid gap-2 md:col-span-3"><Label>Descrizione</Label><Textarea value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Quantita</Label><Input type="number" value={form.quantity ?? ""} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Prezzo unitario</Label><Input type="number" value={form.unit_price ?? ""} onChange={(e) => setForm((p) => ({ ...p, unit_price: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Sconto</Label><Input type="number" value={form.discount ?? ""} onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>IVA %</Label><Input type="number" value={form.tax_rate ?? ""} onChange={(e) => setForm((p) => ({ ...p, tax_rate: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Ordine</Label><Input type="number" value={form.sort_order ?? ""} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} /></div>
        <div className="flex items-end"><Button onClick={add} disabled={!form.name}><Plus className="mr-2 h-4 w-4" /> Aggiungi riga</Button></div>
      </div>
    </div>
  );
}

export function FinanceInvoicesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { relations, reloadRelations } = useFinanceRelations();
  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});
  const [paymentForm, setPaymentForm] = useState<Row>({ amount: "", status: "recorded", method: "bank_transfer" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all__");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "__all__") params.set("status", status);
      if (dueFrom) params.set("due_from", dueFrom);
      if (dueTo) params.set("due_to", dueTo);
      const data = await loadList("/tenant/finance/invoices", params);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento fatture");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewFinance()) return;
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, dueFrom, dueTo]);

  const loadInvoice = async (row: Row) => {
    const invoice = await apiFetch<Row>(`/tenant/finance/invoices/${row.id}`);
    setSelected(invoice);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      title: row.title || "",
      type: row.type || "standard",
      status: row.status || "draft",
      company_id: row.company_id || "",
      contact_id: row.contact_id || "",
      quote_id: row.quote_id || "",
      project_id: row.project_id || "",
      issue_date: row.issue_date ? String(row.issue_date).slice(0, 10) : "",
      due_date: row.due_date ? String(row.due_date).slice(0, 10) : "",
      payment_method: row.payment_method || "",
      invoice_number: row.invoice_number || "",
      client_notes: row.client_notes || "",
      internal_notes: row.internal_notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await apiFetch(`/tenant/finance/invoices/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(form)) });
    setEditing(null);
    await load();
    await reloadRelations();
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Eliminare questa fattura?")) return;
    await apiFetch(`/tenant/finance/invoices/${row.id}`, { method: "DELETE" });
    await load();
  };

  const updateStatus = async (row: Row, next: string) => {
    await apiFetch(`/tenant/finance/invoices/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    await load();
  };

  const recalculate = async (row: Row) => {
    await apiFetch(`/tenant/finance/invoices/${row.id}/recalculate`, { method: "POST" });
    toast({ title: "Fattura ricalcolata" });
    await load();
    if (selected?.id === row.id) await loadInvoice(row);
  };

  const registerPayment = async (row: Row) => {
    const amount = paymentForm.amount || row.remaining_total || row.total || "";
    await apiFetch(`/tenant/finance/invoices/${row.id}/payments`, {
      method: "POST",
      body: JSON.stringify(toBody({ ...paymentForm, amount })),
    });
    setPaymentForm({ amount: "", status: "recorded", method: "bank_transfer" });
    toast({ title: "Pagamento registrato" });
    await load();
    if (selected?.id === row.id) await loadInvoice(row);
  };

  if (!canViewFinance()) return <AccessDenied />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <FinanceHeader title="Fatture" description="Fatture reali tenant-scoped. Niente PDF/XML/SDI in questa fase.">
        <Button onClick={() => router.push("/finance/invoices/new")}><Plus className="mr-2 h-4 w-4" /> Nuova fattura</Button>
      </FinanceHeader>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_160px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca fatture..." className="pl-9" /></div>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem>{INVOICE_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
            <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </div>
          <ErrorBox error={error} />
          {loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div> : items.length === 0 ? <EmptyState>Nessuna fattura reale trovata.</EmptyState> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Fattura</th><th className="px-4 py-3">Cliente/Progetto</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Emissione</th><th className="px-4 py-3">Scadenza</th><th className="px-4 py-3">Totale</th><th className="px-4 py-3">Incassato</th><th className="px-4 py-3">Residuo</th><th className="px-4 py-3 text-right">Azioni</th></tr></thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3"><button className="font-semibold text-primary hover:underline" onClick={() => loadInvoice(row)}>{row.invoice_number || "Senza numero"}</button><p className="text-xs text-muted-foreground">{row.title}</p></td>
                      <td className="px-4 py-3">{row.company_name || row.project_name || "-"}</td>
                      <td className="px-4 py-3"><StateBadge value={row.status} options={INVOICE_STATUSES} /></td>
                      <td className="px-4 py-3">{shortDate(row.issue_date)}</td>
                      <td className="px-4 py-3">{shortDate(row.due_date)}</td>
                      <td className="px-4 py-3 font-semibold">{money(row.total || 0)}</td>
                      <td className="px-4 py-3">{money(row.paid_total || 0)}</td>
                      <td className="px-4 py-3">{money(row.remaining_total || 0)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Edit3 className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => recalculate(row)}><RefreshCw className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => registerPayment(row)}>Pagamento</Button>
                          <Select value={row.status || "draft"} onValueChange={(next) => updateStatus(row, next)}><SelectTrigger className="h-8 w-[145px]"><SelectValue /></SelectTrigger><SelectContent>{INVOICE_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                          <Button size="sm" variant="outline" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader><DialogTitle>{selected?.invoice_number || selected?.title}</DialogTitle><DialogDescription>{selected?.company_name || selected?.project_name || "Fattura tenant"}</DialogDescription></DialogHeader>
          {selected ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <SummaryCard label="Totale" value={money(selected.total || 0)} icon={Receipt} />
                <SummaryCard label="Incassato" value={money(selected.paid_total || 0)} icon={Banknote} tone="success" />
                <SummaryCard label="Residuo" value={money(selected.remaining_total || 0)} icon={Clock} />
                <SummaryCard label="Status" value={labelFor(selected.status, INVOICE_STATUSES)} icon={FileClock} />
              </div>
              <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_180px_180px_auto]">
                <Input type="number" value={paymentForm.amount || ""} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))} placeholder={`Importo ${selected.remaining_total ? money(selected.remaining_total) : ""}`} />
                <SelectField value={paymentForm.method} options={PAYMENT_METHODS} placeholder="Metodo" onChange={(v) => setPaymentForm((p) => ({ ...p, method: v }))} />
                <Input type="date" value={paymentForm.payment_date || ""} onChange={(e) => setPaymentForm((p) => ({ ...p, payment_date: e.target.value }))} />
                <Button onClick={() => registerPayment(selected)}>Registra pagamento</Button>
              </div>
              <InvoiceItemsPanel invoice={selected} onReload={() => loadInvoice(selected)} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Modifica fattura</DialogTitle></DialogHeader>
          <InvoiceForm form={form} setForm={setForm} relations={relations} />
          <DialogFooter><Button onClick={saveEdit} disabled={!form.title}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FinanceInvoiceCreatePage() {
  const router = useRouter();
  const { relations } = useFinanceRelations();
  const [form, setForm] = useState<Row>({ title: "", type: "standard", status: "draft", currency: "EUR" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const invoice = await apiFetch<Row>("/tenant/finance/invoices", { method: "POST", body: JSON.stringify(toBody(form)) });
      router.push("/finance/invoices");
      if (invoice?.id) window.setTimeout(() => router.refresh(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione fattura");
    } finally {
      setSaving(false);
    }
  };

  if (!canViewFinance()) return <AccessDenied />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <FinanceHeader title="Nuova fattura" description="Crea una fattura draft. Le righe si aggiungono dalla lista fatture dopo la creazione." />
      <Card><CardContent className="space-y-4 pt-6"><ErrorBox error={error} /><InvoiceForm form={form} setForm={setForm} relations={relations} /><div className="flex gap-2"><Button onClick={save} disabled={saving || !form.title}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Crea fattura</Button><Button variant="outline" onClick={() => router.push("/finance/invoices")}>Annulla</Button></div></CardContent></Card>
    </div>
  );
}

function PaymentForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2"><Label>Fattura</Label><RelationSelect value={form.invoice_id} rows={relations.invoices} placeholder="Nessuna fattura" onChange={(v) => setForm((p) => ({ ...p, invoice_id: v }))} /></div>
      <div className="grid gap-2"><Label>Progetto</Label><RelationSelect value={form.project_id} rows={relations.projects} placeholder="Nessun progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
      <div className="grid gap-2"><Label>Importo *</Label><Input type="number" value={form.amount || ""} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={PAYMENT_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Metodo</Label><SelectField value={form.method} options={PAYMENT_METHODS} placeholder="Metodo" onChange={(v) => setForm((p) => ({ ...p, method: v }))} /></div>
      <div className="grid gap-2"><Label>Data pagamento</Label><Input type="date" value={form.payment_date || ""} onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Riferimento</Label><Input value={form.reference || ""} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note</Label><Textarea value={form.notes || ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
    </div>
  );
}

export function FinancePaymentsPage() {
  const { relations } = useFinanceRelations();
  return (
    <FinanceCrudPage
      title="Pagamenti"
      description="Pagamenti reali registrati su fatture, aziende o progetti."
      path="/tenant/finance/payments"
      searchPlaceholder="Cerca pagamenti..."
      statusOptions={PAYMENT_STATUSES}
      columns={[
        ["invoice_number", "Fattura", (row) => row.invoice_number || row.invoice_title || "-"],
        ["company_name", "Cliente/Progetto", (row) => row.company_name || row.project_name || "-"],
        ["amount", "Importo", (row) => money(row.amount || 0)],
        ["status", "Status", (row) => <StateBadge value={row.status} options={PAYMENT_STATUSES} />],
        ["payment_date", "Data", (row) => shortDate(row.payment_date)],
        ["method", "Metodo", (row) => labelFor(row.method, PAYMENT_METHODS)],
        ["reference", "Riferimento"],
      ]}
      initialForm={{ amount: "", status: "recorded", method: "bank_transfer" }}
      renderForm={(form, setForm) => <PaymentForm form={form} setForm={setForm} relations={relations} />}
      canSave={(form) => Boolean(form.amount)}
      emptyText="Nessun pagamento reale registrato."
    />
  );
}

function DeadlineForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Tipo</Label><SelectField value={form.type} options={DEADLINE_TYPES} placeholder="Tipo" onChange={(v) => setForm((p) => ({ ...p, type: v }))} /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={DEADLINE_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Importo</Label><Input type="number" value={form.amount || ""} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Scadenza *</Label><Input type="date" value={form.due_date || ""} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
      <div className="grid gap-2"><Label>Progetto</Label><RelationSelect value={form.project_id} rows={relations.projects} placeholder="Nessun progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <div className="grid gap-2"><Label>Fattura</Label><RelationSelect value={form.invoice_id} rows={relations.invoices} placeholder="Nessuna fattura" onChange={(v) => setForm((p) => ({ ...p, invoice_id: v }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note</Label><Textarea value={form.notes || ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
    </div>
  );
}

export function FinanceDeadlinesPage() {
  const { relations } = useFinanceRelations();
  return (
    <FinanceCrudPage
      title="Scadenze economiche"
      description="Scadenze di acconti, saldi, fatture e rinnovi."
      path="/tenant/finance/deadlines"
      searchPlaceholder="Cerca scadenze..."
      statusOptions={DEADLINE_STATUSES}
      columns={[
        ["title", "Titolo"],
        ["type", "Tipo", (row) => labelFor(row.type, DEADLINE_TYPES)],
        ["amount", "Importo", (row) => row.amount ? money(row.amount) : "-"],
        ["due_date", "Scadenza", (row) => shortDate(row.due_date)],
        ["status", "Status", (row) => <StateBadge value={row.status} options={DEADLINE_STATUSES} />],
      ]}
      initialForm={{ title: "", type: "payment", status: "open" }}
      renderForm={(form, setForm) => <DeadlineForm form={form} setForm={setForm} relations={relations} />}
      canSave={(form) => Boolean(form.title && form.due_date)}
      emptyText="Nessuna scadenza economica reale."
      extraAction={(row, reload) => row.status !== "completed" ? <Button size="sm" variant="outline" onClick={async () => { await apiFetch(`/tenant/finance/deadlines/${row.id}/complete`, { method: "PATCH" }); await reload(); }}>Completa</Button> : null}
    />
  );
}

function RecurringForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Nome *</Label><Input value={form.name || ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Categoria</Label><Input value={form.category || ""} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="hosting, maintenance, seo..." /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={RECURRING_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Ciclo</Label><SelectField value={form.billing_cycle} options={BILLING_CYCLES} placeholder="Ciclo" onChange={(v) => setForm((p) => ({ ...p, billing_cycle: v }))} /></div>
      <div className="grid gap-2"><Label>Importo</Label><Input type="number" value={form.amount || ""} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
      <div className="grid gap-2"><Label>Progetto</Label><RelationSelect value={form.project_id} rows={relations.projects} placeholder="Nessun progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <div className="grid gap-2"><Label>Preventivo</Label><RelationSelect value={form.quote_id} rows={relations.quotes} placeholder="Nessun preventivo" onChange={(v) => setForm((p) => ({ ...p, quote_id: v }))} /></div>
      <div className="grid gap-2"><Label>Inizio</Label><Input type="date" value={form.start_date || ""} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Prossima scadenza</Label><Input type="date" value={form.next_due_date || ""} onChange={(e) => setForm((p) => ({ ...p, next_due_date: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Fine</Label><Input type="date" value={form.end_date || ""} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.auto_renew)} onChange={(e) => setForm((p) => ({ ...p, auto_renew: e.target.checked }))} /> Rinnovo automatico</label>
      <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
    </div>
  );
}

export function FinanceRecurringServicesPage() {
  const { relations } = useFinanceRelations();
  return (
    <FinanceCrudPage
      title="Servizi ricorrenti"
      description="Hosting, manutenzioni, SEO, backup e altri canoni reali."
      path="/tenant/finance/recurring-services"
      searchPlaceholder="Cerca servizi..."
      statusOptions={RECURRING_STATUSES}
      columns={[
        ["name", "Servizio"],
        ["category", "Categoria"],
        ["status", "Status", (row) => <StateBadge value={row.status} options={RECURRING_STATUSES} />],
        ["billing_cycle", "Ciclo", (row) => labelFor(row.billing_cycle, BILLING_CYCLES)],
        ["amount", "Importo", (row) => money(row.amount || 0)],
        ["next_due_date", "Prossima scadenza", (row) => shortDate(row.next_due_date)],
      ]}
      initialForm={{ name: "", status: "active", billing_cycle: "yearly", amount: 0 }}
      renderForm={(form, setForm) => <RecurringForm form={form} setForm={setForm} relations={relations} />}
      canSave={(form) => Boolean(form.name)}
      emptyText="Nessun servizio ricorrente reale."
    />
  );
}

function RenewalForm({ form, setForm, relations }: { form: Row; setForm: (updater: (prev: Row) => Row) => void; relations: Record<string, Row[]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="grid gap-2 md:col-span-2"><Label>Titolo *</Label><Input value={form.title || ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Status</Label><SelectField value={form.status} options={RENEWAL_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, status: v }))} /></div>
      <div className="grid gap-2"><Label>Importo</Label><Input type="number" value={form.amount || ""} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Scadenza *</Label><Input type="date" value={form.due_date || ""} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} /></div>
      <div className="grid gap-2"><Label>Servizio ricorrente</Label><RelationSelect value={form.recurring_service_id} rows={relations.recurringServices} placeholder="Nessun servizio" onChange={(v) => setForm((p) => ({ ...p, recurring_service_id: v }))} /></div>
      <div className="grid gap-2"><Label>Azienda</Label><RelationSelect value={form.company_id} rows={relations.companies} placeholder="Nessuna azienda" onChange={(v) => setForm((p) => ({ ...p, company_id: v }))} /></div>
      <div className="grid gap-2"><Label>Progetto</Label><RelationSelect value={form.project_id} rows={relations.projects} placeholder="Nessun progetto" onChange={(v) => setForm((p) => ({ ...p, project_id: v }))} /></div>
      <div className="grid gap-2"><Label>Fattura</Label><RelationSelect value={form.invoice_id} rows={relations.invoices} placeholder="Nessuna fattura" onChange={(v) => setForm((p) => ({ ...p, invoice_id: v }))} /></div>
      <div className="grid gap-2 md:col-span-2"><Label>Note</Label><Textarea value={form.notes || ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
    </div>
  );
}

export function FinanceRenewalsPage() {
  const { relations } = useFinanceRelations();
  return (
    <FinanceCrudPage
      title="Rinnovi"
      description="Rinnovi legati a servizi ricorrenti, progetti e fatture."
      path="/tenant/finance/renewals"
      searchPlaceholder="Cerca rinnovi..."
      statusOptions={RENEWAL_STATUSES}
      columns={[
        ["title", "Titolo"],
        ["status", "Status", (row) => <StateBadge value={row.status} options={RENEWAL_STATUSES} />],
        ["amount", "Importo", (row) => row.amount ? money(row.amount) : "-"],
        ["due_date", "Scadenza", (row) => shortDate(row.due_date)],
        ["invoice_id", "Fattura", (row) => row.invoice_id || "-"],
      ]}
      initialForm={{ title: "", status: "upcoming" }}
      renderForm={(form, setForm) => <RenewalForm form={form} setForm={setForm} relations={relations} />}
      canSave={(form) => Boolean(form.title && form.due_date)}
      emptyText="Nessun rinnovo reale."
      extraAction={(row, reload) => (
        <Select value={row.status || "upcoming"} onValueChange={async (status) => { await apiFetch(`/tenant/finance/renewals/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await reload(); }}>
          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>{RENEWAL_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      )}
    />
  );
}

function FinanceCrudPage({
  title,
  description,
  path,
  searchPlaceholder,
  statusOptions,
  columns,
  initialForm,
  renderForm,
  canSave,
  emptyText,
  extraAction,
}: {
  title: string;
  description: string;
  path: string;
  searchPlaceholder: string;
  statusOptions?: Option[];
  columns: Array<[string, string, ((row: Row) => ReactNode)?]>;
  initialForm: Row;
  renderForm: (form: Row, setForm: (updater: (prev: Row) => Row) => void) => ReactNode;
  canSave: (form: Row) => boolean;
  emptyText: string;
  extraAction?: (row: Row, reload: () => Promise<void>) => ReactNode;
}) {
  const [items, setItems] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all__");
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>(initialForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (statusOptions && status !== "__all__") params.set("status", status);
      const data = await loadList(path, params);
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Errore caricamento ${title.toLowerCase()}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewFinance()) return;
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const open = (row?: Row) => {
    setEditing(row || {});
    setForm(row ? { ...initialForm, ...row } : initialForm);
  };

  const save = async () => {
    if (editing?.id) await apiFetch(`${path}/${editing.id}`, { method: "PATCH", body: JSON.stringify(toBody(form)) });
    else await apiFetch(path, { method: "POST", body: JSON.stringify(toBody(form)) });
    setEditing(null);
    await load();
  };

  const remove = async (row: Row) => {
    if (!window.confirm("Eliminare questo record?")) return;
    await apiFetch(`${path}/${row.id}`, { method: "DELETE" });
    await load();
  };

  if (!canViewFinance()) return <AccessDenied />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <FinanceHeader title={title} description={description}>
        <Button onClick={() => open()}><Plus className="mr-2 h-4 w-4" /> Nuovo</Button>
      </FinanceHeader>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} className="pl-9" /></div>
            {statusOptions ? <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tutti</SelectItem>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select> : null}
          </div>
          <ErrorBox error={error} />
          {loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div> : items.length === 0 ? <EmptyState>{emptyText}</EmptyState> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{columns.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3 text-right">Azioni</th></tr></thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t">
                      {columns.map(([key, , format]) => <td key={key} className="px-4 py-3">{format ? format(row) : String(row[key] ?? "-")}</td>)}
                      <td className="px-4 py-3"><div className="flex justify-end gap-2">{extraAction?.(row, load)}<Button size="sm" variant="outline" onClick={() => open(row)}><Edit3 className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={editing !== null} onOpenChange={(openDialog) => { if (!openDialog) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? `Modifica ${title}` : `Nuovo ${title}`}</DialogTitle></DialogHeader>
          {renderForm(form, setForm)}
          <DialogFooter><Button onClick={save} disabled={!canSave(form)}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FinanceProjectsPage() {
  const [projects, setProjects] = useState<Row[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>({});

  const load = async () => {
    setLoading(true);
    const data = await loadList("/tenant/projects?limit=25").catch(() => ({ items: [] }));
    const projectRows = data.items || [];
    const statusPairs = await Promise.all(projectRows.map(async (project) => {
      const status = await apiFetch<Row>(`/tenant/finance/projects/${project.id}/status`).catch(() => null);
      return [project.id, status] as const;
    }));
    setProjects(projectRows);
    setStatuses(Object.fromEntries(statusPairs.filter(([, status]) => Boolean(status))));
    setLoading(false);
  };

  useEffect(() => {
    if (canViewFinance()) void load();
  }, []);

  const open = (project: Row) => {
    const status = statuses[project.id] || {};
    setEditing(project);
    setForm({
      deposit_required: status.deposit_required || 0,
      deposit_paid: status.deposit_paid || 0,
      balance_required: status.balance_required || 0,
      balance_paid: status.balance_paid || 0,
      total_expected: status.total_expected || 0,
      payment_status: status.payment_status || "not_started",
      deposit_due_date: status.deposit_due_date ? String(status.deposit_due_date).slice(0, 10) : "",
      balance_due_date: status.balance_due_date ? String(status.balance_due_date).slice(0, 10) : "",
      internal_notes: status.internal_notes || "",
    });
  };

  const save = async () => {
    if (!editing) return;
    await apiFetch(`/tenant/finance/projects/${editing.id}/status`, { method: "PATCH", body: JSON.stringify(toBody(form)) });
    setEditing(null);
    await load();
  };

  const recalc = async (project: Row) => {
    await apiFetch(`/tenant/finance/projects/${project.id}/recalculate`, { method: "POST" });
    await load();
  };

  if (!canViewFinance()) return <AccessDenied />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <FinanceHeader title="Stato pagamento progetti" description="Fan-out limitato sui primi 25 progetti. Usa dati reali project_financial_status." />
      {loading ? <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div> : projects.length === 0 ? <EmptyState>Nessun progetto reale trovato.</EmptyState> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Progetto</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Atteso</th><th className="px-4 py-3">Incassato</th><th className="px-4 py-3">Acconto</th><th className="px-4 py-3">Saldo</th><th className="px-4 py-3">Scadenze</th><th className="px-4 py-3 text-right">Azioni</th></tr></thead>
            <tbody>{projects.map((project) => { const status = statuses[project.id] || {}; return <tr key={project.id} className="border-t"><td className="px-4 py-3"><Link href={`/projects/${project.id}`} className="font-semibold text-primary hover:underline">{project.name}</Link><p className="text-xs text-muted-foreground">{project.company_name || "-"}</p></td><td className="px-4 py-3"><StateBadge value={status.payment_status} options={PROJECT_PAYMENT_STATUSES} /></td><td className="px-4 py-3">{money(status.total_expected || 0)}</td><td className="px-4 py-3">{money(status.total_paid || 0)}</td><td className="px-4 py-3">{money(status.deposit_paid || 0)} / {money(status.deposit_required || 0)}</td><td className="px-4 py-3">{money(status.balance_paid || 0)} / {money(status.balance_required || 0)}</td><td className="px-4 py-3">{shortDate(status.deposit_due_date)} · {shortDate(status.balance_due_date)}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => recalc(project)}><RefreshCw className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => open(project)}><Edit3 className="h-4 w-4" /></Button></div></td></tr>; })}</tbody>
          </table>
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(openDialog) => { if (!openDialog) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Stato pagamento progetto</DialogTitle><DialogDescription>{editing?.name}</DialogDescription></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2"><Label>Status</Label><SelectField value={form.payment_status} options={PROJECT_PAYMENT_STATUSES} placeholder="Status" onChange={(v) => setForm((p) => ({ ...p, payment_status: v }))} /></div>
            {["deposit_required", "deposit_paid", "balance_required", "balance_paid", "total_expected", "total_paid"].map((field) => <div key={field} className="grid gap-2"><Label>{field}</Label><Input type="number" value={form[field] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} /></div>)}
            <div className="grid gap-2"><Label>Scadenza acconto</Label><Input type="date" value={form.deposit_due_date || ""} onChange={(e) => setForm((p) => ({ ...p, deposit_due_date: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Scadenza saldo</Label><Input type="date" value={form.balance_due_date || ""} onChange={(e) => setForm((p) => ({ ...p, balance_due_date: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Note interne</Label><Textarea value={form.internal_notes || ""} onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FinanceReportsPage() {
  const [summary, setSummary] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewFinance()) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        setSummary(await apiFetch<Row>("/tenant/finance/summary"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore caricamento report");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  if (!canViewFinance()) return <AccessDenied />;

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <FinanceHeader title="Report economici" description="Report base costruito dalla summary Finance V2. Margini avanzati in arrivo." />
      <ErrorBox error={error} />
      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>
      ) : summary ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Fatturato e incassi</CardTitle><CardDescription>Valori reali aggregati dal backend Finance.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><SummaryCard label="Totale fatturato" value={money(summary.total_invoiced || 0)} icon={Receipt} /><SummaryCard label="Totale incassato" value={money(summary.total_paid || 0)} icon={Banknote} tone="success" /><SummaryCard label="Da incassare" value={money(summary.total_outstanding || 0)} icon={Clock} /><SummaryCard label="Incassi mese" value={money(summary.payments_this_month || 0)} icon={Wallet} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Operativita finance</CardTitle><CardDescription>Conteggi di controllo per CEO/Admin.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><SummaryCard label="Fatture scadute" value={summary.invoices_overdue_count || 0} icon={AlertTriangle} tone={(summary.invoices_overdue_count || 0) > 0 ? "danger" : undefined} /><SummaryCard label="Scadenze aperte" value={summary.deadlines_open || 0} icon={CalendarClock} /><SummaryCard label="Rinnovi 30 giorni" value={summary.renewals_upcoming_30d || 0} icon={RefreshCw} /><SummaryCard label="Servizi attivi" value={summary.recurring_active_count || 0} icon={Receipt} /></CardContent></Card>
          <Card className="border-dashed lg:col-span-2"><CardContent className="p-4 text-sm text-muted-foreground">Margini, forecast e grafici avanzati non sono ancora implementati: qui non vengono inventati dati.</CardContent></Card>
        </div>
      ) : (
        <EmptyState>Nessun report disponibile.</EmptyState>
      )}
    </div>
  );
}
