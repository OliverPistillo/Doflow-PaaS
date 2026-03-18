// Percorso: apps/frontend/src/app/(tenant)/dashboard/dashboard-client.tsx
// Refactored 1:1 dal Figma — logica invariata, stile aggiornato:
//   • Tutti "indigo-*" hardcoded → rimpiazzati con token semantici
//   • KPI cards → df-card-gray (Figma: elm/card/gray)
//   • Header → Figma typescale Bold 22px / SemiBold 16px
//   • Loading spinner → text-primary
//   • Alert strip → Figma warm palette (amber via destructive tokens)
//   • Tag pills → bg-primary/10 text-primary (Figma: active section style)

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
import { getDoFlowUser } from "@/lib/jwt";

// ─── Helper: saluto per ora ────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function getDisplayName(): string {
  if (typeof window === "undefined") return "";
  const user = getDoFlowUser();
  if (!user) return "";
  if (user.email) return user.email.split("@")[0];
  if (user.tenantSlug) return user.tenantSlug;
  return "";
}

// ─── Quick KPI Strip ──────────────────────────────────────────────────────────
// Figma: elm/card/gray cells (bg #f4f9fd, radius 24px)
// Icon backgrounds use tinted primary variants instead of hardcoded colors

const QUICK_KPIS = [
  { label: "Nuovi lead oggi",    value: "7",        delta: "+3",   icon: Users,        iconClass: "text-primary",     bgClass: "bg-primary/10" },
  { label: "Ordini in corso",    value: "23",       delta: "+5",   icon: ShoppingCart, iconClass: "text-chart-2",     bgClass: "bg-chart-2/10" },
  { label: "Preventivi aperti", value: "€ 84.200", delta: "+12%", icon: FileText,     iconClass: "text-chart-5",     bgClass: "bg-chart-5/10" },
  { label: "Fatturato mensile", value: "€ 41.600", delta: "+8%",  icon: TrendingUp,   iconClass: "text-chart-4",     bgClass: "bg-chart-4/10" },
] as const;

function QuickKpiStrip() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {QUICK_KPIS.map((kpi) => (
        <div
          key={kpi.label}
          // Figma: elm/card/gray — bg #f4f9fd, rounded-[24px]
          className="df-card-gray flex items-center gap-3 px-4 py-4 hover:shadow-sm transition-shadow duration-150"
        >
          <div className={cn("h-10 w-10 rounded-nav flex items-center justify-center shrink-0", kpi.bgClass)}>
            <kpi.icon className={cn("h-5 w-5", kpi.iconClass)} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-muted-foreground truncate leading-tight">
              {kpi.label}
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[18px] font-bold tabular-nums tracking-tight text-foreground">
                {kpi.value}
              </span>
              <span className="text-[11px] font-bold text-chart-2">{kpi.delta}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Alert Strip ──────────────────────────────────────────────────────────────
// Figma-aligned: warm accent via CSS tokens, no hardcoded amber-*

const NOTIFS = [
  { text: "Preventivo PRV-2026-008 accettato da Luxor Media", time: "2 min fa",  dotClass: "bg-chart-2" },
  { text: "Nuovo lead: Roberta Silvestri (Tech Solutions)",   time: "18 min fa", dotClass: "bg-primary" },
  { text: "Fattura FT-2026-031 in scadenza domani",           time: "1 ora fa",  dotClass: "bg-chart-5" },
];

function AlertStrip() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div
      role="alert"
      // Uses accent/chart tokens instead of hardcoded amber
      className="rounded-card border border-chart-5/30 bg-chart-5/10 dark:bg-chart-5/5 px-4 py-3 flex items-start justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <Bell className="h-4 w-4 text-chart-5 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1.5 min-w-0">
          {NOTIFS.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-[14px] min-w-0">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", n.dotClass)} />
              <span className="text-foreground/80 truncate">{n.text}</span>
              <span className="text-muted-foreground text-[12px] shrink-0">{n.time}</span>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5 transition-colors"
        aria-label="Chiudi notifiche"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Upcoming Strip ───────────────────────────────────────────────────────────
// No hardcoded indigo/emerald/slate — uses semantic tokens

const UPCOMING = [
  { title: "Call con Marco Bianchi", time: "14:00", tag: "Meeting",  tagClass: "bg-primary/10 text-primary" },
  { title: "Demo Luxor Media",       time: "16:30", tag: "Demo",     tagClass: "bg-chart-2/10 text-chart-2" },
  { title: "Review Q2 pipeline",     time: "18:00", tag: "Interno",  tagClass: "bg-muted text-muted-foreground" },
];

function UpcomingStrip() {
  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long",
  });
  return (
    <div className="df-card-gray px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 text-[14px] text-muted-foreground shrink-0">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        <span className="capitalize font-bold text-foreground">{today}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {UPCOMING.map((ev, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 text-[13px] bg-background rounded-nav px-2.5 py-1.5 border border-border/50"
          >
            <span className="font-bold tabular-nums text-foreground">{ev.time}</span>
            <span className="text-muted-foreground">{ev.title}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold", ev.tagClass)}>
              {ev.tag}
            </span>
          </span>
        ))}
        <a
          href="/calendar"
          className="text-[13px] text-primary hover:text-primary/80 flex items-center gap-0.5 font-semibold transition-colors"
        >
          Vedi tutto <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

// ─── Helpers (invariati) ─────────────────────────────────────────────────────

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

function WidgetRenderer({ moduleKey, activePlan }: { moduleKey: string; activePlan: PlanTier }) {
  const def       = WIDGET_DEFINITIONS[moduleKey as WidgetId];
  const component = COMPONENT_MAP[moduleKey];

  if (!component) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-[14px]">
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

function AddWidgetPanel({
  activePlan,
  currentIds,
  onAdd,
}: {
  activePlan: PlanTier;
  currentIds: string[];
  onAdd: (id: WidgetId) => void;
}) {
  const available = Object.values(WIDGET_DEFINITIONS).filter(
    (d) => !currentIds.includes(d.id),
  );

  if (available.length === 0) {
    return (
      <p className="text-[14px] text-muted-foreground py-2">
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
              "text-left px-3 py-2 rounded-nav border text-[14px] font-semibold transition-colors",
              locked
                ? "opacity-50 cursor-not-allowed border-dashed border-border text-muted-foreground"
                // ✅ border-primary/30 instead of border-indigo-300
                : "border-border hover:bg-primary/5 hover:border-primary/30 text-foreground",
            )}
          >
            {def.label}
            {locked && (
              <span className="block text-[11px] mt-0.5 text-muted-foreground">
                Piano {def.minPlan}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main DashboardClient ─────────────────────────────────────────────────────

export default function DashboardClient() {
  const { plan, meta } = usePlan();
  const [layout, setLayout]               = useState<WidgetItem[] | null>(null);
  const [isEditing, setIsEditing]         = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [showReset, setShowReset]         = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const { toast } = useToast();
  const displayName = getDisplayName();

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

  // ── Loading state ─────────────────────────────────────────────────────
  if (!layout) {
    return (
      <div className="h-full flex items-center justify-center" role="status" aria-label="Caricamento dashboard">
        {/* ✅ text-primary instead of text-indigo-600 */}
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-4 animate-fade-in">

      {/* ── Reset Dialog ──────────────────────────────────────────────── */}
      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent className="rounded-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[22px] font-bold">
              Ripristinare il layout {meta.label}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[16px]">
              Tutte le personalizzazioni andranno perse. Verrà applicato il layout ottimale
              per il piano {meta.label}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ripristina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Greeting Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Figma: Bold 22px #0a1629 */}
            <h2 className="text-[22px] font-bold tracking-tight text-foreground">
              {getGreeting()}{displayName ? `, ${displayName}` : ""} 👋
            </h2>
            {/* ✅ Plan badge: semantic tokens, no hardcoded indigo-* */}
            <Badge
              variant="outline"
              className="text-[11px] font-bold px-2 py-0.5 text-primary border-primary/30 bg-primary/10"
            >
              {meta.label}
            </Badge>
          </div>
          {isEditing ? (
            <p className="text-[14px] text-primary font-semibold animate-pulse">
              Modalità modifica — trascina i widget per riorganizzarli
            </p>
          ) : (
            <p className="text-[14px] text-muted-foreground">
              Ecco il riepilogo di oggi. Buon lavoro.
            </p>
          )}
        </div>

        {/* ── Edit Controls ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <DropdownMenu open={showAddWidget} onOpenChange={setShowAddWidget}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Aggiungi Widget
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-3 rounded-card">
                  <DropdownMenuLabel className="mb-2 text-[14px] font-bold">
                    Widget disponibili
                  </DropdownMenuLabel>
                  <AddWidgetPanel
                    activePlan={plan}
                    currentIds={layout.map((l) => l.i)}
                    onAdd={handleAddWidget}
                  />
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReset(true)}
                title="Ripristina layout di default"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Annulla
              </Button>

              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving
                  ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                }
                Salva
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                title="Personalizza dashboard"
              >
                <Settings2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Personalizza
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <QuickKpiStrip />

      {/* ── Alert Strip ────────────────────────────────────────────────── */}
      <AlertStrip />

      {/* ── Upcoming ───────────────────────────────────────────────────── */}
      <UpcomingStrip />

      {/* ── Widget Grid ────────────────────────────────────────────────── */}
      <DashboardGrid
        layout={layout}
        onLayoutChange={(items) => setLayout(items)}
        isEditing={isEditing}
        renderWidget={(moduleKey) => (
          <WidgetRenderer moduleKey={moduleKey} activePlan={plan} />
        )}
      />
    </div>
  );
}