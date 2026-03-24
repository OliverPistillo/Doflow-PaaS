// Percorso: apps/frontend/src/app/superadmin/api-usage/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, Activity, Globe, AlertTriangle,
  Zap, Server, BarChart3, TrendingUp, ShieldAlert,
  ArrowUpRight, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiUsageData {
  totalRequests: number;
  uniqueIps: number;
  topEndpoints: { path: string; count: number }[];
  topTenants: { tenantId: string; tenantName?: string; count: number }[];
  requestsByType: { type: string; count: number }[];
  errorRate: number;
  recentErrors: any[];
  requestsTimeline: { hour: string; count: number }[];
  rateLimitHits: number;
}

interface RateLimitData {
  activeKeys: number;
  sample: { tenant: string; ip: string; remainingTokens: string | null }[];
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Card className="glass-card transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" style={{ backgroundColor: color }} />
      <CardContent className="p-6 relative z-10 flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-foreground mt-3 tracking-tight tabular-nums">{value}</h3>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 transition-all duration-300 group-hover:scale-110 shadow-sm"
          style={{ color, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiUsagePage() {
  const { toast } = useToast();
  const [data, setData] = useState<ApiUsageData | null>(null);
  const [rateData, setRateData] = useState<RateLimitData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        apiFetch<ApiUsageData>("/superadmin/api-usage/dashboard"),
        apiFetch<RateLimitData>("/superadmin/api-usage/rate-limits"),
      ]);
      setData(d);
      setRateData(r);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Analisi traffico API...</p>
      </div>
    );
  }

  // Timeline chart: format label
  const timelineFormatted = data.requestsTimeline.map(t => ({
    ...t,
    label: t.hour.slice(11) + ":00", // "14:00"
  }));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Richieste Totali" value={data.totalRequests.toLocaleString("it-IT")} sub="Dalla coda telemetria" icon={Activity} color="hsl(var(--chart-1))" />
        <KpiCard title="IP Unici" value={data.uniqueIps} icon={Globe} color="hsl(var(--chart-2))" />
        <KpiCard title="Error Rate" value={`${data.errorRate}%`} icon={AlertTriangle} color={data.errorRate > 5 ? "hsl(0 70% 55%)" : "hsl(var(--chart-3))"} />
        <KpiCard title="Rate Limit Hit" value={data.rateLimitHits} icon={ShieldAlert} color={data.rateLimitHits > 0 ? "hsl(40 80% 55%)" : "hsl(var(--chart-4))"} />
        <KpiCard title="Rate Limit Attivi" value={rateData?.activeKeys || 0} sub="Chiavi Redis attive" icon={Zap} color="hsl(var(--chart-5))" />
      </div>

      {/* Traffic Timeline */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-foreground">Traffic Timeline</h3>
              <p className="text-xs text-muted-foreground">Richieste API per ora (ultime 48h)</p>
            </div>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3 w-3 mr-1.5" />Aggiorna</Button>
          </div>
          {timelineFormatted.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timelineFormatted}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }} />
                <Line type="monotone" dataKey="count" name="Richieste" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">Nessun dato traffic nella coda</div>
          )}
        </CardContent>
      </Card>

      {/* Two columns: Top Endpoints + Top Tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Endpoints */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Server className="h-4 w-4 text-primary" />Top Endpoint</h3>
            {data.topEndpoints.length > 0 ? (
              <div className="space-y-3">
                {data.topEndpoints.slice(0, 12).map((ep, i) => {
                  const maxCount = data.topEndpoints[0]?.count || 1;
                  const pct = Math.round((ep.count / maxCount) * 100);
                  return (
                    <div key={ep.path} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5 text-right tabular-nums font-bold">{i + 1}.</span>
                          <code className="font-mono text-foreground truncate text-[11px]">{ep.path}</code>
                        </div>
                        <span className="font-bold text-foreground tabular-nums shrink-0 ml-2">{ep.count.toLocaleString("it-IT")}</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">Nessun dato</div>
            )}
          </CardContent>
        </Card>

        {/* Top Tenants */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Traffic per Tenant</h3>
            {data.topTenants.length > 0 ? (
              <div className="space-y-3">
                {data.topTenants.slice(0, 12).map((t, i) => {
                  const maxCount = data.topTenants[0]?.count || 1;
                  const pct = Math.round((t.count / maxCount) * 100);
                  return (
                    <div key={t.tenantId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5 text-right tabular-nums font-bold">{i + 1}.</span>
                          <span className="font-semibold text-foreground truncate">{t.tenantName || t.tenantId}</span>
                        </div>
                        <span className="font-bold text-foreground tabular-nums shrink-0 ml-2">{t.count.toLocaleString("it-IT")}</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">Nessun dato</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Request Types + Rate Limit Status + Recent Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Request Types */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Tipi di Evento</h3>
            {data.requestsByType.length > 0 ? (
              <div className="space-y-2">
                {data.requestsByType.slice(0, 10).map(rt => (
                  <div key={rt.type} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${rt.type.includes("ERROR") ? "bg-red-500" : rt.type.includes("SECURITY") ? "bg-amber-500" : "bg-primary"}`} />
                      <span className="text-muted-foreground font-mono text-[11px]">{rt.type}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] tabular-nums">{rt.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">Nessun dato</div>
            )}
          </CardContent>
        </Card>

        {/* Rate Limit Active */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />Rate Limit Attivi</h3>
            {rateData && rateData.sample.length > 0 ? (
              <div className="space-y-2">
                {rateData.sample.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground truncate">{r.tenant}</span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">{r.ip}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] tabular-nums ${Number(r.remainingTokens) < 20 ? "bg-red-500/10 text-red-500 border-red-500/20" : ""}`}>
                      {r.remainingTokens ?? "?"} tok
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Zap className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Nessun rate limit attivo
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />Errori Recenti</h3>
            {data.recentErrors.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {data.recentErrors.slice(0, 15).map((err: any, i: number) => (
                  <div key={i} className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-600">{err.type}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {err.timestamp ? new Date(err.timestamp).toLocaleTimeString("it-IT") : ""}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate">{err.path || "N/A"} — {err.tenantId || "global"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Activity className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Nessun errore recente
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
