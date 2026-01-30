"use client";

import React from "react";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, Box, Zap, AlertTriangle, ScanLine, Wrench, Layers, ArrowRight, RotateCw
} from "lucide-react";
import Link from "next/link";

// Mock Data (per ora, poi collegheremo le API)
const WAREHOUSE_STATS = {
  totalItems: 12540,
  valueDistribution: [
    { label: "Disponibile", value: 45, color: "bg-state-available", textColor: "text-state-available", count: 5643 },
    { label: "Impegnato", value: 30, color: "bg-state-committed", textColor: "text-state-committed", count: 3762 },
    { label: "WIP (Transito)", value: 15, color: "bg-state-wip", textColor: "text-state-wip", count: 1881 },
    { label: "Controllo Qualità", value: 10, color: "bg-state-qc", textColor: "text-state-qc", count: 1254 },
  ],
  alerts: [
    { id: 1, type: "critical", msg: "Scorta minima: Cuscinetti SKF-22" },
    { id: 2, type: "warning", msg: "Rientro Service: Motore M-404 in attesa QC" },
  ]
};

// Componente per i blocchi di stato (SSOT Visualizzata)
function StateWidget() {
  return (
    <Card className="border-businaro-border bg-businaro-panel/80 backdrop-blur-md shadow-2xl">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 font-mono uppercase tracking-wider text-sm">
          <Layers className="text-state-wip h-4 w-4" /> Distribuzione Stati Magazzino (SSOT)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visualizzazione Barriera Grafica */}
        <div className="flex h-3 w-full overflow-hidden rounded-sm bg-businaro-dark">
          {WAREHOUSE_STATS.valueDistribution.map((item, idx) => (
            <div 
              key={idx} 
              style={{ width: `${item.value}%` }} 
              className={`h-full ${item.color} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}
            />
          ))}
        </div>

        {/* Legenda Interattiva */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {WAREHOUSE_STATS.valueDistribution.map((item, idx) => (
            <div key={idx} className="flex flex-col space-y-2 p-4 rounded border border-businaro-border bg-businaro-dark hover:border-slate-600 transition-colors group">
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 uppercase tracking-widest group-hover:text-white">
                <span className={`h-1.5 w-1.5 rounded-full ${item.color} shadow-[0_0_5px_currentColor]`} />
                {item.label}
              </div>
              <div className={`text-2xl font-bold font-mono tabular-nums ${item.textColor}`}>
                {item.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Componente Azioni Rapide (Contextual UI)
function ActionGrid() {
  const actions = [
    { 
      label: "Picking Magazzino", 
      desc: "Scannerizza e preleva", 
      icon: ScanLine, 
      href: "/businaro/magazzino",
      color: "hover:border-state-wip/50 hover:bg-blue-950/30 group-hover:text-state-wip"
    },
    { 
      label: "Trasforma Codice", 
      desc: "Grezzo -> Finito", 
      icon: Box, 
      href: "/businaro/macchine-utensili",
      color: "hover:border-purple-500/50 hover:bg-purple-950/30 group-hover:text-purple-400"
    },
    { 
      label: "Assemblaggio", 
      desc: "Consumo su commessa", 
      icon: Wrench, 
      href: "/businaro/assemblaggio",
      color: "hover:border-state-available/50 hover:bg-emerald-950/30 group-hover:text-state-available"
    },
    { 
      label: "Gestione Resi", 
      desc: "Check-in Qualità", 
      icon: AlertTriangle, 
      href: "#",
      color: "hover:border-state-qc/50 hover:bg-orange-950/30 group-hover:text-state-qc"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action, idx) => (
        <Link href={action.href} key={idx} className="block h-full">
          <button 
            className={`group relative flex flex-col items-start p-6 h-full w-full rounded-lg border border-businaro-border bg-businaro-panel text-left transition-all duration-300 ${action.color}`}
          >
            <div className="mb-4 rounded bg-businaro-dark p-3 border border-businaro-border group-hover:scale-105 transition-transform">
              <action.icon className="h-6 w-6 text-slate-400 group-hover:text-white" />
            </div>
            <div className="space-y-1 mt-auto">
              <h3 className="font-bold text-slate-200 group-hover:text-white flex items-center gap-2">
                {action.label} <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {action.desc}
              </p>
            </div>
          </button>
        </Link>
      ))}
    </div>
  );
}

// Lista Task Attivi (Il "Guardiano")
function ActiveTasks() {
  return (
    <Card className="h-full border-businaro-border bg-businaro-panel/50">
      <CardHeader>
        <CardTitle className="text-white text-sm uppercase font-mono tracking-wider flex justify-between items-center">
          <span>Coda di Lavoro</span>
          <Badge variant="outline" className="border-state-wip text-state-wip bg-blue-950/20">LIVE</Badge>
        </CardTitle>
        <CardDescription className="text-slate-500 text-xs">Attività pendenti che bloccano lo stato</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {[
          { code: "C-2024-001", type: "PRELIEVO", status: "In Corso", items: "12/45", user: "Marco B." },
          { code: "S-REV-99", type: "SERVICE", status: "Aperta", items: "Auto-add", user: "Luigi T." },
          { code: "M-AX-20", type: "LAVORAZIONE", status: "In Attesa", items: "Barra 30mm", user: "CNC-01" },
        ].map((task, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded bg-businaro-dark border border-businaro-border hover:border-slate-600 cursor-pointer transition-colors group">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-slate-700 group-hover:bg-businaro-red transition-colors" />
              <div>
                <p className="text-sm font-bold text-slate-300 group-hover:text-white font-mono">{task.code}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{task.type} • {task.user}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-white font-mono bg-slate-800 px-2 py-1 rounded">{task.items}</span>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button variant="ghost" className="w-full text-xs text-slate-500 hover:text-white hover:bg-businaro-border uppercase tracking-widest">
          Vedi coda completa
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function BusinaroDashboard() {
  return (
    <div className="space-y-8 font-sans">
      
      {/* Header Futuristico */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-businaro-border pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">
            Control Plane
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-mono">
            System Status: <span className="text-state-available">OPTIMAL</span> · Tenant: <span className="text-businaro-red">BUSINARO</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-businaro-border bg-businaro-panel hover:bg-businaro-border text-slate-300">
            <RotateCw className="mr-2 h-4 w-4" /> Sync
          </Button>
          <Button className="bg-businaro-red hover:bg-red-700 text-white shadow-[0_0_20px_rgba(225,29,72,0.2)] border border-transparent hover:border-red-400">
            <Zap className="mr-2 h-4 w-4" /> Lancia Commessa
          </Button>
        </div>
      </div>

      {/* Sezione Stato Materiali (SSOT) */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <StateWidget />
      </section>

      {/* Grid Layout Principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* Colonna Sinistra: Azioni & Operatività */}
        <div className="lg:col-span-2 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Operatività Rapida
            </h2>
            <ActionGrid />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Alert Box */}
             <Card className="border-l-4 border-l-businaro-red bg-businaro-panel border-y-businaro-border border-r-businaro-border">
               <CardHeader className="pb-2">
                 <CardTitle className="text-xs font-bold font-mono text-red-400 flex items-center uppercase tracking-widest">
                   <AlertTriangle className="mr-2 h-3 w-3" /> Criticità Rilevate
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <ul className="space-y-2">
                   {WAREHOUSE_STATS.alerts.map(a => (
                     <li key={a.id} className="text-sm text-slate-300 flex items-start">
                       <span className="mr-2 text-slate-600 font-mono text-xs">{`[!]`}</span> {a.msg}
                     </li>
                   ))}
                 </ul>
               </CardContent>
             </Card>

             {/* KPI Veloci */}
             <Card className="bg-businaro-panel border-businaro-border">
               <CardHeader className="pb-2">
                 <CardTitle className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest">Performance Picking</CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="text-3xl font-black text-white font-mono tracking-tighter">98.5%</div>
                 <Progress value={98.5} className="h-1.5 mt-2 bg-businaro-dark" indicatorColor="bg-state-available" />
                 <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wide">Accuratezza ultimi 30gg</p>
               </CardContent>
             </Card>
          </div>
        </div>

        {/* Colonna Destra: Coda di Lavoro (Il Guardiano) */}
        <div className="lg:col-span-1 h-full animate-in fade-in slide-in-from-right-8 duration-700">
           <ActiveTasks />
        </div>

      </div>
    </div>
  );
}