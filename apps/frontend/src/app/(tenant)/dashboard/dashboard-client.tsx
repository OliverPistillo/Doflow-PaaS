"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Settings2, Pencil, Save, X, RotateCcw } from "lucide-react";
import { DashboardGrid, WidgetItem } from "@/components/dashboard/dashboard-grid";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_LAYOUT: WidgetItem[] = [
  { i: "stat_revenue", x: 0, y: 0, w: 1, h: 1, moduleKey: "stat_revenue" },
  { i: "stat_users",   x: 1, y: 0, w: 1, h: 1, moduleKey: "stat_users"   },
  { i: "stat_sales",   x: 2, y: 0, w: 1, h: 1, moduleKey: "stat_sales"   },
  { i: "chart_main",   x: 0, y: 1, w: 2, h: 2, moduleKey: "chart_overview"},
  { i: "stat_active",  x: 2, y: 1, w: 1, h: 1, moduleKey: "stat_active"  },
  { i: "list_sales",   x: 2, y: 2, w: 1, h: 1, moduleKey: "list_recent_sales" },
];

export default function DashboardClient() {
  const [layout, setLayout]                   = useState<WidgetItem[] | null>(null);
  const [isEditing, setIsEditing]             = useState(false);
  const [isSaving, setIsSaving]               = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    apiFetch<WidgetItem[]>("/tenant/dashboard")
      .then((data) => setLayout(data?.length ? data : DEFAULT_LAYOUT))
      .catch(() => setLayout(DEFAULT_LAYOUT));
  }, []);

  const handleSaveLayout = async () => {
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
      toast({ title: "Layout salvato", description: "La dashboard e stata aggiornata." });
    } catch {
      toast({ title: "Errore salvataggio", description: "Impossibile salvare.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmReset = () => {
    setLayout(DEFAULT_LAYOUT);
    setIsEditing(false);
    setShowResetDialog(false);
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

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ripristinare il layout originale?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutte le personalizzazioni andranno perse finche non salvi di nuovo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReset} className="bg-red-600 hover:bg-red-700 text-white">
              Ripristina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
          {isEditing && <p className="text-sm text-indigo-600 font-medium animate-pulse">Modalita modifica attiva</p>}
        </div>

        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" /> Annulla
              </Button>
              <Button size="sm" onClick={handleSaveLayout} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? "Salvataggio..." : "Salva Layout"}
              </Button>
            </>
          ) : (
            <>
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
                  <DropdownMenuItem onClick={() => setShowResetDialog(true)} className="text-red-600">
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
          <DashboardGrid layout={layout} isEditing={isEditing} onLayoutChange={setLayout} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
