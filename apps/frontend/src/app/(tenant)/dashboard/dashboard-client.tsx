"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Plus, Loader2 } from "lucide-react";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_LAYOUT = [
  { i: "stat_revenue", x: 0, y: 0, w: 1, h: 1.3, moduleKey: "stat_revenue" },
  { i: "stat_users", x: 1, y: 0, w: 1, h: 1.3, moduleKey: "stat_users" },
  { i: "stat_sales", x: 2, y: 0, w: 1, h: 1.3, moduleKey: "stat_sales" },
  { i: "stat_active", x: 3, y: 0, w: 1, h: 1.3, moduleKey: "stat_active" },
  { i: "chart_main", x: 0, y: 1, w: 2, h: 4, moduleKey: "chart_overview" },
  { i: "list_sales", x: 2, y: 1, w: 2, h: 4, moduleKey: "list_recent_sales" },
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
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
             <Download className="mr-2 h-4 w-4" /> Download
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
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