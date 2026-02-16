"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Plus, Loader2 } from "lucide-react";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// --- LAYOUT STANDARD A 3 COLONNE ---
// w: 1 = 1/3 di pagina
// w: 2 = 2/3 di pagina
// w: 3 = Tutta la larghezza
const DEFAULT_LAYOUT = [
  // Riga 1: Tre KPI (Revenue, Users, Sales)
  { i: "stat_revenue", x: 0, y: 0, w: 1, h: 1, moduleKey: "stat_revenue" },
  { i: "stat_users",   x: 1, y: 0, w: 1, h: 1, moduleKey: "stat_users" },
  { i: "stat_sales",   x: 2, y: 0, w: 1, h: 1, moduleKey: "stat_sales" },
  
  // Riga 2: Grafico Grande (2/3) + Statistica Attivi (1/3)
  { i: "chart_main",   x: 0, y: 1, w: 2, h: 2, moduleKey: "chart_overview" },
  { i: "stat_active",  x: 2, y: 1, w: 1, h: 1, moduleKey: "stat_active" },
  
  // Riga 2 (continua sotto stat_active): Lista vendite (1/3)
  { i: "list_sales",   x: 2, y: 2, w: 1, h: 1, moduleKey: "list_recent_sales" },
];

export default function DashboardClient() {
  const [layout, setLayout] = useState<any[] | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLayout = async () => {
      try {
        const data = await apiFetch<any[]>("/tenant/dashboard");
        if (data && data.length > 0) {
          setLayout(data);
        } else {
          setLayout(DEFAULT_LAYOUT);
        }
      } catch (e) {
        console.error("Errore caricamento dashboard:", e);
        setLayout(DEFAULT_LAYOUT);
      }
    };
    fetchLayout();
  }, []);

  const handleSaveLayout = async (newLayout: any[]) => {
    try {
      const payload = newLayout.map(item => ({
        i: item.i,
        moduleKey: item.moduleKey,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h
      }));

      await apiFetch("/tenant/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: payload }),
      });

      setLayout(newLayout);
    } catch (e) {
      toast({ 
        title: "Errore salvataggio", 
        description: "Impossibile salvare la posizione dei widget.", 
        variant: "destructive" 
      });
    }
  };

  if (!layout) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
             <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
             <Plus className="mr-2 h-4 w-4" /> Nuovo Ordine
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="analytics">Analisi</TabsTrigger>
          <TabsTrigger value="reports">Report</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
           <DashboardGrid 
              initialLayout={layout} 
              onSave={handleSaveLayout} 
           />
        </TabsContent>
      </Tabs>
    </div>
  );
}