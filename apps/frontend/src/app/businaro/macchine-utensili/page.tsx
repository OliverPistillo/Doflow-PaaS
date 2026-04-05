"use client";

import * as React from "react";
import { ArrowRight, Box, Hammer, Activity, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
// import { tenantFetch } from "@/lib/tenant-fetch";

const MOCK_HISTORY = [
  { id: 1, source: "ACCIAIO-BARRA-30", target: "ALBERO-GREZZO", qty: 10, time: "10:45" },
  { id: 2, source: "IRON-SHEET-5MM", target: "STAMPO-A1", qty: 25, time: "09:30" },
];

export default function BusinaroMachineToolsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState({ sourceSku: "", targetSku: "", qty: 1 });

  const execute = async () => {
    setLoading(true);
    // Simulazione chiamata
    setTimeout(() => {
         toast({ title: "TRASFORMAZIONE OK", className: "bg-gradient-primary border-none font-bold text-white" });
         setForm({ sourceSku: "", targetSku: "", qty: 1 });
         setLoading(false);
    }, 1000)
  };

  return (
    <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500 font-sans">
      
      <div className="lg:col-span-2 space-y-8">
         <div>
            <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">Trasformazione Materiale</h1>
         </div>

         <div className="grid gap-8">
            {/* INPUT GREZZO (Glass con bordo gradiente attivo) */}
            <div className="glass rounded-[2.5rem] p-10 relative overflow-hidden group focus-within:ring-2 ring-blue-500 transition-all">
               <div className="absolute top-0 left-0 w-3 h-full bg-gradient-to-b from-blue-400 to-blue-600" />
               <h2 className="text-sm font-bold text-blue-500 mb-4 flex items-center gap-3 uppercase tracking-widest">
                  <Box className="h-5 w-5" /> Materiale in Ingresso (Grezzo)
               </h2>
               <Input 
                  autoFocus
                  placeholder="SCANSIONA GREZZO..."
                  value={form.sourceSku}
                  onChange={(e) => setForm({...form, sourceSku: e.target.value.toUpperCase()})}
                  className="h-24 text-4xl font-black tracking-wider bg-transparent border-0 border-b-2 border-accent focus-visible:border-blue-500 focus-visible:ring-0 rounded-none px-0 transition-all placeholder:text-muted-foreground/50"
               />
            </div>

            {/* FRECCIA */}
            <div className="flex justify-center -my-4 z-10 relative">
               <div className="glass p-4 rounded-full shadow-xl text-muted-foreground bg-background/50 backdrop-blur-md">
                  <ArrowRight className="h-8 w-8" />
               </div>
            </div>

            {/* INPUT FINITO */}
            <div className="glass rounded-[2.5rem] p-10 relative overflow-hidden group focus-within:ring-2 ring-purple-500 transition-all">
               <div className="absolute top-0 left-0 w-3 h-full bg-gradient-to-b from-purple-400 to-purple-600" />
               <h2 className="text-sm font-bold text-purple-500 mb-4 flex items-center gap-3 uppercase tracking-widest">
                  <Hammer className="h-5 w-5" /> Prodotto Finito (Semilavorato)
               </h2>
               <Input 
                  placeholder="SCANSIONA FINITO..."
                  value={form.targetSku}
                  onChange={(e) => setForm({...form, targetSku: e.target.value.toUpperCase()})}
                  className="h-24 text-4xl font-black tracking-wider bg-transparent border-0 border-b-2 border-accent focus-visible:border-purple-500 focus-visible:ring-0 rounded-none px-0 transition-all placeholder:text-muted-foreground/50"
               />
            </div>

            {/* ACTION BAR */}
            <div className="glass rounded-[2.5rem] p-6 flex gap-6 items-center">
               <div className="w-1/3 bg-accent/30 rounded-[1.5rem] p-4 flex flex-col justify-center border border-white/5">
                  <label className="text-xs font-bold uppercase text-muted-foreground text-center mb-1">Quantità</label>
                  <Input 
                     type="number" value={form.qty} onChange={(e) => setForm({...form, qty: parseInt(e.target.value)})}
                     className="h-16 text-center text-4xl font-black bg-transparent border-none focus-visible:ring-0"
                  />
               </div>
               <Button 
                  onClick={execute} disabled={loading || !form.sourceSku || !form.targetSku}
                  className="flex-1 h-24 rounded-[2rem] text-2xl font-black uppercase tracking-widest bg-gradient-primary hover:opacity-90 shadow-xl shadow-primary/30 transition-all active:scale-95"
               >
                  {loading ? "..." : "Conferma"} <Save className="ml-4 h-8 w-8" />
               </Button>
            </div>
         </div>
      </div>

      {/* --- SIDEBAR LOGS --- */}
      <div className="lg:col-span-1">
         <div className="glass rounded-[2.5rem] p-8 h-full relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-8 text-muted-foreground font-black uppercase tracking-widest text-sm">
               <Activity className="h-5 w-5 text-primary" /> Ultimi Movimenti
            </div>
            <div className="space-y-4 relative z-10">
               {MOCK_HISTORY.map((log) => (
                  <div key={log.id} className="p-5 rounded-[1.5rem] bg-accent/30 border border-white/5 flex items-center justify-between hover:bg-accent/50 transition-colors backdrop-blur-md shadow-sm">
                     <div>
                        <div className="font-black text-base">{log.target}</div>
                        <div className="text-xs font-bold text-muted-foreground mt-1">da {log.source} <span className="opacity-50">({log.time})</span></div>
                     </div>
                     <div className="bg-gradient-primary px-4 py-2 rounded-xl font-black text-xl shadow-md">+{log.qty}</div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}