"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, PhoneCall, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultGuidedCallDraft,
  guidedCallMetadata,
  guidedCallOutcomes,
  guidedCallPhases,
  parseGuidedCallDraft,
  type GuidedCallDraft,
  type GuidedCallOutcome,
} from "@/features/commercial/commercial-guided-calls";
import { pipelineStages } from "@/features/commercial/pipeline-stages";
import type { CommercialLead, PipelineStage } from "@/features/commercial/types";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { canEditLead } from "@/features/identity/permissions";
import { commercialApi, type CommercialActivity } from "@/lib/tenant-commercial-api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function inputDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isGuidedCall(activity: CommercialActivity) {
  return activity.metadata?.source === "guided_call" || Boolean(activity.metadata?.guided_call);
}

function isNextActionFor(activity: CommercialActivity, guidedCallId: string) {
  return activity.metadata?.guided_call_parent_id === guidedCallId;
}

export function GuidedCallButton({
  lead,
  variant = "default",
  className,
}: {
  lead: CommercialLead;
  variant?: "default" | "outline";
  className?: string;
}) {
  const identity = useDoflowIdentity();
  const [open, setOpen] = React.useState(false);
  if (!canEditLead(identity.currentUser, lead)) return null;
  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setOpen(true)} data-flow-tour="flow-guided-call">
        <PhoneCall />Chiamata guidata
      </Button>
      <GuidedCallSheet lead={lead} open={open} onOpenChange={setOpen} />
    </>
  );
}

function GuidedCallSheet({ lead, open, onOpenChange }: { lead: CommercialLead; open: boolean; onOpenChange: (open: boolean) => void }) {
  const fallback = React.useMemo(() => defaultGuidedCallDraft({
    service: lead.service,
    nextAction: lead.nextAction,
    nextActionAt: lead.nextActionAt,
    probability: lead.probability,
    stage: lead.stage,
  }), [lead.nextAction, lead.nextActionAt, lead.probability, lead.service, lead.stage]);
  const [activity, setActivity] = React.useState<CommercialActivity>();
  const activityRef = React.useRef<CommercialActivity | undefined>(undefined);
  const [draft, setDraft] = React.useState<GuidedCallDraft>(fallback);
  const [loading, setLoading] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string>();
  const saveChainRef = React.useRef<Promise<void>>(Promise.resolve());
  const lastSavedSignature = React.useRef("");

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      void commercialApi.activities({ opportunity_id: lead.id, type: "guided_call", limit: 50, sortBy: "updated_at", sortOrder: "DESC" })
      .then(async (page) => {
        if (cancelled) return;
        let current = page.items.find((item) => isGuidedCall(item) && item.status !== "completed" && !item.completed_at);
        if (!current) {
          const payload: Record<string, unknown> = {
            opportunity_id: lead.id,
            type: "guided_call",
            title: `Chiamata guidata · ${lead.company || lead.firstName + " " + lead.lastName}`,
            description: "Bozza guidata in corso",
            status: "in_progress",
            priority: "medium",
            due_at: new Date().toISOString(),
            metadata: guidedCallMetadata(fallback),
          };
          if (UUID_RE.test(lead.assigneeId)) payload.assigned_to = lead.assigneeId;
          current = await commercialApi.createActivity(payload);
        }
        if (cancelled) return;
        const next = parseGuidedCallDraft(current.metadata?.guided_call, fallback);
        activityRef.current = current;
        setActivity(current);
        setDraft(next);
        lastSavedSignature.current = JSON.stringify(guidedCallMetadata(next));
        setSavedAt(current.updated_at || current.created_at || undefined);
      })
      .catch((cause) => {
        if (!cancelled) {
          toast.error(cause instanceof Error ? cause.message : "Chiamata guidata non disponibile.");
          onOpenChange(false);
        }
      })
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, [fallback, lead.assigneeId, lead.company, lead.firstName, lead.id, lead.lastName, onOpenChange, open]);

  const persist = React.useCallback((next: GuidedCallDraft, announce = false) => {
    const signature = JSON.stringify(guidedCallMetadata(next));
    const operation = saveChainRef.current.catch(() => undefined).then(async () => {
      const current = activityRef.current;
      if (!current || signature === lastSavedSignature.current) return;
      const saved = await commercialApi.updateActivity(current.id, {
        version: current.version,
        status: next.status === "completed" ? "completed" : "in_progress",
        completed_at: next.status === "completed" ? next.completedAt : null,
        description: next.summary || `Bozza · fase ${next.phase + 1}/${guidedCallPhases.length}`,
        metadata: guidedCallMetadata(next),
      });
      activityRef.current = saved;
      setActivity(saved);
      lastSavedSignature.current = signature;
      setSavedAt(saved.updated_at || new Date().toISOString());
      if (announce) toast.success("Bozza salvata sul server.");
    });
    saveChainRef.current = operation;
    void operation.catch((cause) => {
      toast.error(cause instanceof Error ? cause.message : "Salvataggio bozza non riuscito.");
    });
    return operation;
  }, []);

  React.useEffect(() => {
    if (!open || loading || !activityRef.current || draft.status !== "draft") return;
    const timer = window.setTimeout(() => void persist({ ...draft, updatedAt: new Date().toISOString() }), 700);
    return () => window.clearTimeout(timer);
  }, [draft, loading, open, persist]);

  const setAnswer = (key: string, value: string) => setDraft((current) => ({
    ...current,
    answers: { ...current.answers, [key]: value },
  }));
  const phase = guidedCallPhases[draft.phase];
  const canAdvance = Boolean(draft.answers[phase.id]?.trim());
  const allAnswered = guidedCallPhases.every((entry) => Boolean(draft.answers[entry.id]?.trim()));
  const canComplete = allAnswered && Boolean(draft.summary.trim()) && Boolean(draft.nextAction.trim()) && Boolean(draft.nextActionAt);

  const complete = async () => {
    const current = activityRef.current;
    if (!current || !canComplete) return;
    setCompleting(true);
    try {
      const nextActionAt = new Date(draft.nextActionAt).toISOString();
      const activities = await commercialApi.activities({ opportunity_id: lead.id, limit: 100 });
      if (!activities.items.some((item) => isNextActionFor(item, current.id))) {
        const payload: Record<string, unknown> = {
          opportunity_id: lead.id,
          type: "activity",
          title: draft.nextAction.trim(),
          description: `Azione successiva alla chiamata guidata: ${draft.summary.trim()}`,
          due_at: nextActionAt,
          status: "todo",
          priority: "medium",
          metadata: { source: "guided_call", guided_call_parent_id: current.id, outcome: draft.outcome },
        };
        if (UUID_RE.test(lead.assigneeId)) payload.assigned_to = lead.assigneeId;
        await commercialApi.createActivity(payload);
      }
      const currentOpportunity = await commercialApi.opportunity(lead.id);
      const transition = await commercialApi.transitionOpportunity(lead.id, {
        stage: draft.stage,
        version: currentOpportunity.version,
        reason: "Esito chiamata guidata",
      });
      await commercialApi.updateOpportunity(lead.id, {
        version: transition.item.version,
        probability: draft.probability,
        next_action: draft.nextAction.trim(),
        next_action_at: nextActionAt,
      });
      const completedAt = new Date().toISOString();
      const completed: GuidedCallDraft = { ...draft, status: "completed", nextActionAt, completedAt, updatedAt: completedAt };
      await persist(completed);
      setDraft(completed);
      toast.success("Chiamata completata: esito e prossima azione registrati.");
      onOpenChange(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Completamento non riuscito.");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b px-5 py-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><SheetTitle>Chiamata guidata · {lead.firstName} {lead.lastName}</SheetTitle><SheetDescription>{lead.company} · bozza server-authoritative</SheetDescription></div>
            {activity ? <Badge variant="outline">{activity.status === "completed" ? "Completata" : "Bozza"}</Badge> : null}
          </div>
          <Progress value={(draft.phase + 1) / guidedCallPhases.length * 100} className="mt-3" />
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {loading ? <div className="grid min-h-80 place-items-center"><Loader2 className="size-6 animate-spin motion-reduce:animate-none" /></div> : (
            <div className="space-y-5 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">Fase {draft.phase + 1} di {guidedCallPhases.length}</p><h3 className="text-xl font-semibold">{phase.title}</h3></div>{savedAt ? <span className="text-xs text-muted-foreground">Salvata {new Date(savedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span> : null}</div>
              <Card>
                <CardHeader><CardTitle className="text-base">Script suggerito</CardTitle><CardDescription>{phase.hint}</CardDescription></CardHeader>
                <CardContent><p className="rounded-xl bg-muted p-4 text-sm font-medium">“{phase.script}”</p></CardContent>
              </Card>
              <div className="space-y-3">
                <Label htmlFor={"guided-answer-" + phase.id}>Risposta principale</Label>
                <Select value={draft.answers[phase.id] || ""} onValueChange={(value) => setAnswer(phase.id, value)}>
                  <SelectTrigger id={"guided-answer-" + phase.id}><SelectValue placeholder="Seleziona la risposta" /></SelectTrigger>
                  <SelectContent>{phase.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                </Select>
                <Label htmlFor={"guided-notes-" + phase.id}>Note operative</Label>
                <Textarea id={"guided-notes-" + phase.id} value={draft.answers[phase.id + "Notes"] || ""} onChange={(event) => setAnswer(phase.id + "Notes", event.target.value)} placeholder="Dettagli utili, senza dati non necessari" />
              </div>

              {draft.phase === guidedCallPhases.length - 1 ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Esito e azione successiva</CardTitle><CardDescription>Questi dati aggiornano attività e opportunità sul backend NestJS.</CardDescription></CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Esito</Label><Select value={draft.outcome} onValueChange={(value) => setDraft((current) => ({ ...current, outcome: value as GuidedCallOutcome }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{guidedCallOutcomes.map((outcome) => <SelectItem key={outcome} value={outcome}>{outcome}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Fase pipeline</Label><Select value={draft.stage} onValueChange={(value) => setDraft((current) => ({ ...current, stage: value as PipelineStage }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{pipelineStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="guided-next-action">Prossima azione</Label><Input id="guided-next-action" value={draft.nextAction} onChange={(event) => setDraft((current) => ({ ...current, nextAction: event.target.value }))} /></div>
                    <div className="space-y-2"><Label htmlFor="guided-next-date">Data e ora</Label><Input id="guided-next-date" type="datetime-local" value={inputDateTime(draft.nextActionAt)} onChange={(event) => setDraft((current) => ({ ...current, nextActionAt: event.target.value }))} /></div>
                    <div className="space-y-2"><Label htmlFor="guided-probability">Probabilità (%)</Label><Input id="guided-probability" type="number" min="0" max="100" value={draft.probability} onChange={(event) => setDraft((current) => ({ ...current, probability: Math.max(0, Math.min(100, Number(event.target.value || 0))) }))} /></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="guided-summary">Riepilogo concordato</Label><Textarea id="guided-summary" value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} /></div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </ScrollArea>

        <SheetFooter className="shrink-0 flex-row flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
          <Button type="button" variant="ghost" disabled={loading || draft.phase === 0} onClick={() => setDraft((current) => ({ ...current, phase: Math.max(0, current.phase - 1) }))}><ChevronLeft />Indietro</Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={loading || !activity} onClick={() => void persist({ ...draft, updatedAt: new Date().toISOString() }, true)}><Save />Salva bozza</Button>
            {draft.phase < guidedCallPhases.length - 1 ? <Button type="button" disabled={!canAdvance} onClick={() => setDraft((current) => ({ ...current, phase: Math.min(guidedCallPhases.length - 1, current.phase + 1) }))}>Avanti<ChevronRight /></Button> : <Button type="button" disabled={!canComplete || completing} onClick={() => void complete()}>{completing ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Check />}Completa</Button>}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
