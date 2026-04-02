// apps/frontend/src/app/superadmin/sales/pipeline/page.tsx
// Self-contained: STAGE_CONFIG, formatCurrency e DealEditForm sono definiti
// direttamente in questo file per evitare qualsiasi problema di module resolution
// cross-folder con Next.js App Router.

"use client";

import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Filter,
  MoreHorizontal,
  Calendar,
  Loader2,
  Trash2,
  Edit,
  Save,
  X,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch }    from "@/lib/api";
import { useConfirm }  from "@/hooks/useConfirm";

// ─── Utils (self-contained — identici a sales/dashboard/utils.ts) ────────────

const STAGE_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  "Lead qualificato":   { label: "Lead qualificato",   color: "#3b82f6", badgeClass: "bg-blue-50 text-blue-700 border-blue-200"     },
  "Preventivo inviato": { label: "Preventivo inviato", color: "#eab308", badgeClass: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  "Negoziazione":       { label: "Negoziazione",       color: "#06b6d4", badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200"       },
  "Chiuso vinto":       { label: "Chiuso vinto",       color: "#10b981", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Chiuso perso":       { label: "Chiuso perso",       color: "#ef4444", badgeClass: "bg-red-50 text-red-700 border-red-200"          },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value ?? 0);

// ─── Types ────────────────────────────────────────────────────────────────────

type Deal = {
  id:                 string;
  name:               string;
  clientName:         string;
  value:              number;
  stage:              string;
  winProbability:     number;
  expectedCloseDate:  string;
};

type StageGroup = {
  id:        string;
  label:     string;
  color:     string;
  badgeClass:string;
  items:     Deal[];
};

const ORDERED_STAGES = [
  "Lead qualificato",
  "Preventivo inviato",
  "Negoziazione",
  "Chiuso vinto",
];

// ─── DealEditForm (self-contained — identico a sales/dashboard/components/DealEditForm.tsx) ──

interface DealEditFormProps {
  deal:      Deal;
  onSave:    () => void;
  onCancel:  () => void;
}

function DealEditForm({ deal, onSave, onCancel }: DealEditFormProps) {
  const [formData, setFormData] = useState({
    title:             deal.name,
    clientName:        deal.clientName,
    value:             deal.value,
    stage:             deal.stage,
    winProbability:    deal.winProbability * 100,
    expectedCloseDate: deal.expectedCloseDate
      ? new Date(deal.expectedCloseDate).toISOString().split("T")[0]
      : "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (deal.id) {
        await apiFetch(`/superadmin/dashboard/deals/${deal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, winProbability: formData.winProbability / 100 }),
        });
      } else {
        await apiFetch(`/superadmin/dashboard/deals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, winProbability: formData.winProbability / 100 }),
        });
      }
      onSave();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      alert("Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 px-1">
      <div className="flex items-center justify-between border-b pb-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {formData.title || "Nuova Offerta"}
          </h2>
          {deal.id && (
            <p className="text-xs text-muted-foreground">ID: {deal.id}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-2">
          <Label>Nome offerta</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label>Stato trattativa</Label>
          <Select
            value={formData.stage}
            onValueChange={(val) => setFormData({ ...formData, stage: val })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(STAGE_CONFIG).map((stageKey) => (
                <SelectItem key={stageKey} value={stageKey}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: STAGE_CONFIG[stageKey].color }}
                    />
                    {stageKey}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Valore (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.value}
              onChange={(e) =>
                setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Probabilità (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.winProbability}
              onChange={(e) =>
                setFormData({ ...formData, winProbability: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Data chiusura prevista</Label>
            <Input
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) =>
                setFormData({ ...formData, expectedCloseDate: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <Input
              value={formData.clientName}
              onChange={(e) =>
                setFormData({ ...formData, clientName: e.target.value })
              }
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-2 border-t mt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annulla
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Salva
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── PipelinePage ─────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const { ConfirmDialog, confirm } = useConfirm();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "Lead qualificato":   true,
    "Preventivo inviato": true,
    "Negoziazione":       true,
    "Chiuso vinto":       true,
  });

  const loadDeals = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Deal[]>(
        "/superadmin/dashboard/deals?sortBy=expectedCloseDate&sortOrder=ASC"
      );
      setDeals(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error("Errore caricamento pipeline:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDeals(); }, []);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title:        "Eliminare questa offerta?",
      description:  "L'operazione è irreversibile.",
      confirmLabel: "Elimina",
      variant:      "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch(`/superadmin/dashboard/deals/${id}`, { method: "DELETE" });
      loadDeals();
    } catch (e) {
      console.error(e);
      alert("Errore durante l'eliminazione");
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setSheetOpen(true);
  };

  const handleCreateNew = (stage = "Lead qualificato") => {
    setEditingDeal({
      id: "", name: "", clientName: "", value: 0,
      stage, winProbability: 0.1,
      expectedCloseDate: new Date().toISOString().split("T")[0],
    });
    setSheetOpen(true);
  };

  const groupedStages: StageGroup[] = ORDERED_STAGES.map((stageKey) => {
    const cfg = STAGE_CONFIG[stageKey] ?? { label: stageKey, color: "#ccc", badgeClass: "bg-gray-100" };
    return {
      id:         stageKey,
      label:      cfg.label,
      color:      cfg.color,
      badgeClass: cfg.badgeClass,
      items:      deals.filter((d) => d.stage === stageKey),
    };
  });

  return (
    <div className="dashboard-content animate-fadeIn">
      <ConfirmDialog />

      {/* Action bar */}
      <div className="flex justify-end gap-2 mb-6">
        <Button variant="outline" size="sm" onClick={loadDeals} disabled={loading}>
          <Filter className="h-4 w-4 mr-2" />
          {loading ? "Caricamento…" : "Aggiorna"}
        </Button>
        <Button size="sm" onClick={() => handleCreateNew()}>
          <Plus className="h-4 w-4 mr-2" /> Nuova Offerta
        </Button>
      </div>

      {loading && deals.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {groupedStages.map((stage) => (
            <div key={stage.id} className="space-y-2">

              {/* Header fase */}
              <div
                className="flex items-center gap-2 cursor-pointer select-none py-1"
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [stage.id]: !prev[stage.id] }))
                }
              >
                <div className="p-1 rounded-md hover:bg-muted transition-colors">
                  {expanded[stage.id]
                    ? <ChevronDown  className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
                <Badge
                  variant="outline"
                  className={`px-2 py-1 text-xs font-semibold rounded-md border-0 ${stage.badgeClass}`}
                >
                  {stage.label}
                </Badge>
                <span className="text-xs text-muted-foreground ml-1">
                  {stage.items.length} {stage.items.length === 1 ? "offerta" : "offerte"}
                </span>
                {stage.items.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-2 border-l pl-3">
                    Tot: {formatCurrency(stage.items.reduce((a, i) => a + i.value, 0))}
                  </span>
                )}
              </div>

              {/* Tabella fase */}
              {expanded[stage.id] && (
                <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
                  {stage.items.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground italic text-center bg-muted/30">
                      Nessuna offerta in questa fase
                    </div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                        <tr>
                          <th className="px-4 py-3 font-medium w-1/3">Offerta</th>
                          <th className="px-4 py-3 font-medium">Cliente</th>
                          <th className="px-4 py-3 font-medium">Valore</th>
                          <th className="px-4 py-3 font-medium">Probabilità</th>
                          <th className="px-4 py-3 font-medium">Chiusura prevista</th>
                          <th className="px-4 py-3 w-[60px]" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stage.items.map((deal) => (
                          <tr
                            key={deal.id}
                            className="hover:bg-muted/30 group transition-colors"
                          >
                            <td className="px-4 py-3 font-medium">{deal.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{deal.clientName || "—"}</td>
                            <td className="px-4 py-3 font-mono font-medium">{formatCurrency(deal.value)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${Math.round(deal.winProbability * 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(deal.winProbability * 100)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                {deal.expectedCloseDate
                                  ? new Date(deal.expectedCloseDate).toLocaleDateString("it-IT")
                                  : "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(deal)}>
                                    <Edit className="mr-2 h-4 w-4" /> Modifica
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => handleDelete(deal.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Elimina
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Quick add */}
                  <div className="px-4 py-2 border-t bg-muted/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-primary h-7"
                      onClick={() => handleCreateNew(stage.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Aggiungi a {stage.label}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sheet modifica / creazione */}
      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {editingDeal && (
            <DealEditForm
              deal={editingDeal}
              onSave={() => { setSheetOpen(false); loadDeals(); }}
              onCancel={() => setSheetOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
