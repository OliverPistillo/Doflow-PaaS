// Percorso: apps/frontend/src/app/superadmin/email-templates/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, Search, Plus, MoreHorizontal,
  Mail, Send, Eye, Pencil, Trash2, Copy, Megaphone,
  Code, Variable, BarChart3, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailTemplate = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  category: string;
  variables: string[];
  isActive: boolean;
  sendCount: number;
  lastSentAt: string | null;
  createdAt: string;
};

type TemplateStats = { total: number; active: number; totalSent: number; byCategory: { category: string; count: number }[] };

const CATEGORY_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding", BILLING: "Fatturazione", TRIAL_EXPIRY: "Scadenza Trial",
  RENEWAL: "Rinnovo", MARKETING: "Marketing", SYSTEM: "Sistema", CUSTOM: "Custom",
};

const CATEGORY_COLORS: Record<string, string> = {
  ONBOARDING: "hsl(var(--chart-1))", BILLING: "hsl(var(--chart-2))", TRIAL_EXPIRY: "hsl(40 80% 55%)",
  RENEWAL: "hsl(var(--chart-3))", MARKETING: "hsl(280 60% 55%)", SYSTEM: "hsl(var(--chart-4))", CUSTOM: "hsl(var(--muted-foreground))",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [stats, setStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("ALL");
  const [editDialog, setEditDialog] = useState<{ open: boolean; tpl: Partial<EmailTemplate> | null }>({ open: false, tpl: null });
  const [previewSheet, setPreviewSheet] = useState<{ open: boolean; html: string }>({ open: false, html: "" });
  const [sendDialog, setSendDialog] = useState<{ open: boolean; slug: string }>({ open: false, slug: "" });
  const [sendTo, setSendTo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterCat !== "ALL" ? `?category=${filterCat}` : "";
      const [t, s] = await Promise.all([
        apiFetch<EmailTemplate[]>(`/superadmin/email-templates${params}`),
        apiFetch<TemplateStats>("/superadmin/email-templates/stats"),
      ]);
      setTemplates(Array.isArray(t) ? t : []);
      setStats(s);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, filterCat]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editDialog.tpl) return;
    setSaving(true);
    try {
      const t = editDialog.tpl;
      if (t.id) {
        await apiFetch(`/superadmin/email-templates/${t.id}`, { method: "PUT", body: JSON.stringify(t) });
      } else {
        await apiFetch("/superadmin/email-templates", { method: "POST", body: JSON.stringify(t) });
      }
      setEditDialog({ open: false, tpl: null });
      await load();
      toast({ title: "Template salvato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (tpl: EmailTemplate) => {
    try {
      const testData: Record<string, string> = {};
      for (const v of tpl.variables) testData[v] = `[${v}]`;
      const res = await apiFetch<{ subject: string; html: string }>("/superadmin/email-templates/preview", {
        method: "POST", body: JSON.stringify({ slug: tpl.slug, testData }),
      });
      setPreviewSheet({ open: true, html: res.html });
    } catch (e: any) {
      toast({ title: "Errore preview", description: e.message, variant: "destructive" });
    }
  };

  const handleSend = async () => {
    if (!sendDialog.slug || !sendTo) return;
    setSaving(true);
    try {
      await apiFetch("/superadmin/email-templates/send", {
        method: "POST", body: JSON.stringify({ slug: sendDialog.slug, to: sendTo, variables: {} }),
      });
      setSendDialog({ open: false, slug: "" });
      setSendTo("");
      await load();
      toast({ title: "Email inviata" });
    } catch (e: any) {
      toast({ title: "Errore invio", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/superadmin/email-templates/${id}`, { method: "DELETE" });
      await load();
      toast({ title: "Template eliminato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleCampaign = async (slug: string) => {
    try {
      const res = await apiFetch<{ sent: number }>("/superadmin/email-templates/campaign", {
        method: "POST", body: JSON.stringify({ slug }),
      });
      await load();
      toast({ title: `Campagna inviata a ${(res as any).sent || 0} tenant` });
    } catch (e: any) {
      toast({ title: "Errore campagna", description: e.message, variant: "destructive" });
    }
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Caricamento template...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Template", value: stats.total, sub: `${stats.active} attivi`, icon: Mail, color: "hsl(var(--chart-1))" },
            { title: "Email Inviate", value: stats.totalSent, icon: Send, color: "hsl(var(--chart-2))" },
            { title: "Categorie", value: stats.byCategory.length, icon: Sparkles, color: "hsl(var(--chart-3))" },
          ].map(k => (
            <Card key={k.title} className="glass-card transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative">
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" style={{ backgroundColor: k.color }} />
              <CardContent className="p-6 relative z-10 flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{k.title}</p>
                  <h3 className="text-3xl font-black text-foreground mt-3 tabular-nums">{k.value}</h3>
                  {k.sub && <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>}
                </div>
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 group-hover:scale-110 transition-all" style={{ color: k.color }}><k.icon className="h-5 w-5" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca template..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutte le categorie</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aggiorna</Button>
          <Button size="sm" onClick={() => setEditDialog({ open: true, tpl: { slug: "", name: "", subject: "", htmlBody: "", category: "CUSTOM", variables: [], isActive: true } })}>
            <Plus className="h-4 w-4 mr-2" />Nuovo Template
          </Button>
        </div>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(tpl => (
          <Card key={tpl.id} className="glass-card group hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${CATEGORY_COLORS[tpl.category] || "gray"} 12%, transparent)`, color: CATEGORY_COLORS[tpl.category] || "gray" }}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-foreground text-sm truncate">{tpl.name}</h4>
                    <p className="text-xs text-muted-foreground font-mono truncate">{tpl.slug}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handlePreview(tpl)}><Eye className="h-4 w-4 mr-2" />Preview</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSendDialog({ open: true, slug: tpl.slug }); setSendTo(""); }}><Send className="h-4 w-4 mr-2" />Invia test</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCampaign(tpl.slug)}><Megaphone className="h-4 w-4 mr-2" />Campagna a tutti</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setEditDialog({ open: true, tpl: { ...tpl } })}><Pencil className="h-4 w-4 mr-2" />Modifica</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(tpl.id)}><Trash2 className="h-4 w-4 mr-2" />Elimina</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-xs text-muted-foreground mt-3 line-clamp-1">Oggetto: {tpl.subject}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[tpl.category] || tpl.category}</Badge>
                {!tpl.isActive && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20">Disattivo</Badge>}
                {tpl.variables.length > 0 && <Badge variant="outline" className="text-[10px]"><Variable className="h-2.5 w-2.5 mr-1" />{tpl.variables.length} var</Badge>}
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{tpl.sendCount} invii</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground"><Mail className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">Nessun template trovato</p></div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={o => { if (!o) setEditDialog({ open: false, tpl: null }); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog.tpl?.id ? "Modifica Template" : "Nuovo Template"}</DialogTitle>
            <DialogDescription>Usa {'{{variabile}}'} nel body per i campi dinamici.</DialogDescription>
          </DialogHeader>
          {editDialog.tpl && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Slug (unico)</Label><Input value={editDialog.tpl.slug || ""} onChange={e => setEditDialog(p => ({ ...p, tpl: { ...p.tpl!, slug: e.target.value } }))} placeholder="welcome_email" disabled={!!editDialog.tpl.id} /></div>
                <div><Label>Nome</Label><Input value={editDialog.tpl.name || ""} onChange={e => setEditDialog(p => ({ ...p, tpl: { ...p.tpl!, name: e.target.value } }))} placeholder="Email di benvenuto" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Oggetto</Label><Input value={editDialog.tpl.subject || ""} onChange={e => setEditDialog(p => ({ ...p, tpl: { ...p.tpl!, subject: e.target.value } }))} placeholder="Benvenuto {{tenantName}}" /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={editDialog.tpl.category || "CUSTOM"} onValueChange={v => setEditDialog(p => ({ ...p, tpl: { ...p.tpl!, category: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Body HTML</Label><Textarea value={editDialog.tpl.htmlBody || ""} onChange={e => setEditDialog(p => ({ ...p, tpl: { ...p.tpl!, htmlBody: e.target.value } }))} rows={10} className="font-mono text-xs" /></div>
              <div><Label>Variabili (comma-separate)</Label><Input value={(editDialog.tpl.variables || []).join(", ")} onChange={e => setEditDialog(p => ({ ...p, tpl: { ...p.tpl!, variables: e.target.value.split(",").map(v => v.trim()).filter(Boolean) } }))} placeholder="tenantName, expiryDate, loginUrl" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, tpl: null })}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Sheet */}
      <Sheet open={previewSheet.open} onOpenChange={o => { if (!o) setPreviewSheet({ open: false, html: "" }); }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Preview Email</SheetTitle></SheetHeader>
          <div className="mt-4 border border-border rounded-xl overflow-hidden bg-white">
            <div dangerouslySetInnerHTML={{ __html: previewSheet.html }} className="p-6" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Send Dialog */}
      <Dialog open={sendDialog.open} onOpenChange={o => { if (!o) setSendDialog({ open: false, slug: "" }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Invia Email di Test</DialogTitle></DialogHeader>
          <div className="py-2"><Label>Indirizzo email</Label><Input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="test@example.com" type="email" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialog({ open: false, slug: "" })}>Annulla</Button>
            <Button onClick={handleSend} disabled={saving || !sendTo}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}Invia</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
