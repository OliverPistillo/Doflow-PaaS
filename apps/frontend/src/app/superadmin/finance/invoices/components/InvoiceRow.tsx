import React from "react";
import { ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Tipi (puoi anche spostarli in un file types.ts condiviso)
export type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  service?: string;
  notes?: string;
  paymentMethod?: string;
  paymentDate?: string;
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  overdue: "bg-red-100 text-red-700 border-red-200"
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagata",
  pending: "In Attesa",
  overdue: "Scaduta"
};

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <div className="bg-white border rounded-md p-4 text-sm shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* Info Sinistra */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-slate-500">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold text-slate-700 flex items-center gap-2">
            Fattura #{invoice.invoiceNumber}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${STATUS_STYLES[invoice.status]}`}>
              {STATUS_LABELS[invoice.status]}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Emessa: {new Date(invoice.issueDate).toLocaleDateString('it-IT')} • Scadenza: {new Date(invoice.dueDate).toLocaleDateString('it-IT')}
          </div>
        </div>
      </div>

      {/* Info Destra */}
      <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
        <div className="text-right">
          <div className="font-mono font-bold text-lg text-slate-900">
            €{Number(invoice.amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Importo</div>
        </div>
        
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}