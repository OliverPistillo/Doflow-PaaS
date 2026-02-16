"use client";

import React, { useState, useEffect } from "react";
// 1. IMPORTA SOLO IL DEFAULT (Evita l'errore ts(2614) sui named exports)
import RGL from "react-grid-layout";

// CSS necessari
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { COMPONENT_MAP } from "./dashboard-widgets";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X, GripHorizontal } from "lucide-react"; 
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// 2. ESTRAZIONE MANUALE (Bypassiamo TypeScript con 'any')
const ReactGridLayout = RGL as any;
const Responsive = ReactGridLayout.Responsive || ReactGridLayout.default?.Responsive || ReactGridLayout;
const WidthProvider = ReactGridLayout.WidthProvider || ReactGridLayout.default?.WidthProvider;

// 3. CREAZIONE COMPONENTE SICURA
const ResponsiveGrid = WidthProvider ? WidthProvider(Responsive) : Responsive;

// Definiamo il tipo manualmente perché non possiamo importarlo
export type WidgetItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  moduleKey: string;
  static?: boolean;
};

interface DashboardGridProps {
  layout: WidgetItem[]; // CAMBIATO DA initialLayout A layout
  isEditing: boolean;   // AGGIUNTO
  onLayoutChange: (layout: WidgetItem[]) => void; // AGGIUNTO
}

export function DashboardGrid({ layout, isEditing, onLayoutChange }: DashboardGridProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRGLChange = (currentLayout: any) => {
    if (!mounted) return;
    const newLayout: WidgetItem[] = currentLayout.map((l: any) => {
      // Cerchiamo l'elemento originale per mantenere moduleKey e static
      const original = layout.find((o) => o.i === l.i);
      return {
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        moduleKey: original?.moduleKey || "unknown",
        static: original?.static
      };
    });
    onLayoutChange(newLayout);
  };

  // Preveniamo il rendering lato server per evitare errori di idratazione con RGL
  if (!mounted) {
    return <div className="min-h-[500px] w-full bg-slate-50/50 rounded-xl animate-pulse flex items-center justify-center text-slate-400">Caricamento Dashboard...</div>;
  }

  return (
    <div className={cn(
      "min-h-[600px] transition-all rounded-xl",
      isEditing && "bg-slate-50/50 ring-2 ring-indigo-100 ring-offset-2 p-4"
    )}>
      <ResponsiveGrid
        className="layout"
        layouts={{ lg: layout }}
        
        // --- CONFIGURAZIONE "ODOO-STYLE" ---
        // 1. Tre colonne su desktop (lg, md)
        // 2. Una colonna su mobile (xs, xxs) -> Stack verticale forzato
        cols={{ lg: 3, md: 3, sm: 2, xs: 1, xxs: 1 }}
        
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        
        // Altezza riga standardizzata (es. 140px per blocco)
        rowHeight={140}
        
        // Margini puliti
        margin={[24, 24]}
        
        isDraggable={isEditing}
        isResizable={isEditing}
        draggableHandle=".drag-handle"
        
        onLayoutChange={handleRGLChange}
        useCSSTransforms={mounted}
        
        // --- VINCOLI DI MOVIMENTO ---
        // I widget "galleggiano" verso l'alto per riempire i buchi (stile Tetris/Odoo)
        compactType="vertical" 
        preventCollision={false}
      >
        {layout.map((item) => (
          <div key={item.i} className={cn(
              "relative group flex flex-col h-full rounded-xl overflow-hidden transition-shadow duration-200 bg-white border border-slate-200",
              isEditing ? "shadow-lg ring-1 ring-indigo-200" : "hover:shadow-sm"
          )}>
            {isEditing && (
              <div className="drag-handle h-6 bg-indigo-50 border-b border-indigo-100 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-indigo-100 transition-colors z-50">
                <GripHorizontal className="h-4 w-4 text-indigo-400" />
              </div>
            )}
            
            <div className="flex-1 w-full overflow-hidden relative">
                {COMPONENT_MAP[item.moduleKey] || (
                    <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 text-sm border-2 border-dashed">
                        Widget: {item.moduleKey}
                    </div>
                )}
                {/* Overlay per bloccare i click sui grafici durante l'edit */}
                {isEditing && <div className="absolute inset-0 z-10 bg-transparent" />}
            </div>
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  );
}