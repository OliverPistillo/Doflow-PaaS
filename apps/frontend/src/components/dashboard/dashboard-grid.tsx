"use client";

import React, { useState, useEffect } from "react";
// 1. IMPORTA SOLO IL DEFAULT (Evita l'errore ts(2614) sui named exports)
import RGL from "react-grid-layout";

// CSS necessari
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { COMPONENT_MAP } from "./dashboard-widgets";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X, GripHorizontal } from "lucide-react"; // GripHorizontal è più "Odoo" per le header
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
  initialLayout: WidgetItem[];
  onSave: (layout: WidgetItem[]) => void;
}

export function DashboardGrid({ initialLayout, onSave }: DashboardGridProps) {
  const [mounted, setMounted] = useState(false);
  const [layout, setLayout] = useState<WidgetItem[]>(initialLayout || []);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    if (initialLayout && initialLayout.length > 0) {
      setLayout(initialLayout);
    }
  }, [initialLayout]);

  const handleSave = () => {
    onSave(layout);
    setIsEditing(false);
    toast({ title: "Layout Salvato", description: "La configurazione della dashboard è stata aggiornata." });
  };

  const handleLayoutChange = (currentLayout: any) => {
    if (!mounted) return;
    const newLayout: WidgetItem[] = currentLayout.map((l: any) => {
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
    setLayout(newLayout);
  };

  // Preveniamo il rendering lato server per evitare errori di idratazione con RGL
  if (!mounted) {
    return <div className="min-h-[500px] w-full bg-slate-50/50 rounded-xl animate-pulse flex items-center justify-center text-slate-400">Caricamento Dashboard...</div>;
  }

  return (
    <div className="space-y-4">
      {/* TOOLBAR */}
      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
        <div className="text-sm font-medium text-slate-500 pl-2">
            {isEditing ? "Modalità Modifica: Trascina i blocchi per riordinarli" : "Panoramica"}
        </div>
        <div className="flex items-center gap-2">
            {isEditing ? (
            <>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-2" /> Annulla
                </Button>
                <Button size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                    <Save className="h-4 w-4 mr-2" /> Salva Layout
                </Button>
            </>
            ) : (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Personalizza
            </Button>
            )}
        </div>
      </div>

      {/* GRID */}
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
          
          onLayoutChange={handleLayoutChange}
          useCSSTransforms={mounted}
          
          // --- VINCOLI DI MOVIMENTO ---
          // I widget "galleggiano" verso l'alto per riempire i buchi (stile Tetris/Odoo)
          compactType="vertical" 
          preventCollision={false}
        >
          {layout.map((item) => (
            <div key={item.i} className={cn(
                "relative group flex flex-col h-full rounded-xl overflow-hidden transition-shadow duration-200",
                isEditing ? "shadow-lg ring-1 ring-indigo-200 bg-white" : "",
                !isEditing && "hover:shadow-sm"
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
    </div>
  );
}