"use client";

import { useEffect, useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { reportsApi, type ReportSnapshot } from "@/lib/tenant-reports-api";
import { formatDate, REPORT_LABELS, label } from "./report-utils";
import { Empty, ErrorBox, Header, JsonPreview, Loading } from "./reports-core";

const REPORTS = ["executive", "sales", "projects", "finance", "team", "documents", "operations", "customers"];

export function ReportSnapshotsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ReportSnapshot[]>([]);
  const [selected, setSelected] = useState<ReportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ report_key: "executive", title: "", date_from: "", date_to: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportsApi.snapshots({ limit: 100 });
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore snapshot");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    try {
      await reportsApi.createSnapshot(form);
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Snapshot non creato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const openSnapshot = async (snapshot: ReportSnapshot) => {
    try {
      setSelected(await reportsApi.snapshot(snapshot.id));
    } catch (err) {
      toast({ title: "Snapshot non aperto", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const remove = async (snapshot: ReportSnapshot) => {
    if (!window.confirm(`Eliminare ${snapshot.title}?`)) return;
    await reportsApi.deleteSnapshot(snapshot.id);
    await load();
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Header title="Snapshot report" description="Salvataggi manuali di report reali per confronti futuri." />
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nuovo snapshot</Button>
      </div>
      <ErrorBox error={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty>Nessuno snapshot salvato.</Empty> : (
        <div className="grid gap-3">
          {items.map((snapshot) => (
            <Card key={snapshot.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{snapshot.title}</p>
                  <p className="text-sm text-muted-foreground">{label(REPORT_LABELS, snapshot.report_key)} · {formatDate(snapshot.period_from)} - {formatDate(snapshot.period_to)} · {formatDate(snapshot.created_at)}</p>
                </div>
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openSnapshot(snapshot)}><Eye className="mr-2 h-4 w-4" /> Apri</Button><Button size="sm" variant="outline" onClick={() => remove(snapshot)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo snapshot</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Report</Label><Select value={form.report_key} onValueChange={(value) => setForm((p) => ({ ...p, report_key: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REPORTS.map((key) => <SelectItem key={key} value={key}>{label(REPORT_LABELS, key)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Titolo</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Da</Label><Input type="date" value={form.date_from} onChange={(e) => setForm((p) => ({ ...p, date_from: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>A</Label><Input type="date" value={form.date_to} onChange={(e) => setForm((p) => ({ ...p, date_to: e.target.value }))} /></div>
            <Button onClick={create}>Crea snapshot</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selected)} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{selected?.title}</DialogTitle></DialogHeader>
          <JsonPreview value={selected?.payload || selected} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

