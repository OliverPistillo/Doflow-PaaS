import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvoiceRow, Invoice } from "./InvoiceRow";

export type ClientGroup = {
  clientId: string;
  name: string;
  totalVolume: number;
  invoices: Invoice[];
  status: "Attivo" | "Inattivo";
};

interface ClientRowProps {
  client: ClientGroup;
  onAddInvoice: () => void; // Callback per aprire la modale
}

export function ClientRow({ client, onAddInvoice }: ClientRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border rounded-lg bg-white overflow-hidden shadow-sm group transition-all">
      {/* Riga Intestazione Cliente */}
      <div 
        className="grid grid-cols-[30px_2fr_1fr_1fr_1fr] px-4 py-4 items-center hover:bg-slate-50/50 transition-colors cursor-pointer select-none" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-center">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
        
        <div>
          <div className="font-bold text-lg text-slate-800">{client.name}</div>
          {/* Mostriamo ID solo se serve debug, altrimenti pulito */}
        </div>

        <div className="font-mono font-bold text-slate-700 text-right pr-8">
           €{client.totalVolume.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </div>

        <div className="text-sm text-slate-600 pl-2">
           <Badge variant="outline" className="bg-slate-50">{client.invoices.length} docs</Badge>
        </div>

        <div>
           <Badge variant="secondary" className={client.status === 'Attivo' ? "bg-green-100 text-green-800 border-green-200" : "bg-slate-100 text-slate-600"}>
             {client.status}
           </Badge>
        </div>
      </div>

      {/* Area Espansa (Lista Fatture) */}
      {isExpanded && (
        <div className="bg-slate-50/50 border-t p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="ml-0 sm:ml-8 space-y-3">
            {client.invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </div>
          
          <div className="mt-4 ml-8">
            <Button variant="ghost" size="sm" className="text-slate-500 text-xs hover:text-indigo-600 hover:bg-indigo-50" onClick={(e) => {
                e.stopPropagation(); // Evita di chiudere la riga
                onAddInvoice();
            }}>
                <Plus className="h-3 w-3 mr-1" /> Aggiungi nuova fattura a questo cliente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}