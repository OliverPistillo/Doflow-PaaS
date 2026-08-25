"use client";

import { forwardRef,useCallback,useEffect,useImperativeHandle,useMemo,useRef,useState } from "react";
import {
  CalendarClock,CheckSquare2,ChevronDown,FileText,Filter,Mail,
  MessageCircle,NotebookPen,Phone,RefreshCw,SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { timelineApi,type TimelineEvent,type TimelineRecordKind } from "@/lib/tenant-timeline-api";
import type { TeamMember } from "@/lib/tenant-team-api";
import { RecordPanelEmptyState } from "./unified-record-panel";

export type ComposerKind = "note" | "activity" | "appointment" | "call" | "email" | "whatsapp";
export type RecordTimelineHandle = { compose: (kind: ComposerKind) => void };

const quickFilters = [
  { value: "all", label: "Tutto", types: [] },
  { value: "whatsapp", label: "WhatsApp", types: ["whatsapp"] },
  { value: "call", label: "Chiamate", types: ["call"] },
  { value: "email", label: "Email", types: ["email"] },
  { value: "note", label: "Note", types: ["note"] },
] as const;

const composerKinds: Array<{ value: ComposerKind; label: string }> = [
  { value: "note", label: "Nota" },
  { value: "activity", label: "Attività" },
  { value: "appointment", label: "Appuntamento" },
  { value: "call", label: "Chiamata" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
];

const statusLabels: Record<string, string> = {
  answered: "Risposto", busy: "Occupato", completed: "Completata",
  manually_confirmed: "Confermato manualmente", no_answer: "Nessuna risposta",
  pending: "Da fare", recorded: "Registrata", rescheduled: "Da richiamare",
  scheduled: "Pianificato", sent: "Invio confermato", voicemail: "Segreteria",
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
  const className = "h-3.5 w-3.5";
  if (type === "call") return <Phone className={className} />;
  if (type === "email") return <Mail className={className} />;
  if (type === "whatsapp") return <MessageCircle className={className} />;
  if (type === "appointment") return <CalendarClock className={className} />;
  if (type === "note") return <NotebookPen className={className} />;
  if (type === "file") return <FileText className={className} />;
  if (type === "status_change") return <RefreshCw className={className} />;
  return <CheckSquare2 className={className} />;
}

function eventTone(type: string) {
  if (type === "whatsapp") return "border-emerald-200 bg-emerald-500 text-white";
  if (type === "call") return "border-violet-200 bg-violet-600 text-white";
  if (["note", "file"].includes(type)) return "border-blue-200 bg-blue-600 text-white";
  if (type === "status_change") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-violet-200 bg-violet-50 text-violet-700";
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const external = event.direction === "outbound" || event.direction === "inbound";
  const detail = statusLabels[event.outcome || ""] || statusLabels[event.status] || event.outcome || event.status;
  const dueAt = typeof event.metadata?.due_at === "string" ? event.metadata.due_at : null;
  return <article className="relative grid grid-cols-[30px_minmax(0,1fr)] gap-2.5" data-timeline-event>
    <span className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm", eventTone(event.type))}>{eventIcon(event.type)}</span>
    <div className="min-w-0 rounded-lg border border-[#e8e8ed] bg-white px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500">
        <strong className="truncate font-semibold text-slate-700" data-record-sensitive>{event.author_label}</strong>
        <span>·</span><time className="shrink-0">{timelineDate(event.created_at)}</time>
        {event.channel === "internal" ? <Badge className="ml-auto h-4 border-0 bg-amber-50 px-1.5 text-[9px] text-amber-700 hover:bg-amber-50">Interna</Badge> : null}
      </div>
      <div className="mt-1 flex items-start gap-2"><strong className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900" data-record-sensitive>{event.title}</strong>{detail ? <Badge variant="secondary" className="h-5 shrink-0 bg-slate-50 px-2 text-[9px] text-slate-600">{detail}</Badge> : null}</div>
      {event.body ? event.body.length > 220 ? <details className="group mt-1.5 text-xs leading-5 text-slate-600" data-record-sensitive><summary className="cursor-pointer list-none font-medium text-violet-700">Mostra contenuto <ChevronDown className="inline h-3 w-3 group-open:rotate-180" /></summary><p className="mt-1 whitespace-pre-wrap">{event.body}</p></details> : <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-600" data-record-sensitive>{event.body}</p> : null}
      {dueAt || external ? <p className="mt-1.5 text-[10px] text-slate-400">{dueAt ? `Scadenza ${timelineDate(dueAt)}` : event.direction === "outbound" ? "In uscita" : "In entrata"}</p> : null}
    </div>
  </article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="block text-[11px] font-medium text-slate-600">{label}</span>{children}</label>;
}

type RecordTimelineProps = {
  recordKind: TimelineRecordKind;
  recordId: string;
  moduleKey: "crm" | "projects";
  phone?: string | null;
  email?: string | null;
  members: TeamMember[];
  draft?: { key: number; kind: ComposerKind; body?: string } | null;
};

export const RecordTimeline = forwardRef<RecordTimelineHandle, RecordTimelineProps>(function RecordTimeline({
  recordKind, recordId, moduleKey, phone, email, members, draft,
}, ref) {
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
  const [composer, setComposer] = useState<ComposerKind>("whatsapp");
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
  const composerInput = useRef<HTMLInputElement>(null);

  const selectedTypes = useMemo(() => quickFilters.find((item) => item.value === quick)?.types || [], [quick]);
  const target = useMemo(() => ({ record_kind: recordKind, record_id: recordId }), [recordId, recordKind]);

  const activateComposer = useCallback((kind: ComposerKind) => {
    setComposer(kind);
    setExternalOpened(false);
    window.requestAnimationFrame(() => composerInput.current?.focus());
  }, []);
  useImperativeHandle(ref, () => ({ compose: activateComposer }), [activateComposer]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setDestination(composer === "email" ? email || "" : phone || "");
        setExternalOpened(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [composer, email, phone]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        if (!draft) return;
        activateComposer(draft.kind);
        if (draft.body) {
          setTitle("Richiesta materiale");
          setBody(draft.body);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activateComposer, draft]);

  useEffect(() => {
    const controller = new AbortController();
    const version = ++requestVersion.current;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      timelineApi.list(target, {
        types: [...selectedTypes], operator_id: operatorId || undefined,
        date_from: dateFrom || undefined, date_to: dateTo ? `${dateTo}T23:59:59.999` : undefined,
        outcome: outcome || undefined, limit: 20,
      }, controller.signal).then((page) => {
        if (version !== requestVersion.current) return;
        setEvents(page.items || []); setCursor(page.next_cursor || null); setHasMore(Boolean(page.has_more));
      }).catch((reason) => {
        if (!controller.signal.aborted && version === requestVersion.current) setError(reason instanceof Error ? reason.message : "Timeline non disponibile");
      }).finally(() => {
        if (!controller.signal.aborted && version === requestVersion.current) setLoading(false);
      });
    });
    return () => controller.abort();
  }, [dateFrom, dateTo, operatorId, outcome, reloadKey, selectedTypes, target]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await timelineApi.list(target, { types: [...selectedTypes], operator_id: operatorId || undefined, date_from: dateFrom || undefined, date_to: dateTo ? `${dateTo}T23:59:59.999` : undefined, outcome: outcome || undefined, cursor, limit: 20 });
      setEvents((current) => { const known = new Set(current.map((event) => event.id)); return [...current, ...(page.items || []).filter((event) => !known.has(event.id))]; });
      setCursor(page.next_cursor || null); setHasMore(Boolean(page.has_more));
    } catch (reason) {
      toast({ title: "Altri eventi non caricati", description: reason instanceof Error ? reason.message : "Riprova", variant: "destructive" });
    } finally { setLoadingMore(false); }
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
    } finally { setSaving(false); }
  };

  const openExternal = () => {
    if (composer === "whatsapp") {
      const number = normalizePhone(destination); if (!number || !body.trim()) return;
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
    } else if (composer === "email") {
      if (!destination.trim() || !body.trim()) return;
      window.open(`mailto:${destination}?subject=${encodeURIComponent(title || "Aggiornamento")}&body=${encodeURIComponent(body)}`);
    } else if (composer === "call") {
      if (!destination.trim()) return; window.location.href = `tel:${destination}`;
    }
    setExternalOpened(true);
  };

  const external = ["call", "email", "whatsapp"].includes(composer);
  const expanded = ["activity", "appointment", "call"].includes(composer);
  const primaryDisabled = saving || (composer === "note" && !body.trim())
    || (composer === "activity" && !title.trim()) || (composer === "appointment" && (!title.trim() || !dueAt))
    || (composer === "call" && !destination.trim()) || (["email", "whatsapp"].includes(composer) && (!destination.trim() || !body.trim()));
  const handlePrimary = () => { if (external && !externalOpened) openExternal(); else void save(); };

  return <div className="space-y-3" data-record-timeline>
    <section>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Filtri rapidi timeline">
        {quickFilters.map((filter) => <Button key={filter.value} type="button" size="sm" variant="outline" className={cn("h-7 shrink-0 rounded-full border-[#e1e2e8] px-2.5 text-[10px]", quick === filter.value && "border-violet-100 bg-violet-100 text-violet-700 hover:bg-violet-100")} onClick={() => setQuick(filter.value)}>{filter.label}</Button>)}
        <Button type="button" variant="outline" size="sm" className="ml-auto h-7 shrink-0 rounded-lg border-[#e1e2e8] px-2.5 text-[10px]" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}><SlidersHorizontal className="mr-1 h-3 w-3" />Filtri</Button>
      </div>
      {advanced ? <div className="mt-2 grid gap-2 rounded-lg border border-[#e8e8ed] bg-slate-50/50 p-3 sm:grid-cols-3" data-advanced-timeline-filters>
        <Field label="Operatore"><select value={operatorId} onChange={(event) => setOperatorId(event.target.value)} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Tutti</option>{members.map((member) => <option key={member.user_id || member.id} value={member.user_id || member.id}>{member.display_name || member.email}</option>)}</select></Field>
        <Field label="Dal"><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-8 text-xs" /></Field>
        <Field label="Al"><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-8 text-xs" /></Field>
        <Field label="Esito"><select value={outcome} onChange={(event) => setOutcome(event.target.value)} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Tutti</option><option value="answered">Risposto</option><option value="no_answer">Nessuna risposta</option><option value="sent">Invio confermato</option></select></Field>
        <div className="flex items-end sm:col-span-2"><Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setOperatorId(""); setDateFrom(""); setDateTo(""); setOutcome(""); }}><Filter className="mr-1 h-3 w-3" />Azzera filtri</Button></div>
      </div> : null}
    </section>

    <section className="rounded-lg border border-[#e8e8ed] bg-white p-2.5" data-timeline-composer>
      {!canCreate(moduleKey) ? <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Il tuo profilo può leggere la timeline ma non creare eventi.</p> : <>
        <div className="grid grid-cols-[minmax(0,1fr)_126px_72px] gap-1.5">
          <Input ref={composerInput} value={["note", "email", "whatsapp"].includes(composer) ? body : title} onChange={(event) => { if (["note", "email", "whatsapp"].includes(composer)) setBody(event.target.value); else setTitle(event.target.value); if (external) setExternalOpened(false); }} placeholder={["note", "email", "whatsapp"].includes(composer) ? "Scrivi un messaggio o aggiungi una nota…" : composer === "call" ? "Titolo chiamata…" : "Titolo attività…"} className="h-9 min-w-0 border-[#e1e2e8] text-xs" />
          <select aria-label="Canale composer" value={composer} onChange={(event) => activateComposer(event.target.value as ComposerKind)} className="h-9 min-w-0 rounded-md border border-[#e1e2e8] bg-white px-2 text-[11px] font-medium text-slate-700">{composerKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select>
          <Button type="button" className="h-9 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-2 text-xs" onClick={handlePrimary} disabled={primaryDisabled}>{externalOpened ? "Conferma" : composer === "call" ? "Chiama" : "Invia"}</Button>
        </div>
        {["email", "whatsapp"].includes(composer) ? <div className="mt-2 grid gap-1.5 sm:grid-cols-2"><Input aria-label={composer === "email" ? "Destinatario" : "Numero"} value={destination} onChange={(event) => { setDestination(event.target.value); setExternalOpened(false); }} placeholder={composer === "email" ? "email@cliente.it" : "+39…"} className="h-8 text-xs" data-record-sensitive />{composer === "email" ? <Input aria-label="Oggetto" value={title} onChange={(event) => { setTitle(event.target.value); setExternalOpened(false); }} placeholder="Oggetto" className="h-8 text-xs" /> : null}</div> : null}
        {expanded ? <div className="mt-2 space-y-2 rounded-lg bg-slate-50/70 p-2.5" data-expanded-composer>
          {composer === "call" ? <><div className="grid gap-2 sm:grid-cols-2"><Field label="Numero"><Input value={destination} onChange={(event) => { setDestination(event.target.value); setExternalOpened(false); }} className="h-8 text-xs" data-record-sensitive /></Field><Field label="Nota"><Input value={body} onChange={(event) => setBody(event.target.value)} className="h-8 text-xs" /></Field></div>{externalOpened ? <div className="grid gap-2 sm:grid-cols-2"><Field label="Esito"><select value={callOutcome} onChange={(event) => setCallOutcome(event.target.value)} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="answered">Risposto</option><option value="no_answer">Nessuna risposta</option><option value="voicemail">Segreteria</option><option value="busy">Occupato</option><option value="rescheduled">Da richiamare</option></select></Field><Field label="Durata (minuti)"><Input type="number" min="0" max="1440" value={duration} onChange={(event) => setDuration(event.target.value)} className="h-8 text-xs" /></Field></div> : null}</> : <><Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Descrizione opzionale" rows={2} className="text-xs" /><div className="grid gap-2 sm:grid-cols-2"><Field label="Responsabile"><select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Non assegnato</option>{members.map((member) => <option key={member.user_id || member.id} value={member.user_id || member.id}>{member.display_name || member.email}</option>)}</select></Field><Field label="Scadenza"><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="h-8 text-xs" /></Field></div>{composer === "activity" ? <Field label="Priorità"><select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="low">Bassa</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></Field> : null}</>}
        </div> : null}
        {externalOpened ? <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-800">Il canale è stato aperto, ma nessun invio è registrato: premi “Conferma” solo dopo aver completato l’azione.</p> : null}
      </>}
    </section>

    <section className="relative space-y-2.5 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-slate-200" aria-live="polite">
      {loading ? <div className="rounded-lg border border-[#e8e8ed] bg-white p-6 text-center text-xs text-slate-500">Caricamento timeline…</div>
        : error ? <RecordPanelEmptyState title="Timeline non disponibile" description={error} action={<Button size="sm" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>Riprova</Button>} />
          : events.length ? events.map((event) => <TimelineEventCard key={event.id} event={event} />)
            : <RecordPanelEmptyState title="Nessun evento in questa vista" description="Registra una nota interna per avviare lo storico operativo." />}
    </section>
    {hasMore ? <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Caricamento…" : "Carica altri"}</Button> : null}
  </div>;
});
