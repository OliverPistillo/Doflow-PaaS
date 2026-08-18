"use client";

import Link from "next/link";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Bell, CreditCard, ExternalLink, Globe2, Loader2, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { useToast } from "@/hooks/use-toast";
import { financeMoney } from "@/components/tenant-administration/administration-model";
import { recordOperationsApi, type OperationsRecordKind, type RecordAdministration as AdministrationData } from "@/lib/tenant-record-operations-api";
import { cn } from "@/lib/utils";
import { RecordPanelEmptyState, RecordPanelSection } from "./unified-record-panel";

export type RecordAdministrationHandle = { openPayment: () => void };

const paymentMethods = [
  ["bank_transfer", "Bonifico"], ["cash", "Contanti"], ["card", "Carta"],
  ["paypal", "PayPal"], ["stripe", "Stripe"], ["other", "Altro"],
];

const paymentStatusLabels: Record<string, string> = {
  not_started: "Non iniziato", deposit_due: "Acconto da incassare", deposit_paid: "Acconto pagato",
  partially_paid: "Parzialmente pagato", paid: "Pagato", overdue: "Scaduto",
};

function date(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(parsed);
}

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : "Operazione non riuscita.";
}

function invoiceStatus(status?: string | null) {
  const labels: Record<string, string> = { draft: "Bozza", issued: "Emessa", sent: "Inviata", partially_paid: "Parziale", paid: "Pagata", overdue: "Scaduta" };
  return labels[String(status || "")] || String(status || "Non definita").replace(/_/g, " ");
}

type RecordAdministrationProps = { recordKind: OperationsRecordKind; recordId: string };

export const RecordAdministration = forwardRef<RecordAdministrationHandle, RecordAdministrationProps>(function RecordAdministration({ recordKind, recordId }, ref) {
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
    setLoading(true); setError(null);
    try { setData(await recordOperationsApi.administration(target)); }
    catch (reason) { setError(message(reason)); }
    finally { setLoading(false); }
  }, [canView, target]);

  useEffect(() => { void load(); }, [load]);

  const openPayment = useCallback(() => {
    const first = data?.invoices.find((item) => Number(item.remaining_total || 0) > 0);
    if (!first) {
      toast({ title: "Pagamento non disponibile", description: "Non esiste una fattura con residuo da incassare." });
      return;
    }
    setPaymentOpen(true); setIdempotencyKey(crypto.randomUUID()); setInvoiceId(first.id); setPaymentAmount(String(first.remaining_total || ""));
  }, [data, toast]);
  useImperativeHandle(ref, () => ({ openPayment }), [openPayment]);

  const submitPayment = async () => {
    if (!invoiceId || Number(paymentAmount) <= 0 || busy) return;
    setBusy("payment");
    try {
      await recordOperationsApi.createPayment(invoiceId, { amount: Number(paymentAmount), payment_date: paymentDate, method: paymentMethod, reference: paymentReference || undefined, notes: paymentNote || undefined, idempotency_key: idempotencyKey || crypto.randomUUID(), status: "recorded" });
      toast({ title: "Pagamento registrato", description: "Totali fattura e progetto ricalcolati dal finance canonico." });
      setPaymentOpen(false); setPaymentAmount(""); setPaymentReference(""); setPaymentNote(""); setIdempotencyKey(""); await load();
    } catch (reason) { toast({ title: "Pagamento non registrato", description: message(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const completeRenewal = async (id: string) => {
    if (busy) return; setBusy(`renewal:${id}`);
    try { await recordOperationsApi.completeRenewal(id); toast({ title: "Rinnovo completato" }); await load(); }
    catch (reason) { toast({ title: "Rinnovo non aggiornato", description: message(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  if (!canView("finance")) return <RecordPanelEmptyState title="Amministrazione non disponibile" description="La capability finance è necessaria e viene verificata anche dal backend." />;
  if (loading) return <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>;
  if (error || !data) return <RecordPanelEmptyState title="Dati amministrativi non disponibili" description={error || "Riprova tra poco."} action={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Riprova</Button>} />;

  const summary = data.summary;
  const contract = data.contracts.find((item) => String(item.signature_status || "").toLowerCase() === "signed") || data.contracts[0] || null;
  const expected = Number(summary.total_expected || summary.total_invoiced || 0);
  const paid = Number(summary.total_paid || 0);
  const remaining = Number(summary.total_remaining || 0);
  const percent = expected > 0 ? Math.max(0, Math.min(100, Math.round((paid / expected) * 100))) : 0;
  const deadline = data.deadlines.find((item) => ["open", "overdue"].includes(String(item.status))) || null;
  const recurring = data.recurring_services.filter((item) => String(item.status) === "active");
  const activeRenewals = data.renewals.filter((item) => ["upcoming", "reminded", "invoiced"].includes(String(item.status)));

  return <div className="space-y-3" data-record-administration>
    <div className="grid grid-cols-2 gap-2.5">
      <RecordPanelSection title="Contratto" className="min-h-[116px]">
        {contract ? <><Badge className={cn("h-5 border-0 px-2 text-[9px]", String(contract.signature_status).toLowerCase() === "signed" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-slate-100 text-slate-600")}>{String(contract.signature_status).toLowerCase() === "signed" ? "Firmato" : contract.status}</Badge>{contract.signed_at ? <p className="mt-2 text-[10px] text-slate-500">Firmato il {date(contract.signed_at)}</p> : null}<Button asChild variant="outline" size="sm" className="mt-2 h-8 w-full rounded-lg text-[10px]"><Link href={`/contracts/${contract.id}`}><ExternalLink className="mr-1.5 h-3 w-3" />Apri contratto</Link></Button></> : <p className="text-xs text-slate-500">Nessun contratto collegato.</p>}
      </RecordPanelSection>
      <RecordPanelSection title="Valore progetto" className="min-h-[116px]"><p className="mt-5 text-2xl font-bold tracking-tight text-slate-950" data-record-sensitive>{financeMoney(expected, undefined, 0)}</p></RecordPanelSection>
    </div>

    <RecordPanelSection title="Stato pagamenti">
      <div className="flex items-center justify-between"><span className="text-[11px] text-slate-500">{paymentStatusLabels[summary.payment_status] || summary.payment_status}</span><strong className="text-xs text-violet-700">{percent}%</strong></div>
      <Progress value={percent} className="mt-2 h-1.5 bg-slate-100" />
      <div className="mt-3 grid grid-cols-3 divide-x divide-[#e8e8ed] text-[10px] text-slate-500">
        <div className="pr-2"><span className="block">Pagato</span><strong className="mt-1 block text-sm text-slate-950" data-record-sensitive>{financeMoney(paid, undefined, 0)}</strong><Badge className="mt-1 h-5 border-0 bg-emerald-50 px-2 text-[9px] text-emerald-700 hover:bg-emerald-50">{paid > 0 ? "Pagato" : "Da incassare"}</Badge></div>
        <div className="px-2"><span className="block">Saldo</span><strong className="mt-1 block text-sm text-slate-950" data-record-sensitive>{financeMoney(remaining, undefined, 0)}</strong><Badge className="mt-1 h-5 border-0 bg-amber-50 px-2 text-[9px] text-amber-700 hover:bg-amber-50">{remaining > 0 ? "Da incassare" : "Pagato"}</Badge></div>
        <div className="pl-2"><span className="block">Scadenza saldo</span><strong className="mt-1 block text-xs text-slate-950">{date(deadline?.due_date || summary.next_deadline)}</strong></div>
      </div>
    </RecordPanelSection>

    <RecordPanelSection title="Fatture">
      {data.invoices.length ? <div className="grid gap-2 sm:grid-cols-2">{data.invoices.map((invoice) => <div key={invoice.id} className="rounded-lg border border-[#e8e8ed] bg-white p-2.5"><div className="flex items-start gap-2"><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-slate-900" data-record-sensitive>{invoice.title || invoice.invoice_number || "Fattura"}</strong><Badge className="mt-1 h-5 border-0 bg-emerald-50 px-2 text-[9px] text-emerald-700 hover:bg-emerald-50">{invoiceStatus(invoice.status)}</Badge></span><Button asChild variant="ghost" size="icon" className="h-7 w-7"><Link href="/finance/invoices" aria-label="Apri fattura"><ExternalLink className="h-3.5 w-3.5" /></Link></Button></div><p className="mt-1.5 text-[10px] text-slate-500"><span data-record-sensitive>{financeMoney(invoice.total, invoice.currency, 0)}</span> · residuo <span data-record-sensitive>{financeMoney(invoice.remaining_total, invoice.currency, 0)}</span></p></div>)}</div> : <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Nessuna fattura collegata.</p>{canCreate("finance") ? <Button asChild variant="outline" size="sm" className="h-8 text-[10px]"><Link href={`/finance/invoices/new?${recordKind}=${encodeURIComponent(recordId)}`}><Plus className="mr-1 h-3 w-3" />Crea fattura</Link></Button> : null}</div>}
    </RecordPanelSection>

    {recurring.length || activeRenewals.length ? <RecordPanelSection title="Servizi ricorrenti e rinnovi">
      <div className="space-y-2">{recurring.map((service) => <div key={service.id} className="flex items-center gap-2 rounded-lg border border-[#e8e8ed] px-2.5 py-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700"><Globe2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-slate-900" data-record-sensitive>{service.name}</strong><span className="block text-[10px] text-slate-500"><span data-record-sensitive>{financeMoney(service.amount, service.currency, 0)}</span>/{service.billing_cycle === "yearly" ? "anno" : service.billing_cycle} · {date(service.next_due_date)}</span></span>{service.auto_renew ? <span className="flex items-center gap-1 text-[9px] text-violet-700"><Bell className="h-3 w-3" />Rinnovo automatico</span> : null}</div>)}{activeRenewals.map((renewal) => <div key={renewal.id} className="flex items-center gap-2 rounded-lg border border-[#e8e8ed] px-2.5 py-2"><Bell className="h-4 w-4 text-violet-600" /><span className="min-w-0 flex-1"><strong className="block truncate text-[11px]" data-record-sensitive>{renewal.title}</strong><span className="text-[10px] text-slate-500">{date(renewal.due_date)} · <span data-record-sensitive>{financeMoney(renewal.amount, renewal.currency, 0)}</span></span></span>{canUpdate("finance") ? <Button variant="ghost" size="sm" className="h-7 text-[9px]" onClick={() => void completeRenewal(renewal.id)} disabled={Boolean(busy)}>Completa</Button> : null}</div>)}</div>
    </RecordPanelSection> : null}

    {paymentOpen ? <div data-payment-form><RecordPanelSection title="Registra pagamento" className="border-violet-200 bg-violet-50/30">
      <div className="space-y-2"><select value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); const invoice = data.invoices.find((item) => item.id === event.target.value); if (invoice) setPaymentAmount(String(invoice.remaining_total || "")); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs"><option value="">Seleziona fattura</option>{data.invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.title || invoice.invoice_number}</option>)}</select><div className="grid grid-cols-2 gap-2"><Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Importo" className="h-9 text-xs" /><Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="h-9 text-xs" /></div><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs">{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Riferimento opzionale" className="h-9 text-xs" /><Textarea value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Nota opzionale" rows={2} className="text-xs" /><div className="flex gap-2"><Button size="sm" onClick={() => void submitPayment()} disabled={!invoiceId || Number(paymentAmount) <= 0 || Boolean(busy)}>{busy === "payment" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}Registra</Button><Button variant="ghost" size="sm" onClick={() => setPaymentOpen(false)} disabled={Boolean(busy)}>Annulla</Button></div></div>
    </RecordPanelSection></div> : null}
  </div>;
});
