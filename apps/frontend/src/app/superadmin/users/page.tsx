"use client";

/* ======================================================
   IMPORTS
====================================================== */

import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Plus,
  Shield,
  Ban,
  KeyRound,
  History,
  Lock,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/* ======================================================
   TYPES
====================================================== */

type GlobalUser = {
  id: string;
  email: string;
  role: string;
  tenant_id: string; // ID, schema_name o slug (dipende dai dati storici)
  tenant_name?: string;
  tenant_slug?: string;
  tenant_schema?: string;
  is_active: boolean;
  mfa_required?: boolean;
  created_at: string;
};

type AuditRow = {
  id: string;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  metadata: any;
  created_at: string;
};

/* --- Tenant directory (for filter + create modal) --- */
type TenantRow = {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  is_active: boolean;
};

/* --- KPI Types --- */
type KpiByTenantRow = {
  tenant_id: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_schema: string | null;
  total_users: number;
  active_users: number;
  suspended_users: number;
  new_users_window: number;
};

type TrendPoint = {
  day: string; // YYYY-MM-DD
  new_users: number;
};

type UsersKpiResponse = {
  windowDays: number;
  top: number;
  tenantFilter: string | null;
  kpiByTenant: KpiByTenantRow[];
  trend: TrendPoint[];
};

/* ======================================================
   CONSTANTS & UTILS
====================================================== */

const AUDIT_COLOR: Record<string, string> = {
  RESET_PASSWORD: "bg-amber-100 text-amber-800 border-amber-200",
  TENANT_USER_CREATED: "bg-green-100 text-green-800 border-green-200",
  TENANT_USER_UPDATED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  GLOBAL_USER_UPDATED: "bg-purple-100 text-purple-800 border-purple-200",
  USER_SUSPENDED: "bg-red-100 text-red-800 border-red-200",
  MFA_ENABLED: "bg-sky-100 text-sky-800 border-sky-200",
  MFA_DISABLED: "bg-slate-100 text-slate-700 border-slate-200",
};

function RoleBadge({ role }: { role: string }) {
  const r = (role || "user").toLowerCase();
  const cls =
    r === "superadmin" || r === "owner"
      ? "bg-red-50 text-red-700 border-red-200"
      : r === "admin"
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : r === "manager"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${cls}`}>
      {r.toUpperCase()}
    </span>
  );
}

function fmtDate(v: string) {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

/* ======================================================
   PAGE
====================================================== */

export default function SuperadminUsersPage() {
  const { toast } = useToast();

  /* =========================
       DATA STATE
  ========================= */

  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Tenants directory (id filter + create)
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  // KPI State
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpi, setKpi] = useState<UsersKpiResponse | null>(null);

  /* =========================
       FILTER STATE
  ========================= */

  const [q, setQ] = useState("");
  const [role, setRole] = useState("__all__");
  const [isActive, setIsActive] = useState("__all__");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  /* =========================
       VIEW MODE
  ========================= */

  const [activeTab, setActiveTab] = useState<"global" | "tenant">("global");

  // ✅ USIAMO ID (UUID) per il filtro
  const [targetTenantId, setTargetTenantId] = useState<string>("__all__");

  /* =========================
       MODALS
  ========================= */

  const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const [resetUser, setResetUser] = useState<GlobalUser | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);

  /* =========================
       CREATE USER STATE
  ========================= */

  const [createEmail, setCreateEmail] = useState("");
  const [createTenantId, setCreateTenantId] = useState<string>(""); // UUID
  const [createRole, setCreateRole] = useState("user");
  const [accessMode, setAccessMode] = useState<"invite" | "password">("invite");
  const [createMfa, setCreateMfa] = useState(true);
  const [creating, setCreating] = useState(false);

  const resolvedTenantForCreate = useMemo(() => {
    if (!createTenantId || createTenantId === "__none__") return null;
    return tenants.find((x) => x.id === createTenantId) ?? null;
  }, [createTenantId, tenants]);

  const resolvedTenantForFilter = useMemo(() => {
    if (targetTenantId === "__all__") return null;
    return tenants.find((x) => x.id === targetTenantId) ?? null;
  }, [targetTenantId, tenants]);

  /* ======================================================
       LOAD TENANTS
  ======================================================= */

  const loadTenants = async () => {
    setLoadingTenants(true);
    try {
      const data = await apiFetch<{ tenants: TenantRow[] }>("/superadmin/tenants");
      const list = Array.isArray(data?.tenants) ? data.tenants : [];
      setTenants(list);

      // se siamo in tab tenant e non abbiamo selezione, pre-seleziona il primo attivo
      if (activeTab === "tenant" && targetTenantId === "__all__") {
        const firstActive = list.find((t) => t.is_active) ?? list[0];
        if (firstActive?.id) setTargetTenantId(firstActive.id);
      }
    } catch (e: any) {
      setTenants([]);
      toast({
        title: "Errore",
        description: e?.message || "Impossibile caricare la lista tenant",
        variant: "destructive",
      });
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ======================================================
       LOAD USERS + KPI
  ======================================================= */

  const buildUsersQuery = () => {
    const tenantParam =
      activeTab === "tenant" && targetTenantId !== "__all__"
        ? targetTenantId
        : "";

    return new URLSearchParams({
      q,
      role: role === "__all__" ? "" : role,
      is_active: isActive === "__all__" ? "" : isActive,
      tenantId: tenantParam, // ✅ Inviamo UUID come 'tenantId'
      page: String(page),
      pageSize: String(pageSize),
    }).toString();
  };

  const loadUsers = async () => {
    // Se siamo in tab tenant ma non è selezionato nessun tenant, non carichiamo
    if (activeTab === "tenant" && (targetTenantId === "__all__" || !targetTenantId)) {
      setUsers([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const qs = buildUsersQuery();
      const endpoint = `/superadmin/users?${qs}`;

      const data = await apiFetch<{
        users: GlobalUser[];
        total: number;
      }>(endpoint);

      setUsers(Array.isArray(data?.users) ? data.users : []);
      setTotal(Number(data?.total ?? 0));
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Impossibile caricare utenti",
        variant: "destructive",
      });
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadKpi = async () => {
    setKpiLoading(true);
    try {
      const tenantFilter =
        activeTab === "tenant" && targetTenantId !== "__all__" ? targetTenantId : "";

      const qs = new URLSearchParams({
        days: "30",
        top: "20",
        tenantId: tenantFilter, // ✅ UUID
      }).toString();

      const data = await apiFetch<UsersKpiResponse>(`/superadmin/users/kpi?${qs}`);
      setKpi(data);
    } catch (e: any) {
      toast({
        title: "Errore KPI",
        description: e?.message || "Impossibile caricare KPI utenti",
        variant: "destructive",
      });
      setKpi(null);
    } finally {
      setKpiLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeTab, targetTenantId, role, isActive]);

  /* ======================================================
       ACTIONS
  ======================================================= */

  const patchUser = async (id: string, patch: any) => {
    try {
      await apiFetch(`/superadmin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadUsers();
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Operazione fallita",
        variant: "destructive",
      });
      throw e;
    }
  };

  const toggleMfa = async (u: GlobalUser) => {
    try {
      await patchUser(u.id, { mfa_required: !u.mfa_required });
      toast({
        title: "Aggiornato",
        description: `MFA ${!u.mfa_required ? "abilitato" : "disabilitato"} per ${u.email}`,
      });
    } catch {
      // toast gestito in patchUser
    }
  };

  const loadAudit = async (targetEmail: string) => {
    setAuditLoading(true);
    try {
      const qs = new URLSearchParams({
        target_email: targetEmail,
        limit: "200",
        offset: "0",
      }).toString();

      const data = await apiFetch<{ logs: AuditRow[] }>(`/superadmin/audit?${qs}`);
      setAudit(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e: any) {
      setAudit([]);
      toast({
        title: "Errore Audit",
        description: e?.message || "Impossibile caricare audit log",
        variant: "destructive",
      });
    } finally {
      setAuditLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!resetUser) return;

    try {
      // NB: resetUser.tenant_id dovrebbe essere lo schema o slug per l'URL, 
      // oppure l'ID se il backend lo supporta. 
      // Se users.tenant_id nel DB è lo slug, usiamo quello.
      const res = await apiFetch<{ tempPassword: string }>(
        `/superadmin/tenants/${resetUser.tenant_id}/users/${resetUser.id}/reset-password`,
        { method: "POST" },
      );

      setResetResult(res.tempPassword);
      await loadUsers();
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Reset password fallito",
        variant: "destructive",
      });
    }
  };

  const submitCreateUser = async () => {
    if (!createEmail || !createTenantId) {
      toast({
        title: "Dati mancanti",
        description: "Email e tenant sono obbligatori.",
        variant: "destructive",
      });
      return;
    }

    const t = resolvedTenantForCreate;
    if (!t) {
      toast({
        title: "Tenant non valido",
        description: "Seleziona un tenant valido.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        email: createEmail,
        role: createRole,
        mfa_required: createMfa,
        sendInvite: accessMode === "invite",
      };

      // ✅ POST usando l'ID del tenant
      const res = await apiFetch<{ tempPassword?: string }>(
        `/superadmin/tenants/${t.id}/users`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      toast({
        title: "Utente creato",
        description:
          accessMode === "invite"
            ? "Invito email inviato."
            : "Utente creato con password temporanea.",
      });

      if (res?.tempPassword) {
        alert(`Password temporanea:\n\n${res.tempPassword}`);
      }

      setShowCreate(false);
      setCreateEmail("");
      setCreateTenantId("");
      setCreateRole("user");
      setCreateMfa(true);
      setAccessMode("invite");

      await loadUsers();
      await loadKpi();
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Creazione utente fallita",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  /* ======================================================
       DERIVED
  ======================================================= */

  const scopeLabel = useMemo(() => {
    if (activeTab === "global") return "Directory globale";
    if (targetTenantId === "__all__") return "Tenant: —";
    const t = resolvedTenantForFilter;
    return t ? `Tenant: ${t.name} (${t.slug})` : `Tenant ID: ${targetTenantId}`;
  }, [activeTab, targetTenantId, resolvedTenantForFilter]);

  /* ======================================================
       RENDER
  ======================================================= */

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Gestione Utenti</h1>
          <p className="text-slate-500 font-medium">
            Identity &amp; Access Control – livello enterprise.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadTenants} disabled={loadingTenants}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingTenants ? "animate-spin" : ""}`} />
            Tenant
          </Button>

          <Button className="bg-indigo-600 text-white" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Crea Utente
          </Button>
        </div>
      </div>

      {/* TABS */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as any);
          setPage(1);
          // quando passi a tenant senza selezione, prova a impostare un tenant attivo
          if (v === "tenant" && (targetTenantId === "__all__" || !targetTenantId)) {
            const first = tenants.find((t) => t.is_active) ?? tenants[0];
            if (first?.id) setTargetTenantId(first.id);
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="global">
            <Users className="h-4 w-4 mr-2" />
            Directory Globale
          </TabsTrigger>
          <TabsTrigger value="tenant">
            <Shield className="h-4 w-4 mr-2" />
            Per Tenant
          </TabsTrigger>
        </TabsList>

        {/* FILTERS */}
        <Card className="p-4 mt-4 flex flex-wrap gap-4 items-center">
          {activeTab === "tenant" && (
            <div className="w-[300px]">
              <Select
                value={targetTenantId}
                onValueChange={(v) => {
                  setTargetTenantId(v);
                  setPage(1);
                }}
                disabled={loadingTenants || tenants.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingTenants ? "Caricamento..." : "Seleziona tenant"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Seleziona…</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.slug}){t.is_active ? "" : " — SUSPENDED"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Cerca email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  loadUsers();
                }
              }}
              onBlur={() => {
                setPage(1);
                loadUsers();
              }}
            />
          </div>

          <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Ruolo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>

          <Select value={isActive} onValueChange={(v) => { setIsActive(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              <SelectItem value="true">Attivi</SelectItem>
              <SelectItem value="false">Sospesi</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadUsers}>
            <RefreshCw className={`h-4 w-4 ${loading && "animate-spin"}`} />
          </Button>
        </Card>

        {/* ================= KPI SECTION ================= */}
        <Card className="p-5 border-slate-200 rounded-2xl shadow-sm bg-white mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                KPI Utenti — ultimi {kpi?.windowDays ?? 30} giorni
              </div>
              <div className="text-lg font-black text-slate-900 mt-1">{scopeLabel}</div>
            </div>

            <Button
              variant="outline"
              onClick={() => loadKpi()}
              disabled={kpiLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${kpiLoading ? "animate-spin" : ""}`} />
              Aggiorna KPI
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
            {(() => {
              // Cerchiamo la riga corrispondente al tenant selezionato (usando l'ID se possibile, o fallback)
              const row =
                activeTab === "tenant" && targetTenantId !== "__all__"
                  ? kpi?.kpiByTenant?.find(
                      (x) =>
                        x.tenant_id === targetTenantId || 
                        // Fallback nel caso il KPI ritorni slug o schema invece che UUID
                        (x.tenant_slug && resolvedTenantForFilter?.slug === x.tenant_slug)
                    )
                  : null;

              const total =
                row?.total_users ??
                (kpi?.kpiByTenant?.reduce((a, x) => a + (x.total_users || 0), 0) ?? 0);

              const active =
                row?.active_users ??
                (kpi?.kpiByTenant?.reduce((a, x) => a + (x.active_users || 0), 0) ?? 0);

              const suspended =
                row?.suspended_users ??
                (kpi?.kpiByTenant?.reduce((a, x) => a + (x.suspended_users || 0), 0) ?? 0);

              const newUsers =
                row?.new_users_window ??
                (kpi?.kpiByTenant?.reduce((a, x) => a + (x.new_users_window || 0), 0) ?? 0);

              const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;

              const Box = ({
                label,
                value,
                hint,
              }: {
                label: string;
                value: string;
                hint?: string;
              }) => (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {label}
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">{value}</div>
                  {hint ? <div className="text-xs text-slate-500 mt-2">{hint}</div> : null}
                </div>
              );

              return (
                <>
                  <Box label="Totale utenti" value={String(total)} />
                  <Box label="Attivi" value={String(active)} hint={`Active rate: ${activeRate}%`} />
                  <Box label="Sospesi" value={String(suspended)} />
                  <Box label="Nuovi (window)" value={String(newUsers)} hint="Creati nel periodo selezionato" />
                </>
              );
            })()}
          </div>

          {/* Trend */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-800">Trend: nuovi utenti / giorno</div>
              <Badge variant="outline" className="border-slate-200 text-slate-700 bg-white">
                {activeTab === "tenant" ? "Tenant scope" : "Global scope"}
              </Badge>
            </div>

            {/* ✅ FIX Recharts: Wrapper con dimensioni esplicite e min-width */}
            <div className="mt-3 w-full rounded-xl border border-slate-200 bg-white">
              <div className="h-[220px] min-h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                  <LineChart
                    data={kpi?.trend || []}
                    margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="new_users" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top tenants */}
          <div className="mt-6">
            <div className="font-bold text-slate-800 mb-2">Top tenant (per totale utenti)</div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Tenant</th>
                    <th className="px-4 py-3 text-left">Slug</th>
                    <th className="px-4 py-3 text-right">Tot</th>
                    <th className="px-4 py-3 text-right">Attivi</th>
                    <th className="px-4 py-3 text-right">Sospesi</th>
                    <th className="px-4 py-3 text-right">Nuovi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(kpi?.kpiByTenant || []).map((t) => (
                    <tr
                      key={t.tenant_id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        // Proviamo a trovare il tenant nella nostra lista per ottenere l'ID
                        const found = tenants.find(
                          local => local.slug === t.tenant_slug || local.schema_name === t.tenant_schema
                        );
                        if (found) {
                          setActiveTab("tenant");
                          setTargetTenantId(found.id);
                          setPage(1);
                        }
                      }}
                      title="Click per aprire questo tenant"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {t.tenant_name || t.tenant_slug || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {t.tenant_slug || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{t.total_users}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{t.active_users}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{t.suspended_users}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{t.new_users_window}</td>
                    </tr>
                  ))}
                  {!kpiLoading && (kpi?.kpiByTenant?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Nessun dato KPI disponibile.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* TABLE */}
        <Card className="overflow-hidden mt-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-500">
              <tr>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Ruolo</th>
                <th className="px-6 py-4">MFA</th>
                <th className="px-6 py-4">Tenant</th>
                <th className="px-6 py-4">Stato</th>
                <th className="px-6 py-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    Caricamento…
                  </td>
                </tr>
              ) : activeTab === "tenant" && (targetTenantId === "__all__" || !targetTenantId) ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    Seleziona un tenant per vedere gli utenti.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    Nessun utente trovato
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-indigo-700">{u.email}</td>
                    <td className="px-6 py-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-6 py-4">
                      <Switch checked={!!u.mfa_required} onCheckedChange={() => toggleMfa(u)} />
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {u.tenant_name || u.tenant_slug || u.tenant_id}
                    </td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="text-green-600 font-bold">ACTIVE</span>
                      ) : (
                        <span className="text-red-600 font-bold">SUSPENDED</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(u);
                          loadAudit(u.email);
                        }}
                        title="Audit"
                      >
                        <History className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => patchUser(u.id, { is_active: !u.is_active })}
                        title="Suspend / Unsuspend"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResetUser(u)}
                        title="Reset password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-slate-500">
            Totale: <span className="font-semibold text-slate-700">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <div className="text-sm font-medium text-slate-700 px-2">
              Pagina {page}
            </div>
            <Button
              variant="outline"
              disabled={loading || users.length < pageSize}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Tabs>

      {/* ======================================================
            MODALS (Audit / Create / Reset)
      ======================================================= */

      /* Audit modal */}
      {selectedUser && (
        <Dialog open onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedUser.email}</DialogTitle>
              <DialogDescription className="sr-only">
                Audit log utente e dettagli eventi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {auditLoading ? (
                <div className="p-6 text-center text-slate-400">
                  <RefreshCw className="inline-block h-4 w-4 mr-2 animate-spin" />
                  Caricamento audit…
                </div>
              ) : audit.length === 0 ? (
                <p className="text-slate-400 text-sm p-4">Nessun evento registrato.</p>
              ) : (
                audit.map((a) => (
                  <div key={a.id} className="border rounded-md p-3 text-sm">
                    <div className="flex justify-between">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold border ${
                          AUDIT_COLOR[a.action] ||
                          "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {a.action}
                      </span>
                      <span className="text-xs text-slate-400">{fmtDate(a.created_at)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Actor: <span className="font-semibold">{a.actor_email || "—"}</span>
                    </div>
                    {a.metadata && (
                      <pre className="mt-2 text-[10px] bg-slate-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(a.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create user modal */}
      {showCreate && (
        <Dialog
          open
          onOpenChange={(open) => {
            setShowCreate(open);
            if (!open) {
              setCreateEmail("");
              setCreateTenantId("");
              setCreateRole("user");
              setCreateMfa(true);
              setAccessMode("invite");
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crea nuovo utente</DialogTitle>
              <DialogDescription className="sr-only">
                Creazione utente tenant con policy MFA e invito.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-bold text-slate-600">Email</div>
                <Input
                  placeholder="utente@azienda.it"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </div>

              <div>
                <div className="text-sm font-bold text-slate-600">Tenant</div>
                <Select
                  value={createTenantId}
                  onValueChange={(v) => setCreateTenantId(v)}
                  disabled={loadingTenants || tenants.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTenants ? "Caricamento..." : "Seleziona tenant"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Seleziona…</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.slug}){t.is_active ? "" : " — SUSPENDED"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-600">Ruolo</div>
                <Select value={createRole} onValueChange={setCreateRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-600">Metodo di accesso</div>
                <Select value={accessMode} onValueChange={(v) => setAccessMode(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invite">Invito email (consigliato)</SelectItem>
                    {createRole !== "admin" && <SelectItem value="password">Password temporanea</SelectItem>}
                  </SelectContent>
                </Select>

                {createRole === "admin" && (
                  <p className="text-xs text-amber-600 mt-1">
                    Gli admin devono accedere solo tramite invito email.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium">MFA obbligatorio</span>
                </div>
                <Switch checked={createMfa} onCheckedChange={setCreateMfa} />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Annulla
              </Button>
              <Button
                onClick={submitCreateUser}
                disabled={creating}
                className="bg-indigo-600 text-white"
              >
                {creating ? "Creazione…" : "Crea Utente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <Dialog
          open
          onOpenChange={() => {
            setResetUser(null);
            setResetResult(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription className="sr-only">
                Conferma reset password e mostra password temporanea.
              </DialogDescription>
            </DialogHeader>

            {!resetResult ? (
              <p className="text-sm text-slate-600">
                Vuoi rigenerare la password per <b>{resetUser.email}</b>?
              </p>
            ) : (
              <div className="space-y-2">
                <div className="bg-slate-900 text-green-400 font-mono p-4 rounded text-center text-lg select-all">
                  {resetResult}
                </div>
                <p className="text-xs text-slate-400">
                  Copia ora. Non verrà mostrata di nuovo.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setResetUser(null);
                  setResetResult(null);
                }}
              >
                Chiudi
              </Button>
              {!resetResult && (
                <Button variant="destructive" onClick={resetPassword}>
                  Conferma Reset
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}