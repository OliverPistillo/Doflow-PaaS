"use client";

import React from "react";
import { 
  Search, Bell, Filter, MoreHorizontal, 
  ArrowUpRight, Clock, CheckCircle2, AlertCircle, 
  PlayCircle, Factory 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// Dati Mock
const ACTIVE_JOBS = [
  { id: "#427-012", client: "Ferrari SpA", project: "Alberi Motore V8", value: 53154.00, status: "In Lavorazione", progress: 65, avatar: "FE", due: "2gg" },
  { id: "#426-001", client: "Dallara", project: "Telaio Carbonio Part", value: 27114.00, status: "Controllo Qualità", progress: 90, avatar: "DA", due: "4gg" },
  { id: "#424-112", client: "Leonardo", project: "Componenti Avionici", value: 61223.00, status: "Materiale Mancante", progress: 15, avatar: "LE", due: "16gg", warning: true },
  { id: "#417-020", client: "Brembo", project: "Pinze Freno Proto", value: 7311.00, status: "Pianificato", progress: 0, avatar: "BR", due: "19gg" },
];

export default function BusinaroDashboard() {
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
            {/* Tasto Attivo Neon */}
            <Button variant="default" className="rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-[0_0_15px_rgba(204,243,47,0.3)]">Produzione</Button>
            <Button variant="ghost" className="rounded-full px-6 hover:bg-muted font-medium text-muted-foreground">Logistica</Button>
          </nav>
          <div className="h-6 w-px bg-border mx-2 hidden md:block" />
          <div className="flex items-center gap-2 pr-2">
            <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-muted"><Bell className="h-5 w-5" /></Button>
            
            {/* TASTO TEMA */}
            <ThemeToggle />
            
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm cursor-pointer ml-2">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* --- KPI CARDS (Soft Style) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1 */}
        <div className="bg-card rounded-[2rem] p-7 shadow-sm border border-border/50 hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-5">
            <span className="text-muted-foreground font-semibold">Ritardi Critici</span>
            <div className="p-2.5 bg-red-500/10 rounded-full text-red-500"><AlertCircle className="h-5 w-5" /></div>
          </div>
          <div className="text-4xl font-bold mb-1">€ 31,211</div>
          <div className="text-xs text-red-500 font-bold mb-8 uppercase tracking-wide">Leonardo SpA (Attenzione)</div>
          <div className="flex gap-1 h-2.5 overflow-hidden rounded-full bg-muted/30">
             <div className="w-2/3 bg-primary rounded-full shadow-[0_0_10px_currentColor]" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-card rounded-[2rem] p-7 shadow-sm border border-border/50 hover:shadow-md transition-all">
           <div className="flex justify-between items-start mb-5">
            <span className="text-muted-foreground font-semibold">OEE Impianto</span>
            <div className="p-2.5 bg-primary/20 rounded-full text-primary-foreground dark:text-primary"><Factory className="h-5 w-5" /></div>
          </div>
          <div className="text-4xl font-bold mb-1">87.5%</div>
          <div className="text-xs text-muted-foreground font-medium mb-8">Target: 85%</div>
           <Progress value={87.5} className="h-2.5" indicatorColor="bg-primary shadow-[0_0_10px_currentColor]" />
        </div>

        {/* Card 3 */}
        <div className="bg-card rounded-[2rem] p-7 shadow-sm border border-border/50 hover:shadow-md transition-all">
           <div className="flex justify-between items-start mb-5">
            <span className="text-muted-foreground font-semibold">Lead Time</span>
            <div className="p-2.5 bg-blue-500/10 rounded-full text-blue-500"><Clock className="h-5 w-5" /></div>
          </div>
          <div className="text-4xl font-bold mb-1">12 <span className="text-xl font-medium text-muted-foreground">gg</span></div>
          <div className="text-xs text-muted-foreground font-medium mb-6">-3gg rispetto alla media</div>
           <div className="flex -space-x-3">
             {[1,2,3].map(i => (
               <div key={i} className="h-9 w-9 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold">OP{i}</div>
             ))}
             <div className="h-9 w-9 rounded-full border-2 border-card bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">+5</div>
           </div>
        </div>

        {/* Card 4 (Value) */}
        <div className="bg-card rounded-[2rem] p-7 shadow-sm border border-border/50 relative overflow-hidden flex flex-col justify-between group">
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors" />
           <div>
             <div className="flex justify-between items-start mb-2">
               <span className="text-muted-foreground font-semibold">Valore Produzione</span>
               <ArrowUpRight className="h-5 w-5 text-primary" />
             </div>
             <div className="text-3xl font-bold">€ 214,390</div>
             <div className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                <CheckCircle2 className="h-3 w-3" /> Healthy
             </div>
           </div>
           <div className="mt-4 flex gap-3">
             <div className="flex-1 p-3 rounded-2xl bg-primary text-primary-foreground flex flex-col items-center justify-center gap-1 shadow-lg shadow-primary/20 cursor-pointer hover:scale-105 transition-transform">
                <span className="text-2xl font-bold">#177</span>
                <span className="text-[10px] uppercase font-bold opacity-80">Priorità</span>
             </div>
           </div>
        </div>
      </div>

      {/* --- FILTRI E RICERCA --- */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex items-center gap-2 bg-card px-1.5 py-1.5 rounded-full border border-border shadow-sm">
              <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-sm font-bold px-2">Filtri Attivi</span>
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
                placeholder="Cerca commessa, cliente..." 
                className="w-full h-11 pl-11 pr-4 rounded-full bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all shadow-sm"
              />
           </div>
           <Button variant="ghost" size="icon" className="rounded-full bg-card border border-border h-11 w-11"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* --- LISTA COMMESSE (MAIN SECTION) --- */}
      <div className="bg-card rounded-[2.5rem] border border-border/50 shadow-sm overflow-hidden">
        
        {/* Toolbar interna */}
        <div className="p-8 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <h2 className="text-2xl font-bold">Commesse in Lavorazione</h2>
           <div className="flex bg-muted/40 p-1.5 rounded-full">
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground px-4">Tutte</Button>
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground px-4">Draft <span className="ml-2 bg-background px-1.5 py-0.5 rounded-full text-[10px] border shadow-sm">3</span></Button>
              <Button variant="default" size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-sm px-6">In Corso <span className="ml-2 bg-black/10 px-1.5 py-0.5 rounded-full text-[10px]">5</span></Button>
           </div>
        </div>

        {/* Tabella Cards */}
        <div className="p-8 grid gap-5">
          {ACTIVE_JOBS.map((job, idx) => (
             <div key={job.id} className={`
                group flex flex-col md:flex-row items-center gap-6 p-5 rounded-[2rem] transition-all duration-300 relative overflow-hidden
                ${idx === 0 
                  ? 'bg-card border-2 border-primary/50 shadow-[0_0_30px_rgba(204,243,47,0.05)] scale-[1.01] z-10' 
                  : 'bg-muted/20 border border-transparent hover:bg-muted/40 hover:scale-[1.005]'
                }
             `}>
                
                {/* ID & Avatar */}
                <div className="flex items-center gap-5 w-full md:w-1/4">
                   <Avatar className="h-14 w-14 rounded-3xl bg-background text-foreground font-black border border-border/50 shadow-sm">
                      <AvatarFallback className="rounded-3xl">{job.avatar}</AvatarFallback>
                   </Avatar>
                   <div>
                      <div className="font-bold text-xl tracking-tight">{job.id}</div>
                      <div className="text-xs text-muted-foreground font-bold flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded-full w-fit mt-1">
                        <Clock className="h-3 w-3" /> {job.due}
                      </div>
                   </div>
                </div>

                {/* Status Pill */}
                <div className="w-full md:w-auto flex justify-center">
                   <div className={`
                      px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm
                      ${job.warning 
                        ? 'bg-red-500 text-white' 
                        : 'bg-background border border-border text-foreground'
                      }
                   `}>
                      {job.status}
                   </div>
                </div>

                {/* Valore */}
                <div className="w-full md:w-auto text-right min-w-[120px]">
                   <div className="font-mono font-bold text-xl">€ {job.value.toLocaleString()}</div>
                </div>

                {/* Detail Panel (Darker/Lighter area) */}
                <div className="flex-1 w-full bg-muted/40 rounded-[1.5rem] p-5 flex flex-col md:flex-row items-center justify-between gap-6 group-hover:bg-muted/60 transition-colors">
                   
                   <div className="space-y-1.5 w-full md:w-auto">
                      <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Progetto</div>
                      <div className="font-bold text-sm">{job.project}</div>
                   </div>

                   <div className="space-y-1.5 w-full md:w-auto">
                      <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Cliente</div>
                      <div className="flex items-center gap-2">
                         <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 shadow-sm" />
                         <span className="font-bold text-sm">{job.client}</span>
                      </div>
                   </div>

                   <div className="space-y-2 w-full md:w-1/3">
                      <div className="flex justify-between text-[10px] mb-1">
                         <span className="text-muted-foreground font-black uppercase tracking-widest">Avanzamento</span>
                         <span className="font-mono font-bold">{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2.5 bg-background" indicatorColor={job.warning ? "bg-red-500" : "bg-primary shadow-[0_0_10px_currentColor]"} />
                   </div>

                   {/* Action Button */}
                   <Button size="icon" className={`
                      rounded-full w-12 h-12 shrink-0 shadow-sm transition-transform active:scale-95
                      ${idx === 0 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                        : 'bg-background hover:bg-foreground hover:text-background'
                      }
                   `}>
                      {idx === 0 ? <PlayCircle className="h-6 w-6" /> : <MoreHorizontal className="h-6 w-6" />}
                   </Button>

                </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}