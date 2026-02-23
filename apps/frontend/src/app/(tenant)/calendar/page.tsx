"use client";

import { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, Users,
  Video, Phone, Briefcase, Flag, MapPin, X, Check, Edit2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "meeting" | "call" | "demo" | "deadline" | "internal" | "travel";

interface CalEvent {
  id: string;
  title: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;
  type: EventType;
  attendees: string[];
  location?: string;
  description?: string;
  allDay?: boolean;
}

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<EventType, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{className?: string}> }> = {
  meeting:  { label: "Meeting",    color: "text-indigo-700",  bg: "bg-indigo-100 dark:bg-indigo-900/40",  border: "border-l-indigo-500",  icon: Users },
  call:     { label: "Call",       color: "text-emerald-700", bg: "bg-emerald-100 dark:bg-emerald-900/40",border: "border-l-emerald-500", icon: Phone },
  demo:     { label: "Demo",       color: "text-violet-700",  bg: "bg-violet-100 dark:bg-violet-900/40",  border: "border-l-violet-500",  icon: Video },
  deadline: { label: "Scadenza",   color: "text-rose-700",    bg: "bg-rose-100 dark:bg-rose-900/40",      border: "border-l-rose-500",    icon: Flag },
  internal: { label: "Interno",    color: "text-slate-700",   bg: "bg-slate-100 dark:bg-slate-800/40",    border: "border-l-slate-400",   icon: Briefcase },
  travel:   { label: "Viaggio",    color: "text-amber-700",   bg: "bg-amber-100 dark:bg-amber-900/40",    border: "border-l-amber-500",   icon: MapPin },
};

// ─── Demo events (Feb 2026) ───────────────────────────────────────────────────

const EVENTS: CalEvent[] = [
  { id: "c01", title: "Stand-up Team DoFlow",          date: "2026-02-23", startTime: "09:00", endTime: "09:15", type: "internal",  attendees: ["LF", "SC", "MR", "AD", "GE"] },
  { id: "c02", title: "Call con Marco Bianchi",         date: "2026-02-23", startTime: "14:00", endTime: "14:30", type: "call",      attendees: ["LF"], location: "Zoom" },
  { id: "c03", title: "Demo prodotto — Luxor Media",    date: "2026-02-23", startTime: "16:30", endTime: "17:30", type: "demo",      attendees: ["LF", "SC"], location: "Google Meet", description: "Demo completa features Enterprise" },
  { id: "c04", title: "Review Q2 pipeline",             date: "2026-02-23", startTime: "18:00", endTime: "18:45", type: "internal",  attendees: ["LF", "MR", "GE"] },
  { id: "c05", title: "Presentazione offerta Alpine",   date: "2026-02-24", startTime: "10:00", endTime: "11:30", type: "meeting",   attendees: ["LF", "SC"], location: "Via Montenapoleone 12, Milano" },
  { id: "c06", title: "Scadenza fattura FT-2026-031",   date: "2026-02-24", startTime: "23:59", endTime: "23:59", type: "deadline",  attendees: [] },
  { id: "c07", title: "Onboarding Nextech S.r.l.",      date: "2026-02-25", startTime: "15:00", endTime: "16:00", type: "meeting",   attendees: ["SC", "AD"], location: "Videocall", description: "Sessione onboarding piano Pro" },
  { id: "c08", title: "Trasferta Milano → Roma",        date: "2026-02-26", startTime: "07:30", endTime: "10:00", type: "travel",    attendees: ["LF"] },
  { id: "c09", title: "Incontro Manifattura Lombarda",  date: "2026-02-26", startTime: "11:00", endTime: "13:00", type: "meeting",   attendees: ["LF", "GE"], location: "Via Nazionale 45, Roma" },
  { id: "c10", title: "Follow-up Brera Design",         date: "2026-02-27", startTime: "10:30", endTime: "11:00", type: "call",      attendees: ["SC"] },
  { id: "c11", title: "1:1 Luca × Sara",               date: "2026-02-27", startTime: "14:00", endTime: "14:30", type: "internal",  attendees: ["LF", "SC"] },
  { id: "c12", title: "Demo Editoria Moderna",          date: "2026-02-28", startTime: "09:30", endTime: "10:30", type: "demo",      attendees: ["MR", "AD"], location: "Teams" },
  { id: "c13", title: "Budget Review Q1",              date: "2026-02-28", startTime: "15:00", endTime: "16:30", type: "internal",  attendees: ["LF", "MR", "GE", "SC", "AD"] },
  { id: "c14", title: "Call prospect Alpine Ventures", date: "2026-03-03", startTime: "11:00", endTime: "11:30", type: "call",      attendees: ["LF"] },
  { id: "c15", title: "Presentazione Q2 board",        date: "2026-03-05", startTime: "10:00", endTime: "12:00", type: "internal",  attendees: ["LF", "SC", "MR", "AD", "GE"], location: "Sala Riunioni A" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const WEEKDAYS_SHORT = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];
const ATTENDEE_COLORS: Record<string, string> = {
  LF: "bg-indigo-500", SC: "bg-emerald-500", MR: "bg-violet-500",
  AD: "bg-rose-500", GE: "bg-orange-500",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function padDate(n: number) {
  return String(n).padStart(2, "0");
}

// ─── Event pill ───────────────────────────────────────────────────────────────

function EventPill({ event, onClick }: { event: CalEvent; onClick: () => void }) {
  const cfg = EVENT_CONFIG[event.type];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded border-l-2 truncate transition-opacity hover:opacity-80",
        cfg.bg, cfg.color, cfg.border,
      )}
    >
      {event.startTime} {event.title}
    </button>
  );
}

// ─── Event detail modal ───────────────────────────────────────────────────────

function EventModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const cfg = EVENT_CONFIG[event.type];
  const Icon = cfg.icon;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
              <Icon className={cn("h-5 w-5", cfg.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-snug">{event.title}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(event.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{event.startTime} – {event.endTime}</span>
            <Badge variant="outline" className={cn("text-[10px] ml-auto", cfg.color)}>{cfg.label}</Badge>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{event.location}</span>
            </div>
          )}
          {event.attendees.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1">
                {event.attendees.map((a) => (
                  <Avatar key={a} className="h-6 w-6">
                    <AvatarFallback className={cn("text-[9px] font-bold text-white", ATTENDEE_COLORS[a] ?? "bg-slate-500")}>{a}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          )}
          {event.description && (
            <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">{event.description}</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}><X className="h-3.5 w-3.5 mr-1" /> Chiudi</Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Edit2 className="h-3.5 w-3.5 mr-1" /> Modifica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const today = new Date();
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [selectedEvent, setSel]   = useState<CalEvent | null>(null);
  const [view, setView]           = useState<"month" | "week">("month");

  const goBack    = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const goForward = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const daysInMonth  = getDaysInMonth(year, month);
  const firstWeekday = getFirstDayOfMonth(year, month);

  // Map events to dates
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of EVENTS) {
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date)!.push(ev);
    }
    return map;
  }, []);

  // Today's events
  const todayStr    = `${today.getFullYear()}-${padDate(today.getMonth()+1)}-${padDate(today.getDate())}`;
  const todayEvents = eventsByDate.get(todayStr) ?? [];

  // Upcoming 5 events from today onwards
  const upcoming = EVENTS.filter(e => e.date >= todayStr).slice(0, 6);

  // Build grid cells
  const cells: Array<{ day: number | null; dateStr: string }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, dateStr: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: `${year}-${padDate(month+1)}-${padDate(d)}` });
  }

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-4">

      {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSel(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendario</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Pianifica meeting, call e scadenze</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs">Oggi</Button>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setView("month")}
              className={cn("text-xs px-3 py-1 rounded-md font-medium transition-colors", view === "month" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Mese
            </button>
            <button
              onClick={() => setView("week")}
              className={cn("text-xs px-3 py-1 rounded-md font-medium transition-colors", view === "week" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Settimana
            </button>
          </div>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="mr-1.5 h-4 w-4" /> Nuovo Evento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* ── Calendar grid ──────────────────────────────────────────────────── */}
        <Card className="xl:col-span-3">
          {/* Navigation */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
            <button onClick={goBack} className="p-1 rounded-md hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold">
              {MONTHS[month]} {year}
            </h3>
            <button onClick={goForward} className="p-1 rounded-md hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border/50">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;
              const events  = cell.dateStr ? (eventsByDate.get(cell.dateStr) ?? []) : [];
              const isCurrentMonth = cell.day !== null;

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[80px] p-1.5 border-b border-r border-border/30 flex flex-col gap-1",
                    !isCurrentMonth && "bg-muted/20",
                    isToday && "bg-indigo-50/60 dark:bg-indigo-950/20",
                  )}
                >
                  {cell.day !== null && (
                    <>
                      <span className={cn(
                        "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                        isToday
                          ? "bg-indigo-600 text-white"
                          : "text-foreground hover:bg-muted rounded-full cursor-pointer",
                      )}>
                        {cell.day}
                      </span>
                      {events.slice(0, 3).map((ev) => (
                        <EventPill key={ev.id} event={ev} onClick={() => setSel(ev)} />
                      ))}
                      {events.length > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1">+{events.length - 3} altri</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Today's events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Oggi — {today.getDate()} {MONTHS[today.getMonth()]}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {todayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground px-5 pb-4">Nessun evento oggi.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {todayEvents.map((ev) => {
                    const cfg = EVENT_CONFIG[ev.type];
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setSel(ev)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
                      >
                        <div className={cn("h-2 w-2 rounded-full shrink-0", cfg.bg.replace("bg-", "bg-").replace("/40", ""), cfg.border.replace("border-l-", "bg-"))} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{ev.title}</p>
                          <p className="text-[10px] text-muted-foreground">{ev.startTime} – {ev.endTime}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Prossimi eventi</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {upcoming.map((ev) => {
                  const cfg = EVENT_CONFIG[ev.type];
                  const Icon = cfg.icon;
                  const d = new Date(ev.date);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSel(ev)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", cfg.bg)}>
                        <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{ev.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {d.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} · {ev.startTime}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className={cn("h-2.5 w-2.5 rounded-sm", cfg.bg, "border-l-2", cfg.border)} />
                    <span className="text-muted-foreground">{cfg.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
