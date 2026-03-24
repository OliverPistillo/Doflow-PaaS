// Percorso: apps/frontend/src/app/superadmin/system-health/page.tsx

"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, RefreshCw, Cpu, HardDrive, MemoryStick,
  Wifi, WifiOff, Database, Clock, Activity,
  CheckCircle2, XCircle, AlertTriangle, Server,
  Zap, Timer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemData {
  hardware: {
    cpu: { cores: number; brand: string; load: number };
    memory: { totalGb: string; usedGb: string; percent: number };
    disk: { totalGb: string; usedGb: string; percent: number };
    uptime: number;
  };
  services: {
    database: "up" | "down" | "unknown";
    redis: "up" | "down" | "unknown";
    api: "up" | "down" | "unknown";
    redis_latency_ms?: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}g ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getStatusIcon(status: string) {
  if (status === "up") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "down") return <XCircle className="h-4 w-4 text-red-500" />;
  return <AlertTriangle className="h-4 w-4 text-amber-500" />;
}

function getStatusColor(status: string): string {
  if (status === "up") return "hsl(150 60% 45%)";
  if (status === "down") return "hsl(0 70% 55%)";
  return "hsl(40 80% 55%)";
}

function getUsageColor(percent: number): string {
  if (percent < 60) return "hsl(150 60% 45%)";
  if (percent < 85) return "hsl(40 80% 55%)";
  return "hsl(0 70% 55%)";
}

// ─── Gauge Card ───────────────────────────────────────────────────────────────

function GaugeCard({ title, percent, used, total, unit, icon: Icon }: {
  title: string; percent: number; used: string; total: string; unit: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const color = getUsageColor(percent);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <Card className="glass-card group hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl">
      <CardContent className="p-6 flex flex-col items-center">
        <div className="relative w-32 h-32 mb-3">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={color} strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Icon className="h-5 w-5 mb-1" style={{ color }} />
            <span className="text-2xl font-black text-foreground tabular-nums">{percent}%</span>
          </div>
        </div>
        <h4 className="font-bold text-foreground text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{used} / {total} {unit}</p>
      </CardContent>
    </Card>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ name, status, latency, icon: Icon }: {
  name: string; status: "up" | "down" | "unknown";
  latency?: number; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const color = getStatusColor(status);
  const label = status === "up" ? "Operativo" : status === "down" ? "Non raggiungibile" : "Sconosciuto";

  return (
    <Card className="glass-card group hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-foreground text-sm">{name}</h4>
            {getStatusIcon(status)}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            {latency !== undefined && (
              <Badge variant="outline" className="text-[10px] tabular-nums">{latency}ms</Badge>
            )}
          </div>
        </div>
        <div className="h-3 w-3 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: color }} />
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch<SystemData>("/superadmin/system/health");
      setData(res);
      setLastUpdate(new Date());
    } catch (e: any) {
      if (!silent) toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => load(true), 10000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  if (loading && !data) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Connessione al sistema...</p>
      </div>
    );
  }

  if (!data) return null;

  const allUp = data.services.database === "up" && data.services.redis === "up" && data.services.api === "up";
  const anyDown = data.services.database === "down" || data.services.redis === "down" || data.services.api === "down";

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className={`border ${allUp ? "border-emerald-500/30 bg-emerald-500/5" : anyDown ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {allUp ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : anyDown ? <XCircle className="h-6 w-6 text-red-500" /> : <AlertTriangle className="h-6 w-6 text-amber-500" />}
            <div>
              <p className="font-bold text-foreground text-sm">
                {allUp ? "Tutti i servizi operativi" : anyDown ? "Attenzione: servizi non raggiungibili" : "Alcuni servizi in stato sconosciuto"}
              </p>
              <p className="text-xs text-muted-foreground">
                Uptime: {formatUptime(data.hardware.uptime)}
                {lastUpdate && ` · Ultimo aggiornamento: ${lastUpdate.toLocaleTimeString("it-IT")}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
              <Activity className={`h-3 w-3 mr-1.5 ${autoRefresh ? "animate-pulse" : ""}`} />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="h-3 w-3 mr-1.5" />Aggiorna
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resource Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GaugeCard
          title="CPU Load"
          percent={data.hardware.cpu.load}
          used={`${data.hardware.cpu.load}%`}
          total={`${data.hardware.cpu.cores} core`}
          unit=""
          icon={Cpu}
        />
        <GaugeCard
          title="Memoria RAM"
          percent={data.hardware.memory.percent}
          used={data.hardware.memory.usedGb}
          total={data.hardware.memory.totalGb}
          unit="GB"
          icon={MemoryStick}
        />
        <GaugeCard
          title="Disco"
          percent={data.hardware.disk.percent}
          used={data.hardware.disk.usedGb}
          total={data.hardware.disk.totalGb}
          unit="GB"
          icon={HardDrive}
        />
      </div>

      {/* Services Grid */}
      <div>
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" /> Stato Servizi
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ServiceCard name="PostgreSQL" status={data.services.database} icon={Database} />
          <ServiceCard name="Redis" status={data.services.redis} latency={data.services.redis_latency_ms} icon={Zap} />
          <ServiceCard name="API Server" status={data.services.api} icon={Wifi} />
        </div>
      </div>

      {/* System Details */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> Dettagli Hardware
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Processore</p>
              <p className="text-sm font-semibold text-foreground mt-1">{data.hardware.cpu.brand}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Core</p>
              <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">{data.hardware.cpu.cores}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Uptime</p>
              <p className="text-sm font-semibold text-foreground mt-1">{formatUptime(data.hardware.uptime)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Redis Latenza</p>
              <p className="text-sm font-semibold text-foreground mt-1 tabular-nums">{data.services.redis_latency_ms ?? "N/A"} ms</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
