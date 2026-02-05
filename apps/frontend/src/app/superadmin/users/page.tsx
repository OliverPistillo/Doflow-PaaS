"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Users, Search, RefreshCw, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  is_active: boolean;
};

type TenantUserRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

function DegradedBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-4 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-black text-slate-900">Degraded</div>
          <div className="text-sm text-slate-700 mt-1">{message}</div>
          <div className="mt-3">
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" /> Riprova
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RoleBadge({ role }: { role: string }) {
  const r = (role || "user").toLowerCase();

  const cls =
    r === "superadmin" || r === "owner"
      ? "bg-red-50 border-red-200 text-red-700"
      : r === "admin"
      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
      : r === "manager"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : r === "editor"
      ? "bg-sky-50 border-sky-200 text-sky-700"
      : "bg-slate-100 border-slate-200 text-slate-700";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black border ${cls}`}>
      {r.toUpperCase()}
    </span>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function SuperadminUsersPage() {
  const { toast } = useToast();

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState<string>("");

  const [users, setUsers] = useState<TenantUserRow[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [degraded, setDegraded] = useState<string | null>(null);

  // filtri UI
  const [search, setSearch] = useState("");

  const loadTenants = async () => {
    setLoadingTenants(true);
    setDegraded(null);
    try {
      // ✅ usa apiFetch così passa sempre Bearer token
      const data = await apiFetch<{ tenants: TenantRow[] }>("/superadmin/tenants");
      const list = Array.isArray(data?.tenants) ? data.tenants : [];
      setTenants(list);
      if (!tenantId && list.length > 0) setTenantId(list[0].id);
    } catch (e: any) {
      setTenants([]);
      setDegraded(e?.message || "Impossibile caricare la lista tenant.");
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadUsers = async (id: string) => {
    if (!id) return;
    setLoadingUsers(true);
    setDegraded(null);

    try {
      // Endpoint già presente nel tuo BE: users-list-debug
      const data = await apiFetch<{ users: TenantUserRow[] }>(`/superadmin/tenants/${id}/users-list-debug`);
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (e: any) {
      setUsers([]);
      setDegraded(e?.message || "Impossibile caricare gli utenti del tenant.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tenantId) loadUsers(tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) || null,
    [tenants, tenantId],
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const hay = [u.email, u.role, u.id].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [users, search]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestione Utenti</h1>
          <p className="text-slate-500 font-medium">
            Vista per-tenant (schema users). Se vuoi anche la directory globale, aggiungiamo /superadmin/users.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTenants} disabled={loadingTenants}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingTenants ? "animate-spin" : ""}`} />
            Ricarica Tenant
          </Button>

          <Button
            variant="outline"
            onClick={() => tenantId && loadUsers(tenantId)}
            disabled={!tenantId || loadingUsers}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`} />
            Ricarica Utenti
          </Button>
        </div>
      </div>

      {degraded && <DegradedBanner message={degraded} onRetry={() => (tenantId ? loadUsers(tenantId) : loadTenants())} />}

      {/* Tenant selector + search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tenant</span>

          <Select value={tenantId} onValueChange={setTenantId} disabled={loadingTenants || tenants.length === 0}>
            <SelectTrigger className="w-[340px] bg-white">
              <SelectValue placeholder={loadingTenants ? "Caricamento..." : "Scegli azienda..."} />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.slug}){t.is_active ? "" : " — SUSPENDED"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTenant && (
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
              schema: {selectedTenant.schema_name}
            </span>
          )}
        </div>

        <div className="relative flex-1 md:ml-auto max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cerca email, ruolo, id..."
            className="pl-9 border-slate-200 bg-slate-50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <div className="font-bold text-slate-700">Utenti del tenant</div>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {loadingUsers ? "Caricamento..." : `${filteredUsers.length} utenti`}
          </div>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Ruolo</th>
              <th className="px-6 py-4">Creato</th>
              <th className="px-6 py-4">ID</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loadingUsers ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-400">
                  Caricamento utenti...
                </td>
              </tr>
            ) : !tenantId ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-400">
                  Seleziona un tenant.
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-400">
                  Nessun utente trovato.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-indigo-700">{u.email}</td>
                  <td className="px-6 py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                    {fmtDate(u.created_at)}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{u.id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Nota: road map */}
      <Card className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="text-sm text-slate-600">
          Roadmap “enterprise” consigliata:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              Endpoint dedicato <span className="font-mono text-slate-900">/superadmin/users</span> per la directory globale (public.users).
            </li>
            <li>
              Azioni: sospendi utente / reset password / cambio ruolo (con audit log automatico).
            </li>
            <li>
              Filtro lato server + paginazione (per non bruciare il browser quando cresci).
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
