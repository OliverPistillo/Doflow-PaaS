"use client";

import React, { useEffect, useState } from "react";
import { 
  Search, Bell, Filter, MoreHorizontal, 
  ArrowUpRight, Clock, CheckCircle2, AlertCircle, 
  PlayCircle, Factory 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { tenantFetch } from "@/lib/tenant-fetch"; // La tua lib per le chiamate autenticate

export default function BusinaroDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetching dati reali dal Backend
  useEffect(() => {
    async function loadData() {
      try {
        const res = await tenantFetch("/api/businaro/dashboard/stats");
        if (res.ok) {
           const data = await res.json();
           setStats(data);
        }
      } catch (err) {
        console.error("Errore caricamento dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground animate-pulse">
        <Factory className="h-10 w-10 animate-bounce mr-3" />
        Caricamento Control Plane...
      </div>
    );
  }

  // Fallback ai dati vuoti se la fetch fallisce o non ci sono dati
  const metrics = stats?.kpi || { overdueValue: 0, oee: 0, leadTime: 0, totalValue: 0 };
  const jobs = stats?.activeJobs || [];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      
      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-1 text-foreground">Panoramica Produzione</h1>
          <p className="text-muted-foreground font-medium">Bentornato, Master Officina.</p>
        </div>

        <div className="flex items-center gap-4 bg-card p-2 rounded-full shadow-sm border border-border/60">
          <nav className="hidden md:flex items-center gap-1">
            <Button variant="ghost" className="rounded-full px-6 hover:bg-muted font-medium text-muted-foreground">Stime</Button>
            <Button variant="default" className="rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-[0_0_15px_rgba(204,243,47,0.3)]">Produzione</Button>
            <Button variant="ghost" className="rounded-full px-6 hover:bg-muted font-medium text-muted-foreground">Logistica</Button>
          </nav>
          <div className="h-6 w-px bg-border mx-2 hidden md:block" />
          <div className="flex items-center gap-2 pr-2">
            <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-muted"><Bell className="h-5 w-5" /></Button>
            <ThemeToggle />
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm cursor-pointer ml-2">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* --- KPI CARDS (Connected to Backend) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Ritardi */}
        <div className="bg-card rounded-[2rem] p-7 shadow-sm border border-border/50 hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-5">
            <span className="text-muted-foreground font-semibold">Ritardi Critici</span>
            <div className="p-2.5 bg-red-500/10 rounded-full text-red-500"><AlertCircle className="h-5 w-5" /></div>
          </div>
          <div className="text-4xl font-bold mb-1">€ {metrics.overdueValue.toLocaleString()}</div>
          <div className="text-xs text-red-500 font-bold mb-8 uppercase tracking-wide">Attenzione Richiesta</div>
          <div className="flex gap-1 h-2.5 overflow-hidden rounded-full bg-muted/30">
             <div className="w-2/3 bg-primary rounded-full shadow-[0_0_10px_currentColor]" />
          </div>
        </div>

        {/* Card 2: OEE */}
        <div className="bg-card rounded-[2rem] p-7 shadow-sm border border-border/50 hover:shadow-md transition-all">
           <div className="flex justify-between items-start mb-5">
            <span className="text-muted-foreground font-semibold">OEE Impianto</span>
            <div className="p-2.5 bg-primary/20 rounded-full text-primary-foreground dark:text-primary"><Factory className="h-5 w-5" /></div>
          </div>
          <div className="text-4xl font-bold mb-1">{metrics.oee}%</div>
          <div className="text-xs text-muted-foreground font-medium mb-8">Target: 85%</div>
           <Progress value={metrics.oee} className="h-2.5" indicatorColor="bg-primary shadow-[0_0_10px_currentColor]" />
        </div>

        {/* Card 3: Lead Time */}
        <div className="bg-card rounded-[2rem] p-7 shadow-sm border border-border/50 hover:shadow-md transition-all">
           <div className="flex justify-between items-start mb-5">
            <span className="text-muted-foreground font-semibold">Lead Time</span>
            <div className="p-2.5 bg-blue-500/10 rounded-full text-blue-500"><Clock className="h-5 w-5" /></div>
          </div>
          <div className="text-4xl font-bold mb-1">{metrics.leadTime} <span className="text-xl font-medium text-muted-foreground">gg</span></div>
          <div className="text-xs text-muted-foreground font-medium mb-6">Media ultimi 30gg</div>
           <div className="flex -space-x-3">
             {[1,2,3].map(i => (
               <div key={i} className="h-9 w-9 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold">OP{i}</div>
             ))}
             <div className="h-9 w-9 rounded-full border-2 border-card bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">+</div>
           </div>
        </div>

        {/* Card 4: Valore Totale */}
        <div className="bg-card rounded-[2rem] p-7 shadow-sm border border-border/50 relative overflow-hidden flex flex-col justify-between group">
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors" />
           <div>
             <div className="flex justify-between items-start mb-2">
               <span className="text-muted-foreground font-semibold">Valore Produzione</span>
               <ArrowUpRight className="h-5 w-5 text-primary" />
             </div>
             <div className="text-3xl font-bold">€ {metrics.totalValue.toLocaleString()}</div>
             <div className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                <CheckCircle2 className="h-3 w-3" /> Healthy
             </div>
           </div>
        </div>
      </div>

      {/* --- FILTRI E RICERCA --- */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex items-center gap-2 bg-card px-1.5 py-1.5 rounded-full border border-border shadow-sm">
              <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">{jobs.length}</div>
              <span className="text-sm font-bold px-2">Commesse Attive</span>
           </div>
           {["Clienti", "Stato", "Data"].map(filter => (
             <Button key={filter} variant="outline" className="rounded-full border-border bg-transparent hover:bg-card px-5 font-medium">
               {filter} <span className="ml-2 text-xs opacity-50">▼</span>
             </Button>
           ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Cerca commessa..." 
                className="w-full h-11 pl-11 pr-4 rounded-full bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all shadow-sm"
              />
           </div>
           <Button variant="ghost" size="icon" className="rounded-full bg-card border border-border h-11 w-11"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* --- LISTA COMMESSE (Rendering Dinamico) --- */}
      <div className="bg-card rounded-[2.5rem] border border-border/50 shadow-sm overflow-hidden">
        
        <div className="p-8 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <h2 className="text-2xl font-bold">Commesse in Lavorazione</h2>
           <div className="flex bg-muted/40 p-1.5 rounded-full">
              <Button variant="default" size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-sm px-6">In Corso</Button>
           </div>
        </div>

        <div className="p-8 grid gap-5">
          {jobs.length === 0 && <p className="text-muted-foreground">Nessuna commessa attiva trovata.</p>}
          
          {jobs.map((job: any, idx: number) => (
             <div key={idx} className={`
                group flex flex-col md:flex-row items-center gap-6 p-5 rounded-[2rem] transition-all duration-300 relative overflow-hidden
                ${idx === 0 
                  ? 'bg-card border-2 border-primary/50 shadow-[0_0_30px_rgba(204,243,47,0.05)] scale-[1.01] z-10' 
                  : 'bg-muted/20 border border-transparent hover:bg-muted/40 hover:scale-[1.005]'
                }
             `}>
                
                <div className="flex items-center gap-5 w-full md:w-1/4">
                   <Avatar className="h-14 w-14 rounded-3xl bg-background text-foreground font-black border border-border/50 shadow-sm">
                      <AvatarFallback className="rounded-3xl">JOB</AvatarFallback>
                   </Avatar>
                   <div>
                      <div className="font-bold text-xl tracking-tight">{job.id}</div>
                      <div className="text-xs text-muted-foreground font-bold flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-full w-fit mt-1">
                        <Clock className="h-3 w-3" /> {job.due}
                      </div>
                   </div>
                </div>

                <div className="w-full md:w-auto flex justify-center">
                   <div className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm bg-background border border-border text-foreground">
                      {job.status}
                   </div>
                </div>

                <div className="w-full md:w-auto text-right min-w-[120px]">
                   <div className="font-mono font-bold text-xl">€ {job.value.toLocaleString()}</div>
                </div>

                <div className="flex-1 w-full bg-muted/40 rounded-[1.5rem] p-5 flex flex-col md:flex-row items-center justify-between gap-6 group-hover:bg-muted/60 transition-colors">
                   <div className="space-y-1.5 w-full md:w-auto">
                      <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Progetto</div>
                      <div className="font-bold text-sm">{job.project}</div>
                   </div>
                   <div className="space-y-1.5 w-full md:w-auto">
                      <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Cliente</div>
                      <div className="font-bold text-sm">{job.client}</div>
                   </div>
                   <div className="space-y-2 w-full md:w-1/3">
                      <div className="flex justify-between text-[10px] mb-1">
                         <span className="text-muted-foreground font-black uppercase tracking-widest">Avanzamento</span>
                         <span className="font-mono font-bold">{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2.5 bg-background" indicatorColor="bg-primary shadow-[0_0_10px_currentColor]" />
                   </div>
                   <Button size="icon" className="rounded-full w-12 h-12 shrink-0 bg-background hover:bg-foreground hover:text-background shadow-sm">
                      <MoreHorizontal className="h-6 w-6" />
                   </Button>
                </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}