// Percorso: apps/frontend/src/app/superadmin/finance/invoices/components/InvoiceRow.tsx
import React from "react";
import { Edit2, Trash2, FileText, FileCheck2, Download, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "approved";
  docType?: "fattura" | "preventivo";
  service?: string;
  notes?: string;
  paymentMethod?: string;
  paymentDate?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(dueDate: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function computeStatus(inv: Invoice): Invoice["status"] {
  if (inv.docType === "preventivo") {
    if (inv.status === "approved") return "approved";
    if (isExpired(inv.dueDate))    return "overdue";
    return "pending";
  }
  return inv.status;
}

// ── Badge status ──────────────────────────────────────────────────────────────

const FATTURA_STATUS: Record<string, { label: string; cls: string }> = {
  paid:    { label: "Pagata",      cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pending: { label: "In Attesa",   cls: "bg-amber-100 text-amber-700 border-amber-200" },
  overdue: { label: "Scaduta",     cls: "bg-red-100 text-red-700 border-red-200" },
};

const PREVENTIVO_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "In Attesa",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
  approved: { label: "Approvato",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  overdue:  { label: "Scaduto",    cls: "bg-red-100 text-red-700 border-red-200" },
};

// ── Componente ────────────────────────────────────────────────────────────────

interface InvoiceRowProps {
  invoice: Invoice;
  onEdit: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string, number: string) => void;
  onSend: (id: string, number: string) => void;
  onRefresh?: () => void;
}

export function InvoiceRow({ invoice, onEdit, onDelete, onDownload, onSend, onRefresh }: InvoiceRowProps) {
  const isPreventivo = invoice.docType === "preventivo";
  const status       = computeStatus(invoice);

  const statusMap  = isPreventivo ? PREVENTIVO_STATUS : FATTURA_STATUS;
  const statusInfo = statusMap[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };

  // Etichetta e numero documento
  const docLabel = isPreventivo ? "Preventivo" : "Fattura";
  const docRef   = invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : "";

  // Label date contestuale
  const dueDateLabel = isPreventivo ? "Valido fino al" : "Scadenza";

  // Approvazione preventivo
  const handleApprove = async () => {
    try {
      await apiFetch(`/superadmin/finance/invoices/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      });
      onRefresh?.();
    } catch (e) {
      console.error("Errore approvazione", e);
    }
  };

  return (
    <div className="bg-white border rounded-md p-4 text-sm shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group">

      {/* ── Info sinistra ── */}
      <div className="flex items-center gap-4">
        <div className={`h-10 w-10 rounded flex items-center justify-center shrink-0 ${
          isPreventivo ? "bg-indigo-50 text-indigo-500" : "bg-slate-100 text-slate-500"
        }`}>
          {isPreventivo
            ? <FileText className="h-5 w-5" />
            : <FileCheck2 className="h-5 w-5" />}
        </div>
        <div>
          <div className="font-bold text-slate-700 flex items-center gap-2 flex-wrap">
            {docLabel} {docRef}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${statusInfo.cls}`}>
              {statusInfo.label}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Emessa: {new Date(invoice.issueDate).toLocaleDateString("it-IT")}
            {" • "}
            {dueDateLabel}: {new Date(invoice.dueDate).toLocaleDateString("it-IT")}
            {/* Avviso scadenza imminente per preventivi */}
            {isPreventivo && status === "pending" && (() => {
              const days = Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / 86400000);
              return days <= 7 && days > 0
                ? <span className="ml-1 text-amber-600 font-semibold">({days}gg rimasti)</span>
                : null;
            })()}
          </div>
        </div>
      </div>

      {/* ── Info destra + Azioni ── */}
      <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
        <div className="text-right">
          <div className="font-mono font-bold text-lg text-slate-900">
            €{Number(invoice.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Importo</div>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-center">

          {/* Bottone Approva — solo preventivi non ancora approvati/scaduti */}
          {isPreventivo && status === "pending" && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50"
              title="Segna come Approvato"
              onClick={handleApprove}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary/80"
            onClick={() => onSend(invoice.id, invoice.invoiceNumber || invoice.id)}>
            <Mail className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary/80"
            onClick={() => onDownload(invoice.id, invoice.invoiceNumber || invoice.id)}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600"
            onClick={() => onEdit(invoice)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600"
            onClick={() => onDelete(invoice.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}