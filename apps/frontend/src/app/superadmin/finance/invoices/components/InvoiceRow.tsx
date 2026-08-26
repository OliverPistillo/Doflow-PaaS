"use client";

import React from "react";
import { Edit2, Trash2, FileText, FileCheck2, Download, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { useCurrentDate } from "@/hooks/use-current-date";

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

function isExpired(dueDate: string, currentDate: Date): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(currentDate.toDateString());
}

function computeStatus(inv: Invoice, currentDate: Date): Invoice["status"] {
  if (inv.docType === "preventivo") {
    if (inv.status === "approved") return "approved";
    if (isExpired(inv.dueDate, currentDate)) return "overdue";
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
  const currentDate = useCurrentDate();
  const isPreventivo = invoice.docType === "preventivo";
  const status       = computeStatus(invoice, currentDate);

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
    <div className="bg-card border rounded-md p-4 text-sm shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group">

      {/* ── Info sinistra ── */}
      <div className="flex items-center gap-4">
        <div className={`h-10 w-10 rounded flex items-center justify-center shrink-0 ${
          isPreventivo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          {isPreventivo
            ? <FileText className="h-5 w-5" />
            : <FileCheck2 className="h-5 w-5" />}
        </div>
        <div>
          <div className="font-bold text-muted-foreground flex items-center gap-2 flex-wrap">
            {docLabel} {docRef}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${statusInfo.cls}`}>
              {statusInfo.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Emessa: {new Date(invoice.issueDate).toLocaleDateString("it-IT")}
            {" • "}
            {dueDateLabel}: {new Date(invoice.dueDate).toLocaleDateString("it-IT")}
            {/* Avviso scadenza imminente per preventivi */}
            {isPreventivo && status === "pending" && (() => {
              const days = Math.ceil((new Date(invoice.dueDate).getTime() - currentDate.getTime()) / 86400000);
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
          <div className="font-mono font-bold text-lg text-foreground">
            €{Number(invoice.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Importo</div>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-center">

          {/* Bottone Approva — solo preventivi non ancora approvati/scaduti */}
          {isPreventivo && status === "pending" && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={() => onEdit(invoice)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600"
            onClick={() => onDelete(invoice.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
