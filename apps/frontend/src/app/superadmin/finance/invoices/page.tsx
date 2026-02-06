"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Search, Filter, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Invoice = {
  id: string;
  number: string;
  service: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: "Paid" | "Unpaid" | "Overdue";
  notes: string;
  paymentMethod: string;
  paymentDate: string;
};

type ClientGroup = {
  id: string;
  name: string;
  type: string;
  industry: string;
  phone: string;
  status: "Attivo" | "Potenziale cliente";
  invoices: Invoice[];
};

const DATA: ClientGroup[] = [
  {
    id: "c1",
    name: "Urban Eats",
    type: "SMB",
    industry: "Ospitalità",
    phone: "+1 (415) 555-0147",
    status: "Attivo",
    invoices: [
      { id: "inv1", number: "4", service: "Integrazione CRM", issueDate: "7/5/2024", dueDate: "21/5/2024", amount: 2200.00, status: "Paid", notes: "Paid in full, thank you.", paymentMethod: "Credit Card", paymentDate: "5/2/2026" },
      { id: "inv2", number: "5", service: "Annual subscription", issueDate: "1/5/2024", dueDate: "15/5/2024", amount: 320.75, status: "Paid", notes: "", paymentMethod: "Credit Card", paymentDate: "15/5/2024" }
    ]
  },
  {
    id: "c2",
    name: "NextGen Robotics",
    type: "Startup",
    industry: "Robotica",
    phone: "+1 (412) 555-0177",
    status: "Potenziale cliente",
    invoices: [
      { id: "inv3", number: "12", service: "Mu Dynamics SaaS Subsc", issueDate: "24/5/2024", dueDate: "7/6/2024", amount: 950.00, status: "Unpaid", notes: "Awaiting PO from client.", paymentMethod: "Credit Card", paymentDate: "—" }
    ]
  }
];

const STATUS_STYLES = {
  Paid: "bg-emerald-100 text-emerald-700",
  Unpaid: "bg-blue-100 text-blue-700",
  Overdue: "bg-red-100 text-red-700"
};

const CLIENT_STATUS_STYLES = {
  Attivo: "bg-green-100 text-green-800",
  "Potenziale cliente": "bg-sky-100 text-sky-800"
};

export default function InvoicesPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ c1: true, c2: true });

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Elenco Clienti & Fatturazione</h1>
          <p className="text-slate-500 text-sm">Gestisci clienti, visualizza fatture e pagamenti.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-2" /> Filtra</Button>
           <div className="relative">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
             <Input className="pl-9 h-9 w-[250px]" placeholder="Cerca cliente..." />
           </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Header Table Fake */}
        <div className="grid grid-cols-[30px_2fr_1fr_1fr_1fr_1fr] px-4 py-2 text-xs font-bold text-slate-500 uppercase border-b bg-slate-50/50">
            <div></div>
            <div>Client</div>
            <div>Tipo</div>
            <div>Settore</div>
            <div>Telefono</div>
            <div>Stato</div>
        </div>

        {DATA.map((client) => (
          <div key={client.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
            {/* Riga Cliente */}
            <div className="grid grid-cols-[30px_2fr_1fr_1fr_1fr_1fr] px-4 py-4 items-center hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => toggle(client.id)}>
               <div className="flex justify-center">
                 {expanded[client.id] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
               </div>
               <div className="font-bold text-lg text-slate-800">{client.name}</div>
               <div><Badge variant="outline" className="bg-slate-100 font-normal">{client.type}</Badge></div>
               <div className="text-sm text-slate-600">{client.industry}</div>
               <div className="text-sm text-slate-500 font-mono">{client.phone}</div>
               <div>
                 <Badge variant="secondary" className={`font-normal ${CLIENT_STATUS_STYLES[client.status] || 'bg-slate-100'}`}>
                    {client.status}
                 </Badge>
               </div>
            </div>

            {/* Area Fatture Espansa */}
            {expanded[client.id] && (
              <div className="bg-slate-50/30 border-t p-4">
                 <div className="ml-8 space-y-4">
                    {client.invoices.map((inv) => (
                        <div key={inv.id} className="bg-white border rounded-md p-4 text-sm shadow-sm space-y-3">
                            <div className="grid grid-cols-[100px_1fr_120px_120px_120px_100px_1fr] gap-4 items-start border-b border-slate-100 pb-3">
                                <div className="text-xs text-slate-500 uppercase font-bold">Invoice #{inv.number}</div>
                                <div className="font-medium text-slate-700 bg-slate-100 px-2 rounded w-fit">{inv.service}</div>
                                <div className="text-slate-500"><span className="text-[10px] uppercase block text-slate-400">Issue</span>{inv.issueDate}</div>
                                <div className="text-slate-500"><span className="text-[10px] uppercase block text-slate-400">Due</span>{inv.dueDate}</div>
                                <div className="font-mono font-medium">€{inv.amount.toFixed(2)}</div>
                                <div><Badge className={STATUS_STYLES[inv.status]}>{inv.status}</Badge></div>
                                <div className="text-slate-400 italic text-xs">{inv.notes}</div>
                            </div>
                            
                            {/* Dettagli pagamento */}
                            <div className="grid grid-cols-[1fr_120px_1fr] gap-4 items-center pl-4 border-l-2 border-indigo-100">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 gap-1">
                                        <CreditCard className="h-3 w-3" /> {inv.paymentMethod}
                                    </Badge>
                                    <span className="font-mono font-bold text-slate-700">€{inv.amount.toFixed(2)}</span> {/* Assuming partial payments not handled in mock */}
                                </div>
                                <div className="text-slate-500 text-xs">{inv.paymentDate}</div>
                                <div className="text-slate-400 text-xs italic">{inv.notes}</div>
                            </div>
                        </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-indigo-600 pl-0">
                        <Plus className="h-3 w-3 mr-1" /> Add record
                    </Button>
                 </div>
              </div>
            )}
          </div>
        ))}
        
        <div className="pt-2">
            <Button variant="ghost" className="text-slate-500"><Plus className="h-4 w-4 mr-2" /> Add record</Button>
        </div>
      </div>
    </div>
  );
}