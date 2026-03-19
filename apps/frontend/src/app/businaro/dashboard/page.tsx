"use client";

import React, { useEffect, useState } from "react";
import { 
  Search, Filter, ArrowUpRight, Clock, 
  AlertCircle, Factory, MoreHorizontal 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress"; 
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { tenantFetch } from "@/lib/tenant-fetch";

export default function BusinaroDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // const res = await tenantFetch("/api/businaro/dashboard/stats");
        // if (res.ok) setStats(await res.json());
        // MOCK DATA PER VEDERE L'UI SUBITO
        setTimeout(() => {
             setStats({
                 kpi: { overdueValue: 31211, oee: 87.5, leadTime: 12, totalValue: 214390 },
                 activeJobs: [
                     { id: "#427-012", client: "Ferrari SpA", project: "Alberi V8", value: 53154, status: "In Lavorazione", progress: 65, due: "2gg" },
                     { id: "#424-112", client: "Leonardo", project: "Avionica", value: 61223, status: "Materiale Mancante", progress: 15, due: "16gg", warning: true },
                     { id: "#426-001", client: "Dallara", project: "Telaio Carbonio", value: 27114, status: "Controllo Qualità", progress: 90, due: "4gg" },
                 ]
             });
             setLoading(false);
        }, 1000)
      } catch (err) { console.error(err); setLoading(false); }
    }
    loadData();
  }, []);

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Factory className="h-10 w-10 animate-bounce text-primary" /></div>;

  const metrics = stats?.kpi || { overdueValue: 0, oee: 0, leadTime: 0, totalValue: 0 };
  const jobs = stats?.activeJobs || [];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700 font-sans">
      
      {/* --- HEADER & FILTRI --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">Panoramica Produzione</h1>
        </div>
        <div className="flex items-center gap-3 glass p-1.5 rounded-full">
           <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Cerca..." className="w-full h-10 pl-10 pr-4 rounded-full bg-transparent focus:outline-none text-sm" />
           </div>
           <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-accent/50"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* --- KPI CARDS (AURORA GLASS STYLE) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Ritardi (Gradiente Rosso/Arancio) */}
        <div className="glass rounded-[2.5rem] p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/30 to-orange-500/30 blur-[60px] rounded-full -mr-10 -mt-10 pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl text-white shadow-lg">
                <AlertCircle className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Ritardi</span>
          </div>
          <div className="text-5xl font-black mb-2 tracking-tight">€ {metrics.overdueValue.toLocaleString()}</div>
          <div className="text-sm text-red-500 font-bold flex items-center gap-1">
             <ArrowUpRight className="h-4 w-4" /> Attenzione richiesta
          </div>
        </div>

        {/* Card 2: OEE (Gradiente Blu/Viola) */}
        <div className="glass rounded-[2.5rem] p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/30 to-purple-500/30 blur-[60px] rounded-full -mr-10 -mt-10 pointer-events-none group-hover:scale-110 transition-transform" />
           <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl text-white shadow-lg">
                <Factory className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">OEE Impianto</span>
          </div>
          <div className="text-5xl font-black mb-4 tracking-tight">{metrics.oee}%</div>
           <Progress value={metrics.oee} className="h-3 bg-accent/50" indicatorColor="bg-gradient-to-r from-blue-500 to-purple-600" />
        </div>

        {/* Card 3: Lead Time (Gradiente Verde/Acqua) */}
        <div className="glass rounded-[2.5rem] p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 blur-[60px] rounded-full -mr-10 -mt-10 pointer-events-none group-hover:scale-110 transition-transform" />
           <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg">
                <Clock className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Lead Time</span>
          </div>
          <div className="text-5xl font-black mb-2 tracking-tight">{metrics.leadTime} <span className="text-2xl text-muted-foreground font-bold">gg</span></div>
          <div className="text-sm text-emerald-500 font-bold flex items-center gap-1">
             In linea col target
          </div>
        </div>

        {/* Card 4: Valore (Gradiente Principale) */}
        <div className="rounded-[2.5rem] p-8 relative overflow-hidden text-white bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 shadow-2xl">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />
           <div>
             <div className="text-sm font-bold uppercase tracking-widest opacity-80 mb-4">Valore Produzione</div>
             <div className="text-5xl font-black mb-2 tracking-tight">€ {metrics.totalValue.toLocaleString()}</div>
             <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-sm font-bold">
                Healthy Status
             </div>
           </div>
        </div>
      </div>

      {/* --- LISTA COMMESSE (GLASS TABLE STYLE) --- */}
      <div className="glass rounded-[3rem] overflow-hidden p-8">
        <div className="flex justify-between items-center mb-8">
           <h2 className="text-2xl font-black tracking-tight">Commesse Attive</h2>
           <Button className="rounded-full bg-gradient-primary font-bold shadow-lg shadow-primary/30">Vedi Tutte</Button>
        </div>

        <div className="grid gap-4">
          {jobs.map((job: any, idx: number) => (
             <div key={idx} className={`
                group flex flex-col md:flex-row items-center gap-6 p-5 rounded-[2rem] transition-all duration-300 relative overflow-hidden
                ${idx === 0 ? 'glass border-primary/30 shadow-lg' : 'hover:bg-accent/30 border border-transparent'}
             `}>
                
                {/* Avatar & ID */}
                <div className="flex items-center gap-4 w-full md:w-1/4">
                   <Avatar className="h-14 w-14 rounded-2xl border-2 border-white/30 shadow-sm">
                      <AvatarFallback className="rounded-2xl bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-900 font-black text-muted-foreground">JOB</AvatarFallback>
                   </Avatar>
                   <div>
                      <div className="font-black text-lg tracking-tight">{job.id}</div>
                      <div className="text-xs font-bold text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" /> Scadenza: {job.due}
                      </div>
                   </div>
                </div>

                {/* Status Pill */}
                <div className="w-full md:w-auto flex justify-center min-w-[150px]">
                   <div className={`
                      px-4 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest shadow-sm backdrop-blur-md
                      ${job.warning ? 'bg-red-500/90 text-white' : 'bg-accent/50 text-foreground border border-white/10'}
                   `}>
                      {job.status}
                   </div>
                </div>

                 {/* Dettagli e Progress */}
                <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-6 bg-accent/20 rounded-[1.5rem] p-4 px-6 group-hover:bg-accent/30 transition-colors">
                   <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Cliente</div>
                      <div className="font-bold">{job.client}</div>
                   </div>
                   <div className="space-y-1 flex-1 max-w-xs">
                       <div className="flex justify-between text-[10px] mb-1 font-black uppercase tracking-widest text-muted-foreground">
                         <span>Progresso</span>
                         <span>{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2 bg-accent/50" indicatorColor={job.warning ? "bg-red-500" : "bg-gradient-primary"} />
                   </div>
                </div>
                 
                 {/* Valore & Action */}
                 <div className="flex items-center gap-4">
                     <div className="font-black text-xl tracking-tight">€ {job.value.toLocaleString()}</div>
                     <Button size="icon" variant="ghost" className="rounded-full hover:bg-accent/50"><MoreHorizontal /></Button>
                 </div>

             </div>
          ))}
        </div>
      </div>
    </div>
  );
}