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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";

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

export default function DashboardPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const json = await apiFetch<StatsResponse>("/superadmin/system/stats", { method: "GET" });
      setData(json);
      setErrorMsg(null);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Errore di connessione al backend (System Stats).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const uptimeHours = useMemo(() => {
    const u = data?.hardware?.uptime ?? 0;
    return (u / 3600).toFixed(1);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="p-10 flex items-center gap-2 text-slate-700">
        <Activity className="animate-spin" />
        <span className="font-semibold">Loading Control Tower…</span>
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className="p-10">
        <div className="max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-5">
          <div className="font-semibold text-rose-800">System Stats unavailable</div>
          <div className="text-sm text-rose-700 mt-1">{errorMsg}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { hardware, services } = data;

  const cpuLoad = clamp(hardware.cpu.load);
  const memPct = clamp(hardware.memory.percent);
  const diskPct = clamp(hardware.disk.percent);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* TOP BAR */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Superadmin Control Tower</h1>
          </div>
          <p className="text-sm text-slate-500">
            Infrastructure health, service status, and capacity overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">System Uptime</div>
            <div className="mt-1 text-xl font-mono font-semibold text-slate-900">{uptimeHours}h</div>
          </div>
        </div>
      </div>

      {/* SERVICE HEALTH */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Service Health</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusBadge label="Database" status={services.database} icon={Database} />
          <StatusBadge
            label="Redis"
            status={services.redis}
            icon={Zap}
            meta={
              typeof services.redis_latency_ms === "number"
                ? `${services.redis_latency_ms} ms`
                : undefined
            }
          />
          <StatusBadge label="API" status={services.api} icon={Globe} />
        </div>
      </div>

      {/* CAPACITY */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Capacity</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CPU */}
          <Card className="p-6 rounded-2xl border bg-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">CPU Load</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{cpuLoad}%</div>
              </div>
              <div className="p-2 rounded-xl border bg-slate-50">
                <Cpu className="h-5 w-5 text-slate-700" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={cpuLoad} className="h-2 bg-slate-100" />
              <div className="mt-3 text-xs text-slate-500 flex justify-between">
                <span>{hardware.cpu.cores} cores</span>
                <span className="truncate max-w-[70%]">{hardware.cpu.brand}</span>
              </div>
            </div>
          </Card>

          {/* RAM */}
          <Card className="p-6 rounded-2xl border bg-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Memory</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{memPct}%</div>
              </div>
              <div className="p-2 rounded-xl border bg-slate-50">
                <Server className="h-5 w-5 text-slate-700" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={memPct} className="h-2 bg-slate-100" />
              <div className="mt-3 text-xs text-slate-500 flex justify-between">
                <span>{hardware.memory.usedGb} GB used</span>
                <span>{hardware.memory.totalGb} GB total</span>
              </div>
            </div>
          </Card>

          {/* DISK */}
          <Card className="p-6 rounded-2xl border bg-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Storage</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{diskPct}%</div>
              </div>
              <div className="p-2 rounded-xl border bg-slate-50">
                <HardDrive className="h-5 w-5 text-slate-700" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={diskPct} className="h-2 bg-slate-100" />
              <div className="mt-3 text-xs text-slate-500 flex justify-between">
                <span>{hardware.disk.usedGb} GB used</span>
                <span>{hardware.disk.totalGb} GB total</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
