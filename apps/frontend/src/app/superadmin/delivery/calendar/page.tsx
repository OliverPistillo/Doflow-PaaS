// Percorso: C:\Doflow\apps\frontend\src\app\superadmin\delivery\calendar\page.tsx

"use client";

import * as React from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";
import { EventCreateDialog } from './components/EventCreateDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- TIPI ---
type ProjectEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'milestone' | 'deadline' | 'meeting';
  description?: string;
};

const EVENT_STYLES: Record<string, string> = {
  milestone: 'bg-indigo-100 text-primary border-l-2 border-indigo-500',
  deadline: 'bg-red-100 text-red-700 border-l-2 border-red-500',
  meeting: 'bg-emerald-100 text-emerald-700 border-l-2 border-emerald-500',
};

// --- HELPER ---
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ProjectCalendarPage() {
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = React.useState<Date>(new Date());
  const [events, setEvents] = React.useState<ProjectEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { ConfirmDialog, confirm } = useConfirm();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  // Caricamento Eventi
  const loadEvents = async () => {
    setLoading(true);
    try {
      // Carichiamo TUTTI gli eventi per semplicità, o potremmo filtrare per start/end mese
      const res = await apiFetch<ProjectEvent[]>("/superadmin/calendar/events");
      setEvents(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadEvents();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const ok = await confirm({
        title: "Eliminare questo evento?",
        confirmLabel: "Elimina",
        variant: "destructive",
      });
      if (!ok) return;
      try {
          await apiFetch(`/superadmin/calendar/events/${id}`, { method: "DELETE" });
          loadEvents();
      } catch(err) { console.error(err); }
  };

  // Generazione Griglia Giorni
  const daysGrid = React.useMemo(() => {
    const first = startOfMonth(month);
    const dow = (first.getDay() + 6) % 7; // Lunedì = 0
    const start = new Date(first);
    start.setDate(first.getDate() - dow);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) { // 6 righe x 7 giorni
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [month]);

  return (
    <div className="dashboard-content animate-fadeIn flex flex-col" style={{ height: "calc(100vh - 144px)" }}>
      <ConfirmDialog />

      {/* ── Action bar ─────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" onClick={() => { setMonth(new Date()); setSelectedDay(new Date()); }}>Oggi</Button>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuovo Evento
        </Button>
      </div>

      {/* CALENDARIO CARD */}
      <Card className="flex-1 flex flex-col border shadow-sm overflow-hidden">
        {/* Navigation Header */}
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b bg-muted/40">
            <h2 className="text-lg font-bold capitalize text-foreground">
                {month.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1 bg-card rounded-md border p-0.5 shadow-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, +1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </CardHeader>
        
        {/* Days Header Row */}
        <div className="grid grid-cols-7 text-xs font-semibold text-muted-foreground bg-muted/40 border-b">
            {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
                <div key={d} className="py-3 text-center uppercase tracking-wider">{d}</div>
            ))}
        </div>
        
        {/* Days Grid */}
        {loading && events.length === 0 ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-primary"/></div>
        ) : (
            <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-card">
                {daysGrid.map((d, i) => {
                    const inMonth = d.getMonth() === month.getMonth();
                    const isToday = sameDay(d, new Date());
                    const isSelected = sameDay(d, selectedDay);
                    // Parsing sicuro della data (l'API potrebbe tornare stringa o Date)
                    const dayEvents = events.filter(e => sameDay(new Date(e.date), d));
                    
                    return (
                        <div
                            key={i}
                            className={cn(
                                "p-2 border-b border-r flex flex-col items-start min-h-[80px] transition-colors relative group/cell",
                                !inMonth ? "bg-muted/40/30 text-muted-foreground/50" : "hover:bg-muted/40",
                                isSelected && "bg-primary/5"
                            )}
                            onClick={() => setSelectedDay(d)}
                        >
                            <div className="flex justify-between w-full">
                                <span className={cn(
                                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                                    isToday ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
                                )}>
                                    {d.getDate()}
                                </span>
                                {/* Tasto + rapido (appare on hover) */}
                                <button 
                                    className="opacity-0 group-hover/cell:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDay(d);
                                        setIsDialogOpen(true);
                                    }}
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            </div>
                            
                            {/* Eventi del giorno */}
                            <div className="w-full space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                                {dayEvents.map(ev => (
                                    <TooltipProvider key={ev.id}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div 
                                                    className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded truncate font-medium cursor-pointer shadow-sm transition-all hover:opacity-80 flex justify-between items-center group/event", 
                                                        EVENT_STYLES[ev.type] || EVENT_STYLES['meeting']
                                                    )}
                                                >
                                                    <span className="truncate">{ev.title}</span>
                                                    <Trash2 
                                                        className="h-3 w-3 opacity-0 group-hover/event:opacity-100 hover:text-red-700" 
                                                        onClick={(e) => handleDelete(e, ev.id)}
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="font-bold">{ev.title}</p>
                                                <p className="text-xs capitalize">{ev.type}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </Card>

      <EventCreateDialog 
         isOpen={isDialogOpen} 
         onClose={() => setIsDialogOpen(false)} 
         onSuccess={loadEvents}
         defaultDate={selectedDay}
      />
    </div>
  );
}