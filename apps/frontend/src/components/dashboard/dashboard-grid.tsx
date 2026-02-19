"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import RGL from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { COMPONENT_MAP } from "./dashboard-widgets";
import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIDGET_DEFINITIONS, type WidgetId } from "@/lib/plans";

// react-grid-layout ha tipi difettosi nelle versioni recenti — usiamo cast esplicito
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = ((RGL as any).default ?? RGL) as any;

type RGLLayout = {
  i: string; x: number; y: number; w: number; h: number;
  minW?: number; maxW?: number; minH?: number; maxH?: number;
  static?: boolean;
};

// ─── Costanti griglia ─────────────────────────────────────────────────────────
//  12 colonne — stessa logica di Bootstrap/Material
//  rowHeight 80px → h=2 (160px) per KPI, h=5 (400px) per grafici
export const GRID_COLS       = 12;
export const GRID_ROW_HEIGHT = 80;
export const GRID_MARGIN: [number, number] = [16, 16];

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type WidgetItem = {
  i:         string;
  x:         number;
  y:         number;
  w:         number;
  h:         number;
  moduleKey: string;
  // Vincoli — passati direttamente a react-grid-layout
  minW?:     number;
  maxW?:     number;
  minH?:     number;
  maxH?:     number;
  static?:   boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DashboardGridProps {
  layout:          WidgetItem[];
  isEditing:       boolean;
  /** @ts-ignore TS71007 — funzioni tra Client Components sono valide a runtime */
  onLayoutChange:  (layout: WidgetItem[]) => void;
  /** @ts-ignore TS71007 */
  renderWidget?:   (moduleKey: string) => React.ReactNode;
}

// ─── Arricchisce ogni item con i vincoli dalla definizione widget ─────────────

function enrichWithConstraints(items: WidgetItem[]): WidgetItem[] {
  return items.map((item) => {
    const def = WIDGET_DEFINITIONS[item.moduleKey as WidgetId];
    if (!def) return item;
    return {
      ...item,
      minW: item.minW ?? def.minW,
      maxW: item.maxW ?? def.maxW,
      minH: item.minH ?? def.minH,
      maxH: item.maxH ?? def.maxH,
    };
  });
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function DashboardGrid({
  layout,
  isEditing,
  onLayoutChange,
  renderWidget,
}: DashboardGridProps) {
  const [mounted, setMounted]           = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef                    = useRef<HTMLDivElement>(null);

  // Misura larghezza reale del contenitore
  useEffect(() => {
    setMounted(true);
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ⚠️  SOLO in modalità editing propaghiamo i cambiamenti al parent.
  //     RGL chiama onLayoutChange anche durante il mount iniziale
  //     e durante i breakpoint change — quelle chiamate NON devono
  //     sovrascrivere il layout caricato dall'API.
  // eslint-disable-next-line @typescript-eslint/ban-types
  const handleRGLChange = useCallback(
    (currentLayout: readonly any[]) => {
      if (!mounted || !isEditing) return;

      const enriched = enrichWithConstraints(layout);
      const newLayout: WidgetItem[] = currentLayout.map((l) => {
        const original = enriched.find((o) => o.i === l.i);
        return {
          i:         l.i,
          x:         l.x,
          y:         l.y,
          w:         l.w,
          h:         l.h,
          moduleKey: original?.moduleKey ?? l.i,
          minW:      original?.minW,
          maxW:      original?.maxW,
          minH:      original?.minH,
          maxH:      original?.maxH,
          static:    original?.static,
        };
      });
      onLayoutChange(newLayout);
    },
    [mounted, isEditing, layout, onLayoutChange],
  );

  if (!mounted || containerWidth === 0) {
    return (
      <div
        ref={containerRef}
        className="min-h-[500px] w-full bg-slate-50/50 rounded-xl animate-pulse flex items-center justify-center text-slate-400"
      >
        Caricamento Dashboard…
      </div>
    );
  }

  const enrichedLayout = enrichWithConstraints(layout);

  // Converte WidgetItem → Layout di react-grid-layout (include vincoli)
  const rglLayout: RGLLayout[] = enrichedLayout.map((item) => ({
    i:      item.i,
    x:      item.x,
    y:      item.y,
    w:      item.w,
    h:      item.h,
    minW:   item.minW,
    maxW:   item.maxW,
    minH:   item.minH,
    maxH:   item.maxH,
    static: item.static ?? false,
  }));

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full transition-all rounded-xl",
        isEditing && "bg-slate-50/50 ring-2 ring-indigo-100 ring-offset-2 p-3",
      )}
    >
      <GridLayout
        // Dimensioni
        width={containerWidth - (isEditing ? 24 : 0)}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        margin={GRID_MARGIN}

        // Layout
        layout={rglLayout}

        // Comportamento drag/resize
        isDraggable={isEditing}
        isResizable={isEditing}
        draggableHandle=".drag-handle"

        // Compattamento verticale stile Odoo:
        // i widget "cadono" verso l'alto se c'è spazio libero
        compactType="vertical"
        preventCollision={false}

        // Animazioni fluide
        useCSSTransforms={true}

        onLayoutChange={handleRGLChange}
      >
        {enrichedLayout.map((item) => (
          <div
            key={item.i}
            className={cn(
              "relative flex flex-col h-full rounded-xl overflow-hidden",
              "bg-white border border-slate-200 transition-shadow duration-200",
              isEditing
                ? "shadow-lg ring-1 ring-indigo-200"
                : "hover:shadow-sm",
            )}
          >
            {/* Handle drag — visibile solo in edit mode */}
            {isEditing && (
              <div className="drag-handle h-7 flex-shrink-0 bg-indigo-50 border-b border-indigo-100 flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing hover:bg-indigo-100 transition-colors select-none">
                <GripHorizontal className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] text-indigo-400 font-medium uppercase tracking-wide">
                  trascina
                </span>
              </div>
            )}

            {/* Contenuto widget */}
            <div className="flex-1 min-h-0 w-full overflow-hidden relative">
              {renderWidget
                ? renderWidget(item.moduleKey)
                : (COMPONENT_MAP[item.moduleKey] ?? (
                  <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 text-sm border-2 border-dashed">
                    Widget: {item.moduleKey}
                  </div>
                ))}

              {/* Overlay trasparente durante edit: blocca click accidentali sui grafici */}
              {isEditing && (
                <div className="absolute inset-0 z-10 cursor-move" />
              )}
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
