// Percorso: apps/frontend/src/app/superadmin/automations/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, Plus, MoreHorizontal, Zap,
  Play, Pause, Pencil, Trash2, TestTube, BarChart3,
  Mail, Bell, ArrowRight, UserCheck, Webhook, ListTodo,
  Target, Clock, AlertTriangle, CheckCircle2, Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type AutomationRule = {
  id: string; name: string; description: string | null;
  triggerEvent: string; triggerConditions: Record<string, unknown>;
  actionType: string; actionConfig: Record<string, unknown>;
  isActive: boolean; executionCount: number;
  lastExecutedAt: string | null; cronExpression: string | null; createdAt: string;
};

type AutoStats = { total: number; active: number; totalExecutions: number; byTrigger: { trigger: string; count: number }[]; byAction: { action: string; count: number }[] };

const TRIGGER_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  LEAD_STATUS_CHANGE:    { label: "Lead: cambio stato",      icon: Target },
  LEAD_CREATED:          { label: "Lead: creato",            icon: Target },
  LEAD_SCORE_THRESHOLD:  { label: "Lead: soglia score",     icon: BarChart3 },
  TICKET_CREATED:        { label: "Ticket: creato",          icon: AlertTriangle },
  TICKET_SLA_BREACH:     { label: "Ticket: SLA violato",    icon: Clock },
  TENANT_TRIAL_EXPIRING: { label: "Tenant: trial in scadenza", icon: Clock },
  TENANT_INACTIVE:       { label: "Tenant: inattivo",        icon: Pause },
  INVOICE_OVERDUE:       { label: "Fattura: scaduta",        icon: AlertTriangle },
  DEAL_STAGE_CHANGE:     { label: "Deal: cambio fase",       icon: ArrowRight },
  SCHEDULED:             { label: "Schedulato (cron)",        icon: Clock },
};

const ACTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SEND_EMAIL:          { label: "Invia email",          icon: Mail,      color: "hsl(var(--chart-1))" },
  CREATE_NOTIFICATION: { label: "Crea notifica",        icon: Bell,      color: "hsl(var(--chart-2))" },
  UPDATE_STATUS:       { label: "Aggiorna stato",       icon: Settings,  color: "hsl(var(--chart-3))" },
  ASSIGN_TO:           { label: "Assegna a",            icon: UserCheck, color: "hsl(var(--chart-4))" },
  WEBHOOK:             { label: "Webhook esterno",      icon: Webhook,   color: "hsl(280 60% 55%)" },
  CREATE_TASK:         { label: "Crea task",            icon: ListTodo,  color: "hsl(40 80% 55%)" },
};

// ─── KpiCard ──────────────────────────────────────────────────────────────────

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
          <h3 className="text-3xl font-black text-foreground mt-3 tabular-nums">{value}</h3>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 group-hover:scale-110 transition-all" style={{ color }}><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [stats, setStats] = useState<AutoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; rule: Partial<AutomationRule> | null }>({ open: false, rule: null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        apiFetch<AutomationRule[]>("/superadmin/automations"),
        apiFetch<AutoStats>("/superadmin/automations/stats"),
      ]);
      setRules(Array.isArray(r) ? r : []);
      setStats(s);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editDialog.rule) return;
    setSaving(true);
    try {
      const r = editDialog.rule;
      // Parse JSON strings from form
      const payload = { ...r };
      if (typeof payload.triggerConditions === "string") {
        try { payload.triggerConditions = JSON.parse(payload.triggerConditions as any); } catch { payload.triggerConditions = {}; }
      }
      if (typeof payload.actionConfig === "string") {
        try { payload.actionConfig = JSON.parse(payload.actionConfig as any); } catch { payload.actionConfig = {}; }
      }
      if (r.id) {
        await apiFetch(`/superadmin/automations/${r.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/superadmin/automations", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditDialog({ open: false, rule: null });
      await load();
      toast({ title: "Regola salvata" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await apiFetch(`/superadmin/automations/${id}/toggle`, { method: "PATCH", body: JSON.stringify({ isActive }) });
      await load();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleTest = async (rule: AutomationRule) => {
    try {
      const res = await apiFetch<any>("/superadmin/automations/test", {
        method: "POST",
        body: JSON.stringify({ event: rule.triggerEvent, context: { test: true, ruleId: rule.id } }),
      });
      toast({ title: "Test eseguito", description: `Risultato: ${JSON.stringify(res).slice(0, 100)}` });
      await load();
    } catch (e: any) {
      toast({ title: "Errore test", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/superadmin/automations/${id}`, { method: "DELETE" });
      await load();
      toast({ title: "Regola eliminata" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Caricamento automazioni...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="Regole" value={stats.total} sub={`${stats.active} attive`} icon={Zap} color="hsl(var(--chart-1))" />
          <KpiCard title="Esecuzioni Totali" value={stats.totalExecutions} icon={Play} color="hsl(var(--chart-2))" />
          <KpiCard title="Trigger Unici" value={stats.byTrigger.length} icon={Target} color="hsl(var(--chart-3))" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rules.length} regole configurate</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aggiorna</Button>
          <Button size="sm" onClick={() => setEditDialog({ open: true, rule: { name: "", triggerEvent: "LEAD_STATUS_CHANGE", triggerConditions: {}, actionType: "SEND_EMAIL", actionConfig: {}, isActive: true } })}>
            <Plus className="h-4 w-4 mr-2" />Nuova Regola
          </Button>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.map(rule => {
          const trig = TRIGGER_LABELS[rule.triggerEvent] || { label: rule.triggerEvent, icon: Zap };
          const act = ACTION_LABELS[rule.actionType] || { label: rule.actionType, icon: Settings, color: "gray" };
          const TrigIcon = trig.icon;
          const ActIcon = act.icon;
          return (
            <Card key={rule.id} className={`glass-card group hover:-translate-y-0.5 transition-all duration-200 ${!rule.isActive ? "opacity-50" : ""}`}>
              <CardContent className="p-5 flex items-center gap-4">
                {/* Toggle */}
                <Switch checked={rule.isActive} onCheckedChange={v => handleToggle(rule.id, v)} className="shrink-0" />

                {/* Flow visualization: Trigger → Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><TrigIcon className="h-4 w-4" /></div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${act.color} 12%, transparent)`, color: act.color }}><ActIcon className="h-4 w-4" /></div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm truncate">{rule.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{trig.label}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{act.label}</span>
                    {rule.cronExpression && <Badge variant="outline" className="text-[9px] ml-1">{rule.cronExpression}</Badge>}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-bold text-foreground tabular-nums">{rule.executionCount}</p>
                  <p className="text-[10px] text-muted-foreground">esecuzioni</p>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleTest(rule)}><TestTube className="h-4 w-4 mr-2" />Test manuale</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditDialog({ open: true, rule: { ...rule, triggerConditions: JSON.stringify(rule.triggerConditions, null, 2) as any, actionConfig: JSON.stringify(rule.actionConfig, null, 2) as any } })}><Pencil className="h-4 w-4 mr-2" />Modifica</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(rule.id)}><Trash2 className="h-4 w-4 mr-2" />Elimina</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          );
        })}
        {rules.length === 0 && (
          <div className="text-center py-16 text-muted-foreground"><Zap className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">Nessuna automazione configurata</p><p className="text-xs mt-1">Crea la prima regola per automatizzare i workflow</p></div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={o => { if (!o) setEditDialog({ open: false, rule: null }); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog.rule?.id ? "Modifica Regola" : "Nuova Automazione"}</DialogTitle>
            <DialogDescription>Quando scatta il trigger, l'azione viene eseguita automaticamente.</DialogDescription>
          </DialogHeader>
          {editDialog.rule && (
            <div className="space-y-4 py-2">
              <div><Label>Nome regola</Label><Input value={editDialog.rule.name || ""} onChange={e => setEditDialog(p => ({ ...p, rule: { ...p.rule!, name: e.target.value } }))} placeholder="Quando lead qualificato → invia email" /></div>
              <div><Label>Descrizione</Label><Input value={editDialog.rule.description || ""} onChange={e => setEditDialog(p => ({ ...p, rule: { ...p.rule!, description: e.target.value } }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trigger</Label>
                  <Select value={editDialog.rule.triggerEvent || "LEAD_STATUS_CHANGE"} onValueChange={v => setEditDialog(p => ({ ...p, rule: { ...p.rule!, triggerEvent: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Azione</Label>
                  <Select value={editDialog.rule.actionType || "SEND_EMAIL"} onValueChange={v => setEditDialog(p => ({ ...p, rule: { ...p.rule!, actionType: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Condizioni Trigger (JSON)</Label><Textarea value={typeof editDialog.rule.triggerConditions === "string" ? editDialog.rule.triggerConditions as any : JSON.stringify(editDialog.rule.triggerConditions || {}, null, 2)} onChange={e => setEditDialog(p => ({ ...p, rule: { ...p.rule!, triggerConditions: e.target.value as any } }))} rows={4} className="font-mono text-xs" placeholder='{"fromStatus": "NEW", "toStatus": "QUALIFIED"}' /></div>
              <div><Label>Config Azione (JSON)</Label><Textarea value={typeof editDialog.rule.actionConfig === "string" ? editDialog.rule.actionConfig as any : JSON.stringify(editDialog.rule.actionConfig || {}, null, 2)} onChange={e => setEditDialog(p => ({ ...p, rule: { ...p.rule!, actionConfig: e.target.value as any } }))} rows={4} className="font-mono text-xs" placeholder='{"templateSlug": "lead_qualified", "to": "{{lead.email}}"}' /></div>
              {editDialog.rule.triggerEvent === "SCHEDULED" && (
                <div><Label>Cron Expression</Label><Input value={editDialog.rule.cronExpression || ""} onChange={e => setEditDialog(p => ({ ...p, rule: { ...p.rule!, cronExpression: e.target.value } }))} placeholder="0 9 * * 1 (ogni lunedì alle 9)" /></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, rule: null })}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
