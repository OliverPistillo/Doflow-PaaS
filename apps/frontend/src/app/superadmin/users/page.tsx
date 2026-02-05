"use client";

/* ======================================================
   IMPORTS
====================================================== */

import React, { useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  tenant_id: string;
  tenant_name?: string;
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
  const r = role.toLowerCase();
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
  return new Date(v).toLocaleString();
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
  const [targetTenantId, setTargetTenantId] = useState("");

  /* =========================
      MODALS
  ========================= */

  const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const [showCreate, setShowCreate] = useState(false);

  const [resetUser, setResetUser] = useState<GlobalUser | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);

  /* =========================
      CREATE USER STATE
  ========================= */

  const [createEmail, setCreateEmail] = useState("");
  const [createTenant, setCreateTenant] = useState("");
  const [createRole, setCreateRole] = useState("user");
  const [accessMode, setAccessMode] = useState<"invite" | "password">("invite");
  const [createMfa, setCreateMfa] = useState(true);
  const [creating, setCreating] = useState(false);

  /* ======================================================
      LOAD DATA
  ======================================================= */

  const loadUsers = async () => {
    if (activeTab === "tenant" && !targetTenantId) {
      setUsers([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const qs = new URLSearchParams({
        q,
        role: role === "__all__" ? "" : role,
        is_active: isActive === "__all__" ? "" : isActive,
        page: String(page),
        pageSize: String(pageSize),
      }).toString();

      const endpoint =
        activeTab === "global"
          ? `/superadmin/users?${qs}`
          : `/superadmin/tenants/${targetTenantId}/users?${qs}`;

      const data = await apiFetch<{
        users: GlobalUser[];
        total: number;
      }>(endpoint);

      setUsers(data.users);
      setTotal(data.total);
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Impossibile caricare utenti",
        variant: "destructive",
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadKpi = async (tenantFilter?: string) => {
    setKpiLoading(true);
    try {
      const qs = new URLSearchParams({
        days: "30",
        top: "20",
        tenantId: tenantFilter ? tenantFilter : "",
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
    // 1. Load Users
    loadUsers();

    // 2. Load KPI (Global or Tenant scope)
    if (activeTab === "tenant" && targetTenantId) {
      loadKpi(targetTenantId);
    } else if (activeTab === "global") {
      loadKpi("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeTab, targetTenantId]);

  /* ======================================================
      ACTIONS
  ======================================================= */

  const patchUser = async (id: string, patch: any) => {
    await apiFetch(`/superadmin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    loadUsers();
  };

  const toggleMfa = async (u: GlobalUser) => {
    await patchUser(u.id, { mfa_required: !u.mfa_required });
  };

  const loadAudit = async (email: string) => {
    const data = await apiFetch<{ logs: AuditRow[] }>(
      `/superadmin/users/${email}/audit`,
    );
    setAudit(data.logs);
  };

  const resetPassword = async () => {
    if (!resetUser) return;

    try {
      const res = await apiFetch<{ tempPassword: string }>(
        `/superadmin/tenants/${resetUser.tenant_id}/users/${resetUser.id}/reset-password`,
        { method: "POST" },
      );

      setResetResult(res.tempPassword);
      loadUsers();
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Reset password fallito",
        variant: "destructive",
      });
    }
  };

  const submitCreateUser = async () => {
    if (!createEmail || !createTenant) {
      toast({
        title: "Dati mancanti",
        description: "Email e tenant sono obbligatori.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const payload = {
        email: createEmail,
        role: createRole,
        mfa_required: createMfa,
        sendInvite: accessMode === "invite",
      };

      const res = await apiFetch<{ tempPassword?: string }>(
        `/superadmin/tenants/${createTenant}/users`,
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
      setCreateTenant("");
      setCreateRole("user");
      setCreateMfa(true);
      setAccessMode("invite");

      loadUsers();
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
      RENDER
  ======================================================= */

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900">
            Gestione Utenti
          </h1>
          <p className="text-slate-500 font-medium">
            Identity & Access Control – livello enterprise.
          </p>
        </div>

        <Button
          className="bg-indigo-600 text-white"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Crea Utente
        </Button>
      </div>

      {/* TABS */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as any);
          setPage(1);
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
            <Input
              placeholder="Tenant ID"
              value={targetTenantId}
              onChange={(e) => setTargetTenantId(e.target.value)}
              className="w-[220px]"
            />
          )}

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Cerca email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => {
                setPage(1);
                loadUsers();
              }}
            />
          </div>

          <Select value={role} onValueChange={setRole}>
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

          <Select value={isActive} onValueChange={setIsActive}>
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
              <div className="text-lg font-black text-slate-900 mt-1">
                {activeTab === "tenant"
                  ? `Tenant: ${targetTenantId || "—"}`
                  : "Directory globale"}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() =>
                loadKpi(activeTab === "tenant" ? targetTenantId : "")
              }
              disabled={kpiLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${kpiLoading ? "animate-spin" : ""}`}
              />
              Aggiorna KPI
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
            {(() => {
              const row =
                activeTab === "tenant"
                  ? kpi?.kpiByTenant?.find(
                      (x) =>
                        (x.tenant_id || "").toLowerCase() ===
                        (targetTenantId || "").toLowerCase(),
                    )
                  : null;

              const total =
                row?.total_users ??
                kpi?.kpiByTenant?.reduce(
                  (a, x) => a + (x.total_users || 0),
                  0,
                ) ??
                0;
              const active =
                row?.active_users ??
                kpi?.kpiByTenant?.reduce(
                  (a, x) => a + (x.active_users || 0),
                  0,
                ) ??
                0;
              const suspended =
                row?.suspended_users ??
                kpi?.kpiByTenant?.reduce(
                  (a, x) => a + (x.suspended_users || 0),
                  0,
                ) ??
                0;
              const newUsers =
                row?.new_users_window ??
                kpi?.kpiByTenant?.reduce(
                  (a, x) => a + (x.new_users_window || 0),
                  0,
                ) ??
                0;

              const activeRate =
                total > 0 ? Math.round((active / total) * 100) : 0;

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
                  <div className="text-2xl font-black text-slate-900 mt-2">
                    {value}
                  </div>
                  {hint ? (
                    <div className="text-xs text-slate-500 mt-2">{hint}</div>
                  ) : null}
                </div>
              );

              return (
                <>
                  <Box label="Totale utenti" value={String(total)} />
                  <Box
                    label="Attivi"
                    value={String(active)}
                    hint={`Active rate: ${activeRate}%`}
                  />
                  <Box label="Sospesi" value={String(suspended)} />
                  <Box
                    label="Nuovi (window)"
                    value={String(newUsers)}
                    hint="Creati nel periodo selezionato"
                  />
                </>
              );
            })()}
          </div>

          {/* Trend */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-800">
                Trend: nuovi utenti / giorno
              </div>
              <Badge
                variant="outline"
                className="border-slate-200 text-slate-700 bg-white"
              >
                {activeTab === "tenant" ? "Tenant scope" : "Global scope"}
              </Badge>
            </div>

            <div className="h-[220px] mt-3 rounded-xl border border-slate-200 bg-white">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={kpi?.trend || []}
                  margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    minTickGap={24}
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="new_users"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top tenants */}
          <div className="mt-6">
            <div className="font-bold text-slate-800 mb-2">
              Top tenant (per totale utenti)
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Tenant</th>
                    <th className="px-4 py-3 text-left">Tenant ID</th>
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
                        // click -> porta al tab tenant e setta targetTenantId
                        setActiveTab("tenant");
                        setTargetTenantId(t.tenant_id);
                        setPage(1);
                      }}
                      title="Click per aprire questo tenant"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {t.tenant_name || t.tenant_slug || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {t.tenant_id}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {t.total_users}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {t.active_users}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {t.suspended_users}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {t.new_users_window}
                      </td>
                    </tr>
                  ))}
                  {!kpiLoading && (kpi?.kpiByTenant?.length ?? 0) === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-6 text-center text-slate-400"
                      >
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    Nessun utente trovato
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-indigo-700">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-6 py-4">
                      <Switch
                        checked={!!u.mfa_required}
                        onCheckedChange={() => toggleMfa(u)}
                      />
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {u.tenant_name || u.tenant_id}
                    </td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="text-green-600 font-bold">ACTIVE</span>
                      ) : (
                        <span className="text-red-600 font-bold">
                          SUSPENDED
                        </span>
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
                      >
                        <History className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          patchUser(u.id, { is_active: !u.is_active })
                        }
                      >
                        <Ban className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResetUser(u)}
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
      </Tabs>

      {/* ======================================================
            MODALS (Audit / Create / Reset)
      ======================================================= */}

      {/* Audit modal */}
      {selectedUser && (
        <Dialog open onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedUser.email}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {audit.length === 0 && (
                <p className="text-slate-400 text-sm p-4">
                  Nessun evento registrato.
                </p>
              )}
              {audit.map((a) => (
                <div
                  key={a.id}
                  className="border rounded-md p-3 text-sm"
                >
                  <div className="flex justify-between">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold border ${
                        AUDIT_COLOR[a.action] ||
                        "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {a.action}
                    </span>
                    <span className="text-xs text-slate-400">
                      {fmtDate(a.created_at)}
                    </span>
                  </div>
                  {a.metadata && (
                    <pre className="mt-2 text-[10px] bg-slate-50 p-2 rounded">
                      {JSON.stringify(a.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create user modal */}
      {showCreate && (
        <Dialog open onOpenChange={() => setShowCreate(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crea nuovo utente</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Input
                placeholder="Email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />

              <Input
                placeholder="Tenant ID"
                value={createTenant}
                onChange={(e) => setCreateTenant(e.target.value)}
              />

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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium">MFA obbligatorio</span>
                </div>
                <Switch
                  checked={createMfa}
                  onCheckedChange={setCreateMfa}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowCreate(false)}
              >
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
                <Button
                  variant="destructive"
                  onClick={resetPassword}
                >
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