// apps/frontend/src/app/superadmin/system/system-monitor-client.tsx
"use client";

// ─── Tutti gli import in cima — obbligatorio per ES modules ──────────────────
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, RefreshCw, LayoutDashboard, Cpu, Server, Radio, ShieldAlert,
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { TabOverview }  from "./components/tab-overview";
import { TabApiUsage }  from "./components/tab-api-usage";
import { TabAudit }     from "./components/tab-audit";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SystemData {
  hardware: {
    cpu:    { cores: number; brand: string; load: number };
    memory: { totalGb: string; usedGb: string; percent: number };
    disk:   { totalGb: string; usedGb: string; percent: number };
    uptime: number;
  };
  services: {
    database: "up" | "down" | "unknown";
    redis:    "up" | "down" | "unknown";
    api:      "up" | "down" | "unknown";
    redis_latency_ms?: number;
  };
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const VALID_TABS = ["overview", "hardware", "services", "api-usage", "audit"] as const;
type TabId = (typeof VALID_TABS)[number];

const TAB_META: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview",  label: "Overview",  icon: LayoutDashboard },
  { id: "hardware",  label: "Hardware",  icon: Cpu             },
  { id: "services",  label: "Servizi",   icon: Server          },
  { id: "api-usage", label: "API Usage", icon: Radio           },
  { id: "audit",     label: "Audit Log", icon: ShieldAlert     },
];

const REFRESH_MS = 30_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveTab(param: string | null): TabId {
  if (param && VALID_TABS.includes(param as TabId)) return param as TabId;
  return "overview";
}

function globalStatus(data: SystemData | null): "up" | "degraded" | "down" | "loading" {
  if (!data) return "loading";
  const vals = [data.services.database, data.services.redis, data.services.api];
  if (vals.every((v) => v === "up"))   return "up";
  if (vals.some((v) => v === "down"))  return "down";
  return "degraded";
}

function accentForPercent(p: number): string {
  if (p < 60) return "hsl(150 60% 45%)";
  if (p < 80) return "hsl(40 80% 55%)";
  return "hsl(0 70% 55%)";
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}g ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReturnType<typeof globalStatus> }) {
  const map = {
    up:      { cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500 animate-pulse", label: "Sistemi operativi"       },
    degraded:{ cls: "bg-amber-100  text-amber-700",   dot: "bg-amber-500  animate-pulse",  label: "Parzialmente degradato"  },
    down:    { cls: "bg-red-100    text-red-700",      dot: "bg-red-500    animate-pulse",  label: "Guasto critico"          },
    loading: { cls: "bg-muted      text-muted-foreground", dot: "bg-muted-foreground",      label: "Caricamento…"            },
  } as const;
  const { cls, dot, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-0 ${cls}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ─── HardwareDetail ───────────────────────────────────────────────────────────

function HardwareDetail({ data }: { data: SystemData }) {
  const { hardware } = data;
  const bars = [
    { label: "CPU Load", used: hardware.cpu.load.toFixed(1),   total: "100",                   percent: hardware.cpu.load,     unit: "%" },
    { label: "RAM",      used: hardware.memory.usedGb,          total: hardware.memory.totalGb, percent: hardware.memory.percent, unit: "GB" },
    { label: "Disco",    used: hardware.disk.usedGb,            total: hardware.disk.totalGb,   percent: hardware.disk.percent,   unit: "GB" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {bars.map(({ label, used, total, percent, unit }) => {
          const accent = accentForPercent(percent);
          return (
            <Card key={label} className="glass-card border-none">
              <CardContent className="pt-5 pb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">{used} / {total} {unit}</span>
                </div>
                <div className="text-2xl font-black tabular-nums" style={{ color: accent }}>
                  {Number(percent).toFixed(1)}%
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(Number(percent), 100)}%`, backgroundColor: accent }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card className="glass-card border-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Specifiche CPU</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Modello", value: hardware.cpu.brand },
              { label: "Core",   value: String(hardware.cpu.cores) },
              { label: "Load",   value: `${hardware.cpu.load.toFixed(2)}%` },
              { label: "Uptime", value: formatUptime(hardware.uptime) },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="text-sm font-bold text-foreground mt-1 truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ServicesDetail ───────────────────────────────────────────────────────────

function ServiceCard({ name, status, detail }: { name: string; status: string; detail?: string }) {
  const key = status === "up" ? "up" : status === "down" ? "down" : "unknown";
  const cfg = {
    up:      { color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", badge: "bg-emerald-100 text-emerald-700", label: "Operativo",         Icon: CheckCircle2  },
    down:    { color: "text-red-500",     bg: "bg-red-50 dark:bg-red-900/20",         border: "border-red-200 dark:border-red-800",         badge: "bg-red-100 text-red-700",         label: "Non raggiungibile", Icon: XCircle       },
    unknown: { color: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-900/20",     border: "border-amber-200 dark:border-amber-800",     badge: "bg-amber-100 text-amber-700",     label: "Sconosciuto",       Icon: AlertTriangle },
  } as const;
  const { color, bg, border, badge, label, Icon } = cfg[key];
  return (
    <Card className={`border ${border} ${bg}`}>
      <CardContent className="pt-5 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-background/60 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
          </div>
        </div>
        <Badge className={`text-xs font-bold border-0 ${badge}`}>{label}</Badge>
      </CardContent>
    </Card>
  );
}

function ServicesDetail({ data }: { data: SystemData }) {
  const { services } = data;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <ServiceCard name="PostgreSQL" status={services.database} detail="Database principale multi-tenant" />
      <ServiceCard name="Redis" status={services.redis}
        detail={services.redis_latency_ms != null ? `Cache / Pub-Sub — ${services.redis_latency_ms}ms` : "Cache / Pub-Sub"} />
      <ServiceCard name="API NestJS" status={services.api} detail="Backend REST / WebSocket" />
    </div>
  );
}

// ─── SystemMonitorClient ──────────────────────────────────────────────────────

export function SystemMonitorClient() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { toast }    = useToast();

  const [activeTab,    setActiveTab]    = useState<TabId>(() => resolveTab(searchParams.get("tab")));
  const [sysData,      setSysData]      = useState<SystemData | null>(null);
  const [sysLoading,   setSysLoading]   = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSystem = useCallback(async (silent = false) => {
    if (!silent) setSysLoading(true);
    try {
      const res = await apiFetch<SystemData>("/superadmin/system/stats");
      setSysData(res);
      setLastRefresh(new Date());
    } catch {
      if (!silent) {
        toast({ title: "Errore sistema", description: "Impossibile raggiungere /system/stats", variant: "destructive" });
      }
    } finally {
      setSysLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSystem();
    refreshTimer.current = setInterval(() => fetchSystem(true), REFRESH_MS);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [fetchSystem]);

  const handleTabChange = (value: string) => {
    const tab = value as TabId;
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab"); else params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const status = globalStatus(sysData);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {lastRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Aggiornato {lastRefresh.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchSystem()} disabled={sysLoading} className="gap-2 self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${sysLoading ? "animate-spin" : ""}`} />
          Aggiorna sistema
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-10 bg-muted/60 p-1 rounded-xl gap-1 flex-wrap">
          {TAB_META.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}
              className="gap-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-4">
              <Icon className="h-3.5 w-3.5 hidden sm:block" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {sysLoading && !sysData
            ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : sysData ? <TabOverview data={sysData} /> : null}
        </TabsContent>

        <TabsContent value="hardware" className="mt-6">
          {sysLoading && !sysData
            ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : sysData ? <HardwareDetail data={sysData} /> : null}
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          {sysLoading && !sysData
            ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : sysData ? <ServicesDetail data={sysData} /> : null}
        </TabsContent>

        <TabsContent value="api-usage" className="mt-6">
          <TabApiUsage />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <TabAudit />
        </TabsContent>
      </Tabs>
    </div>
  );
}
