"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Server,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Terminal, // Aggiunto per icona console
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications"; // <--- 1. Import Hook
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- TYPES ---
type ServiceStatus = "up" | "down" | "unknown" | string;

type StatsResponse = {
  hardware: {
    cpu: { cores: number; brand: string; load: number };
    memory: { totalGb: string; usedGb: string; percent: number };
    disk: { totalGb: string; usedGb: string; percent: number };
    uptime: number;
  };
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    api: ServiceStatus;
    redis_latency_ms?: number;
  };
};

type TrafficLog = {
  type: string;
  ip: string;
  path: string;
  tenantId: string;
  timestamp: string;
  metadata?: { reason?: string; durationMs?: number; message?: string }; // Esteso per supportare dati extra v3.5
};

type LogsResponse = {
  status: string;
  engine: string;
  count: number;
  data: TrafficLog[];
};

// --- HELPERS ---
function statusTone(status: ServiceStatus) {
  const s = String(status || "").toLowerCase();
  if (s === "up")
    return {
      wrap: "bg-emerald-50 border-emerald-200",
      icon: "bg-emerald-100 text-emerald-700",
      text: "text-emerald-700",
      dot: "bg-emerald-500 animate-pulse",
      label: "Operational",
    };
  if (s === "unknown")
    return {
      wrap: "bg-amber-50 border-amber-200",
      icon: "bg-amber-100 text-amber-800",
      text: "text-amber-700",
      dot: "bg-amber-500",
      label: "Degraded",
    };
  return {
    wrap: "bg-rose-50 border-rose-200",
    icon: "bg-rose-100 text-rose-700",
    text: "text-rose-700",
    dot: "bg-rose-500",
    label: "Down",
  };
}

const StatusBadge = ({
  label,
  status,
  icon: Icon,
  meta,
}: {
  label: string;
  status: ServiceStatus;
  icon: any;
  meta?: string;
}) => {
  const tone = statusTone(status);

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border ${tone.wrap}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg ${tone.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{label}</div>
          <div className={`text-xs font-semibold uppercase tracking-wide ${tone.text}`}>
            {tone.label}
            {meta ? <span className="ml-2 normal-case font-medium text-slate-500">• {meta}</span> : null}
          </div>
        </div>
      </div>
      <div className={`h-3 w-3 rounded-full ${tone.dot}`} />
    </div>
  );
};

function clamp(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// --- PAGE COMPONENT ---
export default function DashboardPage() {
  const { events, connected } = useNotifications(); // <--- 2. WebSocket Hook
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Caricamento Iniziale (Polling come fallback e inizializzazione)
  const loadData = async () => {
    try {
      const statsPromise = apiFetch<StatsResponse>("/superadmin/system/health").catch(() => null);
      const logsPromise = apiFetch<LogsResponse>("/superadmin/system/traffic-logs?limit=20").catch(() => null);

      const [statsData, logsData] = await Promise.all([statsPromise, logsPromise]);

      if (statsData) setStats(statsData as any);
      if (logsData?.data) setLogs(logsData.data);
      
      setErrorMsg(null);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Errore di connessione alla Control Tower.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Rallentiamo il polling a 5s dato che abbiamo WS
    return () => clearInterval(interval);
  }, []);

  // --- 3. GESTIONE REAL-TIME WEBSOCKET ---
  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (!lastEvent) return;

    if (lastEvent.type === 'tenant_notification') {
        const payload: any = lastEvent.payload;
        
        // Intercetta i messaggi "system_alert" dal TelemetryService
        if (payload.type === 'system_alert' && payload.channel === 'control_tower') {
            const newLog = payload.payload as TrafficLog;
            
            // Aggiungiamo in cima alla lista (Animation-ready)
            setLogs(prev => {
                // Evita duplicati se arrivano burst veloci
                const exists = prev.some(l => l.timestamp === newLog.timestamp && l.path === newLog.path);
                if(exists) return prev;
                return [newLog, ...prev].slice(0, 50); // Manteniamo max 50 log in UI
            });
        }
    }
  }, [events]);

  const uptimeHours = useMemo(() => {
    const u = stats?.hardware?.uptime ?? 0;
    return (u / 3600).toFixed(1);
  }, [stats]);

  if (loading && !stats && logs.length === 0) {
    return (
      <div className="p-10 flex items-center gap-2 text-slate-700">
        <Activity className="animate-spin" />
        <span className="font-semibold">Connessione alla Control Tower v3.5...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto p-6 animate-in fade-in">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Superadmin Control Tower</h1>
          </div>
          <p className="text-sm text-slate-500">
            Monitoraggio Infrastruttura & Sicurezza Perimetrale (v3.5)
          </p>
        </div>

        <div className="flex items-center gap-3">
           {/* Badge di Connessione WebSocket */}
           <Badge variant="outline" className={`gap-1.5 px-3 py-1 ${connected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-600 animate-pulse" : "bg-rose-600"}`} />
                {connected ? "Uplink Secure" : "Offline"}
           </Badge>

           {stats && (
              <div className="rounded-xl border bg-white px-4 py-3 shadow-sm hidden md:block">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">System Uptime</div>
                <div className="mt-1 text-xl font-mono font-semibold text-slate-900">{uptimeHours}h</div>
              </div>
           )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* --- SEZIONE 1: INFRASTRUTTURA --- */}
      {stats && (
        <>
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Service Health</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatusBadge label="Database" status={stats.services.database} icon={Database} />
              <StatusBadge 
                label="Redis" 
                status={stats.services.redis} 
                icon={Zap} 
                meta={typeof stats.services.redis_latency_ms === "number" ? `${stats.services.redis_latency_ms} ms` : undefined} 
              />
              <StatusBadge label="API Gateway" status={stats.services.api} icon={Globe} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* CPU */}
             <Card className="p-6 rounded-2xl border bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">CPU Load</div>
                    <div className="text-3xl font-semibold mt-2">{clamp(stats.hardware.cpu.load)}%</div>
                  </div>
                  <Cpu className="text-slate-400" />
                </div>
                <Progress value={clamp(stats.hardware.cpu.load)} className="mt-4 h-2" />
                <div className="mt-3 text-xs text-slate-500 flex justify-between font-medium">
                  {/* Per la CPU mostriamo i dettagli dei Core invece dei GB */}
                  <span>{stats.hardware.cpu.cores} Cores</span>
                  <span className="truncate max-w-[150px]">{stats.hardware.cpu.brand}</span>
                </div>
             </Card>

             {/* RAM */}
             <Card className="p-6 rounded-2xl border bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">Memory Usage</div>
                    <div className="text-3xl font-semibold mt-2">{clamp(stats.hardware.memory.percent)}%</div>
                  </div>
                  <Server className="text-slate-400" />
                </div>
                <Progress value={clamp(stats.hardware.memory.percent)} className="mt-4 h-2" />
                {/* Visualizzazione numerica richiesta */}
                <div className="mt-3 text-xs text-slate-500 font-medium flex justify-between">
                   <span>Used: {stats.hardware.memory.usedGb} GB</span>
                   <span className="text-slate-400">Total: {stats.hardware.memory.totalGb} GB</span>
                </div>
             </Card>

             {/* DISK */}
             <Card className="p-6 rounded-2xl border bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">Disk Usage</div>
                    <div className="text-3xl font-semibold mt-2">{clamp(stats.hardware.disk.percent)}%</div>
                  </div>
                  <HardDrive className="text-slate-400" />
                </div>
                <Progress value={clamp(stats.hardware.disk.percent)} className="mt-4 h-2" />
                {/* Visualizzazione numerica richiesta */}
                <div className="mt-3 text-xs text-slate-500 font-medium flex justify-between">
                   <span>Used: {stats.hardware.disk.usedGb} GB</span>
                   <span className="text-slate-400">Total: {stats.hardware.disk.totalGb} GB</span>
                </div>
             </Card>
          </div>
        </>
      )}

      {/* --- SEZIONE 2: SHADOW LOGS (Live Console) --- */}
      <div className="space-y-4 pt-6 border-t">
        <div className="flex items-center justify-between">
           <div>
             <h2 className="text-lg font-semibold flex items-center gap-2">
               <ShieldAlert className="h-5 w-5 text-amber-600" />
               Gatekeeper Logs
             </h2>
             <p className="text-sm text-slate-500">Richieste bloccate o errori di sistema (Live Telemetry)</p>
           </div>
           
           <div className="flex items-center gap-2">
             {connected ? (
                <Badge variant="outline" className="font-mono text-emerald-600 bg-emerald-50 border-emerald-200 gap-1">
                    <Activity className="h-3 w-3 animate-pulse" /> Live Stream
                </Badge>
             ) : (
                <Badge variant="outline" className="font-mono text-slate-500">
                    Sync (5s)
                </Badge>
             )}
           </div>
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Tenant Context</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    Nessun evento di sicurezza rilevato (Sistema Pulito).
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, i) => (
                  <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={
                          log.type.includes('BLACKLIST') || log.type === 'SYSTEM_ERROR'
                            ? "bg-red-100 text-red-700 border-red-200" 
                            : log.type === 'API_PERFORMANCE' 
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                        }
                      >
                        {log.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                    <TableCell className="text-xs text-slate-600 truncate max-w-[200px]">
                      {log.path}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.tenantId !== 'global' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                           <Lock className="h-3 w-3 text-slate-400" /> {log.tenantId}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Global</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-500">
                      {/* Gestione polimorfica dei metadati */}
                      {log.metadata?.reason || log.metadata?.message ? (
                          <span className="text-rose-600 font-medium">
                              {log.metadata.reason || log.metadata.message}
                          </span>
                      ) : log.metadata?.durationMs ? (
                          <span>{log.metadata.durationMs}ms</span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}