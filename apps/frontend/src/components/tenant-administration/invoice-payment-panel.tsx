"use client";

import { Banknote, ExternalLink, Receipt, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  INVOICE_STATUSES,
  administrationDate,
  financeMoney,
  optionLabel,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationBadge, AdministrationEmpty } from "./administration-ui";

export function InvoicePaymentPanel({
  invoice,
  canUpdate,
  canDelete,
  amount,
  method,
  onAmountChange,
  onMethodChange,
  onRegisterPayment,
  onStatusChange,
  onDelete,
  onClose,
}: {
  invoice: AdministrationRow | null;
  canUpdate: boolean;
  canDelete: boolean;
  amount: string;
  method: string;
  onAmountChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onRegisterPayment: () => void;
  onStatusChange: (value: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!invoice) {
    return <aside className="rounded-2xl border border-slate-200/80 bg-white p-5"><h2 className="text-[17px] font-semibold text-slate-950">Riepilogo incassi</h2><AdministrationEmpty className="mt-4">Seleziona una fattura per vedere pagamenti e residuo.</AdministrationEmpty></aside>;
  }
  const payments = (invoice.payments || []) as AdministrationRow[];
  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-slate-950">{invoice.invoice_number || invoice.title}</h2><p className="mt-1 truncate text-sm text-slate-500">{invoice.company_name || invoice.project_name || invoice.title}</p></div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
        <AmountRow label="Totale documento" value={financeMoney(invoice.total, invoice.currency)} />
        <AmountRow label="Incassato" value={financeMoney(invoice.paid_total, invoice.currency)} tone="text-emerald-600" />
        <AmountRow label="Residuo" value={financeMoney(invoice.remaining_total, invoice.currency)} strong />
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3"><span className="text-xs text-slate-500">Stato</span><AdministrationBadge value={invoice.status} label={optionLabel(INVOICE_STATUSES, invoice.status)} /></div>
      </div>
      {canUpdate ? (
        <div className="mt-5 space-y-3">
          <Select value={invoice.status || "draft"} onValueChange={onStatusChange}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>{INVOICE_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" value={amount} onChange={(event) => onAmountChange(event.target.value)} placeholder={`Residuo ${financeMoney(invoice.remaining_total, invoice.currency)}`} className="h-10 rounded-xl border-slate-200" />
          <Select value={method} onValueChange={onMethodChange}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="bank_transfer">Bonifico</SelectItem><SelectItem value="card">Carta</SelectItem><SelectItem value="cash">Contanti</SelectItem><SelectItem value="paypal">PayPal</SelectItem><SelectItem value="stripe">Stripe</SelectItem><SelectItem value="other">Altro</SelectItem></SelectContent>
          </Select>
          <Button className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700" onClick={onRegisterPayment}><Banknote className="mr-2 h-4 w-4" /> Registra pagamento</Button>
        </div>
      ) : null}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-950">Pagamenti</h3>
        {payments.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">Nessun pagamento registrato.</p> : (
          <div className="mt-2 divide-y divide-slate-100">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-3 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Receipt className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900">{financeMoney(payment.amount, payment.currency)}</p><p className="text-xs text-slate-500">{administrationDate(payment.payment_date || payment.created_at)} · {payment.method || "Metodo non indicato"}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}><ExternalLink className="mr-2 h-4 w-4" /> Chiudi</Button>
        {canDelete ? <Button size="icon" variant="outline" className="rounded-xl text-rose-600" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button> : null}
      </div>
    </aside>
  );
}

function AmountRow({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{label}</span><span className={`${strong ? "text-lg font-bold" : "text-sm font-semibold"} ${tone || "text-slate-950"}`}>{value}</span></div>;
}
