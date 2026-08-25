"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Cable, CircleGauge, Loader2, RefreshCw, Target, Trophy, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationsOverviewPage } from "@/components/tenant-automations/automations-core";
import { ServerRankingsPanel } from "@/features/commercial/components/server-rankings-panel";
import { performanceApi, type PerformanceState } from "@/lib/tenant-performance-api";

export function AutomationPerformancePage() {
  const [state, setState] = useState<PerformanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setState(await performanceApi.state()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Performance non disponibile"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6" data-automation-authority="server">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Collaboration & Automation</p><h1 className="text-2xl font-semibold">Automazioni e Performance</h1><p className="mt-1 text-sm text-muted-foreground">Regole versionate, esecuzioni BullMQ, ledger append-only e classifiche consolidate.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/automations/rules"><Workflow />Regole</Link></Button><Button asChild variant="outline"><Link href="/automations/runs"><Activity />Esecuzioni</Link></Button><Button size="icon" variant="outline" aria-label="Aggiorna dati" onClick={() => void load()}><RefreshCw /></Button></div></header>
    {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : null}
    <Tabs defaultValue="automations"><TabsList className="flex h-auto w-full flex-wrap justify-start"><TabsTrigger value="automations">Automazioni</TabsTrigger><TabsTrigger value="points">Punti</TabsTrigger><TabsTrigger value="rankings">Classifiche</TabsTrigger><TabsTrigger value="mission">Missione</TabsTrigger><TabsTrigger value="adapters">Adapter</TabsTrigger></TabsList>
      <TabsContent value="automations" className="-mx-4 md:-mx-6"><AutomationsOverviewPage /></TabsContent>
      <TabsContent value="points" className="space-y-4 pt-4"><div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleGauge className="size-5" />Ledger punti</CardTitle><CardDescription>Movimenti append-only prodotti da eventi economici, Delivery e QA.</CardDescription></CardHeader><CardContent className="space-y-2">{loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Caricamento…</p> : state?.pointLedger.map((entry) => <div key={entry.id} className="grid gap-1 rounded-lg border p-3 sm:grid-cols-[1fr_auto]"><div><p className="font-medium">{entry.reason}</p><p className="text-xs text-muted-foreground">{entry.rule} · policy v{(entry as typeof entry & { policyVersion?: number }).policyVersion || "—"} · {new Date(entry.occurredAt).toLocaleString("it-IT")}</p></div><Badge variant={entry.points < 0 ? "destructive" : entry.status === "provisional" ? "outline" : "secondary"}>{entry.points > 0 ? "+" : ""}{entry.points} pt</Badge></div>)}{!loading && !state?.pointLedger.length ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun movimento reale registrato.</p> : null}</CardContent></Card><Card><CardHeader><CardTitle>Policy attiva</CardTitle><CardDescription>Formula server versionata e spiegabile.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">{state?.pointPolicy ? Object.entries(state.pointPolicy).map(([key, value]) => <div key={key} className="flex justify-between gap-3 border-b py-2"><span className="text-muted-foreground">{key}</span><strong>{value}</strong></div>) : <p className="text-muted-foreground">Policy non disponibile.</p>}<p className="pt-2 text-xs text-muted-foreground">Le rettifiche richiedono motivazione e creano nuovi movimenti; nessuna riga viene sovrascritta.</p></CardContent></Card></div></TabsContent>
      <TabsContent value="rankings" className="pt-4"><ServerRankingsPanel /></TabsContent>
      <TabsContent value="mission" className="space-y-4 pt-4"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-5" />Missione e obiettivi</CardTitle><CardDescription>Avanzamento aggregato dal backend nel perimetro autorizzato.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{state?.mission.items.map((goal) => <div key={goal.id} className="rounded-lg border p-4"><div className="flex justify-between gap-2"><strong>{goal.title}</strong><Badge variant="outline">{goal.progress == null ? "Protetto" : `${goal.progress}%`}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{goal.description}</p><p className="mt-3 text-xs">{goal.redacted || goal.currentValue == null ? "Valore economico redatto dal backend" : `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`}</p></div>)}{!state?.mission.items.length ? <p className="text-sm text-muted-foreground">Nessun obiettivo attivo.</p> : null}</CardContent></Card></TabsContent>
      <TabsContent value="adapters" className="space-y-4 pt-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{state?.adapters.map((adapter) => <Card key={adapter.name}><CardContent className="p-4"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-medium"><Cable className="size-4" />{adapter.name}</span><Badge variant={adapter.enabled && adapter.configured ? "secondary" : "outline"}>{adapter.enabled && adapter.configured ? "Attivo" : "Disabilitato"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{adapter.synthetic ? "Adapter sintetico acceptance" : adapter.required_secret_names.length ? `Richiede ${adapter.required_secret_names.join(", ")}` : "Provider non configurato"}</p><p className="mt-1 text-xs">Health: {adapter.health_state}</p>{adapter.last_error ? <p className="mt-2 text-xs text-destructive">{adapter.last_error}</p> : null}</CardContent></Card>)}</div><Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-5" />Nessun successo simulato</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Gli adapter esterni non configurati falliscono esplicitamente e producono run/action log/dead-letter controllati. L’adapter sintetico può essere abilitato soltanto nello stack acceptance.</CardContent></Card></TabsContent>
    </Tabs>
  </main>;
}
