"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Download,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  calendarApi,
  type CalendarAttendee,
  type CalendarEvent,
  type CalendarLink,
  type CalendarOptions,
  type CalendarReminder,
  type CalendarSummary,
  type PlanningActivity,
  type PlanningView,
} from "@/lib/tenant-calendar-api";
import {
  EVENT_TYPE_LABELS,
  LINK_ENTITY_TYPES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TRANSPARENCY_LABELS,
  VISIBILITY_LABELS,
  badgeClass,
  canManageCalendar,
  canViewCalendarFinance,
  compactJson,
  downloadJson,
  formatDateOnly,
  formatDateTime,
  formatMinutesAsHours,
  fromDateTimeInput,
  isFinanceEvent,
  label,
  optionList,
  parseJsonTextarea,
  scrubFinancePayload,
  toDateInput,
  toDateTimeInput,
} from "./calendar-utils";
import { CalendarSummaryCards } from "./calendar-summary-cards";

type Filters = Record<string, string>;

function Header({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

function Loading() {
  return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Caricamento...</div>;
}

function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

function StateBadge({ value, children }: { value?: string | null; children?: ReactNode }) {
  return <Badge variant="outline" className={badgeClass(value)}>{children || value || "-"}</Badge>;
}

function SelectField({ value, options, placeholder, onChange }: { value?: string; options: Array<{ value: string; label: string }>; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Select value={value || "__all__"} onValueChange={(next) => onChange(next === "__all__" ? "" : next)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{placeholder}</SelectItem>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function JsonBlock({ value, canFinance = true }: { value: unknown; canFinance?: boolean }) {
  return <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">{compactJson(scrubFinancePayload(value, canFinance))}</pre>;
}

function useCalendarOptions() {
  const [options, setOptions] = useState<CalendarOptions | null>(null);
  useEffect(() => {
    let active = true;
    calendarApi.getCalendarOptions().then((data) => { if (active) setOptions(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return options;
}

function visibleEvents(events: CalendarEvent[], canFinance = canViewCalendarFinance()) {
  return events.filter((event) => canFinance || !isFinanceEvent(event));
}

function EventCard({ event, actions }: { event: CalendarEvent; actions?: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{event.title}</p>
            <StateBadge value={event.event_type}>{label(EVENT_TYPE_LABELS, event.event_type)}</StateBadge>
            <StateBadge value={event.status}>{label(STATUS_LABELS, event.status)}</StateBadge>
            <StateBadge value={event.priority}>{label(PRIORITY_LABELS, event.priority)}</StateBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(event.start_at)} {event.end_at ? `→ ${formatDateTime(event.end_at)}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {event.source_entity_type || "manuale"} {event.source_entity_id ? `· ${event.source_entity_id}` : ""} · {label(VISIBILITY_LABELS, event.visibility)}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

export function CalendarOverviewPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [deadlines, setDeadlines] = useState<CalendarEvent[]>([]);
  const [views, setViews] = useState<PlanningView[]>([]);
  const [dueReminders, setDueReminders] = useState<CalendarReminder[]>([]);
  const [preview, setPreview] = useState<{ total: number; items: CalendarEvent[] } | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewCalendarFinance();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, eventsData, deadlinesData, viewsData, remindersData] = await Promise.all([
        calendarApi.getCalendarSummary(),
        calendarApi.listCalendarEvents({ limit: 6 }).catch(() => ({ items: [] })),
        calendarApi.getCalendarDeadlines({ limit: 6 }).catch(() => ({ items: [] })),
        calendarApi.listPlanningViews().catch(() => ({ items: [] })),
        calendarApi.getDueReminders().catch(() => ({ items: [] })),
      ]);
      setSummary(summaryData);
      setEvents(visibleEvents(eventsData.items || [], canFinance));
      setDeadlines(visibleEvents(deadlinesData.items || [], canFinance));
      setViews(viewsData.items || []);
      setDueReminders(remindersData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento calendario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const previewDerived = async () => {
    setRunning(true);
    try {
      const result = await calendarApi.getDerivedPreview();
      setPreview({ total: result.total || 0, items: visibleEvents(result.items || [], canFinance) });
      toast({ title: "Anteprima eventi derivati pronta" });
    } catch (err) {
      toast({ title: "Anteprima non riuscita", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const syncDerived = async () => {
    if (!window.confirm("Sincronizzare ora gli eventi derivati?")) return;
    setRunning(true);
    try {
      const result = await calendarApi.syncDerivedEvents();
      setSyncResult(result);
      toast({ title: "Eventi derivati sincronizzati", description: `Creati ${result.created}, aggiornati ${result.updated}` });
      await load();
    } catch (err) {
      toast({ title: "Sync non riuscita", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const exportCalendar = async () => {
    try {
      downloadJson("calendar-export.json", await calendarApi.exportCalendar());
    } catch (err) {
      toast({ title: "Export fallito", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Calendario" description="Pianificazione interna, scadenze aggregate, workload e reminder reali.">
        <Button asChild><Link href="/calendar/events/new"><Plus className="mr-2 h-4 w-4" /> Nuovo evento</Link></Button>
        <Button variant="outline" onClick={previewDerived} disabled={running}>Anteprima eventi derivati</Button>
        <Button variant="outline" onClick={syncDerived} disabled={running}><RefreshCw className="mr-2 h-4 w-4" /> Sincronizza eventi derivati</Button>
        <Button variant="outline" onClick={exportCalendar}><Download className="mr-2 h-4 w-4" /> Export JSON</Button>
      </Header>
      <ErrorBox error={error} />
      {loading ? <Loading /> : (
        <>
          <CalendarSummaryCards summary={summary} />
          <Card>
            <CardHeader>
              <CardTitle>Sync-derived</CardTitle>
              <CardDescription>Crea o aggiorna eventi derivati da task, milestone, progetti, finance, contratti e scartoffie.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold">Risultato ultimo sync</p>
                <JsonBlock value={syncResult || { matched: 0, created: 0, updated: 0, skippedLocked: 0 }} canFinance={canFinance} />
              </div>
              <div>
                <p className="text-sm font-semibold">Anteprima</p>
                <p className="mb-2 text-sm text-muted-foreground">Totale: {preview?.total ?? 0}</p>
                <div className="space-y-2">
                  {(preview?.items || []).slice(0, 4).map((event) => <EventCard key={event.source_fingerprint || event.id} event={event} />)}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Prossimi eventi</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {events.length ? events.map((event) => <EventCard key={event.id} event={event} actions={<Button asChild size="sm" variant="outline"><Link href={`/calendar/events/${event.id}`}>Apri</Link></Button>} />) : <Empty>Nessun evento presente.</Empty>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Scadenze settimana</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {deadlines.length ? deadlines.map((event) => <EventCard key={event.id} event={event} actions={<Button asChild size="sm" variant="outline"><Link href={`/calendar/events/${event.id}`}>Apri</Link></Button>} />) : <Empty>Nessuna scadenza imminente.</Empty>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Reminder dovuti</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {dueReminders.length ? dueReminders.map((reminder) => <div key={reminder.id} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{reminder.event_title || "Reminder"}</p><p className="text-muted-foreground">{formatDateTime(reminder.remind_at)}</p></div>) : <Empty>Nessun reminder dovuto.</Empty>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Viste salvate</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {views.length ? views.slice(0, 5).map((view) => <div key={view.id} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{view.name}</p><p className="text-muted-foreground">{view.view_type}</p></div>) : <Empty>Nessuna vista salvata.</Empty>}
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/calendar/agenda">Agenda</Link></Button>
            <Button asChild variant="outline"><Link href="/calendar/week">Settimana</Link></Button>
            <Button asChild variant="outline"><Link href="/calendar/deadlines">Scadenze</Link></Button>
            <Button asChild variant="outline"><Link href="/calendar/conflicts">Conflitti</Link></Button>
          </div>
        </>
      )}
    </div>
  );
}

export function CalendarEventsListPage() {
  const { toast } = useToast();
  const options = useCalendarOptions();
  const [filters, setFilters] = useState<Filters>({ search: "", start: "", end: "", event_type: "", status: "", priority: "", assigned_to_user_id: "", source_entity_type: "", include_cancelled: "" });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewCalendarFinance();
  const canManage = canManageCalendar();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await calendarApi.listCalendarEvents({ ...filters, limit: 100 });
      setEvents(visibleEvents(data.items || [], canFinance));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento eventi");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const action = async (kind: "complete" | "cancel" | "delete" | "export", event: CalendarEvent) => {
    try {
      if (kind === "complete") await calendarApi.completeCalendarEvent(event.id);
      if (kind === "cancel") await calendarApi.cancelCalendarEvent(event.id);
      if (kind === "delete") await calendarApi.deleteCalendarEvent(event.id);
      if (kind === "export") downloadJson(`calendar-event-${event.id}.json`, await calendarApi.exportCalendarEvent(event.id));
      if (kind !== "export") await load();
    } catch (err) {
      toast({ title: "Azione non riuscita", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title="Eventi calendario" description="Eventi manuali e derivati dal backend tenant-scoped.">
        <Button asChild><Link href="/calendar/events/new"><Plus className="mr-2 h-4 w-4" /> Nuovo evento</Link></Button>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Aggiorna</Button>
      </Header>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Cerca evento" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
          <Input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          <Input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
          <SelectField value={filters.event_type} options={optionList((options?.event_types || []).filter((type) => canFinance || !["invoice_due", "financial_deadline", "renewal_due", "recurring_service_due"].includes(type)), EVENT_TYPE_LABELS)} placeholder="Tutti i tipi" onChange={(value) => setFilters({ ...filters, event_type: value })} />
          <SelectField value={filters.status} options={optionList(options?.statuses, STATUS_LABELS)} placeholder="Tutti gli stati" onChange={(value) => setFilters({ ...filters, status: value })} />
          <SelectField value={filters.priority} options={optionList(options?.priorities, PRIORITY_LABELS)} placeholder="Tutte le priorità" onChange={(value) => setFilters({ ...filters, priority: value })} />
          <Input placeholder="assigned_to_user_id" value={filters.assigned_to_user_id} onChange={(e) => setFilters({ ...filters, assigned_to_user_id: e.target.value })} />
          <Input placeholder="source_entity_type" value={filters.source_entity_type} onChange={(e) => setFilters({ ...filters, source_entity_type: e.target.value })} />
          <Button onClick={load} className="md:col-span-4">Filtra</Button>
        </CardContent>
      </Card>
      <ErrorBox error={error} />
      {loading ? <Loading /> : events.length === 0 ? <Empty>Nessun evento presente.</Empty> : <div className="space-y-3">{events.map((event) => <EventCard key={event.id} event={event} actions={<>
        <Button asChild size="sm" variant="outline"><Link href={`/calendar/events/${event.id}`}>Apri</Link></Button>
        {canManage ? <Button size="sm" variant="outline" onClick={() => action("complete", event)}><Check className="mr-2 h-4 w-4" /> Completa</Button> : null}
        {canManage ? <Button size="sm" variant="outline" onClick={() => action("cancel", event)}><X className="mr-2 h-4 w-4" /> Annulla</Button> : null}
        <Button size="sm" variant="outline" onClick={() => action("export", event)}><Download className="mr-2 h-4 w-4" /> Export</Button>
        {canManage ? <Button size="sm" variant="outline" onClick={() => action("delete", event)}><Trash2 className="mr-2 h-4 w-4" /> Elimina</Button> : null}
      </>} />)}</div>}
    </div>
  );
}

const defaultEventForm = {
  title: "",
  description: "",
  event_type: "internal",
  status: "scheduled",
  priority: "medium",
  start_at: "",
  end_at: "",
  all_day: false,
  timezone: "Europe/Rome",
  location: "",
  meeting_url: "",
  color: "",
  visibility: "team",
  transparency: "busy",
  assigned_to_user_id: "",
  reminders_config: "{}",
  metadata: "{}",
};

export function CalendarEventFormPage({ eventId }: { eventId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const options = useCalendarOptions();
  const [form, setForm] = useState<Record<string, any>>(defaultEventForm);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewCalendarFinance();

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    calendarApi.getCalendarEvent(eventId).then((event) => {
      if (!active) return;
      setForm({
        ...defaultEventForm,
        ...event,
        start_at: toDateTimeInput(event.start_at),
        end_at: toDateTimeInput(event.end_at),
        reminders_config: compactJson(event.reminders_config || {}),
        metadata: compactJson(event.metadata || {}),
      });
    }).catch((err) => setError(err instanceof Error ? err.message : "Evento non trovato")).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!String(form.title || "").trim()) throw new Error("Titolo obbligatorio");
      if (!form.start_at) throw new Error("start_at obbligatorio");
      const startAt = fromDateTimeInput(form.start_at);
      const endAt = fromDateTimeInput(form.end_at);
      if (startAt && endAt && new Date(endAt) < new Date(startAt)) throw new Error("end_at deve essere successivo a start_at");
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        status: form.status,
        priority: form.priority,
        start_at: startAt,
        end_at: endAt || null,
        all_day: Boolean(form.all_day),
        timezone: form.timezone || "Europe/Rome",
        location: form.location || null,
        meeting_url: form.meeting_url || null,
        color: form.color || null,
        visibility: form.visibility,
        transparency: form.transparency,
        source_type: "manual",
        reminders_config: parseJsonTextarea(String(form.reminders_config || "{}"), {}),
        metadata: parseJsonTextarea(String(form.metadata || "{}"), {}),
      };
      if (form.assigned_to_user_id) body.assigned_to_user_id = form.assigned_to_user_id;
      const saved = eventId ? await calendarApi.updateCalendarEvent(eventId, body) : await calendarApi.createCalendarEvent(body);
      toast({ title: eventId ? "Evento aggiornato" : "Evento creato" });
      router.push(`/calendar/events/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio evento");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex-1 p-4 md:p-6"><Loading /></div>;
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title={eventId ? "Modifica evento" : "Nuovo evento"} description="Crea o aggiorna un evento interno manuale.">
        <Button asChild variant="outline"><Link href={eventId ? `/calendar/events/${eventId}` : "/calendar/events"}>Annulla</Link></Button>
        <Button onClick={save} disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</Button>
      </Header>
      <ErrorBox error={error} />
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Titolo"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Tipo"><SelectField value={form.event_type} options={optionList((options?.event_types || []).filter((type) => canFinance || !["invoice_due", "financial_deadline", "renewal_due", "recurring_service_due"].includes(type)), EVENT_TYPE_LABELS)} placeholder="Tipo" onChange={(value) => setForm({ ...form, event_type: value })} /></Field>
          <Field label="Stato"><SelectField value={form.status} options={optionList(options?.statuses, STATUS_LABELS)} placeholder="Stato" onChange={(value) => setForm({ ...form, status: value })} /></Field>
          <Field label="Priorità"><SelectField value={form.priority} options={optionList(options?.priorities, PRIORITY_LABELS)} placeholder="Priorità" onChange={(value) => setForm({ ...form, priority: value })} /></Field>
          <Field label="Inizio"><Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} /></Field>
          <Field label="Fine"><Input type="datetime-local" value={form.end_at || ""} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></Field>
          <Field label="Timezone"><Input value={form.timezone || ""} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></Field>
          <Field label="Assegnato a user_id"><Input value={form.assigned_to_user_id || ""} onChange={(e) => setForm({ ...form, assigned_to_user_id: e.target.value })} /></Field>
          <Field label="Visibilità"><SelectField value={form.visibility} options={optionList(options?.visibilities, VISIBILITY_LABELS)} placeholder="Visibilità" onChange={(value) => setForm({ ...form, visibility: value })} /></Field>
          <Field label="Trasparenza"><SelectField value={form.transparency} options={optionList(options?.transparencies, TRANSPARENCY_LABELS)} placeholder="Trasparenza" onChange={(value) => setForm({ ...form, transparency: value })} /></Field>
          <Field label="Location"><Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Meeting URL"><Input value={form.meeting_url || ""} onChange={(e) => setForm({ ...form, meeting_url: e.target.value })} /></Field>
          <Field label="Descrizione" wide><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="reminders_config JSON" wide><Textarea className="font-mono text-xs" value={form.reminders_config} onChange={(e) => setForm({ ...form, reminders_config: e.target.value })} /></Field>
          <Field label="metadata JSON" wide><Textarea className="font-mono text-xs" value={form.metadata} onChange={(e) => setForm({ ...form, metadata: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.all_day)} onChange={(e) => setForm({ ...form, all_day: e.target.checked })} /> Tutto il giorno</label>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label: text, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "space-y-2 md:col-span-2" : "space-y-2"}><Label>{text}</Label>{children}</div>;
}

function Info({ label: text, value, wide = false }: { label: string; value?: ReactNode; wide?: boolean }) {
  return <div className={wide ? "md:col-span-2" : ""}><p className="text-xs font-semibold text-muted-foreground">{text}</p><div className="mt-1 text-sm">{value || "-"}</div></div>;
}

export function CalendarEventDetailPage({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewCalendarFinance();
  const canManage = canManageCalendar();
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEvent(await calendarApi.getCalendarEvent(eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evento non trovato");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [eventId]);
  const doAction = async (kind: "complete" | "cancel" | "delete" | "export") => {
    if (!event) return;
    try {
      if (kind === "complete") setEvent(await calendarApi.completeCalendarEvent(event.id));
      if (kind === "cancel") setEvent(await calendarApi.cancelCalendarEvent(event.id));
      if (kind === "delete") await calendarApi.deleteCalendarEvent(event.id);
      if (kind === "export") downloadJson(`calendar-event-${event.id}.json`, await calendarApi.exportCalendarEvent(event.id));
      if (kind === "delete") window.location.href = "/calendar/events";
    } catch (err) {
      toast({ title: "Azione non riuscita", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  if (loading) return <div className="flex-1 p-4 md:p-6"><Loading /></div>;
  if (error || !event) return <div className="flex-1 p-4 md:p-6"><ErrorBox error={error || "Evento non trovato"} /></div>;
  const safeMetadata = isFinanceEvent(event) && !canFinance ? { scrubbed: true } : event.metadata;
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <Header title={event.title} description={`${label(EVENT_TYPE_LABELS, event.event_type)} · ${formatDateTime(event.start_at)}`}>
        <Button asChild variant="outline"><Link href="/calendar/events">Lista eventi</Link></Button>
        {canManage ? <Button asChild variant="outline"><Link href={`/calendar/events/${event.id}?edit=1`}>Modifica</Link></Button> : null}
        {canManage ? <Button variant="outline" onClick={() => doAction("complete")}><Check className="mr-2 h-4 w-4" /> Completa</Button> : null}
        {canManage ? <Button variant="outline" onClick={() => doAction("cancel")}><X className="mr-2 h-4 w-4" /> Annulla</Button> : null}
        <Button variant="outline" onClick={() => doAction("export")}><Download className="mr-2 h-4 w-4" /> Export</Button>
        {canManage ? <Button variant="outline" onClick={() => doAction("delete")}><Trash2 className="mr-2 h-4 w-4" /> Elimina</Button> : null}
      </Header>
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
          <Info label="Stato" value={<StateBadge value={event.status}>{label(STATUS_LABELS, event.status)}</StateBadge>} />
          <Info label="Priorità" value={<StateBadge value={event.priority}>{label(PRIORITY_LABELS, event.priority)}</StateBadge>} />
          <Info label="Inizio" value={formatDateTime(event.start_at)} />
          <Info label="Fine" value={formatDateTime(event.end_at)} />
          <Info label="Location" value={event.location || "-"} />
          <Info label="Meeting URL" value={event.meeting_url ? <a className="text-primary underline" href={event.meeting_url} target="_blank" rel="noreferrer">Apri link</a> : "-"} />
          <Info label="Visibilità" value={label(VISIBILITY_LABELS, event.visibility)} />
          <Info label="Trasparenza" value={label(TRANSPARENCY_LABELS, event.transparency)} />
          <Info label="Owner" value={event.owner_user_id || "-"} />
          <Info label="Assigned" value={event.assigned_to_user_id || "-"} />
          <Info label="Source" value={`${event.source_type || "-"} · ${event.source_entity_type || "-"}`} />
          <Info label="Locked/System" value={`${event.is_locked ? "locked" : "editabile"} · ${event.is_system_generated ? "system" : "manuale"}`} />
          <Info label="Descrizione" value={event.description || "-"} wide />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Metadata</CardTitle></CardHeader><CardContent><JsonBlock value={safeMetadata} canFinance={canFinance} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Reminders config</CardTitle></CardHeader><CardContent><JsonBlock value={event.reminders_config} canFinance={canFinance} /></CardContent></Card>
      </div>
      {canManage ? <CalendarEventFormPage eventId={event.id} /> : null}
      <CalendarAttendees eventId={event.id} />
      <CalendarReminders eventId={event.id} />
      <CalendarLinks eventId={event.id} />
    </div>
  );
}

export function CalendarAttendees({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const options = useCalendarOptions();
  const [rows, setRows] = useState<CalendarAttendee[]>([]);
  const [form, setForm] = useState({ name: "", email: "", user_id: "", contact_id: "", role: "required", response_status: "needs_action" });
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageCalendar();
  const load = async () => {
    try { setRows((await calendarApi.listEventAttendees(eventId)).items || []); } catch (err) { setError(err instanceof Error ? err.message : "Errore partecipanti"); }
  };
  useEffect(() => { void load(); }, [eventId]);
  const create = async () => {
    try {
      await calendarApi.createEventAttendee(eventId, { ...form, user_id: form.user_id || null, contact_id: form.contact_id || null });
      setForm({ name: "", email: "", user_id: "", contact_id: "", role: "required", response_status: "needs_action" });
      await load();
    } catch (err) {
      toast({ title: "Partecipante non aggiunto", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  return (
    <Card><CardHeader><CardTitle>Partecipanti</CardTitle></CardHeader><CardContent className="space-y-3"><ErrorBox error={error} />
      {rows.length ? rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-semibold">{row.name || row.email || row.user_id || "Partecipante"}</p><p className="text-muted-foreground">{row.role} · {row.response_status}</p></div>{canManage ? <Button size="sm" variant="outline" onClick={async () => { await calendarApi.deleteEventAttendee(eventId, row.id); await load(); }}>Elimina</Button> : null}</div>) : <Empty>Nessun partecipante.</Empty>}
      {canManage ? <div className="grid gap-2 md:grid-cols-3"><Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><SelectField value={form.role} options={optionList(options?.attendee_roles)} placeholder="Ruolo" onChange={(value) => setForm({ ...form, role: value })} /><Input placeholder="user_id opzionale" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} /><Input placeholder="contact_id opzionale" value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })} /><SelectField value={form.response_status} options={optionList(options?.response_statuses)} placeholder="Risposta" onChange={(value) => setForm({ ...form, response_status: value })} /><Button onClick={create} className="md:col-span-3">Aggiungi partecipante</Button></div> : null}
    </CardContent></Card>
  );
}

export function CalendarReminders({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const options = useCalendarOptions();
  const [rows, setRows] = useState<CalendarReminder[]>([]);
  const [form, setForm] = useState({ remind_at: "", method: "in_app" });
  const canManage = canManageCalendar();
  const load = async () => { setRows((await calendarApi.listEventReminders(eventId).catch(() => ({ items: [] }))).items || []); };
  useEffect(() => { void load(); }, [eventId]);
  const create = async () => {
    try {
      await calendarApi.createEventReminder(eventId, { remind_at: fromDateTimeInput(form.remind_at), method: form.method });
      setForm({ remind_at: "", method: "in_app" });
      await load();
    } catch (err) {
      toast({ title: "Reminder non aggiunto", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  return <Card><CardHeader><CardTitle>Reminder</CardTitle></CardHeader><CardContent className="space-y-3">
    {rows.length ? rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-semibold">{formatDateTime(row.remind_at)}</p><p className="text-muted-foreground">{row.method} · {row.status}</p></div><div className="flex gap-2">{row.status === "pending" ? <Button size="sm" variant="outline" onClick={async () => { await calendarApi.dismissReminder(row.id); await load(); }}>Dismiss</Button> : null}{canManage ? <Button size="sm" variant="outline" onClick={async () => { await calendarApi.deleteReminder(row.id); await load(); }}>Elimina</Button> : null}</div></div>) : <Empty>Nessun reminder.</Empty>}
    {canManage ? <div className="grid gap-2 md:grid-cols-3"><Input type="datetime-local" value={form.remind_at} onChange={(e) => setForm({ ...form, remind_at: e.target.value })} /><SelectField value={form.method} options={optionList(options?.reminder_methods)} placeholder="Metodo" onChange={(value) => setForm({ ...form, method: value })} /><Button onClick={create}>Aggiungi reminder</Button></div> : null}
  </CardContent></Card>;
}

export function CalendarLinks({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const options = useCalendarOptions();
  const [rows, setRows] = useState<CalendarLink[]>([]);
  const [form, setForm] = useState({ entity_type: "project", entity_id: "", relation_type: "related", metadata: "{}" });
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageCalendar();
  const load = async () => {
    try { setRows((await calendarApi.listEventLinks(eventId)).items || []); setError(null); } catch (err) { setError(err instanceof Error ? err.message : "Errore collegamenti"); }
  };
  useEffect(() => { void load(); }, [eventId]);
  const create = async () => {
    try {
      await calendarApi.createEventLink(eventId, { entity_type: form.entity_type, entity_id: form.entity_id, relation_type: form.relation_type, metadata: parseJsonTextarea(form.metadata, {}) });
      setForm({ entity_type: "project", entity_id: "", relation_type: "related", metadata: "{}" });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore";
      toast({ title: message.includes("entity_type") || message.includes("entità") ? "Tipo entità non consentito dal backend per questo collegamento." : "Collegamento non aggiunto", description: message, variant: "destructive" });
    }
  };
  return <Card><CardHeader><CardTitle>Collegamenti</CardTitle><CardDescription>Non usa mai entity_type calendar_event; usa solo entità consentite.</CardDescription></CardHeader><CardContent className="space-y-3"><ErrorBox error={error} />
    {rows.length ? rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-semibold">{row.entity_type} · {row.entity_id}</p><p className="text-muted-foreground">{row.relation_type}</p></div>{canManage ? <Button size="sm" variant="outline" onClick={async () => { await calendarApi.deleteEventLink(eventId, row.id); await load(); }}>Elimina</Button> : null}</div>) : <Empty>Nessun collegamento.</Empty>}
    {canManage ? <div className="grid gap-2 md:grid-cols-4"><SelectField value={form.entity_type} options={LINK_ENTITY_TYPES.map((value) => ({ value, label: value.replace(/_/g, " ") }))} placeholder="Tipo entità" onChange={(value) => setForm({ ...form, entity_type: value })} /><Input placeholder="entity_id UUID" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })} /><SelectField value={form.relation_type} options={optionList(options?.link_relations)} placeholder="Relazione" onChange={(value) => setForm({ ...form, relation_type: value })} /><Button onClick={create}><Link2 className="mr-2 h-4 w-4" /> Collega</Button><Textarea className="font-mono text-xs md:col-span-4" value={form.metadata} onChange={(e) => setForm({ ...form, metadata: e.target.value })} /></div> : null}
  </CardContent></Card>;
}

function PlanningListPage({ kind, title, description }: { kind: "agenda" | "week" | "timeline" | "deadlines"; title: string; description: string }) {
  const [date, setDate] = useState(toDateInput(new Date().toISOString()));
  const [items, setItems] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canFinance = canViewCalendarFinance();
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = kind === "agenda" ? { date } : kind === "week" ? { week_start: date } : {};
      const data = kind === "agenda" ? await calendarApi.getCalendarAgenda(params) : kind === "week" ? await calendarApi.getCalendarWeek(params) : kind === "timeline" ? await calendarApi.getCalendarTimeline({ limit: 200 }) : await calendarApi.getCalendarDeadlines({ limit: 200 });
      setItems(visibleEvents((data as any).items || [], canFinance));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento pianificazione");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const item of items) {
      const key = toDateInput(item.start_at) || "Senza data";
      map.set(key, [...(map.get(key) || []), item]);
    }
    return Array.from(map.entries());
  }, [items]);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title={title} description={description}>{["agenda", "week"].includes(kind) ? <><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Button onClick={load}>Aggiorna</Button></> : <Button onClick={load}>Aggiorna</Button>}</Header><ErrorBox error={error} />{loading ? <Loading /> : grouped.length === 0 ? <Empty>{kind === "agenda" ? "Nessun evento in agenda per questa data." : "Nessun evento da mostrare."}</Empty> : <div className={kind === "week" ? "grid gap-3 lg:grid-cols-7" : "space-y-4"}>{grouped.map(([day, dayItems]) => <Card key={day}><CardHeader><CardTitle className="text-base">{formatDateOnly(day)}</CardTitle></CardHeader><CardContent className="space-y-2">{dayItems.map((event) => <EventCard key={event.id} event={event} actions={<Button asChild size="sm" variant="outline"><Link href={`/calendar/events/${event.id}`}>Apri</Link></Button>} />)}</CardContent></Card>)}</div>}</div>;
}

export function CalendarAgendaPage() { return <PlanningListPage kind="agenda" title="Agenda" description="Agenda giornaliera interna." />; }
export function CalendarWeekPage() { return <PlanningListPage kind="week" title="Settimana" description="Vista settimanale senza librerie esterne." />; }
export function CalendarTimelinePage() { return <PlanningListPage kind="timeline" title="Timeline" description="Timeline cronologica degli eventi." />; }
export function CalendarDeadlinesPage() { return <PlanningListPage kind="deadlines" title="Scadenze" description="Scadenze aggregate da progetti, task, finance, contratti e scartoffie." />; }

export function CalendarWorkloadPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { calendarApi.getCalendarWorkload().then((data) => setRows(data.items || [])).finally(() => setLoading(false)); }, []);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Workload calendario" description="Carico busy per membro nel range selezionato." />{loading ? <Loading /> : rows.length === 0 ? <Empty>Nessun workload calendario disponibile.</Empty> : <div className="grid gap-3">{rows.map((row, index) => <Card key={String(row.user_id || index)}><CardContent className="grid gap-3 p-4 md:grid-cols-5"><Info label="User" value={String(row.user_id || "-")} /><Info label="Busy" value={formatMinutesAsHours(row.busyMinutes)} /><Info label="Eventi" value={String(row.eventCount || 0)} /><Info label="Alta priorità" value={String(row.highPriorityCount || 0)} /><Info label="Scaduti" value={String(row.overdueCount || 0)} /></CardContent></Card>)}</div>}</div>;
}

export function CalendarConflictsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { calendarApi.getCalendarConflicts().then((data) => setRows(data.items || [])).finally(() => setLoading(false)); }, []);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Conflitti" description="Overlap busy per lo stesso utente/assegnatario." />{loading ? <Loading /> : rows.length === 0 ? <Empty>Nessun conflitto rilevato.</Empty> : <div className="space-y-3">{rows.map((row, index) => <Card key={index}><CardContent className="space-y-2 p-4"><StateBadge value="urgent">Rischio pianificazione</StateBadge><p className="font-semibold">{String(row.event_a_title || row.event_a_id)} ↔ {String(row.event_b_title || row.event_b_id)}</p><p className="text-sm text-muted-foreground">User {String(row.user_id || "-")} · {String(row.reason || "-")}</p><p className="text-sm">{formatDateTime(String(row.overlap_start || ""))} → {formatDateTime(String(row.overlap_end || ""))}</p><div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link href={`/calendar/events/${row.event_a_id}`}>Evento A</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/calendar/events/${row.event_b_id}`}>Evento B</Link></Button></div></CardContent></Card>)}</div>}</div>;
}

export function CalendarAvailabilityPage() {
  const [data, setData] = useState<{ events: CalendarEvent[]; teamAvailability: Array<Record<string, unknown>> }>({ events: [], teamAvailability: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => { calendarApi.getCalendarAvailability().then((result) => setData({ events: result.events || [], teamAvailability: result.teamAvailability || [] })).finally(() => setLoading(false)); }, []);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Disponibilità" description="Eventi busy e blocchi availability del team." />{loading ? <Loading /> : data.events.length === 0 && data.teamAvailability.length === 0 ? <Empty>Nessun blocco di indisponibilità rilevato nel periodo.</Empty> : <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Eventi busy</CardTitle></CardHeader><CardContent className="space-y-2">{data.events.map((event) => <EventCard key={event.id} event={event} />)}</CardContent></Card><Card><CardHeader><CardTitle>Team availability</CardTitle></CardHeader><CardContent className="space-y-2">{data.teamAvailability.map((row, index) => <div key={index} className="rounded-lg border p-3 text-sm"><p className="font-semibold">{String(row.title || row.type || "Blocco")}</p><p className="text-muted-foreground">{formatDateTime(String(row.starts_at || ""))} → {formatDateTime(String(row.ends_at || ""))}</p></div>)}</CardContent></Card></div>}</div>;
}

export function CalendarViewsPage() {
  const { toast } = useToast();
  const options = useCalendarOptions();
  const [rows, setRows] = useState<PlanningView[]>([]);
  const [form, setForm] = useState({ name: "", description: "", view_type: "calendar", filters: "{}", layout_config: "{}", is_default: false, is_shared: true });
  const [loading, setLoading] = useState(true);
  const load = async () => { setRows((await calendarApi.listPlanningViews().catch(() => ({ items: [] }))).items || []); setLoading(false); };
  useEffect(() => { void load(); }, []);
  const create = async () => {
    try {
      await calendarApi.createPlanningView({ ...form, filters: parseJsonTextarea(form.filters, {}), layout_config: parseJsonTextarea(form.layout_config, {}) });
      setForm({ name: "", description: "", view_type: "calendar", filters: "{}", layout_config: "{}", is_default: false, is_shared: true });
      await load();
    } catch (err) { toast({ title: "Vista non creata", description: err instanceof Error ? err.message : "Errore", variant: "destructive" }); }
  };
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Viste calendario" description="Viste salvate per agenda, timeline, workload e scadenze." />{loading ? <Loading /> : <div className="grid gap-3">{rows.map((view) => <Card key={view.id}><CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]"><div><p className="font-semibold">{view.name}</p><p className="text-sm text-muted-foreground">{view.view_type} · {view.is_system ? "system" : "custom"} · {view.is_shared ? "shared" : "private"}</p><JsonBlock value={view.filters} /></div>{!view.is_system ? <Button variant="outline" onClick={async () => { await calendarApi.deletePlanningView(view.id); await load(); }}>Elimina</Button> : null}</CardContent></Card>)}</div>}<Card><CardHeader><CardTitle>Nuova vista</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><SelectField value={form.view_type} options={optionList(options?.view_types)} placeholder="Tipo vista" onChange={(value) => setForm({ ...form, view_type: value })} /><Textarea placeholder="Descrizione" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Textarea className="font-mono text-xs" value={form.filters} onChange={(e) => setForm({ ...form, filters: e.target.value })} /><Textarea className="font-mono text-xs md:col-span-2" value={form.layout_config} onChange={(e) => setForm({ ...form, layout_config: e.target.value })} /><Button onClick={create} className="md:col-span-2">Crea vista</Button></CardContent></Card></div>;
}

export function CalendarActivityPage() {
  const [rows, setRows] = useState<PlanningActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const canFinance = canViewCalendarFinance();
  useEffect(() => { calendarApi.getCalendarActivity({ limit: 100 }).then((data) => setRows(data.items || [])).finally(() => setLoading(false)); }, []);
  return <div className="flex-1 space-y-5 p-4 md:p-6"><Header title="Activity calendario" description="Audit interno del modulo pianificazione." />{loading ? <Loading /> : rows.length === 0 ? <Empty>Nessuna activity calendario.</Empty> : <div className="space-y-3">{rows.map((row) => <Card key={row.id}><CardContent className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{row.action.replace(/_/g, " ")}</p><span className="text-sm text-muted-foreground">{formatDateTime(row.created_at)}</span></div><p className="mt-1 text-sm text-muted-foreground">Evento {row.event_id || "-"} · Vista {row.view_id || "-"} · {row.entity_type || "-"} {row.entity_id || ""}</p><JsonBlock value={row.metadata} canFinance={canFinance} /></CardContent></Card>)}</div>}</div>;
}
