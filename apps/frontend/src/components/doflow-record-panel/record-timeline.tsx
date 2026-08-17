"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock, CheckSquare2, ChevronDown, CircleDot, FileText, Filter, Mail,
  MessageCircle, NotebookPen, Phone, Plus, RefreshCw, Send, SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { timelineApi, type TimelineEvent, type TimelineRecordKind } from "@/lib/tenant-timeline-api";
import type { TeamMember } from "@/lib/tenant-team-api";
import { RecordPanelEmptyState } from "./unified-record-panel";

type ComposerKind = "note" | "activity" | "appointment" | "call" | "email" | "whatsapp";

const quickFilters = [
  { value: "all", label: "Tutto", types: [] },
  { value: "call", label: "Chiamate", types: ["call"] },
  { value: "whatsapp", label: "WhatsApp", types: ["whatsapp"] },
  { value: "email", label: "Email", types: ["email"] },
  { value: "note", label: "Note", types: ["note"] },
  { value: "appointment", label: "Appuntamenti", types: ["appointment"] },
  { value: "status", label: "Cambi di stato", types: ["status_change"] },
] as const;

const composerKinds: Array<{ value: ComposerKind; label: string; icon: typeof NotebookPen }> = [
  { value: "note", label: "Nota", icon: NotebookPen },
  { value: "activity", label: "Attività", icon: CheckSquare2 },
  { value: "appointment", label: "Appuntamento", icon: CalendarClock },
  { value: "call", label: "Chiamata", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const eventLabels: Record<string, string> = {
  activity: "Attività",
  appointment: "Appuntamento",
  call: "Chiamata",
  email: "Email",
  file: "File",
  note: "Nota interna",
  status_change: "Cambio di stato",
  whatsapp: "WhatsApp",
};

const statusLabels: Record<string, string> = {
  answered: "Risposto",
  busy: "Occupato",
  completed: "Completata",
  manually_confirmed: "Confermato manualmente",
  no_answer: "Nessuna risposta",
  pending: "Da fare",
  recorded: "Registrata",
  rescheduled: "Da richiamare",
  scheduled: "Pianificato",
  sent: "Invio confermato",
  voicemail: "Segreteria",
};

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function timelineDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Data non disponibile";
}

function eventIcon(type: string) {
  if (type === "call") return Phone;
  if (type === "email") return Mail;
  if (type === "whatsapp") return MessageCircle;
  if (type === "appointment") return CalendarClock;
  if (type === "note") return NotebookPen;
  if (type === "file") return FileText;
  if (type === "status_change") return RefreshCw;
  return CheckSquare2;
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const Icon = eventIcon(event.type);
  const external = event.direction === "outbound" || event.direction === "inbound";
  const detail = statusLabels[event.outcome || ""] || statusLabels[event.status] || event.outcome || event.status;
  const dueAt = typeof event.metadata?.due_at === "string" ? event.metadata.due_at : null;
  const priority = typeof event.metadata?.priority === "string" ? event.metadata.priority : null;
  return (
    <article className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3" data-timeline-event>
      <div className={cn(
        "relative z-10 flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm",
        event.type === "whatsapp" ? "border-emerald-200 text-emerald-600" : "border-violet-200 text-violet-700",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{eventLabels[event.type] || event.type}</span>
              {event.channel === "internal" ? <Badge variant="secondary" className="h-5 bg-amber-50 px-2 text-[10px] text-amber-700">Interna</Badge> : null}
              {external ? <span>{event.direction === "outbound" ? "In uscita" : "In entrata"}</span> : null}
            </div>
            <h4 className="mt-1 text-sm font-semibold text-slate-950" data-record-sensitive>{event.title}</h4>
          </div>
          {detail ? <Badge variant="secondary" className="shrink-0 bg-slate-100 text-[10px] text-slate-700">{detail}</Badge> : null}
        </div>
        {event.body ? event.body.length > 220 ? (
          <details className="group mt-3 text-sm leading-6 text-slate-700" data-record-sensitive>
            <summary className="cursor-pointer list-none font-medium text-violet-700">Mostra contenuto <ChevronDown className="inline h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
            <p className="mt-2 whitespace-pre-wrap">{event.body}</p>
          </details>
        ) : <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700" data-record-sensitive>{event.body}</p> : null}
        {dueAt || priority ? <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">{dueAt ? <span>Scadenza {timelineDate(dueAt)}</span> : null}{priority ? <span>Priorità {priority}</span> : null}</div> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <span data-record-sensitive>{event.author_label}</span><span aria-hidden="true">·</span><time>{timelineDate(event.created_at)}</time>
        </div>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="block text-xs font-medium text-slate-600">{label}</span>{children}</label>;
}

export function RecordTimeline({
  recordKind,
  recordId,
  moduleKey,
  phone,
  email,
  members,
  draft,
}: {
  recordKind: TimelineRecordKind;
  recordId: string;
  moduleKey: "crm" | "projects";
  phone?: string | null;
  email?: string | null;
  members: TeamMember[];
  draft?: { key: number; channel: "email" | "whatsapp"; body: string } | null;
}) {
  const { canCreate } = useTenantAccess();
  const { toast } = useToast();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState("all");
  const [advanced, setAdvanced] = useState(false);
  const [operatorId, setOperatorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [outcome, setOutcome] = useState("");
  const [composer, setComposer] = useState<ComposerKind>("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("medium");
  const [destination, setDestination] = useState(phone || email || "");
  const [callOutcome, setCallOutcome] = useState("answered");
  const [duration, setDuration] = useState("");
  const [externalOpened, setExternalOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestVersion = useRef(0);

  const selectedTypes = useMemo(() => quickFilters.find((item) => item.value === quick)?.types || [], [quick]);
  const target = useMemo(() => ({ record_kind: recordKind, record_id: recordId }), [recordId, recordKind]);

  useEffect(() => {
    setDestination(composer === "email" ? email || "" : phone || "");
    setExternalOpened(false);
  }, [composer, email, phone]);

  useEffect(() => {
    if (!draft) return;
    setComposer(draft.channel);
    setTitle("Richiesta materiale");
    setBody(draft.body);
    setDestination(draft.channel === "email" ? email || "" : phone || "");
    setExternalOpened(false);
  }, [draft, email, phone]);

  useEffect(() => {
    const controller = new AbortController();
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    timelineApi.list(target, {
      types: [...selectedTypes], operator_id: operatorId || undefined,
      date_from: dateFrom || undefined, date_to: dateTo ? `${dateTo}T23:59:59.999` : undefined,
      outcome: outcome || undefined, limit: 20,
    }, controller.signal).then((page) => {
      if (version !== requestVersion.current) return;
      setEvents(page.items || []);
      setCursor(page.next_cursor || null);
      setHasMore(Boolean(page.has_more));
    }).catch((reason) => {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setError(reason instanceof Error ? reason.message : "Timeline non disponibile");
    }).finally(() => {
      if (!controller.signal.aborted && version === requestVersion.current) setLoading(false);
    });
    return () => controller.abort();
  }, [dateFrom, dateTo, operatorId, outcome, reloadKey, selectedTypes, target]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await timelineApi.list(target, {
        types: [...selectedTypes], operator_id: operatorId || undefined,
        date_from: dateFrom || undefined, date_to: dateTo ? `${dateTo}T23:59:59.999` : undefined,
        outcome: outcome || undefined, cursor, limit: 20,
      });
      setEvents((current) => {
        const known = new Set(current.map((event) => event.id));
        return [...current, ...(page.items || []).filter((event) => !known.has(event.id))];
      });
      setCursor(page.next_cursor || null);
      setHasMore(Boolean(page.has_more));
    } catch (reason) {
      toast({ title: "Altri eventi non caricati", description: reason instanceof Error ? reason.message : "Riprova", variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, dateFrom, dateTo, loadingMore, operatorId, outcome, selectedTypes, target, toast]);

  const resetComposer = () => {
    setTitle(""); setBody(""); setDueAt(""); setAssignedTo(""); setPriority("medium");
    setDuration(""); setCallOutcome("answered"); setExternalOpened(false);
  };

  const save = async () => {
    if (saving || !canCreate(moduleKey)) return;
    setSaving(true);
    try {
      let event: TimelineEvent;
      if (composer === "note") event = await timelineApi.note({ ...target, title, body });
      else if (composer === "activity") event = await timelineApi.activity({ ...target, title, description: body, due_at: dueAt || undefined, assigned_to: assignedTo || undefined, priority });
      else if (composer === "appointment") event = await timelineApi.appointment({ ...target, title, description: body, due_at: dueAt, assigned_to: assignedTo || undefined });
      else if (composer === "call") event = await timelineApi.call({ ...target, title, body, number: destination, duration_minutes: duration || undefined, outcome: callOutcome, confirmed: externalOpened });
      else event = await timelineApi.externalMessage({ ...target, title, body, destination, channel: composer, confirmed: externalOpened });
      setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)]);
      resetComposer();
      toast({ title: composer === "note" ? "Nota registrata" : "Evento registrato", description: "La timeline è stata aggiornata." });
    } catch (reason) {
      toast({ title: "Evento non registrato", description: reason instanceof Error ? reason.message : "Riprova", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openExternal = () => {
    if (composer === "whatsapp") {
      const number = normalizePhone(destination);
      if (!number || !body.trim()) return;
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
    } else if (composer === "email") {
      if (!destination.trim() || !body.trim()) return;
      window.open(`mailto:${destination}?subject=${encodeURIComponent(title || "Aggiornamento")}&body=${encodeURIComponent(body)}`);
    } else if (composer === "call") {
      if (!destination.trim()) return;
      window.location.href = `tel:${destination}`;
    }
    setExternalOpened(true);
  };

  const saveDisabled = saving
    || (composer === "note" && !body.trim())
    || (["activity", "appointment"].includes(composer) && !title.trim())
    || (composer === "appointment" && !dueAt)
    || (["call", "email", "whatsapp"].includes(composer) && !externalOpened);

  return (
    <div className="space-y-4" data-record-timeline>
      <section className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtri rapidi timeline">
          {quickFilters.map((filter) => (
            <Button key={filter.value} type="button" size="sm" variant={quick === filter.value ? "default" : "outline"}
              className={cn("h-8 shrink-0 rounded-full px-3 text-xs", quick === filter.value && "bg-violet-600 hover:bg-violet-700")}
              onClick={() => setQuick(filter.value)}>{filter.label}</Button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-600" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}>
          <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Filtri avanzati
        </Button>
        {advanced ? (
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3" data-advanced-timeline-filters>
            <Field label="Operatore"><select value={operatorId} onChange={(event) => setOperatorId(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Tutti</option>{members.map((member) => <option key={member.user_id || member.id} value={member.user_id || member.id}>{member.display_name || member.email}</option>)}</select></Field>
            <Field label="Dal"><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9" /></Field>
            <Field label="Al"><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9" /></Field>
            <Field label="Esito"><select value={outcome} onChange={(event) => setOutcome(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Tutti</option><option value="answered">Risposto</option><option value="no_answer">Nessuna risposta</option><option value="voicemail">Segreteria</option><option value="busy">Occupato</option><option value="sent">Invio confermato</option></select></Field>
            <div className="flex items-end sm:col-span-2"><Button type="button" variant="outline" size="sm" onClick={() => { setOperatorId(""); setDateFrom(""); setDateTo(""); setOutcome(""); }}><Filter className="mr-1.5 h-3.5 w-3.5" />Azzera filtri</Button></div>
          </div>
        ) : null}
      </section>

      <section className="relative space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-slate-200" aria-live="polite">
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Caricamento timeline…</div>
          : error ? <RecordPanelEmptyState title="Timeline non disponibile" description={error} action={<Button size="sm" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>Riprova</Button>} />
            : events.length ? events.map((event) => <TimelineEventCard key={event.id} event={event} />)
              : <RecordPanelEmptyState title="Nessun evento in questa vista" description="Registra una nota interna per avviare lo storico operativo." action={canCreate(moduleKey) ? <Button size="sm" onClick={() => setComposer("note")}><Plus className="mr-1.5 h-4 w-4" />Aggiungi nota</Button> : undefined} />}
      </section>
      {hasMore ? <Button type="button" variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Caricamento…" : "Carica altri"}</Button> : null}

      <section className="sticky bottom-0 z-20 rounded-2xl border border-violet-200 bg-white p-4 shadow-xl shadow-slate-300/30" data-timeline-composer>
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-950">Nuovo evento</h3><p className="text-xs text-slate-500">Scegli il canale prima di registrare.</p></div><CircleDot className="h-4 w-4 text-violet-600" /></div>
        <div className="mb-4 flex gap-1 overflow-x-auto pb-1" aria-label="Canale composer">
          {composerKinds.map((kind) => { const Icon = kind.icon; return <Button key={kind.value} type="button" size="sm" variant={composer === kind.value ? "default" : "ghost"} className={cn("h-8 shrink-0 px-2 text-xs", composer === kind.value && "bg-violet-600 hover:bg-violet-700")} onClick={() => setComposer(kind.value)} disabled={saving}><Icon className="mr-1 h-3.5 w-3.5" />{kind.label}</Button>; })}
        </div>
        {!canCreate(moduleKey) ? <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Il tuo profilo può leggere la timeline ma non creare eventi.</p> : (
          <div className="space-y-3">
            {composer !== "note" ? <Field label={composer === "email" ? "Oggetto" : "Titolo"}><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={composer === "call" ? "Chiamata di aggiornamento" : "Titolo evento"} disabled={saving} /></Field> : null}
            {["call", "email", "whatsapp"].includes(composer) ? <Field label={composer === "email" ? "Destinatario" : "Numero"}><Input value={destination} onChange={(event) => { setDestination(event.target.value); setExternalOpened(false); }} placeholder={composer === "email" ? "email@cliente.it" : "+39…"} disabled={saving} data-record-sensitive /></Field> : null}
            <Field label={composer === "note" ? "Nota interna" : composer === "call" ? "Nota conclusiva" : "Descrizione / messaggio"}><Textarea value={body} onChange={(event) => { setBody(event.target.value); if (["email", "whatsapp"].includes(composer)) setExternalOpened(false); }} placeholder={composer === "note" ? "Scrivi una nota visibile al team…" : "Inserisci i dettagli…"} rows={3} disabled={saving} /></Field>
            {["activity", "appointment"].includes(composer) ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Responsabile"><select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} disabled={saving} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Non assegnato</option>{members.map((member) => <option key={member.user_id || member.id} value={member.user_id || member.id}>{member.display_name || member.email}</option>)}</select></Field><Field label="Scadenza"><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={saving} /></Field></div> : null}
            {composer === "activity" ? <Field label="Priorità"><select value={priority} onChange={(event) => setPriority(event.target.value)} disabled={saving} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="low">Bassa</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></Field> : null}
            {composer === "call" && externalOpened ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Esito"><select value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)} disabled={saving} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="answered">Risposto</option><option value="no_answer">Nessuna risposta</option><option value="voicemail">Segreteria</option><option value="busy">Occupato</option><option value="rescheduled">Da richiamare</option><option value="other">Altro</option></select></Field><Field label="Durata (minuti, opzionale)"><Input type="number" min="0" max="1440" value={duration} onChange={(event) => setDuration(event.target.value)} disabled={saving} /></Field></div> : null}
            {["call", "email", "whatsapp"].includes(composer) ? (
              <div className="space-y-2">
                <Button type="button" variant="outline" className="w-full" onClick={openExternal} disabled={saving || !destination.trim() || (["email", "whatsapp"].includes(composer) && !body.trim())}>
                  {composer === "call" ? <Phone className="mr-2 h-4 w-4" /> : composer === "email" ? <Mail className="mr-2 h-4 w-4" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                  {composer === "call" ? "Chiama" : composer === "email" ? "Apri email" : "Apri WhatsApp"}
                </Button>
                {externalOpened ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">L’apertura del canale non registra un invio. Conferma manualmente solo dopo aver completato l’azione.</p> : null}
              </div>
            ) : null}
            <Button type="button" className="w-full bg-violet-600 hover:bg-violet-700" onClick={save} disabled={saveDisabled}>
              {saving ? "Registrazione…" : ["email", "whatsapp"].includes(composer) ? "Segna come inviato" : composer === "call" ? "Conferma esito chiamata" : "Salva evento"}<Send className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
