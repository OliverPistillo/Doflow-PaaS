"use client";

import * as React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- TIPI ---
type ProjectEvent = {
  id: string;
  title: string;
  date: string; // ISO Date string
  type: 'milestone' | 'deadline' | 'meeting';
};

// Dati Mock
const MOCK_EVENTS: ProjectEvent[] = [
  { id: '1', title: 'Rilascio Beta', date: '2026-02-06', type: 'milestone' },
  { id: '2', title: 'Consegna Mockup', date: '2026-02-13', type: 'deadline' },
  { id: '3', title: 'Meeting Cliente X', date: '2026-02-20', type: 'meeting' },
];

const EVENT_STYLES = {
  milestone: 'bg-indigo-100 text-indigo-700 border-l-4 border-indigo-500',
  deadline: 'bg-red-100 text-red-700 border-l-4 border-red-500',
  meeting: 'bg-emerald-100 text-emerald-700 border-l-4 border-emerald-500',
};

// --- HELPER ---
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ProjectCalendarPage() {
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = React.useState<Date>(() => new Date());

  // CALENDAR LOGIC
  const daysGrid = React.useMemo(() => {
    const first = startOfMonth(month);
    const dow = (first.getDay() + 6) % 7; // Lunedì = 0
    const start = new Date(first);
    start.setDate(first.getDate() - dow);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) { // 6 settimane
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [month]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <CalendarDays className="h-6 w-6 text-indigo-600" /> Calendario del progetto
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualizza scadenze e milestone di tutti i progetti attivi.
          </p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => setMonth(new Date())}>Oggi</Button>
           <Button className="bg-indigo-600 text-white"><Plus className="h-4 w-4 mr-2" /> Nuovo Evento</Button>
        </div>
      </div>

      {/* CALENDARIO */}
      <Card className="flex-1 flex flex-col border shadow-sm overflow-hidden">
        {/* Navigation */}
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b bg-slate-50/50">
            <h2 className="text-lg font-bold capitalize text-slate-800">
                {month.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1 bg-white rounded-md border p-0.5 shadow-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, +1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </CardHeader>
        
        {/* Days Header */}
        <div className="grid grid-cols-7 text-xs font-semibold text-slate-500 bg-slate-50 border-b">
            {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
                <div key={d} className="py-3 text-center uppercase tracking-wider">{d}</div>
            ))}
        </div>
        
        {/* Grid */}
        <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-white">
            {daysGrid.map((d, i) => {
                const inMonth = d.getMonth() === month.getMonth();
                const isToday = sameDay(d, new Date());
                const dayEvents = MOCK_EVENTS.filter(e => sameDay(new Date(e.date), d));
                
                return (
                    <div
                        key={i}
                        className={cn(
                            "p-2 border-b border-r flex flex-col items-start min-h-[100px] transition-colors relative",
                            !inMonth ? "bg-slate-50/50 text-slate-300" : "hover:bg-slate-50/30",
                            isToday && "bg-indigo-50/30"
                        )}
                        onClick={() => setSelectedDay(d)}
                    >
                        <span className={cn(
                            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                            isToday ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700"
                        )}>
                            {d.getDate()}
                        </span>
                        
                        <div className="w-full space-y-1 overflow-y-auto max-h-[80px]">
                            {dayEvents.map(ev => (
                                <div 
                                    key={ev.id} 
                                    className={cn("text-[10px] px-1.5 py-0.5 rounded truncate font-medium cursor-pointer shadow-sm", EVENT_STYLES[ev.type])}
                                    title={ev.title}
                                >
                                    {ev.title}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
      </Card>
    </div>
  );
}