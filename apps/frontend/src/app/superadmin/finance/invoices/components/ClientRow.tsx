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
  onAddInvoice: () => void;
  onEditInvoice: (inv: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onDownloadInvoice: (id: string, number: string) => void;
  onSendInvoice: (id: string, number: string) => void;
}

export function ClientRow({ client, onAddInvoice, onEditInvoice, onDeleteInvoice, onDownloadInvoice, onSendInvoice }: ClientRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border rounded-lg bg-white overflow-hidden shadow-sm group transition-all">
      <div 
        className="grid grid-cols-[30px_2fr_1fr_1fr_1fr] px-4 py-4 items-center hover:bg-muted/5/50 transition-colors cursor-pointer select-none" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-center">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
        
        <div><div className="font-bold text-lg text-foreground">{client.name}</div></div>
        <div className="font-mono font-bold text-foreground text-right pr-8">€{client.totalVolume.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
        <div className="text-sm text-foreground pl-2"><Badge variant="outline" className="bg-muted/5">{client.invoices.length} docs</Badge></div>
        <div><Badge variant="secondary" className={client.status === 'Attivo' ? "bg-green-100 text-green-800 border-green-200" : "bg-muted/20 text-foreground"}>{client.status}</Badge></div>
      </div>

      {isExpanded && (
        <div className="bg-muted/5/50 border-t p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="ml-0 sm:ml-8 space-y-3">
            {client.invoices.map((inv) => (
              <InvoiceRow 
                 key={inv.id} 
                 invoice={inv} 
                 onEdit={onEditInvoice} 
                 onDelete={onDeleteInvoice} 
                 onDownload={onDownloadInvoice}
                 onSend={onSendInvoice}
              />
            ))}
          </div>
          
          <div className="mt-4 ml-8">
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs hover:text-primary hover:bg-primary/5" onClick={(e) => {
                e.stopPropagation(); 
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