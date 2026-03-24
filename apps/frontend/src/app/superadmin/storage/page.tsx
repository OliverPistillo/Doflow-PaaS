// Percorso: apps/frontend/src/app/superadmin/storage/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, HardDrive, Database, Download,
  Trash2, Play, Clock, CheckCircle2, XCircle, AlertTriangle,
  Archive, Server, MoreHorizontal, FolderArchive,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

interface TenantStorage {
  id: string;
  name: string;
  slug: string;
  storageUsedMb: number;
  storageLimitGb: number;
  usagePercent: number;
}

interface BackupRow {
  id: string;
  tenantId: string | null;
  tenantSlug: string | null;
  type: string;
  status: string;
  sizeMb: number;
  storagePath: string | null;
  durationSeconds: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface StorageOverview {
  tenants: TenantStorage[];
  summary: {
    totalStorageUsedMb: number;
    totalStorageLimitMb: number;
    totalBackupSizeMb: number;
    totalBackups: number;
    completedBackups: number;
    failedBackups: number;
    lastBackupAt: string | null;
  };
  recentBackups: BackupRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function getUsageColor(pct: number): string {
  if (pct < 60) return "hsl(150 60% 45%)";
  if (pct < 85) return "hsl(40 80% 55%)";
  return "hsl(0 70% 55%)";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "COMPLETED": return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Completato</Badge>;
    case "RUNNING": return <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"><Loader2 className="h-3 w-3 mr-1 animate-spin" />In corso</Badge>;
    case "PENDING": return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />In coda</Badge>;
    case "FAILED": return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Fallito</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoragePage() {
  const { toast } = useToast();
  const [data, setData] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [backupType, setBackupType] = useState("FULL");
  const [backupTenant, setBackupTenant] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StorageOverview>("/superadmin/storage/overview");
      setData(res);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const triggerBackup = async () => {
    setTriggering(true);
    try {
      const body: any = { type: backupType };
      if (backupTenant !== "ALL") body.tenantId = backupTenant;
      await apiFetch("/superadmin/storage/backups/trigger", { method: "POST", body: JSON.stringify(body) });
      toast({ title: "Backup avviato", description: "Il backup è in coda di esecuzione." });
      // Ricarica dopo un secondo per dare tempo al backend
      setTimeout(() => load(), 1500);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setTriggering(false);
    }
  };

  const deleteBackup = async (id: string) => {
    try {
      await apiFetch(`/superadmin/storage/backups/${id}`, { method: "DELETE" });
      toast({ title: "Backup eliminato" });
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
    ? Math.round((data.summary.totalStorageUsedMb / data.summary.totalStorageLimitMb) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Storage Usato" value={fmtSize(data.summary.totalStorageUsedMb)} sub={`${totalPct}% del limite`} icon={HardDrive} color={getUsageColor(totalPct)} />
        <KpiCard title="Backup Totali" value={String(data.summary.totalBackups)} sub={`${data.summary.completedBackups} completati`} icon={Archive} color="hsl(var(--chart-2))" />
        <KpiCard title="Spazio Backup" value={fmtSize(data.summary.totalBackupSizeMb)} icon={FolderArchive} color="hsl(var(--chart-3))" />
        <KpiCard
          title="Ultimo Backup"
          value={data.summary.lastBackupAt ? new Date(data.summary.lastBackupAt).toLocaleDateString("it-IT") : "Mai"}
          sub={data.summary.failedBackups > 0 ? `${data.summary.failedBackups} falliti` : "Tutto ok"}
          icon={Clock}
          color={data.summary.failedBackups > 0 ? "hsl(0 70% 55%)" : "hsl(var(--chart-4))"}
        />
      </div>

      {/* Backup Trigger */}
      <Card className="glass-card">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2"><Play className="h-4 w-4 text-primary" />Avvia Nuovo Backup</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Seleziona il tipo e il target del backup.</p>
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
                {data.tenants.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={triggerBackup} disabled={triggering}>
              {triggering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Avvia Backup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Storage per Tenant / Cronologia Backup */}
      <Tabs defaultValue="storage">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="storage"><HardDrive className="h-4 w-4 mr-2" />Storage Tenant</TabsTrigger>
            <TabsTrigger value="backups"><Archive className="h-4 w-4 mr-2" />Cronologia Backup</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3 w-3 mr-1.5" />Aggiorna</Button>
        </div>

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
                    <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: getUsageColor(t.usagePercent) }}>{t.usagePercent}%</span>
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

        {/* ── Cronologia Backup ──────────────────────────────────── */}
        <TabsContent value="backups" className="mt-4">
          <div className="space-y-2">
            {data.recentBackups.map(b => (
              <Card key={b.id} className="glass-card group hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="shrink-0">{getStatusBadge(b.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-sm">{b.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.tenantSlug ? `Tenant: ${b.tenantSlug}` : "Backup globale"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{new Date(b.createdAt).toLocaleString("it-IT")}</span>
                      {b.sizeMb > 0 && <span className="tabular-nums">{fmtSize(b.sizeMb)}</span>}
                      {b.durationSeconds > 0 && <span className="tabular-nums">{b.durationSeconds}s</span>}
                    </div>
                    {b.error && <p className="text-xs text-red-500 mt-1 truncate">{b.error}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {b.storagePath && (
                        <DropdownMenuItem><Download className="h-4 w-4 mr-2" />Scarica</DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteBackup(b.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
            {data.recentBackups.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Archive className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nessun backup registrato</p>
                <p className="text-xs mt-1">Avvia il primo backup con il pulsante sopra</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
