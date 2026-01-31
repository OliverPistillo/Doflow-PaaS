"use client";

import React from "react";
import { 
  Search, Bell, Settings, Filter, MoreHorizontal, 
  ArrowUpRight, Clock, CheckCircle2, AlertCircle, 
  PlayCircle, Factory, Truck, Users, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress"; // Assicurati di aver installato il componente Progress
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle"; // Il componente che abbiamo creato prima

// Dati Mock per la dashboard arricchita
const METRICS = {
  oee: 87.5, // Overall Equipment Effectiveness
  activeJobsValue: 214390.00,
  productionLeadTime: 12, // Giorni
  wipItems: 1450,
};

const ACTIVE_JOBS = [
  { id: "#427-012", client: "Ferrari SpA", project: "Alberi Motore V8", value: 53154.00, status: "In Lavorazione", progress: 65, avatar: "FE", due: "2gg" },
  { id: "#426-001", client: "Dallara", project: "Telaio Carbonio Part", value: 27114.00, status: "Controllo Qualità", progress: 90, avatar: "DA", due: "4gg" },
  { id: "#424-112", client: "Leonardo", project: "Componenti Avionici", value: 61223.00, status: "Materiale Mancante", progress: 15, avatar: "LE", due: "16gg", warning: true },
  { id: "#417-020", client: "Brembo", project: "Pinze Freno Proto", value: 7311.00, status: "Pianificato", progress: 0, avatar: "BR", due: "19gg" },
];

export default function BusinaroDashboard() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      
      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-1">Panoramica Produzione</h1>
          <p className="text-muted-foreground">Bentornato, Master Officina. Ecco la situazione in tempo reale.</p>
        </div>

        <div className="flex items-center gap-4 bg-card p-2 rounded-full shadow-sm border border-border/50">
          <nav className="flex items-center gap-1">
            <Button variant="ghost" className="rounded-full px-6 hover:bg-muted text-muted-foreground">Stime</Button>
            <Button variant="default" className="rounded-full px-6 bg-neon text-black hover:bg-neon-hover font-bold shadow-[0_0_15px_rgba(204,243,47,0.4)]">Produzione</Button>
            <Button variant="ghost" className="rounded-full px-6 hover:bg-muted text-muted-foreground">Logistica</Button>
          </nav>
          <div className="h-6 w-px bg-border mx-2" />
          <div className="flex items-center gap-2 pr-2">
            <Button variant="ghost" size="icon" className="rounded-full w-10 h-10"><Bell className="h-5 w-5" /></Button>
            <ThemeToggle /> {/* Switch Dark/Light */}
            <Avatar className="h-10 w-10 border-2 border-card shadow-sm cursor-pointer">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* --- KPI CARDS (Stile Salesforce) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Valore in Ritardo (Alert) */}
        <div className="bg-card rounded-3xl p-6 shadow-sm border border-border/50 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-4">
            <span className="text-muted-foreground font-medium">Ritardi Critici</span>
            <div className="p-2 bg-red-500/10 rounded-full text-red-500"><AlertCircle className="h-5 w-5" /></div>
          </div>
          <div className="text-3xl font-bold mb-1">€ 31,211.00</div>
          <div className="text-xs text-red-500 font-medium mb-6">Commessa #424-112 (Leonardo)</div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span>Settembre</span>
              <span>Ottobre</span>
            </div>
            <div className="flex gap-1">
              <div className="h-2 w-full bg-neon rounded-full" />
              <div className="h-2 w-1/3 bg-muted rounded-full" />
            </div>
          </div>
        </div>

        {/* Card 2: Efficienza Macchine (OEE) */}
        <div className="bg-card rounded-3xl p-6 shadow-sm border border-border/50 group hover:shadow-md transition-all">
           <div className="flex justify-between items-start mb-4">
            <span className="text-muted-foreground font-medium">OEE Impianto</span>
            <div className="p-2 bg-neon/10 rounded-full text-black dark:text-neon"><Factory className="h-5 w-5" /></div>
          </div>
          <div className="text-3xl font-bold mb-1">87.5%</div>
          <div className="text-xs text-muted-foreground mb-6">Target mensile: 85%</div>
           <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span>Performance</span>
              <span className="text-neon-dark font-bold">+2.5%</span>
            </div>
            <Progress value={87.5} className="h-2" indicatorColor="bg-neon" />
          </div>
        </div>

        {/* Card 3: Lead Time */}
        <div className="bg-card rounded-3xl p-6 shadow-sm border border-border/50 group hover:shadow-md transition-all">
           <div className="flex justify-between items-start mb-4">
            <span className="text-muted-foreground font-medium">Tempo Medio Prod.</span>
            <div className="p-2 bg-blue-500/10 rounded-full text-blue-500"><Clock className="h-5 w-5" /></div>
          </div>
          <div className="text-3xl font-bold mb-1">12 <span className="text-lg font-normal text-muted-foreground">giorni</span></div>
          <div className="text-xs text-muted-foreground mb-6">-3gg rispetto alla media</div>
          
           {/* Mini Avatar Stack */}
           <div className="flex -space-x-3 pt-2">
             {[1,2,3,4].map(i => (
               <div key={i} className="h-8 w-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold">
                 OP{i}
               </div>
             ))}
             <div className="h-8 w-8 rounded-full border-2 border-card bg-neon flex items-center justify-center text-[10px] font-bold text-black">+5</div>
           </div>
        </div>

        {/* Card 4: Action / Value */}
        <div className="bg-card rounded-3xl p-6 shadow-sm border border-border/50 relative overflow-hidden flex flex-col justify-between">
           <div className="absolute top-0 right-0 w-32 h-32 bg-neon/20 blur-[60px] rounded-full pointer-events-none" />
           
           <div>
             <div className="flex justify-between items-start mb-2">
               <span className="text-muted-foreground font-medium">Valore in Produzione</span>
               <ArrowUpRight className="h-5 w-5 text-neon-dark" />
             </div>
             <div className="text-3xl font-bold">€ 214,390</div>
             <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-neon text-black text-xs font-bold">
                <CheckCircle2 className="h-3 w-3" /> Healthy
             </div>
           </div>

           <div className="mt-6 flex gap-3">
             <div className="flex-1 p-3 rounded-2xl bg-muted/50 border border-border flex flex-col items-center justify-center gap-1 hover:bg-muted cursor-pointer transition-colors">
                <span className="text-2xl font-bold">4443</span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">SKU Totali</span>
             </div>
             <div className="flex-1 p-3 rounded-2xl bg-neon text-black flex flex-col items-center justify-center gap-1 shadow-lg shadow-neon/20 cursor-pointer hover:scale-105 transition-transform">
                <span className="text-2xl font-bold">#177</span>
                <span className="text-[10px] uppercase font-bold opacity-80">Priorità</span>
             </div>
           </div>
        </div>
      </div>

      {/* --- FILTRI E RICERCA --- */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
           <div className="flex items-center gap-2 bg-card px-1 py-1 rounded-full border border-border shadow-sm">
              <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-sm font-medium px-2">Filtri Attivi</span>
           </div>
           
           {["Tutti i Clienti", "Tutti gli Stati", "Novembre 2024"].map(filter => (
             <Button key={filter} variant="outline" className="rounded-full border-border bg-transparent hover:bg-card">
               {filter} <span className="ml-2">▼</span>
             </Button>
           ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Cerca commessa..." 
                className="w-full h-10 pl-10 pr-4 rounded-full bg-card border border-border focus:outline-none focus:ring-2 focus:ring-neon/50 text-sm transition-shadow"
              />
           </div>
           <Button variant="ghost" size="icon" className="rounded-full bg-card border border-border"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* --- LISTA COMMESSE (MAIN SECTION) --- */}
      <div className="bg-card rounded-[2rem] border border-border/50 shadow-sm overflow-hidden">
        
        {/* Toolbar interna */}
        <div className="p-6 pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <h2 className="text-xl font-bold">Commesse in Lavorazione</h2>
           <div className="flex bg-muted/50 p-1 rounded-full">
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground">Tutte</Button>
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground">In Attesa <span className="ml-2 bg-muted px-1.5 py-0.5 rounded-full text-[10px]">3</span></Button>
              <Button variant="default" size="sm" className="rounded-full bg-neon text-black hover:bg-neon-hover font-bold shadow-sm">In Corso <span className="ml-2 bg-black/10 px-1.5 py-0.5 rounded-full text-[10px]">5</span></Button>
           </div>
        </div>

        {/* Tabella Cards */}
        <div className="p-6 grid gap-4">
          
          {ACTIVE_JOBS.map((job, idx) => (
             <div key={job.id} className={`
                group flex flex-col md:flex-row items-center gap-6 p-4 rounded-3xl transition-all duration-300
                ${idx === 2 ? 'bg-card border-2 border-neon/50 shadow-[0_0_20px_rgba(204,243,47,0.1)] scale-[1.01]' : 'bg-muted/30 border border-transparent hover:bg-muted/50'}
             `}>
                
                {/* Colonna 1: Info Base */}
                <div className="flex items-center gap-4 w-full md:w-1/4">
                   <Avatar className="h-12 w-12 rounded-2xl bg-white dark:bg-black text-foreground font-bold border border-border">
                      <AvatarFallback className="rounded-2xl">{job.avatar}</AvatarFallback>
                   </Avatar>
                   <div>
                      <div className="font-bold text-lg">{job.id}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {job.due}
                      </div>
                   </div>
                </div>

                {/* Colonna 2: Status Pill */}
                <div className="w-full md:w-auto flex justify-center">
                   <div className={`
                      px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider
                      ${job.warning ? 'bg-red-500/10 text-red-500' : 'bg-card border border-border'}
                   `}>
                      {job.status}
                   </div>
                </div>

                {/* Colonna 3: Valore */}
                <div className="w-full md:w-auto text-right">
                   <div className="font-mono font-bold text-lg">€ {job.value.toLocaleString()}</div>
                </div>

                {/* Colonna 4: Detailed Card (Quella grigia scura nell'immagine) */}
                <div className="flex-1 w-full bg-muted/50 dark:bg-[#1f2231] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 group-hover:bg-muted dark:group-hover:bg-[#25283a] transition-colors">
                   
                   <div className="space-y-1 w-full md:w-auto">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Progetto</div>
                      <div className="font-bold">{job.project}</div>
                   </div>

                   <div className="space-y-1 w-full md:w-auto">
                      <div className="text-xs text-muted-foreground uppercase font-bold">Cliente</div>
                      <div className="flex items-center gap-2">
                         <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
                         <span className="font-medium">{job.client}</span>
                      </div>
                   </div>

                   <div className="space-y-1 w-full md:w-1/3">
                      <div className="flex justify-between text-xs mb-1">
                         <span className="text-muted-foreground font-bold uppercase">Avanzamento</span>
                         <span className="font-mono">{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2 bg-background" indicatorColor={job.warning ? "bg-red-500" : "bg-neon"} />
                   </div>

                   {/* Action Button (solo su hover o su card attiva) */}
                   <Button size="icon" className={`rounded-full w-10 h-10 shrink-0 ${idx === 2 ? 'bg-neon text-black hover:bg-neon-hover' : 'bg-background hover:bg-foreground hover:text-background'}`}>
                      {idx === 2 ? <PlayCircle className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
                   </Button>

                </div>

             </div>
          ))}

        </div>

        {/* Footer Totali */}
        <div className="bg-muted/30 p-6 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-border">
           <div className="flex gap-8 text-sm">
              <div>
                 <span className="text-muted-foreground block text-xs uppercase font-bold">Sub Totale</span>
                 <span className="font-mono font-bold text-lg">€ 53,154.00</span>
              </div>
              <div>
                 <span className="text-muted-foreground block text-xs uppercase font-bold">Totale Stimato</span>
                 <span className="font-mono font-bold text-lg">€ 53,154.00</span>
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="text-right">
                 <span className="text-muted-foreground block text-xs uppercase font-bold">Valore Produzione</span>
                 <span className="font-mono font-bold text-xl">€ 53,154.00</span>
              </div>
              <Button size="lg" className="rounded-full bg-neon text-black hover:bg-neon-hover font-bold px-8 shadow-lg shadow-neon/20">
                 Gestisci Commesse
              </Button>
           </div>
        </div>

      </div>
    </div>
  );
}