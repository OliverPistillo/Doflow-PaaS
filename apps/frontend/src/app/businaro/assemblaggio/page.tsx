"use client";

import * as React from "react";
import { Wrench, QrCode, ClipboardList, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { tenantFetch } from "@/lib/tenant-fetch";

const ACTIVE_TASKS_MOCK = [
  { job: "C-2024-001", sku: "KIT-VITERIA-A", qty: 45, status: "OK" },
  { job: "C-2024-001", sku: "GUARNIZIONE-X", qty: 12, status: "OK" },
];

export default function BusinaroAssemblyKioskPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  
  const [data, setData] = React.useState({ job: "", sku: "", qty: 1 });

  const confirm = async () => {
    if(!data.job || !data.sku) return;
    setLoading(true);
    try {
       await tenantFetch("/api/businaro/assembly/consume", { method: "POST", body: JSON.stringify({ jobOrderCode: data.job, sku: data.sku, quantity: data.qty }) });
       toast({ title: "CONSUMO OK", className: "bg-primary text-primary-foreground font-bold" });
       setData(p => ({ ...p, sku: "", qty: 1 })); // Reset parziale
    } catch {
       toast({ title: "Errore", variant: "destructive" });
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
       
       {/* LEFT: ACTION */}
       <div className="lg:col-span-2 space-y-6">
          <div className="mb-4">
             <h1 className="text-3xl font-extrabold text-foreground">Assemblaggio</h1>
             <p className="text-muted-foreground font-medium">Scarico componenti su commessa attiva.</p>
          </div>

          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm space-y-8">
             
             {/* 1. JOB */}
             <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                   <ClipboardList className="h-4 w-4" /> Commessa (Job Order)
                </label>
                <Input 
                   value={data.job}
                   onChange={e => setData({...data, job: e.target.value.toUpperCase()})}
                   placeholder="SCANSIONA JOB..."
                   className="h-16 text-2xl font-mono font-bold bg-muted/30 border-2 border-border focus-visible:ring-primary rounded-xl"
                />
             </div>

             <div className="h-px bg-border/50" />

             {/* 2. SKU & QTY */}
             <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-3">
                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <QrCode className="h-4 w-4" /> Componente (SKU)
                   </label>
                   <Input 
                      value={data.sku}
                      onChange={e => setData({...data, sku: e.target.value.toUpperCase()})}
                      placeholder="SCANSIONA COMPONENTE..."
                      className="h-20 text-2xl font-mono font-bold bg-muted/30 border-2 border-border focus-visible:ring-primary rounded-xl"
                   />
                </div>
                <div className="w-full md:w-40 space-y-3">
                   <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Q.tà</label>
                   <Input 
                      type="number"
                      value={data.qty}
                      onChange={e => setData({...data, qty: Number(e.target.value)})}
                      className="h-20 text-center text-3xl font-bold bg-muted/30 border-2 border-border rounded-xl"
                   />
                </div>
             </div>

             {/* BUTTON */}
             <Button 
                onClick={confirm}
                disabled={loading || !data.job || !data.sku}
                className="w-full h-24 rounded-[2rem] text-3xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
             >
                {loading ? "..." : "Registra Consumo"}
             </Button>

          </div>
       </div>

       {/* RIGHT: LIST */}
       <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-[2.5rem] p-6 h-full shadow-sm flex flex-col">
             <div className="text-sm font-bold uppercase text-muted-foreground tracking-widest mb-6 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Attività Recenti
             </div>
             
             <div className="space-y-3 flex-1">
                {ACTIVE_TASKS_MOCK.map((t, i) => (
                   <div key={i} className="bg-muted/20 border border-border p-4 rounded-2xl flex items-center justify-between">
                      <div>
                         <div className="text-[10px] font-bold text-muted-foreground">{t.job}</div>
                         <div className="font-bold text-sm">{t.sku}</div>
                      </div>
                      <div className="text-xl font-mono font-bold">-{t.qty}</div>
                   </div>
                ))}
             </div>
          </div>
       </div>

    </div>
  );
}