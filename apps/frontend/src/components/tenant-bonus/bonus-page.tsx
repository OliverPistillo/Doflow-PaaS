"use client";

import * as React from "react";
import { CalendarCheck, CheckCircle2, Coins, Gift, History, Loader2, RefreshCw, Send, ShieldCheck, SlidersHorizontal, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { bonusApi, type BonusDashboard } from "@/lib/tenant-feature-api";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";

function points(value?: number) {
  return new Intl.NumberFormat("it-IT").format(Number(value || 0));
}

function euros(cents?: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(cents || 0) / 100);
}

function shortIdentity(value?: string) {
  if (!value) return "Utente tenant";
  return value.length > 16 ? value.slice(0, 8) + "…" + value.slice(-4) : value;
}

const policyFields = [
  ["pointEuroCents", "Cent per punto"],
  ["minimumRequestPoints", "Soglia richiesta"],
  ["reservePoints", "Riserva minima"],
  ["monthlyCapPoints", "Tetto mensile"],
  ["collectedEuroPerPoint", "Euro incassati per punto"],
] as const;

export function BonusPage() {
  const [dashboard, setDashboard] = React.useState<BonusDashboard>();
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [adminBusy, setAdminBusy] = React.useState(false);
  const [requestedPoints, setRequestedPoints] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [decisionReasons, setDecisionReasons] = React.useState<Record<string, string>>({});
  const [adjustmentUserId, setAdjustmentUserId] = React.useState("");
  const [adjustmentPoints, setAdjustmentPoints] = React.useState("");
  const [adjustmentReason, setAdjustmentReason] = React.useState("");
  const [policyDraft, setPolicyDraft] = React.useState<Record<string, string>>({});
  const [policyReason, setPolicyReason] = React.useState("");
  const [periodReasons, setPeriodReasons] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await bonusApi.dashboard();
      setDashboard(next);
      if (next.canManage) {
        const team = await teamApi.members({ limit: 200 }).catch(() => ({ items: [] as TeamMember[] }));
        const available = team.items.filter((member) => Boolean(member.user_id));
        setMembers(available);
        setAdjustmentUserId((current) => current || available[0]?.user_id || "");
      } else {
        setMembers([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bonus non disponibile.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submit = async () => {
    const value = Number(requestedPoints);
    if (!Number.isInteger(value) || value <= 0 || !reason.trim()) return;
    setSubmitting(true);
    try {
      await bonusApi.request(value, reason.trim());
      setRequestedPoints("");
      setReason("");
      await load();
      toast.success("Richiesta inviata.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Richiesta non inviata.");
    } finally {
      setSubmitting(false);
    }
  };

  const runAdmin = async (task: () => Promise<unknown>, success: string) => {
    setAdminBusy(true);
    try {
      await task();
      await load();
      toast.success(success);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Operazione non completata.");
    } finally {
      setAdminBusy(false);
    }
  };

  const decide = (requestId: string, decision: "approve" | "reject") => {
    const decisionReason = decisionReasons[requestId]?.trim();
    if (!decisionReason) return;
    void runAdmin(
      () => bonusApi.decide(requestId, decision, decisionReason),
      decision === "approve" ? "Richiesta approvata." : "Richiesta rifiutata.",
    ).then(() => setDecisionReasons((current) => ({ ...current, [requestId]: "" })));
  };

  const saveAdjustment = () => {
    const value = Number(adjustmentPoints);
    if (!adjustmentUserId || !Number.isFinite(value) || value === 0 || !adjustmentReason.trim()) return;
    void runAdmin(
      () => bonusApi.adjustment(adjustmentUserId, value, adjustmentReason.trim()),
      "Rettifica append-only registrata.",
    ).then(() => {
      setAdjustmentPoints("");
      setAdjustmentReason("");
    });
  };

  const savePolicy = () => {
    const current = dashboard?.policy;
    if (!current || !policyReason.trim()) return;
    const rules = Object.fromEntries(policyFields.map(([key]) => [key, Number(policyDraft[key] ?? current[key] ?? 0)]));
    if (Object.values(rules).some((value) => !Number.isFinite(value) || value < 0)) return;
    void runAdmin(
      () => bonusApi.policy(current.name || "Policy Bonus", rules, policyReason.trim()),
      "Nuova versione della policy salvata.",
    ).then(() => {
      setPolicyDraft({});
      setPolicyReason("");
    });
  };

  const wallet = dashboard?.wallet;
  const minimum = wallet?.minimumRequestPoints || dashboard?.policy?.minimumRequestPoints || 0;
  const requestValue = Number(requestedPoints || 0);
  const canRequest = Number.isInteger(requestValue)
    && requestValue >= minimum
    && requestValue <= Number(wallet?.availablePoints || 0)
    && Boolean(reason.trim());
  const memberName = React.useCallback((userId?: string) => {
    const member = members.find((entry) => entry.user_id === userId);
    return member?.display_name || member?.email || shortIdentity(userId);
  }, [members]);

  return (
    <main className="w-full space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bonus</h1>
          <p className="mt-1 text-sm text-muted-foreground">Saldo, policy versionata e richieste registrati dal ledger del tenant.</p>
        </div>
        <div className="flex items-center gap-2">
          {dashboard?.policy?.version ? <Badge variant="outline">Policy v{dashboard.policy.version}</Badge> : null}
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw className={loading ? "animate-spin motion-reduce:animate-none" : ""} />Aggiorna
          </Button>
        </div>
      </header>

      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
      {loading && !dashboard ? <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-2xl" />)}</div> : null}

      {dashboard ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardDescription>Disponibili</CardDescription><CardTitle className="flex items-center gap-2 text-3xl"><Coins className="size-6 text-primary" />{points(wallet?.availablePoints)}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Valore indicativo: {euros(wallet?.euroValueCents)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardDescription>Provvisori</CardDescription><CardTitle className="text-3xl">{points(wallet?.provisionalPoints)}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Diventano disponibili dopo il consolidamento.</CardContent>
            </Card>
            <Card>
              <CardHeader><CardDescription>Riservati</CardDescription><CardTitle className="text-3xl">{points(wallet?.reservedPoints)}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Associati a richieste ancora in lavorazione.</CardContent>
            </Card>
          </section>

          <Tabs defaultValue="movements" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 justify-start sm:flex sm:overflow-x-auto">
              <TabsTrigger value="movements">Movimenti</TabsTrigger>
              <TabsTrigger value="requests">Richieste</TabsTrigger>
              {dashboard.canManage ? <TabsTrigger value="approvals">Approvazioni</TabsTrigger> : null}
              {dashboard.canManage ? <TabsTrigger value="administration">Amministrazione</TabsTrigger> : null}
            </TabsList>

            <TabsContent value="movements">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5" />Movimenti</CardTitle><CardDescription>Registro trasparente e non modificabile dal client.</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {!dashboard.ledger.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun movimento disponibile.</p> : null}
                  {dashboard.ledger.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 rounded-xl border p-3">
                      <span className={"text-sm font-semibold " + (entry.points >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{entry.points >= 0 ? "+" : ""}{points(entry.points)}</span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{entry.reason}</p><p className="text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString("it-IT")}</p></div>
                      {entry.status ? <Badge variant="secondary">{entry.status}</Badge> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requests">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <Card>
                  <CardHeader><CardTitle className="text-base">Richieste recenti</CardTitle><CardDescription>Lo stato viene aggiornato dal backend.</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    {!dashboard.requests.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nessuna richiesta.</p> : null}
                    {dashboard.requests.map((request) => (
                      <div key={request.id} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between gap-2"><span className="font-medium">{points(request.points)} punti</span><Badge variant="outline">{request.status}</Badge></div>
                        <p className="mt-1 text-sm">{request.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleString("it-IT")}</p>
                        {request.decisionReason ? <p className="mt-2 rounded-lg bg-muted p-2 text-xs">Decisione: {request.decisionReason}</p> : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="size-5" />Richiedi bonus</CardTitle><CardDescription>Minimo {points(minimum)} punti.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2"><Label htmlFor="bonus-points">Punti</Label><Input id="bonus-points" type="number" min={minimum || 1} max={wallet?.availablePoints} value={requestedPoints} onChange={(event) => setRequestedPoints(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="bonus-reason">Motivazione</Label><Textarea id="bonus-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
                    <Progress value={wallet?.availablePoints ? Math.min(100, requestValue / wallet.availablePoints * 100) : 0} />
                    <Button type="button" className="w-full" disabled={!canRequest || submitting} onClick={() => void submit()}>{submitting ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Send />}Invia richiesta</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {dashboard.canManage ? (
              <TabsContent value="approvals">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />Approvazioni</CardTitle><CardDescription>Ogni decisione richiede una motivazione ed è registrata nell’audit tenant.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {!dashboard.pendingRequests.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nessuna richiesta da elaborare.</p> : null}
                    {dashboard.pendingRequests.map((request) => (
                      <div key={request.id} className="space-y-3 rounded-xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{memberName(request.userId)}</p><p className="text-sm text-muted-foreground">{points(request.points)} punti · {request.reason}</p></div><Badge variant="outline">{request.status}</Badge></div>
                        <div className="space-y-2"><Label htmlFor={"bonus-decision-" + request.id}>Motivazione decisione</Label><Textarea id={"bonus-decision-" + request.id} value={decisionReasons[request.id] || ""} onChange={(event) => setDecisionReasons((current) => ({ ...current, [request.id]: event.target.value }))} /></div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" disabled={adminBusy || !decisionReasons[request.id]?.trim()} onClick={() => decide(request.id, "reject")}><XCircle />Rifiuta</Button>
                          {request.userId !== dashboard.currentUserId ? (
                            <Button type="button" disabled={adminBusy || !decisionReasons[request.id]?.trim()} onClick={() => decide(request.id, "approve")}><CheckCircle2 />Approva</Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}

            {dashboard.canManage ? (
              <TabsContent value="administration" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-5" />Policy Bonus</CardTitle><CardDescription>Il salvataggio crea una nuova versione; i movimenti precedenti restano immutati.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {policyFields.map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={"bonus-policy-" + key}>{label}</Label><Input id={"bonus-policy-" + key} type="number" min="0" value={policyDraft[key] ?? String(dashboard.policy?.[key] ?? 0)} onChange={(event) => setPolicyDraft((current) => ({ ...current, [key]: event.target.value }))} /></div>)}
                    </div>
                    <div className="space-y-2"><Label htmlFor="bonus-policy-reason">Motivazione nuova versione</Label><Textarea id="bonus-policy-reason" value={policyReason} onChange={(event) => setPolicyReason(event.target.value)} /></div>
                    <Button type="button" disabled={adminBusy || !policyReason.trim()} onClick={savePolicy}>Salva nuova versione</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Rettifica append-only</CardTitle><CardDescription>Il movimento originale non viene riscritto e la motivazione resta nell’audit.</CardDescription></CardHeader>
                  <CardContent className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_10rem_minmax(16rem,2fr)_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="bonus-adjustment-user">Collaboratore</Label>
                      {members.length ? <select id="bonus-adjustment-user" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={adjustmentUserId} onChange={(event) => setAdjustmentUserId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.user_id || ""}>{member.display_name || member.email}</option>)}</select> : <Input id="bonus-adjustment-user" value={adjustmentUserId} onChange={(event) => setAdjustmentUserId(event.target.value)} placeholder="UUID utente tenant" />}
                    </div>
                    <div className="space-y-2"><Label htmlFor="bonus-adjustment-points">Punti</Label><Input id="bonus-adjustment-points" type="number" value={adjustmentPoints} onChange={(event) => setAdjustmentPoints(event.target.value)} placeholder="+10 / -5" /></div>
                    <div className="space-y-2"><Label htmlFor="bonus-adjustment-reason">Motivazione</Label><Input id="bonus-adjustment-reason" value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} /></div>
                    <Button type="button" className="self-end" disabled={adminBusy || !adjustmentUserId || !adjustmentPoints || !adjustmentReason.trim()} onClick={saveAdjustment}>Registra</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="size-5" />Periodi</CardTitle><CardDescription>Il consolidamento rende definitivi i movimenti provvisori ed è idempotente.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {!dashboard.periods.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun periodo configurato.</p> : null}
                    {dashboard.periods.map((period) => (
                      <div key={period.id} className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,2fr)_auto]">
                        <div><p className="font-medium">{period.label}</p><p className="text-xs text-muted-foreground">{period.startsAt || "—"} → {period.endsAt || "—"}</p><Badge className="mt-2" variant="outline">{period.status}</Badge></div>
                        <div className="space-y-2"><Label htmlFor={"bonus-period-" + period.id}>Motivazione consolidamento</Label><Input id={"bonus-period-" + period.id} disabled={period.status !== "open"} value={periodReasons[period.id] || ""} onChange={(event) => setPeriodReasons((current) => ({ ...current, [period.id]: event.target.value }))} /></div>
                        <Button type="button" className="self-end" disabled={adminBusy || period.status !== "open" || !periodReasons[period.id]?.trim()} onClick={() => void runAdmin(() => bonusApi.consolidate(period.id, periodReasons[period.id].trim()), "Periodo consolidato.")}>Consolida</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}
          </Tabs>
        </>
      ) : null}
    </main>
  );
}
