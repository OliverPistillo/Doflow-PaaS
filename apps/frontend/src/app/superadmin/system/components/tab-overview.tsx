// apps/frontend/src/app/superadmin/system/components/tab-overview.tsx
// Tab di riepilogo live: status semaforo servizi + metriche hardware aggregate.

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  Cpu,
  MemoryStick,
  HardDrive,
  Zap,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import type { SystemData } from "../system-monitor-client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}g ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type ServiceStatus = "up" | "down" | "unknown" | string;

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === "up")      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "down")    return <XCircle      className="h-5 w-5 text-red-500"     />;
  return                           <AlertTriangle className="h-5 w-5 text-amber-500"  />;
}

function statusLabel(status: ServiceStatus): string {
  if (status === "up")   return "Operativo";
  if (status === "down") return "Non raggiungibile";
  return "Sconosciuto";
}

function statusVariant(status: ServiceStatus): "default" | "destructive" | "outline" | "secondary" {
  if (status === "up")   return "default";
  if (status === "down") return "destructive";
  return "outline";
}

function usageColor(percent: number): string {
  if (percent < 60) return "hsl(150 60% 45%)";
  if (percent < 80) return "hsl(40 80% 55%)";
  return "hsl(0 70% 55%)";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ServiceRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: ServiceStatus;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon status={status} />
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {detail && (
            <p className="text-xs text-muted-foreground">{detail}</p>
          )}
        </div>
      </div>
      <Badge variant={statusVariant(status)} className="text-xs font-medium">
        {statusLabel(status)}
      </Badge>
    </div>
  );
}

function HardwareStat({
  icon: Icon,
  label,
  used,
  total,
  percent,
  unit = "GB",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  used: string;
  total: string;
  percent: number;
  unit?: string;
}) {
  const color = usageColor(percent);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {used} / {total} {unit}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span style={{ color }}>{percent.toFixed(1)}% utilizzato</span>
      </div>
    </div>
  );
}

// ─── TabOverview ──────────────────────────────────────────────────────────────

interface Props {
  data: SystemData;
}

export function TabOverview({ data }: Props) {
  const { hardware, services } = data;

  const allUp = Object.values(services).every(
    (v) => typeof v === "string" && v === "up"
  );
  const anyDown = Object.entries(services).some(
    ([k, v]) => k !== "redis_latency_ms" && v === "down"
  );

  const overallStatus = anyDown ? "down" : allUp ? "up" : "degraded";
  const overallColor =
    overallStatus === "up"       ? "text-emerald-500"
    : overallStatus === "degraded" ? "text-amber-500"
    : "text-red-500";
  const overallLabel =
    overallStatus === "up"       ? "Tutti i sistemi operativi"
    : overallStatus === "degraded" ? "Sistemi parzialmente degradati"
    : "Guasto critico rilevato";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ── STATUS SERVIZI ──────────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Stato Servizi
            </CardTitle>
            <span className={`text-xs font-bold ${overallColor}`}>
              {overallLabel}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ServiceRow
            label="Database PostgreSQL"
            status={services.database}
          />
          <ServiceRow
            label="Redis Cache"
            status={services.redis}
            detail={
              services.redis_latency_ms != null
                ? `Latenza: ${services.redis_latency_ms}ms`
                : undefined
            }
          />
          <ServiceRow
            label="API Backend"
            status={services.api}
          />
        </CardContent>
      </Card>

      {/* ── HARDWARE ────────────────────────────────────────────────── */}
      <Card className="glass-card border-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Risorse Hardware
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Uptime: {formatUptime(hardware.uptime)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-5">
          <HardwareStat
            icon={Cpu}
            label={`CPU — ${hardware.cpu.brand} (${hardware.cpu.cores} core)`}
            used={hardware.cpu.load.toFixed(1)}
            total="100"
            percent={hardware.cpu.load}
            unit="%"
          />
          <HardwareStat
            icon={MemoryStick}
            label="RAM"
            used={hardware.memory.usedGb}
            total={hardware.memory.totalGb}
            percent={hardware.memory.percent}
          />
          <HardwareStat
            icon={HardDrive}
            label="Disco"
            used={hardware.disk.usedGb}
            total={hardware.disk.totalGb}
            percent={hardware.disk.percent}
          />
        </CardContent>
      </Card>

      {/* ── INFO RAPIDE ─────────────────────────────────────────────── */}
      <Card className="glass-card border-none lg:col-span-2">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Server, label: "CPU Cores",   value: String(hardware.cpu.cores)              },
              { icon: Zap,    label: "CPU Load",    value: `${hardware.cpu.load.toFixed(1)}%`      },
              { icon: MemoryStick, label: "RAM Tot", value: `${hardware.memory.totalGb} GB`        },
              { icon: Clock,  label: "Uptime",      value: formatUptime(hardware.uptime)           },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="text-sm font-black text-foreground tabular-nums">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
