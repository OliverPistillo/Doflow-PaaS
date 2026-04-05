// Percorso: apps/frontend/src/app/superadmin/modules/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Puzzle, Plus, Loader2, RefreshCw, Search, MoreHorizontal,
  Pencil, Trash2, ToggleLeft, ToggleRight, Grid3x3, List,
  Sparkles, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformModule = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  minTier: string;
  priceMonthly: number;
  isBeta: boolean;
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  enabledModules: string[];
};

type MatrixData = {
  tenants: TenantRow[];
  modules: PlatformModule[];
};

// ─── Category Colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  COMMERCIAL: "hsl(var(--chart-1))",
  FINANCE: "hsl(var(--chart-2))",
  OPERATIONS: "hsl(var(--chart-3))",
  HR: "hsl(var(--chart-4))",
  MARKETING: "hsl(var(--chart-5))",
  SERVICES: "hsl(210 60% 55%)",
  HEALTH: "hsl(160 60% 45%)",
  CONSTRUCTION: "hsl(30 70% 50%)",
};

const TIER_BADGE: Record<string, string> = {
  STARTER: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  PRO: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  ENTERPRISE: "bg-violet-500/10 text-violet-600 border-violet-500/20",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Card className="glass-card transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" style={{ backgroundColor: color }} />
      <CardContent className="p-6 relative z-10 flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-foreground mt-3 tracking-tight tabular-nums">{value}</h3>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 transition-all duration-300 group-hover:scale-110 shadow-sm"
          style={{ color, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModulesPage() {
  const { toast } = useToast();
  const [modules, setModules] = useState<PlatformModule[]>([]);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; module: Partial<PlatformModule> | null }>({ open: false, module: null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mods, mat] = await Promise.all([
        apiFetch<PlatformModule[]>("/superadmin/modules"),
        apiFetch<MatrixData>("/superadmin/modules/matrix"),
      ]);
      setModules(Array.isArray(mods) ? mods : []);
      setMatrix(mat && typeof mat === "object" ? mat : null);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (tenantId: string, moduleKey: string, enable: boolean) => {
    const key = `${tenantId}-${moduleKey}`;
    setToggling(key);
    try {
      await apiFetch("/superadmin/modules/tenant/" + tenantId + "/toggle", {
        method: "POST",
        body: JSON.stringify({ moduleKey, enable }),
      });
      await load();
      toast({ title: enable ? "Modulo attivato" : "Modulo disattivato" });
    } catch (e: any) {
      toast({ title: "Errore toggle", description: e.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const handleSaveModule = async () => {
    if (!editDialog.module) return;
    setSaving(true);
    try {
      const m = editDialog.module;
      if (m.id) {
        await apiFetch(`/superadmin/modules/${m.id}`, { method: "PUT", body: JSON.stringify(m) });
      } else {
        await apiFetch("/superadmin/modules", { method: "POST", body: JSON.stringify(m) });
      }
      setEditDialog({ open: false, module: null });
      await load();
      toast({ title: "Modulo salvato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModule = async (id: string) => {
    try {
      await apiFetch(`/superadmin/modules/${id}`, { method: "DELETE" });
      await load();
      toast({ title: "Modulo eliminato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const filteredModules = modules.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.key.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Caricamento moduli...</p>
      </div>
    );
  }

  const categories = [...new Set(modules.map(m => m.category))];
  const betaCount = modules.filter(m => m.isBeta).length;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Moduli Totali" value={modules.length} icon={Puzzle} color="hsl(var(--chart-1))" />
        <KpiCard title="Categorie" value={categories.length} icon={Grid3x3} color="hsl(var(--chart-2))" />
        <KpiCard title="In Beta" value={betaCount} icon={Sparkles} color="hsl(var(--chart-4))" />
        <KpiCard title="Tenant Attivi" value={matrix?.tenants.length || 0} icon={ToggleRight} color="hsl(var(--chart-3))" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca moduli..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aggiorna</Button>
          <Button size="sm" onClick={() => setEditDialog({ open: true, module: { key: "", name: "", category: "COMMERCIAL", minTier: "STARTER", priceMonthly: 0, isBeta: true } })}>
            <Plus className="h-4 w-4 mr-2" />Nuovo Modulo
          </Button>
        </div>
      </div>

      {/* Tabs: Catalogo / Matrice */}
      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog"><List className="h-4 w-4 mr-2" />Catalogo Moduli</TabsTrigger>
          <TabsTrigger value="matrix"><Grid3x3 className="h-4 w-4 mr-2" />Matrice Tenant</TabsTrigger>
        </TabsList>

        {/* ── Catalogo ────────────────────────────────────────────── */}
        <TabsContent value="catalog" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredModules.map(mod => (
              <Card key={mod.id} className="glass-card group hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black"
                        style={{ backgroundColor: `color-mix(in srgb, ${CATEGORY_COLORS[mod.category] || "gray"} 15%, transparent)`, color: CATEGORY_COLORS[mod.category] || "gray" }}>
                        {mod.key.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{mod.name}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{mod.key}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditDialog({ open: true, module: { ...mod } })}>
                          <Pencil className="h-4 w-4 mr-2" />Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteModule(mod.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {mod.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{mod.description}</p>}
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{mod.category}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${TIER_BADGE[mod.minTier] || ""}`}>{mod.minTier}</Badge>
                    {mod.isBeta && <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20" variant="outline">BETA</Badge>}
                    <span className="ml-auto text-sm font-bold text-foreground tabular-nums">€{Number(mod.priceMonthly).toFixed(0)}/mo</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredModules.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Puzzle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nessun modulo trovato</p>
            </div>
          )}
        </TabsContent>

        {/* ── Matrice Tenant / Moduli ─────────────────────────────── */}
        <TabsContent value="matrix" className="mt-4">
          {matrix && matrix.tenants.length > 0 && matrix.modules.length > 0 ? (
            <Card className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-bold text-foreground sticky left-0 bg-card z-10 min-w-[180px]">Tenant</th>
                      {matrix.modules.map(m => (
                        <th key={m.key} className="text-center p-3 font-medium text-muted-foreground min-w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs truncate max-w-[90px]">{m.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground/60">{m.key}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.tenants.map(tenant => (
                      <tr key={tenant.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-3 sticky left-0 bg-card z-10">
                          <div>
                            <p className="font-semibold text-foreground text-sm">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">{tenant.slug} · <Badge variant="outline" className={`text-[9px] ${TIER_BADGE[tenant.planTier] || ""}`}>{tenant.planTier}</Badge></p>
                          </div>
                        </td>
                        {matrix.modules.map(mod => {
                          const isEnabled = tenant.enabledModules.includes(mod.key);
                          const toggleKey = `${tenant.id}-${mod.key}`;
                          return (
                            <td key={mod.key} className="text-center p-3">
                              {toggling === toggleKey ? (
                                <Loader2 className="h-4 w-4 mx-auto animate-spin text-primary" />
                              ) : (
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => handleToggle(tenant.id, mod.key, checked)}
                                  className="mx-auto"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Grid3x3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Crea moduli e tenant per visualizzare la matrice</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Edit / Create Dialog ───────────────────────────────── */}
      <Dialog open={editDialog.open} onOpenChange={(o) => { if (!o) setEditDialog({ open: false, module: null }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editDialog.module?.id ? "Modifica Modulo" : "Nuovo Modulo"}</DialogTitle>
            <DialogDescription>Configura le proprietà del modulo piattaforma.</DialogDescription>
          </DialogHeader>
          {editDialog.module && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Key (unica)</Label>
                  <Input value={editDialog.module.key || ""} onChange={e => setEditDialog(p => ({ ...p, module: { ...p.module!, key: e.target.value } }))} placeholder="crm_base" disabled={!!editDialog.module.id} />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input value={editDialog.module.name || ""} onChange={e => setEditDialog(p => ({ ...p, module: { ...p.module!, name: e.target.value } }))} placeholder="CRM Base" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={editDialog.module.category || "COMMERCIAL"} onValueChange={v => setEditDialog(p => ({ ...p, module: { ...p.module!, category: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["COMMERCIAL","FINANCE","OPERATIONS","HR","MARKETING","SERVICES","HEALTH","CONSTRUCTION"].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tier Minimo</Label>
                  <Select value={editDialog.module.minTier || "STARTER"} onValueChange={v => setEditDialog(p => ({ ...p, module: { ...p.module!, minTier: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STARTER">Starter</SelectItem>
                      <SelectItem value="PRO">Pro</SelectItem>
                      <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prezzo Mensile (€)</Label>
                  <Input type="number" value={editDialog.module.priceMonthly || 0} onChange={e => setEditDialog(p => ({ ...p, module: { ...p.module!, priceMonthly: Number(e.target.value) } }))} />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <div className="flex items-center gap-2">
                    <Switch checked={editDialog.module.isBeta ?? true} onCheckedChange={v => setEditDialog(p => ({ ...p, module: { ...p.module!, isBeta: v } }))} />
                    <Label>Beta</Label>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, module: null })}>Annulla</Button>
            <Button onClick={handleSaveModule} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
