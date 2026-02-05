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
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  is_active: boolean;
  plan_tier?: string | null;
  admin_email?: string | null;
  created_at?: string | null;
};

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-800 border-emerald-200">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border bg-rose-50 text-rose-800 border-rose-200">
      <span className="h-2 w-2 rounded-full bg-rose-500" />
      Suspended
    </span>
  );
}

export default function TenantsPage() {
  const { toast } = useToast();

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtri
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  // Modale reset pwd
  const [resetModal, setResetModal] = useState<{
    open: boolean;
    tenantId: string;
    email: string;
    result?: string;
  } | null>(null);

  const filteredTenants = useMemo(() => {
    let res = tenants;

    if (search) {
      const q = search.toLowerCase();
      res = res.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(q) ||
          (t.slug || "").toLowerCase().includes(q) ||
          (t.schema_name || "").toLowerCase().includes(q),
      );
    }

    if (statusFilter === "active") res = res.filter((t) => !!t.is_active);
    if (statusFilter === "suspended") res = res.filter((t) => !t.is_active);

    return res;
  }, [search, statusFilter, tenants]);

  const loadTenants = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const data = await apiFetch<{ tenants: TenantRow[]; warning?: string }>(
        "/superadmin/tenants",
        { method: "GET" },
      );

      const rows = Array.isArray(data?.tenants) ? data.tenants : [];
      setTenants(rows);

      if (data?.warning) {
        // non lo spariamo in faccia all’utente, ma lo segnaliamo in toast “soft”
        toast({
          title: "Nota",
          description: "Lista tenant caricata in modalità compatibile (fallback).",
        });
      }
    } catch (e: any) {
      const msg = e?.message || "Impossibile caricare la lista tenant.";
      setTenants([]);
      setErrorMsg(msg);
      toast({ title: "Errore", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImpersonate = async (tenantId: string) => {
    const adminEmail = prompt("Email admin da impersonare:", "admin@example.com");
    if (!adminEmail) return;

    try {
      const data = await apiFetch<{ token: string; redirectUrl: string }>(
        `/superadmin/tenants/${tenantId}/impersonate`,
        { method: "POST", body: JSON.stringify({ email: adminEmail }) },
      );

      window.open(`${data.redirectUrl}?token=${data.token}`, "_blank");
      toast({ title: "Sessione avviata", description: `Accesso su ${data.redirectUrl}` });
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
        { method: "POST", body: JSON.stringify({ email: resetModal.email }) },
      );

      setResetModal({ ...resetModal, result: data.tempPassword });
      toast({ title: "Successo", description: "Password rigenerata con successo." });
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Reset password fallito.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* TOP BAR */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Tenants</h1>
          </div>
          <p className="text-sm text-slate-500">
            Portfolio clienti, piani, schemi DB e accessi amministrativi.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTenants} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold">
            <Plus className="mr-2 h-4 w-4" /> New Tenant
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search name, slug, schema…"
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
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="suspended">Suspended only</option>
            </select>
          </div>
        </div>

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="font-semibold">Degraded</div>
            <div className="text-sm mt-1">{errorMsg}</div>
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Company</th>
              <th className="px-6 py-4">Plan</th>
              <th className="px-6 py-4">Schema</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">
                  Loading tenants…
                </td>
              </tr>
            ) : filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">
                  No tenants found.
                </td>
              </tr>
            ) : (
              filteredTenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 shrink-0 border border-indigo-100">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{t.name}</div>
                        <div className="text-slate-400 text-xs font-mono truncate">/{t.slug}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <Badge
                      variant="outline"
                      className="border-indigo-200 text-indigo-800 bg-indigo-50 font-semibold px-3 py-1"
                    >
                      {t.plan_tier || "STARTER"}
                    </Badge>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-md w-fit border border-slate-200">
                      {t.schema_name}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <StatusPill active={!!t.is_active} />
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImpersonate(t.id)}
                        className="hidden group-hover:flex h-8 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50"
                      >
                        <Eye className="h-4 w-4 mr-2" /> Enter
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Tenant actions</DropdownMenuLabel>

                          <DropdownMenuItem onClick={() => handleImpersonate(t.id)}>
                            <Eye className="mr-2 h-4 w-4" /> Impersonate admin
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
                            <KeyRound className="mr-2 h-4 w-4" /> Reset admin password
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem className="text-rose-600">
                            Suspend tenant
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

      {/* Reset modal */}
      {resetModal && (
        <Dialog open={resetModal.open} onOpenChange={(v) => !v && setResetModal(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset admin password</DialogTitle>
              <DialogDescription>
                Generazione nuove credenziali per <b>{resetModal.email}</b>.
              </DialogDescription>
            </DialogHeader>

            {!resetModal.result ? (
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={() => setResetModal(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleResetPassword}>
                  Generate
                </Button>
              </div>
            ) : (
              <div className="mt-4 bg-slate-900 text-white p-6 rounded-xl text-center shadow-lg">
                <div className="text-xs text-slate-400 mb-2 uppercase tracking-widest font-semibold">
                  Temporary password
                </div>
                <div className="text-3xl font-mono font-black tracking-wider select-all cursor-text text-emerald-400">
                  {resetModal.result}
                </div>
                <div className="text-xs text-slate-400 mt-4">Copy it now. It won’t be shown again.</div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
