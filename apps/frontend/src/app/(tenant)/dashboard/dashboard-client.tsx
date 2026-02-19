"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Settings2, Pencil, Save, X, RotateCcw, Plus, Sparkles } from "lucide-react";
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

// ─── Converte LayoutItem (da DEFAULT_LAYOUTS o DB) → WidgetItem ──────────────
//  Aggiunge moduleKey = i (la chiave del widget)

function toWidgetItems(items: LayoutItem[]): WidgetItem[] {
  return items.map((item) => ({
    i:         item.i,
    x:         item.x,
    y:         item.y,
    w:         item.w,
    h:         item.h,
    moduleKey: item.i,   // il DB salva module_key = i
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

  // ── Carica layout dal backend, fallback al default del piano ──────────────
  useEffect(() => {
    apiFetch<LayoutItem[]>("/tenant/dashboard")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLayout(toWidgetItems(data));
        } else {
          // Nessun layout salvato → usa default del piano
          setLayout(toWidgetItems(DEFAULT_LAYOUTS[plan]));
        }
      })
      .catch(() => {
        setLayout(toWidgetItems(DEFAULT_LAYOUTS[plan]));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // ── Salva layout sul backend ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!layout) return;
    setIsSaving(true);
    try {
      await apiFetch("/tenant/dashboard", {
        method: "POST",
        body: JSON.stringify({
          widgets: layout.map(({ i, moduleKey, x, y, w, h }) => ({
            i,
            moduleKey,
            x,
            y,
            w,
            h,
          })),
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

  // ── Annulla modifiche: ricarica dal backend ────────────────────────────────
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    // Ricarica il layout salvato per annullare le modifiche non salvate
    apiFetch<LayoutItem[]>("/tenant/dashboard")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLayout(toWidgetItems(data));
        }
      })
      .catch(() => {}); // se fallisce teniamo il layout in memoria
  }, []);

  // ── Reset al default del piano ─────────────────────────────────────────────
  const handleReset = async () => {
    const defaultLayout = toWidgetItems(DEFAULT_LAYOUTS[plan]);
    setLayout(defaultLayout);
    setIsEditing(false);
    setShowReset(false);
    // Salva subito il default in modo che persista al prossimo login
    try {
      await apiFetch("/tenant/dashboard", {
        method: "POST",
        body: JSON.stringify({
          widgets: defaultLayout.map(({ i, moduleKey, x, y, w, h }) => ({
            i, moduleKey, x, y, w, h,
          })),
        }),
      });
    } catch {}
    toast({ title: "Layout ripristinato", description: "Ripristinato il layout di default." });
  };

  // ── Aggiungi widget ────────────────────────────────────────────────────────
  const handleAddWidget = (id: WidgetId) => {
    const def = WIDGET_DEFINITIONS[id];
    if (!def || !layout) return;

    // Calcola la y massima occupata e metti il nuovo widget in fondo
    const maxY = layout.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);

    setLayout((prev) => [
      ...(prev ?? []),
      {
        i:         id,
        x:         0,
        y:         maxY,
        w:         def.defaultW,
        h:         def.defaultH,
        moduleKey: id,
      },
    ]);
    setShowAddWidget(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          {isEditing ? (
            <p className="text-sm text-indigo-600 font-medium animate-pulse mt-0.5">
              Modalità modifica — trascina i widget per riorganizzarli, ridimensionali dagli angoli
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-0.5">
              Piano <span className="font-semibold">{meta.label}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              {/* Aggiungi widget */}
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

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
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
                  : <Save className="mr-1.5 h-4 w-4" />
                }
                {isSaving ? "Salvataggio…" : "Salva"}
              </Button>
            </>
          ) : (
            <>
              {meta.nextPlan && (
                <a
                  href="/billing"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
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

      {/* Griglia */}
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
