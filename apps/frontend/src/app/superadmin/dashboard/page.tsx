"use client";

import React, { useEffect, useState } from "react";
import { Server, HardDrive, Cpu, Activity, Clock, Database, Zap, Globe, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { tenantFetch } from "@/lib/tenant-fetch";
import { Card } from "@/components/ui/card";

// Componente Pallino Stato
const StatusBadge = ({ label, status, icon: Icon }: any) => (
  <div className={`flex items-center justify-between p-4 rounded-xl border ${status === 'up' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${status === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-bold text-slate-900">{label}</div>
        <div className={`text-xs font-medium uppercase ${status === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {status === 'up' ? 'OPERATIONAL' : 'DOWN'}
        </div>
      </div>
    </div>
    <div className={`h-3 w-3 rounded-full ${status === 'up' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
  </div>
);

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    try {
      const res = await tenantFetch("/api/superadmin/system/stats");
      if (res.ok) {
          setData(await res.json());
          setError(false);
      } else {
          setError(true);
      }
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) return <div className="p-10 flex items-center gap-2"><Activity className="animate-spin" /> Caricamento Control Tower...</div>;
  if (error && !data) return <div className="p-10 text-red-600 font-bold">Errore di connessione al backend (System Stats).</div>;

  const { hardware, services } = data;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Control Tower</h1>
          <p className="text-slate-500 font-medium">Monitoraggio Infrastruttura & Servizi</p>
        </div>
        <div className="text-right">
           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uptime Sistema</div>
           <div className="text-2xl font-mono font-black text-slate-700">{(hardware.uptime / 3600).toFixed(1)}h</div>
        </div>
      </div>

      {/* 1. SERVICE HEALTH (I Pallini che volevi) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <StatusBadge label="Database Cluster" status={services.database} icon={Database} />
         <StatusBadge label="Redis Cache" status={services.redis === 'unknown' ? 'up' : services.redis} icon={Zap} /> {/* Mock se redis non c'è */}
         <StatusBadge label="API Gateway" status={services.api} icon={Globe} />
      </div>

      {/* 2. HARDWARE METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CPU */}
        <Card className="p-6 rounded-2xl shadow-sm border-t-4 border-t-indigo-500">
           <div className="flex justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">CPU Load</span>
              <Cpu className="h-5 w-5 text-indigo-600" />
           </div>
           <div className="text-4xl font-black text-slate-900 mb-2">{hardware.cpu.load}%</div>
           <Progress value={hardware.cpu.load} className="h-2 bg-slate-100" indicatorColor={hardware.cpu.load > 80 ? "bg-red-500" : "bg-indigo-600"} />
           <div className="text-xs text-slate-400 mt-4 font-medium">{hardware.cpu.cores} Cores - {hardware.cpu.brand}</div>
        </Card>

        {/* RAM */}
        <Card className="p-6 rounded-2xl shadow-sm border-t-4 border-t-emerald-500">
           <div className="flex justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">RAM Usage</span>
              <Server className="h-5 w-5 text-emerald-600" />
           </div>
           <div className="text-4xl font-black text-slate-900 mb-2">{hardware.memory.percent}%</div>
           <Progress value={hardware.memory.percent} className="h-2 bg-slate-100" indicatorColor={hardware.memory.percent > 90 ? "bg-red-500" : "bg-emerald-500"} />
           <div className="text-xs text-slate-400 mt-4 font-medium flex justify-between">
               <span>{hardware.memory.usedGb}GB Used</span>
               <span>{hardware.memory.totalGb}GB Total</span>
           </div>
        </Card>

        {/* DISK */}
        <Card className="p-6 rounded-2xl shadow-sm border-t-4 border-t-blue-500">
           <div className="flex justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Storage</span>
              <HardDrive className="h-5 w-5 text-blue-600" />
           </div>
           <div className="text-4xl font-black text-slate-900 mb-2">{hardware.disk.percent}%</div>
           <Progress value={hardware.disk.percent} className="h-2 bg-slate-100" indicatorColor="bg-blue-500" />
           <div className="text-xs text-slate-400 mt-4 font-medium flex justify-between">
               <span>{hardware.disk.usedGb}GB Used</span>
               <span>{hardware.disk.totalGb}GB Total</span>
           </div>
        </Card>
      </div>
    </div>
  );
}