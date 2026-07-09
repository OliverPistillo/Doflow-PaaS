"use client";

import { useEffect, useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { reportsApi, type KpiTarget } from "@/lib/tenant-reports-api";
import { canViewFinance, formatNumber } from "./report-utils";
import { Empty, ErrorBox, Header, Loading, TargetsProgress } from "./reports-core";

const PERIODS = ["weekly", "monthly", "quarterly", "yearly"];

export function KpiTargetsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<KpiTarget[]>([]);
  const [executiveTargets, setExecutiveTargets] = useState<KpiTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KpiTarget | null>(null);
  const [form, setForm] = useState({ kpi_key: "", label: "", target_value: "", period: "monthly", applies_to_role: "", applies_to_user_id: "" });
  const canManage = canViewFinance();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [targetData, executive] = await Promise.all([
        reportsApi.targets({ limit: 100 }),
        reportsApi.executive().catch(() => null),
      ]);
      setItems(targetData.items || []);
      setExecutiveTargets(executive?.targets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore target KPI");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const startCreate = () => {
    setEditing(null);
    setForm({ kpi_key: "", label: "", target_value: "", period: "monthly", applies_to_role: "", applies_to_user_id: "" });
    setOpen(true);
  };
  const startEdit = (target: KpiTarget) => {
    setEditing(target);
    setForm({
      kpi_key: target.kpi_key || target.kpiKey || "",
      label: target.label || "",
      target_value: String(target.target_value ?? target.target ?? ""),
      period: target.period || "monthly",
      applies_to_role: target.applies_to_role || "",
      applies_to_user_id: target.applies_to_user_id || "",
    });
    setOpen(true);
  };
  const save = async () => {
    try {
      const body = { ...form, target_value: Number(form.target_value || 0) };
      if (editing) await reportsApi.updateTarget(editing.id, body);
      else await reportsApi.createTarget(body);
      setOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Target non salvato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };
  const remove = async (target: KpiTarget) => {
    if (!window.confirm(`Eliminare ${target.label}?`)) return;
    try {
      await reportsApi.deleteTarget(target.id);
      await load();
    } catch (err) {
      toast({ title: "Target non eliminato", description: err instanceof Error ? err.message : "Errore", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Header title="Obiettivi KPI" description="Target direzionali configurabili, collegati ai report reali." />
        {canManage ? <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Nuovo target</Button> : null}
      </div>
      <ErrorBox error={error} />
      {loading ? <Loading /> : (
        <>
          <TargetsProgress targets={executiveTargets} />
          {items.length === 0 ? <Empty>Nessun target configurato.</Empty> : (
            <div className="grid gap-3">
              {items.map((target) => (
                <Card key={target.id}>
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{target.label}</p>
                      <p className="text-sm text-muted-foreground">{target.kpi_key || target.kpiKey} · {target.period} · target {formatNumber(target.target_value ?? target.target)}</p>
                    </div>
                    {canManage ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(target)}><Edit2 className="mr-2 h-4 w-4" /> Modifica</Button><Button size="sm" variant="outline" onClick={() => remove(target)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifica target" : "Nuovo target"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>KPI key</Label><Input value={form.kpi_key} disabled={Boolean(editing)} onChange={(e) => setForm((p) => ({ ...p, kpi_key: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Label</Label><Input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Target</Label><Input type="number" value={form.target_value} onChange={(e) => setForm((p) => ({ ...p, target_value: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Periodo</Label><Select value={form.period} onValueChange={(value) => setForm((p) => ({ ...p, period: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PERIODS.map((period) => <SelectItem key={period} value={period}>{period}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Ruolo opzionale</Label><Input value={form.applies_to_role} onChange={(e) => setForm((p) => ({ ...p, applies_to_role: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>User ID opzionale</Label><Input value={form.applies_to_user_id} onChange={(e) => setForm((p) => ({ ...p, applies_to_user_id: e.target.value }))} /></div>
            <Button onClick={save} disabled={!form.kpi_key || !form.label}>{editing ? "Aggiorna" : "Crea"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

