"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Settings2, Pencil, Save, X, RotateCcw, Plus, Sparkles,
  TrendingUp, Users, ShoppingCart, FileText,
  CalendarDays, Bell, ChevronRight,
} from "lucide-react";
import { DashboardGrid, type WidgetItem } from "@/components/dashboard/dashboard-grid";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/contexts/PlanContext";
import {
  DEFAULT_LAYOUTS, WIDGET_DEFINITIONS,
  planIncludes,
  type WidgetId, type PlanTier, type LayoutItem,
} from "@/lib/plans";
import { LockedFeature } from "@/components/ui/locked-feature";
import { COMPONENT_MAP } from "@/components/dashboard/dashboard-widgets";
import { cn } from "@/lib/utils";

// ─── Helper: orario del saluto ────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

// ─── Quick KPI Strip ──────────────────────────────────────────────────────────

const QUICK_KPIS = [
  { label: "Nuovi lead oggi",    value: "7",        delta: "+3",   icon: Users,        color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  { label: "Ordini in corso",    value: "23",       delta: "+5",   icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { label: "Preventivi aperti", value: "€ 84.200", delta: "+12%", icon: FileText,     color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" },
  { label: "Fatturato mensile", value: "€ 41.600", delta: "+8%",  icon: TrendingUp,   color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-950/30" },
];

function QuickKpiStrip() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {QUICK_KPIS.map((kpi) => (
        <div
          key={kpi.label}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-xs hover:shadow-sm transition-shadow"
        >
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", kpi.bg)}>
            <kpi.icon className={cn("h-4 w-4", kpi.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground truncate leading-tight">{kpi.label}</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold tabular-nums tracking-tight">{kpi.value}</span>
              <span className="text-[10px] font-medium text-emerald-600">{kpi.delta}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Notifiche urgenti ────────────────────────────────────────────────────────

const NOTIFS = [
  { text: "Preventivo PRV-2026-008 accettato da Luxor Media", time: "2 min fa",  dot: "bg-emerald-500" },
  { text: "Nuovo lead: Roberta Silvestri (Tech Solutions)",   time: "18 min fa", dot: "bg-indigo-500" },
  { text: "Fattura FT-2026-031 in scadenza domani",           time: "1 ora fa",  dot: "bg-amber-500" },
];

function AlertStrip() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 px-4 py-3 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <Bell className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1.5 min-w-0">
          {NOTIFS.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-sm min-w-0">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", n.dot)} />
              <span className="text-amber-900 dark:text-amber-200 truncate">{n.text}</span>
              <span className="text-amber-600/70 text-xs shrink-0">{n.time}</span>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-amber-600 hover:text-amber-800 shrink-0 mt-0.5"
        aria-label="Chiudi"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Prossimi appuntamenti ────────────────────────────────────────────────────

const UPCOMING = [
  { title: "Call con Marco Bianchi",    time: "14:00", tag: "Meeting",  tagColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  { title: "Demo Luxor Media",          time: "16:30", tag: "Demo",     tagColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { title: "Review Q2 pipeline",        time: "18:00", tag: "Interno",  tagColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
];

function UpcomingStrip() {
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        <CalendarDays className="h-4 w-4" />
        <span className="capitalize font-medium text-foreground">{today}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {UPCOMING.map((ev, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs bg-muted/60 rounded-lg px-2.5 py-1.5 border border-border/50">
            <span className="font-semibold tabular-nums text-foreground">{ev.time}</span>
            <span className="text-muted-foreground">{ev.title}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", ev.tagColor)}>{ev.tag}</span>
          </span>
        ))}
        <a href="/calendar" className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 font-medium">
          Vedi tutto <ChevronRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ─── Converte LayoutItem → WidgetItem ─────────────────────────────────────────

function toWidgetItems(items: LayoutItem[]): WidgetItem[] {
  return items.map((item) => ({
    i:         item.i,
    x:         item.x,
    y:         item.y,
    w:         item.w,
    h:         item.h,
    moduleKey: item.i,
  }));
}

// ─── Wrapper widget con lock overlay ─────────────────────────────────────────

function WidgetRenderer({ moduleKey, activePlan }: { moduleKey: string; activePlan: PlanTier }) {
  const def       = WIDGET_DEFINITIONS[moduleKey as WidgetId];
  const component = COMPONENT_MAP[moduleKey];

  if (!component) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Widget non trovato: {moduleKey}
      </div>
    );
  }

  if (def && !planIncludes(activePlan, def.minPlan)) {
    return (
      <LockedFeature minPlan={def.minPlan} message={def.lockMsg} variant="overlay">
        {component}
      </LockedFeature>
    );
  }

  return <>{component}</>;
}

// ─── Pannello aggiunta widget ─────────────────────────────────────────────────

function AddWidgetPanel({
  activePlan,
  currentIds,
  onAdd,
}: {
  activePlan: PlanTier;
  currentIds: string[];
  onAdd:      (id: WidgetId) => void;
}) {
  const available = Object.values(WIDGET_DEFINITIONS).filter(
    (d) => !currentIds.includes(d.id),
  );

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Tutti i widget sono già nella dashboard.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-1.5 max-h-[320px] overflow-y-auto p-1">
      {available.map((def) => {
        const locked = !planIncludes(activePlan, def.minPlan);
        return (
          <button
            key={def.id}
            disabled={locked}
            onClick={() => onAdd(def.id)}
            className={cn(
              "text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
              locked
                ? "opacity-50 cursor-not-allowed border-dashed border-muted-foreground/30 text-muted-foreground"
                : "border-border hover:bg-accent hover:border-indigo-300",
            )}
          >
            {def.label}
            {locked && (
              <span className="block text-[10px] mt-0.5 text-muted-foreground">
                Piano {def.minPlan}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardClient() {
  const { plan, meta } = usePlan();
  const [layout, setLayout]               = useState<WidgetItem[] | null>(null);
  const [isEditing, setIsEditing]         = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [showReset, setShowReset]         = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    apiFetch<LayoutItem[]>("/tenant/dashboard")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLayout(toWidgetItems(data));
        } else {
          setLayout(toWidgetItems(DEFAULT_LAYOUTS[plan]));
        }
      })
      .catch(() => {
        setLayout(toWidgetItems(DEFAULT_LAYOUTS[plan]));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const handleSave = async () => {
    if (!layout) return;
    setIsSaving(true);
    try {
      await apiFetch("/tenant/dashboard", {
        method: "POST",
        body: JSON.stringify({
          widgets: layout.map(({ i, moduleKey, x, y, w, h }) => ({ i, moduleKey, x, y, w, h })),
        }),
      });
      setIsEditing(false);
      toast({ title: "Layout salvato ✓", description: "La dashboard è stata aggiornata." });
    } catch {
      toast({ title: "Errore nel salvataggio", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    apiFetch<LayoutItem[]>("/tenant/dashboard")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setLayout(toWidgetItems(data));
      })
      .catch(() => {});
  }, []);

  const handleReset = async () => {
    const defaultLayout = toWidgetItems(DEFAULT_LAYOUTS[plan]);
    setLayout(defaultLayout);
    setIsEditing(false);
    setShowReset(false);
    try {
      await apiFetch("/tenant/dashboard", {
        method: "POST",
        body: JSON.stringify({
          widgets: defaultLayout.map(({ i, moduleKey, x, y, w, h }) => ({ i, moduleKey, x, y, w, h })),
        }),
      });
    } catch {}
    toast({ title: "Layout ripristinato", description: "Ripristinato il layout di default." });
  };

  const handleAddWidget = (id: WidgetId) => {
    const def = WIDGET_DEFINITIONS[id];
    if (!def || !layout) return;
    const maxY = layout.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
    setLayout((prev) => [
      ...(prev ?? []),
      { i: id, x: 0, y: maxY, w: def.defaultW, h: def.defaultH, moduleKey: id },
    ]);
    setShowAddWidget(false);
  };

  if (!layout) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-4 animate-in fade-in duration-500">

      {/* Dialog reset */}
      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ripristinare il layout {meta.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutte le personalizzazioni andranno perse. Verrà applicato il layout ottimale
              per il piano {meta.label}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Ripristina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Greeting header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-2xl font-bold tracking-tight">
              {getGreeting()}, Luca 👋
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-2 py-0.5 text-indigo-700 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-300"
            >
              {meta.label}
            </Badge>
          </div>
          {isEditing ? (
            <p className="text-sm text-indigo-600 font-medium animate-pulse mt-0.5">
              Modalità modifica — trascina i widget per riorganizzarli, ridimensionali dagli angoli
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">
              Ecco il riepilogo di oggi. Buon lavoro.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <DropdownMenu open={showAddWidget} onOpenChange={setShowAddWidget}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-1.5 h-4 w-4" /> Aggiungi Widget
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-3">
                  <DropdownMenuLabel className="mb-2">Widget disponibili</DropdownMenuLabel>
                  <AddWidgetPanel
                    activePlan={plan}
                    currentIds={layout.map((l) => l.i)}
                    onAdd={handleAddWidget}
                  />
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="mr-1.5 h-4 w-4" /> Annulla
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSaving
                  ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  : <Save className="mr-1.5 h-4 w-4" />}
                {isSaving ? "Salvataggio…" : "Salva"}
              </Button>
            </>
          ) : (
            <>
              {meta.nextPlan && (
                <a
                  href="/billing"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {meta.upgradeLabel}
                </a>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Opzioni Vista</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Personalizza Layout
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowReset(true)}
                    className="text-red-600"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Ripristina Default
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* ── Notifiche urgenti ────────────────────────────────────────────────── */}
      {!isEditing && <AlertStrip />}

      {/* ── Quick KPI Strip ──────────────────────────────────────────────────── */}
      {!isEditing && <QuickKpiStrip />}

      {/* ── Agenda del giorno ────────────────────────────────────────────────── */}
      {!isEditing && <UpcomingStrip />}

      {/* ── Separatore sezione widget ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          Widget Dashboard
        </p>
        <div className="flex-1 border-t border-border/40" />
      </div>

      {/* ── Griglia widget ───────────────────────────────────────────────────── */}
      <DashboardGrid
        layout={layout}
        isEditing={isEditing}
        onLayoutChange={setLayout}
        renderWidget={(moduleKey) => (
          <WidgetRenderer moduleKey={moduleKey} activePlan={plan} />
        )}
      />
    </div>
  );
}
