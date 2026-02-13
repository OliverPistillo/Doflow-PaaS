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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
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
  metadata?: { reason?: string };
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
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="space-y-8 max-w-[1600px] mx-auto p-6">
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

        {stats && (
           <div className="flex items-center gap-3">
             <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
               <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">System Uptime</div>
               <div className="mt-1 text-xl font-mono font-semibold text-slate-900">{uptimeHours}h</div>
             </div>
           </div>
        )}
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

      {/* --- SEZIONE 2: SHADOW LOGS --- */}
      <div className="space-y-4 pt-6 border-t">
        <div className="flex items-center justify-between">
           <div>
             <h2 className="text-lg font-semibold flex items-center gap-2">
               <ShieldAlert className="h-5 w-5 text-amber-600" />
               Gatekeeper Logs
             </h2>
             <p className="text-sm text-slate-500">Richieste bloccate o limitate dal Traffic Control (Live from Redis)</p>
           </div>
           <Badge variant="outline" className="font-mono">
             Live Sync (3s)
           </Badge>
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
                <TableHead className="text-right">Reason</TableHead>
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
                  <TableRow key={i} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={
                          log.type.includes('BLACKLIST') 
                            ? "bg-red-100 text-red-700 border-red-200" 
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
                      {log.metadata?.reason || '-'}
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