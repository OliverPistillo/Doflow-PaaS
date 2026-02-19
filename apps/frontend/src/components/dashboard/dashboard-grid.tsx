"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import RGL from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { COMPONENT_MAP } from "./dashboard-widgets";
import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIDGET_DEFINITIONS, type WidgetId } from "@/lib/plans";

// ─── Costanti griglia ─────────────────────────────────────────────────────────
export const GRID_COLS       = 12;
export const GRID_ROW_HEIGHT = 80;
export const GRID_MARGIN: [number, number] = [16, 16];

// Cast as any per bypassare tipi difettosi di RGL v2
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = ((RGL as any).default ?? RGL) as any;

type RGLLayout = {
  i: string; x: number; y: number; w: number; h: number;
  minW?: number; maxW?: number; minH?: number; maxH?: number;
  static?: boolean;
};

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export type WidgetItem = {
  i:         string;
  x:         number;
  y:         number;
  w:         number;
  h:         number;
  moduleKey: string;
  minW?:     number;
  maxW?:     number;
  minH?:     number;
  maxH?:     number;
  static?:   boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DashboardGridProps {
  layout:         WidgetItem[];
  isEditing:      boolean;
  /** @ts-ignore */
  onLayoutChange: (layout: WidgetItem[]) => void;
  /** @ts-ignore */
  renderWidget?:  (moduleKey: string) => React.ReactNode;
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
  layout, isEditing, onLayoutChange, renderWidget,
}: DashboardGridProps) {
  const [mounted, setMounted]           = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef                    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const measure = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ⚠️  Propaga al parent SOLO durante edit — RGL chiama onLayoutChange
  // anche al mount e durante i resize di finestra.
  const handleRGLChange = useCallback(
    (currentLayout: readonly any[]) => {
      if (!mounted || !isEditing) return;
      const enriched = enrichWithConstraints(layout);
      const newLayout: WidgetItem[] = currentLayout.map((l) => {
        const orig = enriched.find((o) => o.i === l.i);
        return {
          i: l.i, x: l.x, y: l.y, w: l.w, h: l.h,
          moduleKey: orig?.moduleKey ?? l.i,
          minW: orig?.minW, maxW: orig?.maxW,
          minH: orig?.minH, maxH: orig?.maxH,
          static: orig?.static,
        };
      });
      onLayoutChange(newLayout);
    },
    [mounted, isEditing, layout, onLayoutChange],
  );

  if (!mounted || containerWidth === 0) {
    return (
      <div ref={containerRef}
        className="min-h-[500px] w-full bg-muted/30 rounded-xl animate-pulse flex items-center justify-center text-muted-foreground text-sm">
        Caricamento Dashboard…
      </div>
    );
  }

  const enrichedLayout = enrichWithConstraints(layout);

  const rglLayout: RGLLayout[] = enrichedLayout.map((item) => ({
    i: item.i, x: item.x, y: item.y, w: item.w, h: item.h,
    minW: item.minW, maxW: item.maxW,
    minH: item.minH, maxH: item.maxH,
    static: item.static ?? false,
  }));

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full transition-all duration-200",
        isEditing && "rounded-xl bg-muted/20 ring-2 ring-indigo-200 ring-offset-2 p-3",
      )}
    >
      <GridLayout
        width={containerWidth - (isEditing ? 24 : 0)}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        margin={GRID_MARGIN}
        layout={rglLayout}
        isDraggable={isEditing}
        isResizable={isEditing}
        draggableHandle=".drag-handle"
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms={true}
        onLayoutChange={handleRGLChange}
        // ── Stile maniglie resize (visibili solo in edit) ──────────
        resizeHandles={["se", "sw", "ne", "nw"]}
      >
        {enrichedLayout.map((item) => (
          <div
            key={item.i}
            className={cn(
              // ⚠️ NO overflow-hidden qui — taglia le maniglie di resize di RGL!
              "relative flex flex-col h-full",
              "bg-background border border-border rounded-xl",
              "transition-shadow duration-200",
              isEditing
                ? "shadow-lg ring-1 ring-indigo-300"
                : "hover:shadow-md hover:border-border/80",
            )}
          >
            {/* Handle drag — solo in edit mode */}
            {isEditing && (
              <div className="drag-handle h-7 flex-shrink-0 flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing select-none rounded-t-xl bg-indigo-50 border-b border-indigo-100 hover:bg-indigo-100 transition-colors">
                <GripHorizontal className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[10px] font-medium text-indigo-400 uppercase tracking-widest">trascina</span>
              </div>
            )}

            {/* Contenuto widget */}
            {/* 
              ⚠️ pointer-events-none solo al widget content (non all'intera cella)
              Questo blocca interazioni accidentali CON i grafici durante il drag
              ma NON impedisce alla maniglie RGL (che stanno FUORI da questo div) di funzionare
            */}
            <div className={cn(
              "flex-1 min-h-0 w-full overflow-hidden rounded-b-xl",
              // In edit: blocca click sui grafici ma lascia funzionare il resize
              isEditing && "pointer-events-none",
            )}>
              {renderWidget
                ? renderWidget(item.moduleKey)
                : (COMPONENT_MAP[item.moduleKey] ?? (
                  <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30 text-sm border-2 border-dashed rounded-lg m-2">
                    Widget: {item.moduleKey}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
