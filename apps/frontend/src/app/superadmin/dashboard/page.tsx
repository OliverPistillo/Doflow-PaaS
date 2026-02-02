"use client";

import React, { useEffect, useState } from "react";
import { Server, HardDrive, Cpu, Activity, Clock, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { tenantFetch } from "@/lib/tenant-fetch";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    try {
      const res = await tenantFetch("/api/superadmin/system/stats");
      if (res.ok) {
          setStats(await res.json());
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
    const interval = setInterval(loadData, 5000); // Aggiorna ogni 5 secondi
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) return (
      <div className="flex h-screen items-center justify-center text-slate-500 gap-2">
          <Activity className="animate-spin h-5 w-5" /> Inizializzazione Telemetria...
      </div>
  );

  if (error && !stats) return (
      <div className="p-10 flex flex-col items-center justify-center text-red-500 gap-4">
          <AlertTriangle className="h-12 w-12" />
          <h2 className="text-xl font-bold">Connessione al Nodo Server Fallita</h2>
          <p className="text-sm text-slate-600">Verifica che il Backend sia avviato e che l'endpoint /api/superadmin/system/stats sia raggiungibile.</p>
      </div>
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      
      {/* Header Status */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Control Tower</h1>
          <p className="text-slate-500 font-medium">Monitoraggio infrastruttura multi-tenant.</p>
        </div>
        <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-sm font-mono text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" /> 
                NODE: ONLINE
            </div>
            <span className="text-xs text-slate-400 mt-1">{stats?.platform || 'Unknown OS'}</span>
        </div>
      </div>

      {/* Grid Metriche */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* CPU */}
        <Card className="p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all group border-t-4 border-t-indigo-500">
           <div className="flex justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">CPU Load</span>
              <Cpu className="h-5 w-5 text-indigo-600" />
           </div>
           <div className="text-4xl font-black text-slate-900 mb-2">{stats.cpu.loadPercent}%</div>
           <Progress value={stats.cpu.loadPercent} className="h-2 bg-slate-100" indicatorColor={stats.cpu.loadPercent > 80 ? "bg-red-500" : "bg-indigo-600"} />
           <div className="text-xs text-slate-400 mt-4 font-medium flex justify-between">
               <span>{stats.cpu.cores} Cores</span>
               <span className="text-slate-300">|</span>
               <span className="truncate max-w-[120px]">{stats.cpu.brand}</span>
           </div>
        </Card>

        {/* RAM */}
        <Card className="p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all group border-t-4 border-t-emerald-500">
           <div className="flex justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">Memory</span>
              <Server className="h-5 w-5 text-emerald-600" />
           </div>
           <div className="text-4xl font-black text-slate-900 mb-2">{stats.memory.usedPercent}%</div>
           <Progress value={stats.memory.usedPercent} className="h-2 bg-slate-100" indicatorColor={stats.memory.usedPercent > 90 ? "bg-red-500" : "bg-emerald-500"} />
           <div className="text-xs text-slate-400 mt-4 font-medium flex justify-between">
               <span>Used: {stats.memory.usedGb}GB</span>
               <span className="text-slate-300">|</span>
               <span>Total: {stats.memory.totalGb}GB</span>
           </div>
        </Card>

        {/* DISK */}
        <Card className="p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all group border-t-4 border-t-blue-500">
           <div className="flex justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">Storage</span>
              <HardDrive className="h-5 w-5 text-blue-600" />
           </div>
           <div className="text-4xl font-black text-slate-900 mb-2">{stats.disk.usedPercent}%</div>
           <Progress value={stats.disk.usedPercent} className="h-2 bg-slate-100" indicatorColor="bg-blue-500" />
           <div className="text-xs text-slate-400 mt-4 font-medium flex justify-between">
               <span>Used: {stats.disk.usedGb}GB</span>
               <span className="text-slate-300">|</span>
               <span>Total: {stats.disk.totalGb}GB</span>
           </div>
        </Card>

        {/* UPTIME */}
        <Card className="p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all flex flex-col justify-center border-t-4 border-t-amber-500">
           <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Uptime
           </div>
           <div className="text-4xl font-black text-slate-900">{(stats.uptime / 3600).toFixed(1)}h</div>
           <div className="text-xs text-green-600 font-bold mt-3 flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg w-fit border border-green-100">
              <Activity className="h-3 w-3" /> System Healthy
           </div>
        </Card>
      </div>
    </div>
  );
}