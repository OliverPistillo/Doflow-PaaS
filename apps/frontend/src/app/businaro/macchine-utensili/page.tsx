"use client";

import * as React from "react";
import { ArrowRight, Box, Hammer, Activity, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { tenantFetch } from "@/lib/tenant-fetch";
import { cn } from "@/lib/utils";

// Mock History per non lasciare la pagina vuota
const MOCK_HISTORY = [
  { id: 1, source: "ACCIAIO-BARRA-30", target: "ALBERO-GREZZO", qty: 10, time: "10:45" },
  { id: 2, source: "IRON-SHEET-5MM", target: "STAMPO-A1", qty: 25, time: "09:30" },
  { id: 3, source: "ALLUMINIO-BLOCK", target: "TESTATA-V6", qty: 2, time: "Ieri" },
];

export default function BusinaroMachineToolsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const [form, setForm] = React.useState({
    sourceSku: "",
    targetSku: "",
    qty: 1
  });

  const handleScan = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const execute = async () => {
    if (!form.sourceSku || !form.targetSku) {
       toast({ title: "Dati mancanti", description: "Inserisci entrambi i codici.", variant: "destructive" });
       return;
    }

    setLoading(true);
    try {
      const res = await tenantFetch("/api/businaro/production/machine-tools/transform", {
        method: "POST",
        body: JSON.stringify({ ...form, quantity: Number(form.qty) }),
      });

      if (!res.ok) throw new Error("Errore backend");

      toast({
        title: "TRASFORMAZIONE OK",
        description: `${form.qty}x ${form.sourceSku} -> ${form.targetSku}`,
        className: "bg-primary text-primary-foreground border-none font-bold",
      });
      setForm({ sourceSku: "", targetSku: "", qty: 1 });
    } catch (e) {
      toast({ title: "Errore", description: "Impossibile registrare.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      
      {/* --- COLONNA SINISTRA: INPUT FORM --- */}
      <div className="lg:col-span-2 space-y-6">
         
         <div className="flex flex-col gap-2 mb-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Trasformazione Materiale</h1>
            <p className="text-muted-foreground font-medium">Registra la lavorazione da Grezzo a Semilavorato.</p>
         </div>

         <div className="grid gap-6">
            {/* CARD 1: SOURCE */}
            <div className="bg-card border border-border rounded-[2rem] p-8 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-2 h-full bg-blue-500" />
               <h2 className="text-lg font-bold text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Box className="text-blue-500" /> Materiale in Ingresso (Grezzo)
               </h2>
               <Input 
                  autoFocus
                  placeholder="SCANSIONA GREZZO..."
                  value={form.sourceSku}
                  onChange={(e) => handleScan("sourceSku", e.target.value)}
                  className="h-20 text-3xl font-mono font-bold bg-muted/30 border-2 border-border focus-visible:ring-blue-500/50 rounded-xl"
               />
            </div>

            {/* FRECCIA CENTRALE */}
            <div className="flex justify-center -my-2 z-10">
               <div className="bg-card border border-border p-3 rounded-full shadow-sm">
                  <ArrowRight className="h-6 w-6 text-foreground" />
               </div>
            </div>

            {/* CARD 2: TARGET */}
            <div className="bg-card border border-border rounded-[2rem] p-8 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
               <h2 className="text-lg font-bold text-muted-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Hammer className="text-primary" /> Prodotto Finito (Semilavorato)
               </h2>
               <Input 
                  placeholder="SCANSIONA FINITO..."
                  value={form.targetSku}
                  onChange={(e) => handleScan("targetSku", e.target.value)}
                  className="h-20 text-3xl font-mono font-bold bg-muted/30 border-2 border-border focus-visible:ring-primary/50 rounded-xl"
               />
            </div>

            {/* CARD 3: QTY & ACTION */}
            <div className="flex gap-4">
               <div className="w-1/3 bg-card border border-border rounded-[2rem] p-6 flex flex-col justify-center">
                  <label className="text-xs font-bold uppercase text-muted-foreground mb-2">Quantità</label>
                  <Input 
                     type="number"
                     value={form.qty}
                     onChange={(e) => setForm({...form, qty: parseInt(e.target.value)})}
                     className="h-16 text-center text-3xl font-bold bg-muted/30 border-border rounded-xl"
                  />
               </div>
               <Button 
                  onClick={execute}
                  disabled={loading}
                  className="flex-1 h-auto rounded-[2rem] text-2xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(204,243,47,0.3)] transition-all active:scale-95"
               >
                  {loading ? "Registrazione..." : "Conferma Trasformazione"}
                  {!loading && <Save className="ml-3 h-6 w-6" />}
               </Button>
            </div>
         </div>
      </div>

      {/* --- COLONNA DESTRA: LIVE LOGS --- */}
      <div className="lg:col-span-1">
         <div className="bg-card border border-border rounded-[2rem] p-6 h-full shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-muted-foreground font-bold uppercase tracking-widest text-sm">
               <Activity className="h-4 w-4" /> Ultimi Movimenti
            </div>
            
            <div className="space-y-4">
               {MOCK_HISTORY.map((log) => (
                  <div key={log.id} className="p-4 rounded-2xl bg-muted/20 border border-border flex items-center justify-between group hover:bg-muted/40 transition-colors">
                     <div>
                        <div className="text-[10px] font-bold text-muted-foreground mb-1">{log.time}</div>
                        <div className="font-bold text-sm text-foreground">{log.target}</div>
                        <div className="text-xs text-muted-foreground">da {log.source}</div>
                     </div>
                     <div className="bg-background border border-border px-3 py-1 rounded-lg font-mono font-bold text-lg">
                        +{log.qty}
                     </div>
                  </div>
               ))}
               
               {/* Empty state filler */}
               <div className="p-8 text-center text-muted-foreground text-xs opacity-50 border-2 border-dashed border-border rounded-2xl">
                  In attesa di nuovi dati...
               </div>
            </div>
         </div>
      </div>

    </div>
  );
}