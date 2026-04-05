// Percorso: apps/frontend/src/app/superadmin/subscriptions/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, TrendingUp, Wallet, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Crown,
  Layers, CircleDollarSign, BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueDashboard {
  mrr: number;
  baseMrr: number;
  moduleMrr: number;
  arr: number;
  totalRevenue: number;
  churnRate: number;
  activeTenants: number;
  totalTenants: number;
  tierBreakdown: Record<string, { count: number; revenue: number }>;
  topModules: { key: string; name: string; count: number; revenue: number }[];
  expiringTrials: number;
  revenueTrend: { month: string; amount: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n ?? 0);

const TIER_COLORS: Record<string, string> = {
  STARTER: "hsl(var(--chart-1))",
  PRO: "hsl(var(--chart-2))",
  ENTERPRISE: "hsl(var(--chart-3))",
  CUSTOM: "hsl(var(--chart-4))",
};

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, color, trend }: {
  title: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string;
  trend?: { value: number; label: string };
}) {
  return (
    <Card className="glass-card transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" style={{ backgroundColor: color }} />
      <CardContent className="p-6 relative z-10 flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-foreground mt-3 tracking-tight tabular-nums">{value}</h3>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trend.value >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
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

export default function SubscriptionsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<RevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<RevenueDashboard>("/superadmin/subscriptions/revenue");
      setData(res);
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
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Calcolo revenue in corso...</p>
      </div>
    );
  }

  const tierPieData = Object.entries(data.tierBreakdown).map(([tier, d]) => ({
    name: tier, value: d.count, revenue: d.revenue, fill: TIER_COLORS[tier] || "gray",
  }));

  const mrrSplit = [
    { name: "Piani Base", value: data.baseMrr, fill: "hsl(var(--chart-1))" },
    { name: "Moduli Add-on", value: data.moduleMrr, fill: "hsl(var(--chart-2))" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="MRR" value={fmtCurrency(data.mrr)} sub={`Base ${fmtCurrency(data.baseMrr)} + Moduli ${fmtCurrency(data.moduleMrr)}`} icon={CircleDollarSign} color="hsl(var(--chart-1))" />
        <KpiCard title="ARR" value={fmtCurrency(data.arr)} icon={TrendingUp} color="hsl(var(--chart-2))" />
        <KpiCard title="Revenue Totale" value={fmtCurrency(data.totalRevenue)} sub="Da fatture pagate" icon={Wallet} color="hsl(var(--chart-3))" />
        <KpiCard title="Churn Rate" value={`${data.churnRate}%`} sub={`${data.activeTenants}/${data.totalTenants} attivi`} icon={Users} color={data.churnRate > 10 ? "hsl(0 70% 55%)" : "hsl(var(--chart-4))"} />
      </div>

      {/* Alerts */}
      {data.expiringTrials > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm text-foreground"><strong>{data.expiringTrials}</strong> trial in scadenza nei prossimi 30 giorni — contatta i tenant per la conversione.</p>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend */}
        <Card className="glass-card lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">Revenue Trend</h3>
                <p className="text-xs text-muted-foreground">Ultimi 6 mesi da fatture pagate</p>
              </div>
              <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3 w-3 mr-1.5" />Aggiorna</Button>
            </div>
            {data.revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `€${v}`} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Bar dataKey="amount" name="Revenue" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">Nessuna fattura negli ultimi 6 mesi</div>
            )}
          </CardContent>
        </Card>

        {/* MRR Split Donut */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-1">Composizione MRR</h3>
            <p className="text-xs text-muted-foreground mb-4">Piani base vs moduli add-on</p>
            {mrrSplit.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={mrrSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} strokeWidth={0}>
                    {mrrSplit.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">Nessun dato MRR</div>
            )}
            <div className="mt-2 space-y-2">
              {mrrSplit.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-bold text-foreground tabular-nums">{fmtCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Tier Breakdown + Top Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tier Breakdown */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" />Distribuzione per Tier</h3>
            <div className="space-y-4">
              {Object.entries(data.tierBreakdown).map(([tier, d]) => {
                const pct = data.totalTenants > 0 ? Math.round((d.count / data.totalTenants) * 100) : 0;
                return (
                  <div key={tier} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
                        <span className="font-semibold text-foreground">{tier}</span>
                        <Badge variant="outline" className="text-[10px]">{d.count} tenant</Badge>
                      </div>
                      <span className="font-bold text-foreground tabular-nums">{fmtCurrency(d.revenue)}/mo</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Modules */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Top Moduli per Adozione</h3>
            {data.topModules.length > 0 ? (
              <div className="space-y-3">
                {data.topModules.slice(0, 8).map((mod, i) => (
                  <div key={mod.key} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-sm truncate">{mod.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] tabular-nums">{mod.count} tenant</Badge>
                          <span className="text-xs font-bold text-foreground tabular-nums">{fmtCurrency(mod.revenue)}/mo</span>
                        </div>
                      </div>
                      <Progress value={data.activeTenants > 0 ? (mod.count / data.activeTenants) * 100 : 0} className="h-1.5 mt-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nessun modulo attivato
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
