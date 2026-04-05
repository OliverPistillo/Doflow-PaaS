// Percorso: apps/frontend/src/app/superadmin/storage/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, HardDrive, Database, Download, Trash2, Play,
  Clock, CheckCircle2, XCircle, AlertTriangle, Archive, Server,
  MoreHorizontal, FolderArchive, ShieldCheck, CalendarClock, Plus,
  RotateCcw, Pencil, ToggleLeft, ToggleRight, CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantStorage {
  id: string; name: string; slug: string;
  storageUsedMb: number; storageLimitGb: number; usagePercent: number;
}

interface BackupRow {
  id: string; tenantId: string | null; tenantSlug: string | null;
  type: string; status: string; sizeMb: number; storagePath: string | null;
  durationSeconds: number; error: string | null;
  createdAt: string; completedAt: string | null;
}

interface BackupSchedule {
  id: string; tenantId: string | null; tenantSlug: string | null; tenantName: string | null;
  frequency: string; backupType: string; hour: number;
  dayOfWeek: number | null; dayOfMonth: number | null;
  retentionDays: number; isActive: boolean;
  lastRunAt: string | null; nextRunAt: string | null;
}

interface StorageOverview {
  tenants: TenantStorage[];
  summary: {
    totalStorageUsedMb: number; totalStorageLimitMb: number;
    totalBackupSizeMb: number; totalBackups: number;
    completedBackups: number; failedBackups: number;
    activeSchedules: number;
    lastBackupAt: string | null; nextScheduled: string | null;
  };
  recentBackups: BackupRow[];
  schedules: BackupSchedule[];
}

type ScheduleForm = {
  tenantId: string; frequency: string; backupType: string;
  hour: string; dayOfWeek: string; dayOfMonth: string;
  retentionDays: string; isActive: boolean;
};

const DEFAULT_FORM: ScheduleForm = {
  tenantId: "GLOBAL", frequency: "DAILY", backupType: "FULL",
  hour: "2", dayOfWeek: "1", dayOfMonth: "1",
  retentionDays: "30", isActive: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
  return `${mb.toFixed(0)} MB`;
}

function getUsageColor(pct: number) {
  if (pct < 60) return "hsl(150 60% 45%)";
  if (pct < 85) return "hsl(40 80% 55%)";
  return "hsl(0 70% 55%)";
}

function getStatusBadge(status: string) {
  const map: Record<string, JSX.Element> = {
    COMPLETED: <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><CheckCircle2 className="h-3 w-3" />Completato</Badge>,
    RUNNING:   <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1"><Loader2 className="h-3 w-3 animate-spin" />In corso</Badge>,
    PENDING:   <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1"><Clock className="h-3 w-3" />In coda</Badge>,
    FAILED:    <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20 gap-1"><XCircle className="h-3 w-3" />Fallito</Badge>,
  };
  return map[status] ?? <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

function freqLabel(s: BackupSchedule): string {
  const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  switch (s.frequency) {
    case "HOURLY":  return `Ogni ora`;
    case "DAILY":   return `Ogni giorno alle ${String(s.hour).padStart(2, "0")}:00`;
    case "WEEKLY":  return `Ogni ${days[s.dayOfWeek ?? 1]} alle ${String(s.hour).padStart(2, "0")}:00`;
    case "MONTHLY": return `Il giorno ${s.dayOfMonth} del mese alle ${String(s.hour).padStart(2, "0")}:00`;
    default: return s.frequency;
  }
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string;
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

// ─── ScheduleDialog ───────────────────────────────────────────────────────────

function ScheduleDialog({ open, onClose, onSave, tenants, editing }: {
  open: boolean;
  onClose: () => void;
  onSave: (form: ScheduleForm) => Promise<void>;
  tenants: TenantStorage[];
  editing: BackupSchedule | null;
}) {
  const [form, setForm] = useState<ScheduleForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        tenantId: editing.tenantId ?? "GLOBAL",
        frequency: editing.frequency,
        backupType: editing.backupType,
        hour: String(editing.hour),
        dayOfWeek: String(editing.dayOfWeek ?? 1),
        dayOfMonth: String(editing.dayOfMonth ?? 1),
        retentionDays: String(editing.retentionDays),
        isActive: editing.isActive,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [editing, open]);

  const set = (k: keyof ScheduleForm, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifica Schedule" : "Nuovo Schedule Automatico"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Target */}
          <div className="space-y-1.5">
            <Label>Target</Label>
            <Select value={form.tenantId} onValueChange={v => set("tenantId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">🌐 Globale (tutti i tenant)</SelectItem>
                {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo backup</Label>
              <Select value={form.backupType} onValueChange={v => set("backupType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Full</SelectItem>
                  <SelectItem value="SCHEMA">Schema</SelectItem>
                  <SelectItem value="INCREMENTAL">Incrementale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequenza</Label>
              <Select value={form.frequency} onValueChange={v => set("frequency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Ogni ora</SelectItem>
                  <SelectItem value="DAILY">Giornaliero</SelectItem>
                  <SelectItem value="WEEKLY">Settimanale</SelectItem>
                  <SelectItem value="MONTHLY">Mensile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Orario */}
          <div className="grid grid-cols-2 gap-3">
            {form.frequency !== "HOURLY" && (
              <div className="space-y-1.5">
                <Label>Ora (0-23)</Label>
                <Input type="number" min={0} max={23} value={form.hour} onChange={e => set("hour", e.target.value)} />
              </div>
            )}
            {form.frequency === "WEEKLY" && (
              <div className="space-y-1.5">
                <Label>Giorno settimana</Label>
                <Select value={form.dayOfWeek} onValueChange={v => set("dayOfWeek", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"].map((d, i) =>
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.frequency === "MONTHLY" && (
              <div className="space-y-1.5">
                <Label>Giorno del mese (1-28)</Label>
                <Input type="number" min={1} max={28} value={form.dayOfMonth} onChange={e => set("dayOfMonth", e.target.value)} />
              </div>
            )}
          </div>
          {/* Retention */}
          <div className="space-y-1.5">
            <Label>Retention (giorni) — 0 = mai eliminare</Label>
            <Input type="number" min={0} value={form.retentionDays} onChange={e => set("retentionDays", e.target.value)} />
          </div>
          {/* Attivo */}
          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} id="isActive" />
            <Label htmlFor="isActive">Attivo</Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Annulla</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editing ? "Salva modifiche" : "Crea schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoragePage() {
  const { toast } = useToast();
  const [data, setData] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BackupSchedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<BackupSchedule | null>(null);
  const [backupType, setBackupType] = useState("FULL");
  const [backupTenant, setBackupTenant] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StorageOverview>("/superadmin/storage/overview");
      setData(res);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    const hasRunning = data.recentBackups.some(b => b.status === "RUNNING" || b.status === "PENDING");
    if (!hasRunning) return;
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, [data, load]);

  const triggerBackup = async () => {
    setTriggering(true);
    try {
      const body: any = { type: backupType };
      if (backupTenant !== "ALL") body.tenantId = backupTenant;
      await apiFetch("/superadmin/storage/backups/trigger", { method: "POST", body: JSON.stringify(body) });
      toast({ title: "✅ Backup avviato", description: "Esecuzione in background, la lista si aggiornerà." });
      setTimeout(() => load(), 1500);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally { setTriggering(false); }
  };

  const downloadBackup = async (b: BackupRow) => {
    if (!b.storagePath) return;
    setDownloading(b.id);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const token = typeof window !== "undefined" ? localStorage.getItem("doflow_token") : null;
      window.open(`${apiBase}/api/superadmin/storage/backups/${b.id}/download?token=${token}`, "_blank");
      toast({ title: "⬇️ Download avviato" });
    } catch (e: any) {
      toast({ title: "Errore download", description: e.message, variant: "destructive" });
    } finally { setDownloading(null); }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(restoreTarget.id);
    try {
      await apiFetch(`/superadmin/storage/backups/${restoreTarget.id}/restore`, { method: "POST" });
      toast({
        title: "🔄 Ripristino avviato",
        description: "Il database verrà ripristinato in background. Controlla i log del server.",
      });
      setRestoreTarget(null);
    } catch (e: any) {
      toast({ title: "Errore ripristino", description: e.message, variant: "destructive" });
    } finally { setRestoring(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/superadmin/storage/backups/${deleteTarget.id}`, { method: "DELETE" });
      toast({ title: "🗑️ Backup eliminato" });
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const saveSchedule = async (form: any) => {
    const payload = {
      tenantId: form.tenantId === "GLOBAL" ? null : form.tenantId,
      frequency: form.frequency,
      backupType: form.backupType,
      hour: parseInt(form.hour),
      dayOfWeek: form.frequency === "WEEKLY" ? parseInt(form.dayOfWeek) : null,
      dayOfMonth: form.frequency === "MONTHLY" ? parseInt(form.dayOfMonth) : null,
      retentionDays: parseInt(form.retentionDays),
      isActive: form.isActive,
    };
    if (editingSchedule) {
      await apiFetch(`/superadmin/storage/schedules/${editingSchedule.id}`, {
        method: "PUT", body: JSON.stringify(payload),
      });
      toast({ title: "✅ Schedule aggiornato" });
    } else {
      await apiFetch("/superadmin/storage/schedules", {
        method: "POST", body: JSON.stringify(payload),
      });
      toast({ title: "✅ Schedule creato" });
    }
    setEditingSchedule(null);
    await load();
  };

  const deleteSchedule = async (s: BackupSchedule) => {
    try {
      await apiFetch(`/superadmin/storage/schedules/${s.id}`, { method: "DELETE" });
      toast({ title: "🗑️ Schedule eliminato" });
      setDeletingSchedule(null);
      await load();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Caricamento storage...</p>
      </div>
    );
  }

  if (!data) return null;

  const totalPct = data.summary.totalStorageLimitMb > 0
    ? Math.round((data.summary.totalStorageUsedMb / data.summary.totalStorageLimitMb) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Storage Usato" value={fmtSize(data.summary.totalStorageUsedMb)} sub={`${totalPct}% del limite`} icon={HardDrive} color={getUsageColor(totalPct)} />
        <KpiCard title="Backup Totali" value={String(data.summary.totalBackups)} sub={`${data.summary.completedBackups} completati`} icon={Archive} color="hsl(var(--chart-2))" />
        <KpiCard title="Schedule Attivi" value={String(data.summary.activeSchedules)} sub={data.summary.nextScheduled ? `Prossimo: ${new Date(data.summary.nextScheduled).toLocaleString("it-IT")}` : "Nessuno programmato"} icon={CalendarClock} color="hsl(var(--chart-3))" />
        <KpiCard
          title="Ultimo Backup"
          value={data.summary.lastBackupAt ? new Date(data.summary.lastBackupAt).toLocaleDateString("it-IT") : "Mai"}
          sub={data.summary.failedBackups > 0 ? `${data.summary.failedBackups} falliti` : "Tutto ok"}
          icon={data.summary.failedBackups > 0 ? AlertTriangle : ShieldCheck}
          color={data.summary.failedBackups > 0 ? "hsl(0 70% 55%)" : "hsl(var(--chart-4))"}
        />
      </div>

      {/* Trigger manuale */}
      <Card className="glass-card">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />Avvia Backup Manuale
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Eseguito in background, salvato su MinIO.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={backupType} onValueChange={setBackupType}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL">Full</SelectItem>
                <SelectItem value="SCHEMA">Schema</SelectItem>
                <SelectItem value="INCREMENTAL">Incrementale</SelectItem>
              </SelectContent>
            </Select>
            <Select value={backupTenant} onValueChange={setBackupTenant}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tutti i tenant</SelectItem>
                {data.tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={triggerBackup} disabled={triggering}>
              {triggering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Avvia
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="backups">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="backups"><Archive className="h-4 w-4 mr-2" />Cronologia</TabsTrigger>
            <TabsTrigger value="schedules"><CalendarDays className="h-4 w-4 mr-2" />Pianificazione</TabsTrigger>
            <TabsTrigger value="storage"><HardDrive className="h-4 w-4 mr-2" />Storage Tenant</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />Aggiorna
          </Button>
        </div>

        {/* ── Cronologia Backup ─────────────────────────────────── */}
        <TabsContent value="backups" className="mt-4">
          <div className="space-y-2">
            {data.recentBackups.map(b => (
              <Card key={b.id} className="glass-card group hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="shrink-0">{getStatusBadge(b.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-sm">{b.type}</span>
                      <span className="text-xs text-muted-foreground">{b.tenantSlug ? `Tenant: ${b.tenantSlug}` : "Backup globale"}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span>{new Date(b.createdAt).toLocaleString("it-IT")}</span>
                      {b.sizeMb > 0 && <span className="tabular-nums font-medium">{fmtSize(b.sizeMb)}</span>}
                      {b.durationSeconds > 0 && <span className="tabular-nums">{b.durationSeconds}s</span>}
                    </div>
                    {b.error && <p className="text-xs text-red-500 mt-1 truncate">{b.error}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {b.status === "COMPLETED" && b.storagePath && (
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => downloadBackup(b)} disabled={downloading === b.id}>
                        {downloading === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Scarica
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {b.status === "COMPLETED" && b.storagePath && (<>
                          <DropdownMenuItem onClick={() => downloadBackup(b)} disabled={downloading === b.id}>
                            <Download className="h-4 w-4 mr-2" />Scarica backup
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRestoreTarget(b)} className="text-amber-600 focus:text-amber-600">
                            <RotateCcw className="h-4 w-4 mr-2" />Ripristina database
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>)}
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(b)}>
                          <Trash2 className="h-4 w-4 mr-2" />Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
            {data.recentBackups.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Archive className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nessun backup registrato</p>
                <p className="text-xs mt-1">Avvia il primo backup manuale oppure configura uno schedule automatico</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Pianificazione ─────────────────────────────────────── */}
        <TabsContent value="schedules" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setEditingSchedule(null); setScheduleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Nuovo schedule
            </Button>
          </div>
          <div className="space-y-3">
            {(data.schedules ?? []).map(s => (
              <Card key={s.id} className="glass-card group hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="shrink-0">
                    {s.isActive
                      ? <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><ToggleRight className="h-3 w-3" />Attivo</Badge>
                      : <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground gap-1"><ToggleLeft className="h-3 w-3" />Inattivo</Badge>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-sm">
                        {s.tenantName ?? "🌐 Globale"} — {s.backupType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span>{freqLabel(s)}</span>
                      <span>Retention: {s.retentionDays > 0 ? `${s.retentionDays} giorni` : "Nessuna"}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {s.lastRunAt && <span>Ultima esecuzione: {new Date(s.lastRunAt).toLocaleString("it-IT")}</span>}
                      {s.nextRunAt && <span className="text-primary font-medium">Prossima: {new Date(s.nextRunAt).toLocaleString("it-IT")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setEditingSchedule(s); setScheduleDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingSchedule(s)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(data.schedules ?? []).length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nessun schedule configurato</p>
                <p className="text-xs mt-1">Crea uno schedule per automatizzare i backup</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Storage per Tenant ─────────────────────────────────── */}
        <TabsContent value="storage" className="mt-4">
          <div className="space-y-3">
            {data.tenants.map(t => (
              <Card key={t.id} className="glass-card group hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Database className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{t.name}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{t.slug}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground tabular-nums">{fmtSize(t.storageUsedMb)}</p>
                      <p className="text-xs text-muted-foreground">di {t.storageLimitGb} GB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={t.usagePercent} className="h-2 flex-1" />
                    <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: getUsageColor(t.usagePercent) }}>
                      {t.usagePercent}%
                    </span>
                  </div>
                  {t.usagePercent >= 85 && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />Spazio in esaurimento
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {data.tenants.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Server className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nessun tenant attivo</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Schedule ──────────────────────────────────────── */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => { setScheduleDialogOpen(false); setEditingSchedule(null); }}
        onSave={saveSchedule}
        tenants={data.tenants}
        editing={editingSchedule}
      />

      {/* ── Confirm Delete Backup ───────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina backup</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare il backup del{" "}
              <strong>{deleteTarget ? new Date(deleteTarget.createdAt).toLocaleString("it-IT") : ""}</strong>.
              Il file verrà rimosso anche da MinIO. Azione irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm Delete Schedule ─────────────────────────────── */}
      <AlertDialog open={!!deletingSchedule} onOpenChange={o => !o && setDeletingSchedule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Lo schedule <strong>{deletingSchedule ? freqLabel(deletingSchedule) : ""}</strong> verrà rimosso e non eseguirà più backup automatici.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingSchedule && deleteSchedule(deletingSchedule)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-2" />Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm Restore ─────────────────────────────────────── */}
      <AlertDialog open={!!restoreTarget} onOpenChange={o => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />Ripristina database
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Stai per ripristinare il database dal backup del{" "}
                  <strong>{restoreTarget ? new Date(restoreTarget.createdAt).toLocaleString("it-IT") : ""}</strong>
                  {restoreTarget?.sizeMb ? ` (${fmtSize(restoreTarget.sizeMb)})` : ""}.
                </p>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-amber-700 text-sm space-y-1">
                  <p className="font-bold">⚠️ Attenzione — operazione critica</p>
                  <p>Tutti i dati creati dopo la data del backup andranno persi.</p>
                  <p>Il ripristino viene eseguito in background. Controlla i log del server per verificare il completamento.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore} disabled={!!restoring}
              className="bg-amber-600 text-white hover:bg-amber-700">
              {restoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Conferma ripristino
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}