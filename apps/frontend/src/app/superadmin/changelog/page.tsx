// Percorso: apps/frontend/src/app/superadmin/changelog/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, Plus, MoreHorizontal, Rocket,
  Eye, EyeOff, Pencil, Trash2, Tag, Calendar,
  ArrowUpCircle, ArrowRightCircle, Wrench, Zap,
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
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangelogEntry = {
  id: string; version: string; title: string; content: string;
  type: string; tags: string[]; isPublished: boolean;
  publishedAt: string | null; author: string | null; createdAt: string;
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  MAJOR:  { label: "Major",  icon: ArrowUpCircle,    color: "hsl(0 70% 55%)" },
  MINOR:  { label: "Minor",  icon: ArrowRightCircle, color: "hsl(210 70% 55%)" },
  PATCH:  { label: "Patch",  icon: Wrench,           color: "hsl(150 60% 45%)" },
  HOTFIX: { label: "Hotfix", icon: Zap,              color: "hsl(40 80% 55%)" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; entry: Partial<ChangelogEntry> | null }>({ open: false, entry: null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<ChangelogEntry[]>("/superadmin/changelog");
      setEntries(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editDialog.entry) return;
    setSaving(true);
    try {
      const e = editDialog.entry;
      if (e.id) {
        await apiFetch(`/superadmin/changelog/${e.id}`, { method: "PUT", body: JSON.stringify(e) });
      } else {
        await apiFetch("/superadmin/changelog", { method: "POST", body: JSON.stringify(e) });
      }
      setEditDialog({ open: false, entry: null });
      await load();
      toast({ title: "Release note salvata" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await apiFetch(`/superadmin/changelog/${id}/publish`, { method: "PATCH" });
      await load();
      toast({ title: "Pubblicato e notificato ai tenant" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await apiFetch(`/superadmin/changelog/${id}/unpublish`, { method: "PATCH" });
      await load();
      toast({ title: "Nascosto dai tenant" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/superadmin/changelog/${id}`, { method: "DELETE" });
      await load();
      toast({ title: "Eliminato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Caricamento changelog...</p>
      </div>
    );
  }

  const published = entries.filter(e => e.isPublished).length;

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{entries.length} release note · {published} pubblicate</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aggiorna</Button>
          <Button size="sm" onClick={() => setEditDialog({ open: true, entry: { version: "", title: "", content: "", type: "MINOR", tags: [], author: "superadmin" } })}>
            <Plus className="h-4 w-4 mr-2" />Nuova Release
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {entries.map(entry => {
          const tc = TYPE_CONFIG[entry.type] || TYPE_CONFIG.MINOR;
          const IconComp = tc.icon;
          return (
            <Card key={entry.id} className={`glass-card group hover:-translate-y-0.5 transition-all duration-200 ${!entry.isPublished ? "opacity-60" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Version badge */}
                  <div className="shrink-0 text-center pt-0.5">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${tc.color} 12%, transparent)`, color: tc.color }}>
                      <IconComp className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-xs font-mono font-bold" style={{ backgroundColor: `color-mix(in srgb, ${tc.color} 15%, transparent)`, color: tc.color, border: `1px solid color-mix(in srgb, ${tc.color} 25%, transparent)` }}>
                        v{entry.version}
                      </Badge>
                      <h3 className="font-bold text-foreground">{entry.title}</h3>
                      <Badge variant="outline" className="text-[10px]">{tc.label}</Badge>
                      {entry.isPublished ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><Eye className="h-2.5 w-2.5 mr-1" />Pubblicato</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground"><EyeOff className="h-2.5 w-2.5 mr-1" />Bozza</Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-4">{entry.content}</p>

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {(entry.tags || []).map(tag => (
                        <Badge key={tag} variant="outline" className="text-[10px]"><Tag className="h-2.5 w-2.5 mr-1" />{tag}</Badge>
                      ))}
                      <span className="text-[11px] text-muted-foreground/60 ml-auto flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString("it-IT") : new Date(entry.createdAt).toLocaleDateString("it-IT")}
                        {entry.author && <> · {entry.author}</>}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {entry.isPublished ? (
                        <DropdownMenuItem onClick={() => handleUnpublish(entry.id)}><EyeOff className="h-4 w-4 mr-2" />Nascondi</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handlePublish(entry.id)}><Rocket className="h-4 w-4 mr-2" />Pubblica</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setEditDialog({ open: true, entry: { ...entry } })}><Pencil className="h-4 w-4 mr-2" />Modifica</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(entry.id)}><Trash2 className="h-4 w-4 mr-2" />Elimina</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {entries.length === 0 && (
          <div className="text-center py-16 text-muted-foreground"><Rocket className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">Nessuna release note</p></div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={o => { if (!o) setEditDialog({ open: false, entry: null }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editDialog.entry?.id ? "Modifica Release" : "Nuova Release Note"}</DialogTitle>
            <DialogDescription>Il contenuto supporta testo semplice. Pubblica quando sei pronto.</DialogDescription>
          </DialogHeader>
          {editDialog.entry && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Versione</Label><Input value={editDialog.entry.version || ""} onChange={e => setEditDialog(p => ({ ...p, entry: { ...p.entry!, version: e.target.value } }))} placeholder="3.6.0" /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={editDialog.entry.type || "MINOR"} onValueChange={v => setEditDialog(p => ({ ...p, entry: { ...p.entry!, type: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Titolo</Label><Input value={editDialog.entry.title || ""} onChange={e => setEditDialog(p => ({ ...p, entry: { ...p.entry!, title: e.target.value } }))} placeholder="Nuovo modulo magazzino" /></div>
              <div><Label>Contenuto</Label><Textarea value={editDialog.entry.content || ""} onChange={e => setEditDialog(p => ({ ...p, entry: { ...p.entry!, content: e.target.value } }))} rows={8} placeholder="Descrivi le novità..." /></div>
              <div><Label>Tag (comma-separati)</Label><Input value={(editDialog.entry.tags || []).join(", ")} onChange={e => setEditDialog(p => ({ ...p, entry: { ...p.entry!, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) } }))} placeholder="feature, CRM, fix" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, entry: null })}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
