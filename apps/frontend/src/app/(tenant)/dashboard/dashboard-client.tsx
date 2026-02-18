"use client";

import { useEffect, useState } from "react";
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
import { DashboardGrid, WidgetItem } from "@/components/dashboard/dashboard-grid";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/contexts/PlanContext";
import { DEFAULT_LAYOUTS, WIDGET_DEFINITIONS, planIncludes, type WidgetId, type PlanTier } from "@/lib/plans";
import { LockedFeature } from "@/components/ui/locked-feature";
import { COMPONENT_MAP } from "@/components/dashboard/dashboard-widgets";
import { cn } from "@/lib/utils";

// ─── Converte LayoutItem → WidgetItem (tipo DashboardGrid) ───────────────────

function planLayoutToWidgetItems(plan: PlanTier): WidgetItem[] {
  return DEFAULT_LAYOUTS[plan].map((item) => ({
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
  const def = WIDGET_DEFINITIONS[moduleKey as WidgetId];
  const component = COMPONENT_MAP[moduleKey];

  if (!component) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Widget non trovato
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
  activePlan:  PlanTier;
  currentIds:  string[];
  onAdd:       (id: WidgetId) => void;
}) {
  const available = Object.values(WIDGET_DEFINITIONS).filter(
    (d) => !currentIds.includes(d.id),
  );

  if (available.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Tutti i widget sono già nella dashboard.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1">
      {available.map((def) => {
        const locked = !planIncludes(activePlan, def.minPlan);
        return (
          <button
            key={def.id}
            disabled={locked}
            onClick={() => onAdd(def.id)}
            className={cn(
              "text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
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
  const [layout, setLayout]           = useState<WidgetItem[] | null>(null);
  const [isEditing, setIsEditing]     = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [showReset, setShowReset]     = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const { toast } = useToast();

  // Carica layout salvato, fallback al default del piano
  useEffect(() => {
    apiFetch<WidgetItem[]>("/tenant/dashboard")
      .then((data) => setLayout(data?.length ? data : planLayoutToWidgetItems(plan)))
      .catch(() => setLayout(planLayoutToWidgetItems(plan)));
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
      toast({ title: "Layout salvato", description: "La dashboard è stata aggiornata." });
    } catch {
      toast({ title: "Errore salvataggio", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLayout(planLayoutToWidgetItems(plan));
    setIsEditing(false);
    setShowReset(false);
    toast({ title: "Layout ripristinato" });
  };

  const handleAddWidget = (id: WidgetId) => {
    const def = WIDGET_DEFINITIONS[id];
    if (!def) return;
    setLayout((prev) => [
      ...(prev ?? []),
      {
        i:         id,
        x:         0,
        y:         Infinity, // react-grid-layout posiziona in fondo
        w:         def.defaultW,
        h:         def.defaultH,
        moduleKey: id,
      },
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
    <div className="flex-1 space-y-4 p-6 md:p-8 pt-6 animate-in fade-in duration-500">

      {/* Dialog reset */}
      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ripristinare il layout {meta.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutte le personalizzazioni andranno perse. Verrà ripristinato il layout di default per il piano {meta.label}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white">
              Ripristina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          {isEditing && (
            <p className="text-sm text-indigo-600 font-medium animate-pulse">
              Modalità modifica — trascina i widget per riorganizzarli
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
                    <Plus className="mr-2 h-4 w-4" /> Aggiungi Widget
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-3">
                  <DropdownMenuLabel className="mb-2">Widget disponibili</DropdownMenuLabel>
                  <AddWidgetPanel
                    activePlan={plan}
                    currentIds={layout.map((l) => l.i)}
                    onAdd={handleAddWidget}
                  />
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                <X className="mr-1.5 h-4 w-4" /> Annulla
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {isSaving ? "Salvataggio..." : "Salva"}
              </Button>
            </>
          ) : (
            <>
              {/* Link upgrade se non Enterprise */}
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
                  <Button variant="outline" size="icon"><Settings2 className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Opzioni Vista</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Personalizza Layout
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowReset(true)} className="text-red-600">
                    <RotateCcw className="mr-2 h-4 w-4" /> Ripristina Default
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
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
