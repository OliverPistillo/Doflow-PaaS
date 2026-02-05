"use client";

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
} from "lucide-react";
import {
  Card,
} from "@/components/ui/card";
import {
  Button,
} from "@/components/ui/button";
import {
  Input,
} from "@/components/ui/input";
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
  TabsContent,
} from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/* ======================================================
   Types
====================================================== */

type GlobalUser = {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  tenant_name?: string;
  is_active: boolean;
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

/* ======================================================
   Utils
====================================================== */

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
   Page
====================================================== */

export default function SuperadminUsersPage() {
  const { toast } = useToast();

  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [total, setTotal] = useState(0);

  const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  /* =========================
     Load users
  ========================= */

  const loadUsers = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        q,
        role,
        is_active: isActive,
        page: String(page),
        pageSize: String(pageSize),
      }).toString();

      const data = await apiFetch<{
        users: GlobalUser[];
        total: number;
      }>(`/superadmin/users?${qs}`);

      setUsers(data.users);
      setTotal(data.total);
    } catch (e: any) {
      toast({
        title: "Errore",
        description: e?.message || "Impossibile caricare utenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* =========================
     Actions
  ========================= */

  const patchUser = async (id: string, patch: any) => {
    await apiFetch(`/superadmin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    loadUsers();
  };

  const loadAudit = async (email: string) => {
    const data = await apiFetch<{ logs: AuditRow[] }>(
      `/superadmin/users/${email}/audit`,
    );
    setAudit(data.logs);
  };

  /* ======================================================
     Render
  ======================================================= */

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900">
            Gestione Utenti
          </h1>
          <p className="text-slate-500 font-medium">
            Directory globale utenti (multi-tenant).
          </p>
        </div>
        <Button
          className="bg-indigo-600 text-white"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Crea Utente
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Cerca email / tenant"
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
            <SelectItem value="">Tutti</SelectItem>
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
            <SelectItem value="">Tutti</SelectItem>
            <SelectItem value="true">Attivi</SelectItem>
            <SelectItem value="false">Sospesi</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => loadUsers()}>
          <RefreshCw className={`h-4 w-4 ${loading && "animate-spin"}`} />
        </Button>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-xs uppercase font-bold text-slate-500">
            <tr>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Ruolo</th>
              <th className="px-6 py-4">Tenant</th>
              <th className="px-6 py-4">Stato</th>
              <th className="px-6 py-4 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">
                  Caricamento…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">
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
                  <td className="px-6 py-4 text-slate-600">
                    {u.tenant_name || u.tenant_id}
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

                    <Button size="sm" variant="ghost">
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* User detail + audit */}
      {selectedUser && (
        <Dialog open onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedUser.email}</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="audit">
              <TabsList>
                <TabsTrigger value="audit">Audit</TabsTrigger>
              </TabsList>

              <TabsContent value="audit">
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {audit.map((a) => (
                    <div
                      key={a.id}
                      className="border rounded-md p-3 text-sm"
                    >
                      <div className="font-bold">{a.action}</div>
                      <div className="text-xs text-slate-500">
                        {fmtDate(a.created_at)} — {a.actor_email}
                      </div>
                      <pre className="mt-2 text-xs bg-slate-100 p-2 rounded">
                        {JSON.stringify(a.metadata, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Create user modal (placeholder, hook ready) */}
      {showCreate && (
        <Dialog open onOpenChange={() => setShowCreate(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crea nuovo utente</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-slate-500">
              Modale già collegato al backend (policy C).
              <br />
              Prossimo step: form completo tenant + invito.
            </div>
            <DialogFooter>
              <Button onClick={() => setShowCreate(false)}>Chiudi</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
