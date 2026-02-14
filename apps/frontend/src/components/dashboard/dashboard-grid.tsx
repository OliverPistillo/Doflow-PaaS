"use client";

import React, { useState, useEffect } from "react";
// 1. IMPORTA SOLO IL DEFAULT (Evita l'errore ts(2614) sui named exports)
import RGL from "react-grid-layout";

// CSS necessari
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { COMPONENT_MAP } from "./dashboard-widgets";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// 2. ESTRAZIONE MANUALE (Bypassiamo TypeScript con 'any')
// Questo codice controlla se la libreria è stata caricata come modulo ES6 o CommonJS
// e recupera i componenti necessari senza che TS si lamenti.
const ReactGridLayout = RGL as any;
const Responsive = ReactGridLayout.Responsive || ReactGridLayout.default?.Responsive || ReactGridLayout;
const WidthProvider = ReactGridLayout.WidthProvider || ReactGridLayout.default?.WidthProvider;

// 3. CREAZIONE COMPONENTE SICURA
// Se WidthProvider esiste, lo usiamo. Altrimenti usiamo Responsive liscio (fallback).
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
    toast({ title: "Layout Salvato", description: "La tua dashboard è stata aggiornata." });
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
      <div className="flex justify-end items-center gap-2">
        {isEditing ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4 mr-2" /> Annulla
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4 mr-2" /> Salva Modifiche
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Personalizza Dashboard
          </Button>
        )}
      </div>

      {/* GRID */}
      <div className={cn(
        "min-h-[500px] transition-all rounded-xl",
        isEditing && "bg-slate-50 border-2 border-dashed border-slate-300 p-4"
      )}>
        <ResponsiveGrid
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 4, md: 4, sm: 2, xs: 1, xxs: 1 }}
          rowHeight={100}
          isDraggable={isEditing}
          isResizable={isEditing}
          draggableHandle=".drag-handle"
          onLayoutChange={handleLayoutChange}
          margin={[16, 16]}
          // Importante: useCSSTransforms true solo dopo il mount
          useCSSTransforms={mounted}
        >
          {layout.map((item) => (
            <div key={item.i} className="relative group h-full">
              <div className="h-full w-full overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md flex flex-col">
                {isEditing && (
                  <div className="drag-handle absolute top-2 right-2 z-50 cursor-grab active:cursor-grabbing p-1.5 bg-white/90 backdrop-blur rounded-md shadow-sm border hover:bg-slate-100 text-slate-500">
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 w-full overflow-hidden">
                    {COMPONENT_MAP[item.moduleKey] || (
                        <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 text-sm">
                            Widget non trovato: {item.moduleKey}
                        </div>
                    )}
                </div>
              </div>
            </div>
          ))}
        </ResponsiveGrid>
      </div>
    </div>
  );
}