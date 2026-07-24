"use client";

import { useEffect, useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { reportsApi, type ReportSavedView } from "@/lib/tenant-reports-api";
import { formatDate, REPORT_LABELS, label } from "./report-utils";
import { Empty, ErrorBox, Header, Loading } from "./reports-core";

const REPORTS = ["executive", "sales", "projects", "finance", "team", "documents", "operations", "customers"];
const VISIBILITIES = ["private", "team", "management"];

export function SavedViewsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ReportSavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReportSavedView | null>(null);
  const [form, setForm] = useState({ name: "", description: "", report_key: "executive", visibility: "private", filters: "{}" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportsApi.savedViews({ limit: 100 });
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore viste salvate");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const startCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", report_key: "executive", visibility: "private", filters: "{}" });
    setOpen(true);
  };
  const startEdit = (view: ReportSavedView) => {
    setEditing(view);
    setForm({
      name: view.name,
      description: view.description || "",
      report_key: view.report_key,
      visibility: view.visibility || "private",
      filters: JSON.stringify(view.filters || {}, null, 2),
    });
    setOpen(true);
  };
  const save = async () => {
    try {
      const body = { ...form, filters: JSON.parse(form.filters || "{}") };
      if (editing) await reportsApi.updateSavedView(editing.id, body);
      else await reportsApi.createSavedView(body);
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Vista non salvata", description: err instanceof Error ? err.message : "JSON filtri non valido", variant: "destructive" });
    }
  };
  const remove = async (view: ReportSavedView) => {
    if (!window.confirm(`Eliminare ${view.name}?`)) return;
    await reportsApi.deleteSavedView(view.id);
    await load();
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Header title="Viste salvate" description="Filtri e viste ricorrenti per i report interni." />
        <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Nuova vista</Button>
      </div>
      <ErrorBox error={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty>Nessuna vista salvata.</Empty> : (
        <div className="grid gap-3">
          {items.map((view) => (
            <Card key={view.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{view.name}</p>
                  <p className="text-sm text-muted-foreground">{label(REPORT_LABELS, view.report_key)} · {view.visibility} · {formatDate(view.updated_at || view.created_at)}</p>
                  {view.description ? <p className="mt-1 text-sm">{view.description}</p> : null}
                </div>
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(view)}><Edit2 className="mr-2 h-4 w-4" /> Modifica</Button><Button size="sm" variant="outline" onClick={() => remove(view)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifica vista" : "Nuova vista"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Descrizione</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Report</Label><Select value={form.report_key} onValueChange={(value) => setForm((p) => ({ ...p, report_key: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REPORTS.map((key) => <SelectItem key={key} value={key}>{label(REPORT_LABELS, key)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Visibilità</Label><Select value={form.visibility} onValueChange={(value) => setForm((p) => ({ ...p, visibility: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VISIBILITIES.map((key) => <SelectItem key={key} value={key}>{key}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Filtri JSON</Label><Textarea rows={7} value={form.filters} onChange={(e) => setForm((p) => ({ ...p, filters: e.target.value }))} /></div>
            <Button onClick={save} disabled={!form.name}>{editing ? "Aggiorna" : "Crea"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

