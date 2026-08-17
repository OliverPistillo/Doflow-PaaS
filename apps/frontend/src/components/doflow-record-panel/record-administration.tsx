"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, CreditCard, Loader2, ReceiptText, RefreshCw, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { useToast } from "@/hooks/use-toast";
import {
  recordOperationsApi, type OperationsRecordKind, type RecordAdministration as AdministrationData,
} from "@/lib/tenant-record-operations-api";
import { RecordPanelEmptyState, RecordPanelField, RecordPanelSection } from "./unified-record-panel";

const paymentMethods = [
  ["bank_transfer", "Bonifico"], ["cash", "Contanti"], ["card", "Carta"],
  ["paypal", "PayPal"], ["stripe", "Stripe"], ["other", "Altro"],
];

function money(value: unknown, currency = "EUR") {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: currency || "EUR", maximumFractionDigits: 2 }).format(Number.isFinite(numeric) ? numeric : 0);
}

function date(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(parsed);
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : "Operazione non riuscita.";
}

const paymentStatusLabels: Record<string, string> = {
  not_started: "Non iniziato", deposit_due: "Acconto da incassare", deposit_paid: "Acconto pagato",
  partially_paid: "Parzialmente pagato", paid: "Pagato", overdue: "Scaduto",
};

export function ProjectFinanceCard({ projectId }: { projectId: string }) {
  const { canView } = useTenantAccess();
  const [data, setData] = useState<AdministrationData | null>(null);
  useEffect(() => {
    if (!canView("finance")) return;
    let cancelled = false;
    recordOperationsApi.administration({ record_kind: "project", record_id: projectId })
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [canView, projectId]);
  if (!canView("finance") || !data) return null;
  const summary = data.summary;
  return <RecordPanelSection title="Sintesi economica" description="Visibile soltanto a chi dispone della capability finance.">
    <dl className="grid gap-4 sm:grid-cols-2">
      <RecordPanelField label="Stato pagamenti" value={paymentStatusLabels[summary.payment_status] || summary.payment_status} />
      <RecordPanelField label="Totale atteso" value={money(summary.total_expected)} sensitive />
      <RecordPanelField label="Pagato" value={money(summary.total_paid)} sensitive />
      <RecordPanelField label="Residuo" value={money(summary.total_remaining)} sensitive />
      <RecordPanelField label="Prossima scadenza" value={date(summary.next_deadline)} />
      <RecordPanelField label="Prossimo rinnovo" value={date(summary.next_renewal)} />
    </dl>
  </RecordPanelSection>;
}

export function RecordAdministration({ recordKind, recordId }: { recordKind: Exclude<OperationsRecordKind, "project">; recordId: string }) {
  const { canView, canCreate, canUpdate } = useTenantAccess();
  const { toast } = useToast();
  const target = useMemo(() => ({ record_kind: recordKind, record_id: recordId }), [recordId, recordKind]);
  const [data, setData] = useState<AdministrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView("finance")) return;
    setLoading(true);
    setError(null);
    try { setData(await recordOperationsApi.administration(target)); }
    catch (reason) { setError(message(reason)); }
    finally { setLoading(false); }
  }, [canView, target]);

  useEffect(() => { void load(); }, [load]);

  const openPayment = () => {
    setPaymentOpen(true);
    setIdempotencyKey(crypto.randomUUID());
    const first = data?.invoices.find((item) => Number(item.remaining_total || 0) > 0);
    if (first) {
      setInvoiceId(first.id);
      setPaymentAmount(String(first.remaining_total || ""));
    }
  };

  const submitPayment = async () => {
    if (!invoiceId || Number(paymentAmount) <= 0 || busy) return;
    setBusy("payment");
    try {
      await recordOperationsApi.createPayment(invoiceId, {
        amount: Number(paymentAmount), payment_date: paymentDate, method: paymentMethod,
        reference: paymentReference || undefined, notes: paymentNote || undefined,
        idempotency_key: idempotencyKey || crypto.randomUUID(), status: "recorded",
      });
      toast({ title: "Pagamento registrato", description: "Totali fattura e progetto sono stati ricalcolati dal finance canonico." });
      setPaymentOpen(false);
      setPaymentAmount(""); setPaymentReference(""); setPaymentNote(""); setIdempotencyKey("");
      await load();
    } catch (reason) {
      toast({ title: "Pagamento non registrato", description: message(reason), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const completeDeadline = async (id: string) => {
    if (busy) return;
    setBusy(`deadline:${id}`);
    try { await recordOperationsApi.completeDeadline(id); toast({ title: "Scadenza completata" }); await load(); }
    catch (reason) { toast({ title: "Scadenza non aggiornata", description: message(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const completeRenewal = async (id: string) => {
    if (busy) return;
    setBusy(`renewal:${id}`);
    try { await recordOperationsApi.completeRenewal(id); toast({ title: "Rinnovo completato" }); await load(); }
    catch (reason) { toast({ title: "Rinnovo non aggiornato", description: message(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  if (!canView("finance")) {
    return <RecordPanelEmptyState title="Amministrazione non disponibile" description="La capability finance è necessaria e viene verificata anche dal backend." />;
  }
  if (loading) return <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>;
  if (error || !data) return <RecordPanelEmptyState title="Dati amministrativi non disponibili" description={error || "Riprova tra poco."} action={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Riprova</Button>} />;

  const summary = data.summary;
  const openDeadlines = data.deadlines.filter((item) => ["open", "overdue"].includes(String(item.status)));
  const openRenewals = data.renewals.filter((item) => ["upcoming", "reminded", "invoiced"].includes(String(item.status)));
  return <div className="space-y-5" data-record-administration>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Fatturato collegato</p><p className="mt-1 text-xl font-bold text-slate-950" data-record-sensitive>{money(summary.total_invoiced)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Pagato</p><p className="mt-1 text-xl font-bold text-emerald-700" data-record-sensitive>{money(summary.total_paid)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Residuo</p><p className="mt-1 text-xl font-bold text-amber-700" data-record-sensitive>{money(summary.total_remaining)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Scaduto</p><p className="mt-1 text-xl font-bold text-rose-700" data-record-sensitive>{money(summary.total_overdue)}</p></div>
    </div>

    <RecordPanelSection title="Prossime date"><dl className="grid grid-cols-2 gap-4"><RecordPanelField label="Scadenza" value={date(summary.next_deadline)} /><RecordPanelField label="Rinnovo" value={date(summary.next_renewal)} /></dl></RecordPanelSection>

    <RecordPanelSection title="Preventivi" description="Creazione e apertura passano dal flow preventivi esistente.">
      <div className="space-y-2">{data.quotes.map((quote) => <Link key={quote.id} href="/quotes" className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="truncate font-medium" data-record-sensitive>{quote.title || quote.quote_number || "Preventivo"}</span><span className="flex items-center gap-2"><Badge variant="outline">{quote.status}</Badge><span data-record-sensitive>{money(quote.total, quote.currency)}</span></span></Link>)}{!data.quotes.length ? <p className="text-xs text-slate-500">Nessun preventivo collegato.</p> : null}</div>
      <Button asChild variant="outline" size="sm" className="mt-3"><Link href={`/quotes/new?${recordKind}=${encodeURIComponent(recordId)}`}>Crea preventivo</Link></Button>
    </RecordPanelSection>

    <RecordPanelSection title="Contratti">
      <div className="space-y-2">{data.contracts.map((contract) => <Link key={contract.id} href={`/contracts/${contract.id}`} className="block rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="flex justify-between gap-2"><span className="truncate font-medium" data-record-sensitive>{contract.title || contract.contract_number}</span><Badge variant="outline">{contract.status}</Badge></span><span className="mt-1 block text-xs text-slate-500">Firma {contract.signature_status} · {date(contract.start_date)}–{date(contract.end_date)} · rinnovo {date(contract.renewal_date)} · <span data-record-sensitive>{money(contract.amount, contract.currency)}</span></span></Link>)}{!data.contracts.length ? <p className="text-xs text-slate-500">Nessun contratto collegato.</p> : null}</div>
    </RecordPanelSection>

    <RecordPanelSection title="Fatture e pagamenti">
      <div className="space-y-2">{data.invoices.map((invoice) => <div key={invoice.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><div className="flex justify-between gap-2"><span className="truncate font-medium" data-record-sensitive>{invoice.title || invoice.invoice_number || "Fattura"}</span><Badge variant="outline">{invoice.status}</Badge></div><p className="mt-1 text-xs text-slate-500"><span data-record-sensitive>{money(invoice.total, invoice.currency)}</span> · pagato <span data-record-sensitive>{money(invoice.paid_total, invoice.currency)}</span> · residuo <span data-record-sensitive>{money(invoice.remaining_total, invoice.currency)}</span> · scadenza {date(invoice.due_date)}</p></div>)}{!data.invoices.length ? <p className="text-xs text-slate-500">Nessuna fattura collegata.</p> : null}</div>
      <div className="mt-3 flex flex-wrap gap-2">{canCreate("finance") && data.invoices.length ? <Button size="sm" onClick={openPayment}><CreditCard className="mr-2 h-4 w-4" />Registra pagamento</Button> : null}{canCreate("finance") ? <Button asChild variant="outline" size="sm"><Link href={`/finance/invoices/new?${recordKind}=${encodeURIComponent(recordId)}`}><ReceiptText className="mr-2 h-4 w-4" />Crea fattura</Link></Button> : null}</div>
      {paymentOpen ? <div className="mt-4 space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3" data-payment-form>
        <p className="text-sm font-semibold">Nuovo pagamento</p>
        <select value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); const invoice = data.invoices.find((item) => item.id === event.target.value); if (invoice) setPaymentAmount(String(invoice.remaining_total || "")); }} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Seleziona fattura</option>{data.invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.title || invoice.invoice_number}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Importo" /><Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></div>
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Riferimento opzionale" />
        <Textarea value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Nota opzionale" rows={2} />
        <div className="flex gap-2"><Button onClick={() => void submitPayment()} disabled={!invoiceId || Number(paymentAmount) <= 0 || Boolean(busy)}>{busy === "payment" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Registra</Button><Button variant="ghost" onClick={() => setPaymentOpen(false)} disabled={Boolean(busy)}>Annulla</Button></div>
      </div> : null}
      {data.payments.length ? <div className="mt-4 border-t border-slate-100 pt-3"><p className="mb-2 text-xs font-semibold text-slate-600">Ultimi pagamenti</p>{data.payments.slice(0, 5).map((payment) => <p key={payment.id} className="flex justify-between py-1 text-xs text-slate-600"><span>{date(payment.payment_date)} · {payment.method || "metodo non indicato"}</span><span data-record-sensitive>{money(payment.amount, payment.currency)}</span></p>)}</div> : null}
    </RecordPanelSection>

    <RecordPanelSection title="Scadenze">
      <div className="space-y-2">{openDeadlines.map((deadline) => <div key={deadline.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><CalendarCheck className="h-4 w-4 text-amber-600" /><span className="min-w-0 flex-1"><span className="block truncate font-medium" data-record-sensitive>{deadline.title}</span><span className="text-xs text-slate-500">{date(deadline.due_date)} · <span data-record-sensitive>{money(deadline.amount, deadline.currency)}</span></span></span><Badge variant="outline">{deadline.status}</Badge>{canUpdate("finance") ? <Button variant="ghost" size="sm" onClick={() => void completeDeadline(deadline.id)} disabled={Boolean(busy)}>Completa</Button> : null}</div>)}{!openDeadlines.length ? <p className="text-xs text-slate-500">Nessuna scadenza aperta.</p> : null}</div>
    </RecordPanelSection>

    <RecordPanelSection title="Servizi ricorrenti e rinnovi">
      <div className="space-y-2">{data.recurring_services.map((service) => <div key={service.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="flex justify-between"><span className="font-medium" data-record-sensitive>{service.name}</span><Badge variant="outline">{service.status}</Badge></span><span className="mt-1 block text-xs text-slate-500">{service.billing_cycle} · prossimo {date(service.next_due_date)} · rinnovo automatico {service.auto_renew ? "attivo" : "disattivo"} · <span data-record-sensitive>{money(service.amount, service.currency)}</span></span></div>)}</div>
      {openRenewals.length ? <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{openRenewals.map((renewal) => <div key={renewal.id} className="flex items-center gap-3 text-sm"><RotateCw className="h-4 w-4 text-violet-600" /><span className="min-w-0 flex-1"><span className="block truncate font-medium" data-record-sensitive>{renewal.title}</span><span className="text-xs text-slate-500">{date(renewal.due_date)} · <span data-record-sensitive>{money(renewal.amount, renewal.currency)}</span></span></span>{canUpdate("finance") ? <Button variant="ghost" size="sm" onClick={() => void completeRenewal(renewal.id)} disabled={Boolean(busy)}>Completa rinnovo</Button> : null}</div>)}</div> : null}
    </RecordPanelSection>
  </div>;
}
