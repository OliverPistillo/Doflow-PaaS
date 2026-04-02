// apps/frontend/src/app/superadmin/system/components/tab-api-usage.tsx
// CORRETTO: allineato allo shape reale di ApiUsageStats dal backend.
// requestsTimeline (non requestsByHour), topEndpoints senza avgMs/errors,
// no avgResponseMs, aggiunto rateLimitHits e uniqueIps.

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Loader2, RefreshCw, Radio } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ApiUsageStats {
  totalRequests:    number;
  uniqueIps:        number;
  topEndpoints:     { path: string; count: number }[];
  topTenants:       { tenantId: string; tenantName?: string; count: number }[];
  requestsByType:   { type: string; count: number }[];
  errorRate:        number;
  recentErrors:     any[];
  requestsTimeline: { hour: string; count: number }[];
  rateLimitHits:    number;
}

const fmtNumber = (n: unknown) =>
  new Intl.NumberFormat("it-IT").format(Number(n) || 0);

function ErrorRateBadge({ rate }: { rate: number }) {
  const r = Number(rate) || 0;
  if (r < 1) return <Badge className="bg-emerald-100 text-emerald-700 border-0">{r.toFixed(2)}%</Badge>;
  if (r < 5) return <Badge className="bg-amber-100 text-amber-700 border-0">{r.toFixed(2)}%</Badge>;
  return <Badge variant="destructive">{r.toFixed(2)}%</Badge>;
}

export function TabApiUsage() {
  const [data, setData]       = useState<ApiUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<ApiUsageStats>("/superadmin/api-usage/stats");
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Radio className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">Impossibile caricare i dati API</p>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Riprova
        </Button>
      </div>
    );
  }

  const errorRate = Number(data.errorRate) || 0;

  return (
    <div className="space-y-6">

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Richieste totali", value: fmtNumber(data.totalRequests), color: "hsl(var(--chart-1))" },
          { label: "IP unici",         value: fmtNumber(data.uniqueIps),     color: "hsl(var(--chart-2))" },
          {
            label: "Error rate",
            value: `${errorRate.toFixed(2)}%`,
            color: errorRate > 5 ? "hsl(0 70% 55%)" : "hsl(150 60% 45%)",
          },
        ].map(({ label, value, color }) => (
          <Card key={label} className="glass-card border-none">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-3xl font-black mt-2 tabular-nums" style={{ color }}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rate limit warning */}
      {(data.rateLimitHits ?? 0) > 0 && (
        <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-4 pb-4">
            <span className="text-amber-600 dark:text-amber-400 text-sm font-bold">
              ⚠ Rate limit colpito {fmtNumber(data.rateLimitHits)} volte nell&apos;ultima finestra
            </span>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {(data.requestsTimeline?.length ?? 0) > 0 && (
        <Card className="glass-card border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Traffico per ora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.requestsTimeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "12px", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Richieste" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Endpoints */}
        <Card className="glass-card border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Endpoint più chiamati
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Chiamate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.topEndpoints ?? []).slice(0, 10).map((ep) => (
                  <TableRow key={ep.path}>
                    <TableCell className="font-mono text-xs max-w-[260px] truncate">{ep.path}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">{fmtNumber(ep.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Tenants */}
        <Card className="glass-card border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Tenant più attivi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Richieste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.topTenants ?? []).slice(0, 10).map((t) => (
                  <TableRow key={t.tenantId}>
                    <TableCell className="text-sm font-medium">{t.tenantName || t.tenantId}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtNumber(t.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Aggiorna dati
        </Button>
      </div>

    </div>
  );
}
