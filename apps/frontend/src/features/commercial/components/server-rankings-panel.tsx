"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rankingMetricLabels, rankingRoleLabels } from "@/features/commercial/commercial-rankings";
import type { RankingConfig, RankingRole, RankingSnapshot } from "@/features/commercial/commercial-provider-types";
import { performanceApi, type PerformanceState, type RankingPreview } from "@/lib/tenant-performance-api";

const roles: RankingRole[] = ["commercial", "developer", "project_manager", "support"];

export function ServerRankingsPanel() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [role, setRole] = useState<RankingRole>("commercial");
  const [state, setState] = useState<PerformanceState | null>(null);
  const [preview, setPreview] = useState<RankingPreview | null>(null);
  const [draft, setDraft] = useState<RankingConfig["metrics"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextState, nextPreview] = await Promise.all([performanceApi.state(), performanceApi.previewRanking(period, role)]);
      setState(nextState); setPreview(nextPreview);
      setDraft(nextState.rankingConfigs.find((item) => item.role === role)?.metrics || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Classifica non disponibile");
      setPreview(null);
    } finally { setLoading(false); }
  }, [period, role]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const config = state?.rankingConfigs.find((item) => item.role === role);
  const currentPeriod = period === new Date().toISOString().slice(0, 7);
  const snapshots = (state?.rankingSnapshots || []).filter((item) => item.role === role).sort((a, b) => b.period.localeCompare(a.period));

  const saveFormula = async () => {
    if (!config) return;
    try {
      await performanceApi.updateRankingConfig(role, draft, config.optimisticVersion || 1);
      toast.success("Formula classifica versionata sul server");
      await load();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Formula non salvata"); }
  };
  const consolidate = async () => {
    try {
      await performanceApi.consolidateRanking(period, role, "Consolidamento amministrativo del periodo chiuso");
      toast.success("Snapshot immutabile consolidato");
      await load();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Consolidamento non riuscito"); }
  };
  const revoke = async (snapshot: RankingSnapshot) => {
    const reason = window.prompt("Motivo obbligatorio della revoca");
    if (!reason?.trim()) return;
    try { await performanceApi.revokeRanking(snapshot.id, reason.trim()); toast.success("Revoca registrata senza modificare lo snapshot"); await load(); }
    catch (failure) { toast.error(failure instanceof Error ? failure.message : "Revoca non riuscita"); }
  };

  return <Card data-performance-source="server">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Trophy className="size-5 text-amber-500" />Classifiche mensili</CardTitle><CardDescription>Metriche, punteggi e badge sono calcolati dal backend; gli snapshot consolidati sono immutabili.</CardDescription></div><div className="flex gap-2"><Input aria-label="Periodo classifiche" type="month" className="w-40" value={period} onChange={(event) => setPeriod(event.target.value)} /><Button size="icon" variant="outline" aria-label="Aggiorna classifica" onClick={() => void load()}><RefreshCw /></Button></div></div></CardHeader>
    <CardContent><Tabs value={role} onValueChange={(value) => setRole(value as RankingRole)}><TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">{roles.map((item) => <TabsTrigger key={item} value={item}>{rankingRoleLabels[item]}</TabsTrigger>)}</TabsList><TabsContent value={role} className="space-y-4 pt-4">
      {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Calcolo server in corso…</p> : <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]"><div className="space-y-2">{preview?.rows.map((row) => <div key={row.userId} className="rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><Badge variant={row.position === 1 ? "default" : "secondary"}>#{row.position}</Badge>{currentPeriod && row.position === 1 && row.score > 0 ? <Badge variant="outline">In testa questo mese</Badge> : null}<strong>{row.name}</strong>{row.tied ? <Badge variant="outline">Pari merito</Badge> : null}<span className="ml-auto font-semibold tabular-nums">{row.score.toFixed(2)} pt</span></div><div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">{Object.entries(row.metrics).map(([metric, value]) => <span key={metric}>{rankingMetricLabels[metric as keyof typeof rankingMetricLabels] || metric}: <b>{value}</b></span>)}</div></div>)}{!preview?.rows.length ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun dato reale autorizzato nel periodo.</p> : null}</div><div className="space-y-3 rounded-lg border p-4"><h3 className="font-medium">Formula trasparente</h3><p className="text-xs text-muted-foreground">Ogni metrica è normalizzata sul massimo del periodo. Rimborsi, ritardi e riaperture sono penalità; il risultato resta tra 0 e 100.</p>{draft.map((metric, index) => <div key={metric.metric} className="grid grid-cols-[1fr_80px] items-center gap-2"><Label htmlFor={`server-${role}-${metric.metric}`} className="text-xs">{rankingMetricLabels[metric.metric]}</Label><Input id={`server-${role}-${metric.metric}`} type="number" min="0" max="100" value={metric.weight} disabled={!state?.permissions.canManageRankings} onChange={(event) => setDraft((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, weight: Number(event.target.value) } : item))} /></div>)}<p className="text-xs text-muted-foreground">Totale pesi: {draft.reduce((sum, item) => sum + item.weight, 0)}% · versione {config?.formulaVersion || "—"}</p>{state?.permissions.canManageRankings ? <><Button className="w-full" variant="outline" onClick={() => void saveFormula()}>Salva nuova versione formula</Button><Button className="w-full" disabled={currentPeriod || !preview?.rows.some((row) => row.score > 0) || snapshots.some((item) => item.period === period && item.status !== "revoked")} onClick={() => void consolidate()}>Consolida periodo chiuso</Button></> : null}</div></div>}
      <div><h3 className="mb-2 text-sm font-medium">Snapshot e revisioni</h3><div className="flex flex-wrap gap-2">{snapshots.map((snapshot) => <span key={snapshot.id} className="inline-flex items-center gap-1"><Badge variant="outline" className={snapshot.status === "revoked" ? "line-through opacity-60" : ""}>{snapshot.period} · {snapshot.winnerUserId}{snapshot.status === "revoked" ? " · revocata" : ""}</Badge>{state?.permissions.canManageRankings && snapshot.status !== "revoked" ? <Button size="sm" variant="ghost" onClick={() => void revoke(snapshot)}>Revoca</Button> : null}</span>)}{!snapshots.length ? <span className="text-xs text-muted-foreground">Nessuno snapshot consolidato.</span> : null}</div></div>
    </TabsContent></Tabs></CardContent>
  </Card>;
}
