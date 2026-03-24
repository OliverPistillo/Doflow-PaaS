// Percorso: apps/frontend/src/app/(tenant)/support/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, Plus, LifeBuoy, Clock, CheckCircle2, MessageSquare,
  Send, AlertTriangle, ChevronRight,
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Reply = { author: string; message: string; timestamp: string; isInternal: boolean };
type Ticket = {
  id: string; ticketCode: string; subject: string; description: string;
  category: string; priority: string; status: string; replies: Reply[];
  slaHours: number | null; createdAt: string; updatedAt: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN:          { label: "Aperto",         color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  IN_PROGRESS:   { label: "In lavorazione", color: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  WAITING_REPLY: { label: "Attesa risposta",color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  RESOLVED:      { label: "Risolto",        color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  CLOSED:        { label: "Chiuso",         color: "bg-muted text-muted-foreground" },
};

const PRIORITY_LABELS: Record<string, string> = { LOW: "Bassa", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Critica" };
const CATEGORY_LABELS: Record<string, string> = { BUG: "Bug", FEATURE_REQUEST: "Richiesta funzionalità", BILLING: "Fatturazione", ACCESS: "Accesso", PERFORMANCE: "Performance", GENERAL: "Generale" };

export default function SupportPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", category: "GENERAL", priority: "MEDIUM" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Ticket[]>("/tenant/self-service/tickets");
      setTickets(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiFetch("/tenant/self-service/tickets", { method: "POST", body: JSON.stringify(form) });
      setCreateOpen(false);
      setForm({ subject: "", description: "", category: "GENERAL", priority: "MEDIUM" });
      await load();
      toast({ title: "Ticket creato", description: "Il nostro team lo prenderà in carico a breve." });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/tenant/self-service/tickets/${detail.id}/reply`, {
        method: "POST", body: JSON.stringify({ message: replyText }),
      });
      setReplyText("");
      const updated = await apiFetch<Ticket[]>("/tenant/self-service/tickets");
      setTickets(Array.isArray(updated) ? updated : []);
      const refreshed = (updated as Ticket[]).find(t => t.id === detail.id);
      if (refreshed) setDetail(refreshed);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6 flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm animate-pulse">Caricamento ticket...</p>
      </div>
    );
  }

  const openCount = tickets.filter(t => t.status !== "RESOLVED" && t.status !== "CLOSED").length;

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><LifeBuoy className="h-6 w-6 text-primary" />Supporto</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tickets.length} ticket · {openCount} aperti</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuovo Ticket</Button>
      </div>

      <div className="space-y-2">
        {tickets.map(t => {
          const sc = STATUS_LABELS[t.status] || STATUS_LABELS.OPEN;
          return (
            <Card key={t.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => { setDetail(t); setReplyText(""); }}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="shrink-0 text-center">
                  <p className="text-xs font-mono font-bold text-primary">{t.ticketCode}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground text-sm truncate">{t.subject}</h4>
                    <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[t.category] || t.category} · {new Date(t.createdAt).toLocaleDateString("it-IT")}</p>
                </div>
                {t.replies.length > 0 && <Badge variant="outline" className="text-[10px] shrink-0"><MessageSquare className="h-3 w-3 mr-1" />{t.replies.length}</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          );
        })}
        {tickets.length === 0 && (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <LifeBuoy className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nessun ticket aperto</p>
            <p className="text-xs mt-1">Hai bisogno di aiuto? Apri un ticket e ti risponderemo al più presto.</p>
          </CardContent></Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Ticket di Supporto</DialogTitle>
            <DialogDescription>Descrivi il problema e il nostro team lo prenderà in carico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Oggetto *</Label><Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Non riesco ad accedere al modulo..." /></div>
            <div><Label>Descrizione *</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4} placeholder="Descrivi il problema in dettaglio..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorità</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={saving || !form.subject || !form.description}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Crea Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="text-primary font-mono">{detail.ticketCode}</span>
                  <Badge variant="outline" className={`text-[10px] ${(STATUS_LABELS[detail.status] || STATUS_LABELS.OPEN).color}`}>
                    {(STATUS_LABELS[detail.status] || STATUS_LABELS.OPEN).label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <Card><CardContent className="p-4">
                  <h4 className="font-bold text-foreground text-sm">{detail.subject}</h4>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{detail.description}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-2">{new Date(detail.createdAt).toLocaleString("it-IT")}</p>
                </CardContent></Card>

                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Conversazione ({detail.replies.filter(r => !r.isInternal).length})</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {detail.replies.filter(r => !r.isInternal).map((r, i) => (
                      <div key={i} className="p-3 rounded-xl bg-muted/50 border border-border text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-foreground">{r.author}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(r.timestamp).toLocaleString("it-IT")}</span>
                        </div>
                        <p className="text-foreground/80 whitespace-pre-wrap">{r.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {detail.status !== "CLOSED" && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} placeholder="Scrivi un messaggio..." />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleReply} disabled={saving || !replyText.trim()}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}Rispondi
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
