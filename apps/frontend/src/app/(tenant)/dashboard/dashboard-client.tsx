"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Plus, Loader2, Settings2, Pencil, Save, X, RotateCcw } from "lucide-react";
import { DashboardGrid, WidgetItem } from "@/components/dashboard/dashboard-grid";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// --- LAYOUT STANDARD A 3 COLONNE ---
const DEFAULT_LAYOUT: WidgetItem[] = [
  { i: "stat_revenue", x: 0, y: 0, w: 1, h: 1, moduleKey: "stat_revenue" },
  { i: "stat_users",   x: 1, y: 0, w: 1, h: 1, moduleKey: "stat_users" },
  { i: "stat_sales",   x: 2, y: 0, w: 1, h: 1, moduleKey: "stat_sales" },
  { i: "chart_main",   x: 0, y: 1, w: 2, h: 2, moduleKey: "chart_overview" },
  { i: "stat_active",  x: 2, y: 1, w: 1, h: 1, moduleKey: "stat_active" },
  { i: "list_sales",   x: 2, y: 2, w: 1, h: 1, moduleKey: "list_recent_sales" },
];

export default function DashboardClient() {
  // Usiamo WidgetItem[] per tipizzare correttamente lo stato
  const [layout, setLayout] = useState<WidgetItem[] | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLayout = async () => {
      try {
        const data = await apiFetch<WidgetItem[]>("/tenant/dashboard");
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

  const handleSaveLayout = async () => {
    if (!layout) return;
    try {
      const payload = layout.map(item => ({
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

      setIsEditing(false);
      toast({ title: "Layout salvato", description: "La dashboard è stata aggiornata." });
    } catch (e) {
      toast({ 
        title: "Errore salvataggio", 
        description: "Impossibile salvare la configurazione.", 
        variant: "destructive" 
      });
    }
  };

  const handleReset = () => {
      if(confirm("Vuoi ripristinare il layout originale?")) {
          setLayout(DEFAULT_LAYOUT);
          setIsEditing(false);
          // Opzionale: salva subito il reset o lascia che l'utente salvi
      }
  }

  // Wrapper per gestire il set state tipizzato
  const handleLayoutUpdate = (newLayout: WidgetItem[]) => {
      setLayout(newLayout);
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
      
      {/* HEADER */}
      <div className="flex items-center justify-between space-y-2">
        <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
            {isEditing && <p className="text-sm text-indigo-600 font-medium animate-pulse">Modalità modifica attiva</p>}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Pulsanti visibili solo in EDIT MODE */}
          {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="mr-2 h-4 w-4" /> Annulla
                </Button>
                <Button size="sm" onClick={handleSaveLayout} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save className="mr-2 h-4 w-4" /> Salva Layout
                </Button>
              </>
          ) : (
              <>
                {/* MENU OPZIONI */}
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
                        <DropdownMenuItem onClick={handleReset} className="text-red-600">
                            <RotateCcw className="mr-2 h-4 w-4" /> Ripristina Default
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Nuovo Ordine
                </Button>
              </>
          )}
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
              layout={layout} 
              isEditing={isEditing}
              onLayoutChange={handleLayoutUpdate} 
           />
        </TabsContent>
      </Tabs>
    </div>
  );
}