"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  KeyRound,
  Plus,
  Building2,
  MoreHorizontal,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  Database,
  Loader2,
  Globe,
  Mail,
  Trash2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// --- TIPI (Allineati al Backend camelCase) ---
type TenantRow = {
  id: string;
  slug: string;
  name: string;
  schemaName: string;
  isActive: boolean;
  planTier?: string | null;
  maxUsers?: number | null;
  storageUsedMb?: number | null;
  storageLimitGb?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ResetModalState = {
  open: boolean;
  tenantId: string;
  email: string;
  result?: string;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok" }
  | { status: "degraded"; message: string };

// --- UTILS ---
function formatMbToGb(mb?: number | null): string {
  if (!mb || mb <= 0) return "0.00";
  return (mb / 1024).toFixed(2);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("it-IT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

// --- COMPONENTI UI ---
const StatusPill = ({ isActive }: { isActive: boolean }) => {
  return isActive ? (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
      <CheckCircle2 className="h-4 w-4" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
      <PauseCircle className="h-4 w-4" />
      Suspended
    </span>
  );
};

export default function TenantsPage() {
  const { toast } = useToast();

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  const [resetModal, setResetModal] = useState<ResetModalState | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [newTenant, setNewTenant] = useState({ name: "", slug: "", email: "", plan: "STARTER" });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (newTenant.name) {
      setNewTenant(prev => ({ ...prev, slug: generateSlug(prev.name) }));
    }
  }, [newTenant.name]);

  const filteredTenants = useMemo(() => {
    let res = tenants;

    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(q) ||
          (t.slug || "").toLowerCase().includes(q) ||
          (t.schemaName || "").toLowerCase().includes(q),
      );
    }

    if (statusFilter === "active") res = res.filter((t) => !!t.isActive);
    if (statusFilter === "suspended") res = res.filter((t) => !t.isActive);

    return res;
  }, [tenants, search, statusFilter]);

  const loadTenants = async () => {
    setFetchState({ status: "loading" });
    try {
      // Usiamo la rotta V2 per bypassare cache residue
      const data = await apiFetch<any>("/superadmin/v2/tenants");
      const list = Array.isArray(data?.tenants) ? data.tenants : [];

      setTenants(list);
      setFetchState({ status: "ok" });

      if (data?.warning) {
        toast({
          title: "Avviso",
          description: `Risposta in modalità fallback (${data.warning}).`,
        });
      }
    } catch (e: any) {
      const msg = e?.message || "Impossibile caricare i tenant";
      setTenants([]);
      setFetchState({ status: "degraded", message: msg });

      toast({
        title: "Errore caricamento",
        description: msg,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug || !newTenant.email) {
      toast({ title: "Dati mancanti", description: "Compila tutti i campi obbligatori.", variant: "destructive" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTenant.email)) {
      toast({ title: "Email non valida", description: "Inserisci un indirizzo email corretto.", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      await apiFetch("/superadmin/v2/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTenant)
      });

      toast({
        title: "Tenant Creato! 🚀",
        description: `Il database per ${newTenant.name} è stato provisionato.`,
        className: "bg-emerald-50 border-emerald-200 text-emerald-800"
      });

      setIsCreateOpen(false);
      setNewTenant({ name: "", slug: "", email: "", plan: "STARTER" });
      loadTenants();
    } catch (e: any) {
      console.error(e);
      let errorMessage = e.message || "Impossibile creare il tenant.";
      if (e.message && Array.isArray(e.message)) errorMessage = e.message.join(", ");

      toast({
        title: "Errore creazione",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleImpersonate = async (tenantId: string) => {
    const adminEmail = prompt("Email admin da impersonare:", "admin@example.com");
    if (!adminEmail) return;

    try {
      const data = await apiFetch<{ token: string; redirectUrl: string }>(
        `/superadmin/tenants/${tenantId}/impersonate`,
        {
          method: "POST",
          body: JSON.stringify({ email: adminEmail }),
        },
      );

      window.open(`${data.redirectUrl}?token=${data.token}`, "_blank");
      toast({
        title: "Sessione avviata",
        description: `Accesso fantasma su ${data.redirectUrl}`,
      });
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Impossibile impersonare l'utente.",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal) return;

    try {
      const data = await apiFetch<{ tempPassword: string }>(
        `/superadmin/tenants/${resetModal.tenantId}/reset-admin-password`,
        {
          method: "POST",
          body: JSON.stringify({ email: resetModal.email }),
        },
      );

      setResetModal({ ...resetModal, result: data.tempPassword });
      toast({
        title: "Successo",
        description: "Password rigenerata con successo.",
      });
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Reset fallito.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    const confirmMessage = `🚨 ATTENZIONE: ZONA PERICOLOSA 🚨\n\nStai per eliminare DEFINITIVAMENTE il tenant:\n\nnome: ${tenantName}\nid: ${tenantId}\n\nQuesta operazione cancellerà:\n1. Il record del cliente\n2. L'INTERO SCHEMA DATABASE associato e tutti i suoi dati.\n\nSei assolutamente sicuro?`;

    if (!window.confirm(confirmMessage)) return;
    if (!window.confirm(`Ultima possibilità: Confermi l'eliminazione di ${tenantName}?`)) return;

    try {
      await apiFetch(`/superadmin/v2/tenants/${tenantId}`, {
        method: "DELETE",
      });

      toast({
        title: "Tenant Eliminato",
        description: "Il tenant e i suoi dati sono stati rimossi.",
        variant: "destructive"
      });

      loadTenants();
    } catch (e: any) {
      toast({
        title: "Errore Eliminazione",
        description: e?.message || "Impossibile eliminare il tenant.",
        variant: "destructive",
      });
    }
  };

  const isLoading = fetchState.status === "loading";
  const isDegraded = fetchState.status === "degraded";

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in">

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Clienti & Tenant</h1>
          <p className="text-slate-500 font-medium">
            Gestione aziende, contratti, schemi DB e accessi amministrativi.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button variant="outline" onClick={loadTenants} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>

          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 font-bold"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Tenant
          </Button>
        </div>
      </div>

      {/* STATUS BANNER */}
      {isDegraded && (
        <Card className="p-4 rounded-2xl border border-rose-200 bg-rose-50">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-rose-100 p-2 text-rose-700 border border-rose-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-black text-rose-900">Degraded</div>
              <div className="text-sm text-rose-800 font-medium mt-1 break-words">
                {fetchState.status === "degraded" ? fetchState.message : "Errore inatteso."}
              </div>
              <div className="mt-3">
                <Button variant="outline" className="border-rose-200" onClick={loadTenants}>
                  Riprova
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cerca azienda, slug o schema DB..."
            className="pl-9 border-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">Tutti gli stati</option>
            <option value="active">Solo attivi</option>
            <option value="suspended">Sospesi</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-black text-slate-900">
            Tenant ({filteredTenants.length})
          </div>
          <div className="text-xs font-medium text-slate-400">
            Ultimo refresh: {new Date().toLocaleTimeString("it-IT")}
          </div>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Azienda</th>
              <th className="px-6 py-4">Piano</th>
              <th className="px-6 py-4">Schema</th>
              <th className="px-6 py-4">Storage</th>
              <th className="px-6 py-4">Stato</th>
              <th className="px-6 py-4">Aggiornato</th>
              <th className="px-6 py-4 text-right">Azioni</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin h-6 w-6 text-indigo-600" />
                    Caricamento in corso...
                  </div>
                </td>
              </tr>
            ) : filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-400">
                  Nessun tenant trovato.
                </td>
              </tr>
            ) : (
              filteredTenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 text-base truncate">
                          {t.name}
                        </div>
                        <div className="text-slate-400 text-xs font-mono truncate flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {t.slug}.tuodominio.it
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <Badge
                      variant="outline"
                      className="border-indigo-200 text-indigo-700 bg-indigo-50 font-bold px-3 py-1"
                    >
                      {t.planTier || "STARTER"}
                    </Badge>
                    <div className="text-xs text-slate-400 mt-2 font-medium">
                      Max users: <span className="font-mono">{t.maxUsers ?? "-"}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200 flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {t.schemaName}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-black text-slate-900">
                      {formatMbToGb(t.storageUsedMb)} GB
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      Limit: <span className="font-mono">{t.storageLimitGb ?? 0} GB</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <StatusPill isActive={!!t.isActive} />
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-700">
                      {formatDate(t.updatedAt || t.createdAt)}
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      Creato: {formatDate(t.createdAt)}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImpersonate(t.id)}
                        className="hidden group-hover:flex h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Entra
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Azioni Tenant</DropdownMenuLabel>

                          <DropdownMenuItem onClick={() => handleImpersonate(t.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Impersona Admin
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() =>
                              setResetModal({
                                open: true,
                                tenantId: t.id,
                                email: "admin@example.com",
                              })
                            }
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Reset Password
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            className="text-slate-600 focus:text-slate-700"
                            onClick={() => toast({ title: "In Sviluppo", description: "La sospensione sarà presto disponibile." })}
                          >
                            <PauseCircle className="mr-2 h-4 w-4" />
                            Sospendi Accesso
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 font-bold"
                            onClick={() => handleDeleteTenant(t.id, t.name)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Elimina Definitivamente
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE TENANT MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuovo Tenant</DialogTitle>
            <DialogDescription>
              Configura un nuovo ambiente isolato. Verrà creato automaticamente uno schema DB dedicato.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome Azienda</Label>
              <Input
                id="name"
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                placeholder="Es. Acme Corp"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="slug">URL Slug (Auto)</Label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="slug"
                    value={newTenant.slug}
                    onChange={(e) => setNewTenant({ ...newTenant, slug: generateSlug(e.target.value) })}
                    className="pl-9 font-mono text-sm bg-slate-50"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan">Piano</Label>
                <select
                  id="plan"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={newTenant.plan}
                  onChange={(e) => setNewTenant({ ...newTenant, plan: e.target.value })}
                >
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Amministratore</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={newTenant.email}
                  onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                  className="pl-9"
                  placeholder="admin@azienda.com"
                />
              </div>
              <p className="text-[11px] text-slate-500">Invieremo un invito per impostare la password.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Annulla</Button>
            <Button onClick={handleCreateTenant} disabled={isCreating} className="bg-indigo-600 hover:bg-indigo-700">
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Provisioning DB...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Crea Tenant
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD MODAL */}
      {resetModal && (
        <Dialog open={resetModal.open} onOpenChange={(v) => !v && setResetModal(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Reset Password Amministratore</DialogTitle>
              <DialogDescription>
                Generazione nuove credenziali per <b>{resetModal.email}</b>.
              </DialogDescription>
            </DialogHeader>

            {!resetModal.result ? (
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={() => setResetModal(null)}>
                  Annulla
                </Button>
                <Button variant="destructive" onClick={handleResetPassword}>
                  Genera Nuova Password
                </Button>
              </div>
            ) : (
              <div className="mt-4 bg-slate-900 text-white p-6 rounded-2xl text-center shadow-lg">
                <div className="text-xs text-slate-400 mb-2 uppercase tracking-widest font-bold">
                  Credenziali
                </div>
                <div className="text-3xl font-mono font-black tracking-wider select-all cursor-text text-emerald-400">
                  {resetModal.result}
                </div>
                <div className="text-xs text-slate-500 mt-4">
                  Copia la password ora. Dopo chiudo la porta e butto via la chiave.
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}