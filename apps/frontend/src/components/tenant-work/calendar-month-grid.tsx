"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/lib/tenant-calendar-api";
import { cn } from "@/lib/utils";
import { addLocalDays, dateValue, isSameLocalDay, startOfWeek } from "./work-model";
import { calendarTone, calendarToneClasses } from "./calendar-presentation";

export function CalendarMonthGrid({ month, events }: { month: Date; events: CalendarEvent[] }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addLocalDays(gridStart, index));
  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {Array.from({ length: 7 }, (_, index) => addLocalDays(gridStart, index)).map((day) => (
            <div key={day.toISOString()} className="border-l border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500 first:border-l-0">
              {new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dayEvents = events.filter((event) => {
              const start = dateValue(event.start_at);
              return start && isSameLocalDay(start, day);
            });
            return (
              <div key={day.toISOString()} className={cn("min-h-28 border-b border-l border-slate-200 p-2", index % 7 === 0 && "border-l-0", day.getMonth() !== month.getMonth() && "bg-slate-50/80 text-slate-400", isSameLocalDay(day, today) && "bg-indigo-50/60")}>
                <p className={cn("mb-2 text-xs font-semibold", isSameLocalDay(day, today) && "text-indigo-600")}>{day.getDate()}</p>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => {
                    const tone = calendarTone(event);
                    return (
                      <Link key={event.id} href={`/calendar/events/${event.id}`} className={cn("block truncate rounded-md border px-2 py-1 text-[11px] font-medium", calendarToneClasses[tone].surface)}>
                        {event.title}
                      </Link>
                    );
                  })}
                  {dayEvents.length > 3 ? <p className="px-1 text-[10px] text-slate-500">+{dayEvents.length - 3} altri</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
