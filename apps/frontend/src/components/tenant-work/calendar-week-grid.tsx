"use client";

import Link from "next/link";
import { CalendarDays, CheckSquare2, Flag, Phone, UsersRound } from "lucide-react";
import type { CalendarEvent } from "@/lib/tenant-calendar-api";
import { cn } from "@/lib/utils";
import { addLocalDays, dateValue, formatTime, isSameLocalDay } from "./work-model";
import { calendarTone, calendarToneClasses, calendarTypeLabel } from "./calendar-presentation";
import { WorkAvatar } from "./work-ui";

const HOUR_START = 9;
const HOUR_END = 18;
const HOUR_HEIGHT = 68;

function EventIcon({ event }: { event: CalendarEvent }) {
  const type = calendarTypeLabel(event);
  if (type === "Attività") return <UsersRound className="h-3.5 w-3.5" />;
  if (type === "Milestone") return <Flag className="h-3.5 w-3.5" />;
  if (type === "Consegna") return <CheckSquare2 className="h-3.5 w-3.5" />;
  return event.event_type === "call" ? <Phone className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />;
}

function eventPosition(event: CalendarEvent) {
  const start = dateValue(event.start_at);
  if (!start) return null;
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const minMinutes = HOUR_START * 60;
  const maxMinutes = (HOUR_END + 1) * 60;
  if (!event.all_day && (startMinutes < minMinutes || startMinutes >= maxMinutes)) return null;
  const end = dateValue(event.end_at);
  const duration = event.all_day ? 40 : Math.max(36, Math.min(100, ((end?.getTime() || start.getTime() + 3600000) - start.getTime()) / 60000 / 60 * HOUR_HEIGHT));
  const top = event.all_day ? 4 : ((startMinutes - minMinutes) / 60) * HOUR_HEIGHT + 4;
  return { top, height: duration };
}

export function CalendarWeekGrid({
  weekStart,
  events,
  relatedLabel,
  assignee,
}: {
  weekStart: Date;
  events: CalendarEvent[];
  relatedLabel: (event: CalendarEvent) => string | undefined;
  assignee: (event: CalendarEvent) => { name?: string | null; email?: string | null } | undefined;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index));
  const today = new Date();
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, index) => HOUR_START + index);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[68px_repeat(7,minmax(128px,1fr))] border-b border-slate-200">
          <div />
          {days.map((day) => (
            <div key={day.toISOString()} className={cn("border-l border-slate-200 px-2 py-3 text-center", isSameLocalDay(day, today) && "bg-indigo-50/70")}>
              <p className={cn("text-xs font-semibold uppercase text-slate-500", isSameLocalDay(day, today) && "text-indigo-600")}>{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day)}</p>
              <p className={cn("mt-1 text-sm font-semibold text-slate-800", isSameLocalDay(day, today) && "text-indigo-600")}>{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(day)}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[68px_repeat(7,minmax(128px,1fr))]">
          <div className="relative" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
            {hours.map((hour, index) => (
              <span key={hour} className="absolute right-3 -translate-y-2 text-[11px] text-slate-500" style={{ top: `${index * HOUR_HEIGHT}px` }}>{String(hour).padStart(2, "0")}:00</span>
            ))}
          </div>
          {days.map((day) => (
            <div key={day.toISOString()} className={cn("relative border-l border-slate-200", isSameLocalDay(day, today) && "bg-indigo-50/45")} style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
              {hours.map((hour, index) => <span key={hour} className="absolute inset-x-0 border-t border-dashed border-slate-200/80" style={{ top: `${index * HOUR_HEIGHT}px` }} />)}
              {events.filter((event) => {
                const start = dateValue(event.start_at);
                return start && isSameLocalDay(start, day);
              }).map((event) => {
                const position = eventPosition(event);
                if (!position) return null;
                const tone = calendarTone(event);
                const owner = assignee(event);
                return (
                  <Link
                    key={event.id}
                    href={`/calendar/events/${event.id}`}
                    className={cn("absolute left-1 right-1 z-10 overflow-hidden rounded-lg border-l-[3px] p-2 text-xs shadow-none transition hover:brightness-[0.98]", calendarToneClasses[tone].surface)}
                    style={{ top: `${position.top}px`, height: `${position.height}px` }}
                    title={event.title}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className={calendarToneClasses[tone].text}><EventIcon event={event} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{event.title}</p>
                        <p className="mt-0.5 truncate opacity-70">{event.all_day ? "Tutto il giorno" : `${formatTime(event.start_at)}${event.end_at ? ` – ${formatTime(event.end_at)}` : ""}`}</p>
                      </div>
                      {owner ? <WorkAvatar name={owner.name} email={owner.email} size="sm" className="h-6 w-6 text-[9px]" /> : null}
                    </div>
                    {position.height >= 60 && relatedLabel(event) ? <p className="mt-1 truncate opacity-70">{relatedLabel(event)}</p> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
