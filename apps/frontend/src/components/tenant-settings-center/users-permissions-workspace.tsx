"use client";

import { useEffect,useMemo,useState,useEffectEvent } from "react";
import { Search,ShieldCheck,UserPlus,UserRoundX,UsersRound } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { teamApi,type TeamMember,type TeamOptions } from "@/lib/tenant-team-api";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { SettingsError,SettingsKpi,SettingsLoading,SettingsPageHeader } from "./settings-center-ui";
import { SettingsNavigation } from "./settings-navigation";
import { normalizeRole,roleLabel,settingsApi,type PermissionState } from "./settings-center-model";
import { UsersTable } from "./users-table";
import { UserPermissionsPanel } from "./user-permissions-panel";

const PAGE_SIZE = 7;

export function UsersPermissionsWorkspace() {
  const { access, canView, canCreate, canUpdate, canManage } = useTenantAccess();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [options, setOptions] = useState<TeamOptions | null>(null);
  const [permissions, setPermissions] = useState<PermissionState[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const teamAllowed = canView("settings") && canView("team");
  const manageAllowed = canUpdate("settings") && canManage("team");

  const load = async () => {
    if (!teamAllowed) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [memberData, optionData] = await Promise.all([teamApi.members({ limit: 500 }), teamApi.options()]);
      setMembers(memberData.items || []);
      setOptions(optionData);
      setSelectedId((current) => current && memberData.items.some((item) => item.id === current) ? current : memberData.items[0]?.id || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile caricare utenti e ruoli.");
    } finally {
      setLoading(false);
    }
  };

    const loadEffect = useEffectEvent(load);
useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadEffect();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [teamAllowed]);

  const selected = members.find((member) => member.id === selectedId) || null;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!selected || !manageAllowed) { setPermissions([]); return; }
      teamApi.permissions(selected.id).then((data) => {
        if (active) setPermissions((data.items || []).map((item) => ({
          module_key: item.module_key,
          can_view: item.can_view,
          can_create: item.can_create,
          can_update: item.can_update,
          can_delete: item.can_delete,
          can_manage: item.can_manage,
        })));
      }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Permessi non disponibili.")).finally(() => undefined);
    });
    return () => { active = false; };
  }, [manageAllowed, selected]);

  const roles = useMemo(() => Array.from(new Set(members.map((item) => normalizeRole(item.tenant_role)))).sort(), [members]);
  const visible = useMemo(() => members.filter((member) => {
    const text = `${member.display_name} ${member.email} ${roleLabel(member.tenant_role)} ${member.job_title || ""}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (role === "all" || normalizeRole(member.tenant_role) === role) && (status === "all" || member.status === status);
  }), [members, role, search, status]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageRows = visible.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);
  const owners = members.filter((member) => normalizeRole(member.tenant_role) === "owner").length;
  const lastOwner = Boolean(selected && normalizeRole(selected.tenant_role) === "owner" && owners <= 1);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setPage(1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [search, role, status]);

  const saveMemberAccess = async (nextRole: string, nextPermissions: PermissionState[]) => {
    if (!selected || !manageAllowed) return;
    const currentRole = normalizeRole(selected.tenant_role);
    if (currentRole === "owner" && owners <= 1 && nextRole !== "owner") {
      setError("Non è possibile rimuovere l’ultimo proprietario.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (nextRole !== currentRole) {
        if (!selected.user_id) throw new Error("Il ruolo di accesso può essere modificato soltanto per account attivi.");
        await settingsApi.changeRole(selected.user_id, nextRole);
        await teamApi.updateMember(selected.id, { tenant_role: nextRole });
      }
      if (!["owner", "admin", "superadmin", "super_admin"].includes(nextRole)) {
        await teamApi.updatePermissions(selected.id, nextPermissions);
      }
      setSuccess("Ruolo e permessi sono stati aggiornati.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento permessi non riuscito.");
    } finally {
      setBusy(false);
    }
  };

  const resendInvite = async () => {
    if (!selected || !manageAllowed || selected.user_id) return;
    setBusy(true); setError(null); setSuccess(null);
    try {
      await teamApi.inviteMember(selected.id);
      setSuccess("Invito rigenerato e inoltro email richiesto.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reinvio non riuscito.");
    } finally { setBusy(false); }
  };

  const changeProfileStatus = async (nextStatus: string) => {
    if (!selected || !manageAllowed || normalizeRole(selected.tenant_role) === "owner") return;
    setBusy(true); setError(null); setSuccess(null);
    try {
      await teamApi.updateMember(selected.id, { status: nextStatus });
      setSuccess("Stato del profilo team aggiornato. Lo stato di login non è esposto da questa API.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento stato non riuscito.");
    } finally { setBusy(false); }
  };

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <SettingsPageHeader title="Utenti e permessi" description="Gestisci accessi, ruoli tenant e override autorizzati." canAct={false}>
        {canCreate("team") && manageAllowed ? <Button onClick={() => setInviteOpen(true)} className="h-11 rounded-xl bg-indigo-600 px-5 text-white hover:bg-indigo-700"><UserPlus className="mr-2 h-4 w-4" />Invita utente</Button> : null}
      </SettingsPageHeader>
      <SettingsNavigation />
      <SettingsError message={error} />
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div> : null}
      {!teamAllowed ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Il modulo Team non è visibile: nessun dato utente è stato richiesto.</div> : loading ? <SettingsLoading /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SettingsKpi icon={UsersRound} label="Utenti attivi" value={members.filter((item) => item.status === "active" && item.user_id).length} hint={`${members.length} profili team`} />
            <SettingsKpi icon={UserPlus} label="Inviti in attesa" value={members.filter((item) => item.status === "invited" && !item.user_id).length} hint="Profili senza account attivo" tone="orange" />
            <SettingsKpi icon={ShieldCheck} label="Amministratori" value={members.filter((item) => ["owner", "admin", "superadmin", "super_admin"].includes(normalizeRole(item.tenant_role)) && item.status === "active").length} hint="Proprietari e amministratori" tone="blue" />
            <SettingsKpi icon={UserRoundX} label="Profili sospesi" value={members.filter((item) => item.status === "suspended").length} hint="Stato operativo team" tone="red" />
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px_220px]">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca utente..." className="pl-9" /></div>
              <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue placeholder="Ruolo" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i ruoli</SelectItem>{roles.map((item) => <SelectItem key={item} value={item}>{roleLabel(item)}</SelectItem>)}</SelectContent></Select>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem><SelectItem value="active">Attivi</SelectItem><SelectItem value="invited">Inviti in attesa</SelectItem><SelectItem value="suspended">Sospesi</SelectItem><SelectItem value="inactive">Inattivi</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <UsersTable rows={pageRows} selectedId={selectedId} onSelect={setSelectedId} page={Math.min(page, pages)} pages={pages} onPageChange={setPage} />
            <UserPermissionsPanel member={selected} permissions={permissions} options={options} actorRole={access?.role || "user"} canManage={manageAllowed} lastOwner={lastOwner} busy={busy} onClose={() => setSelectedId(null)} onSave={saveMemberAccess} onInvite={resendInvite} onStatusChange={changeProfileStatus} />
          </div>
        </>
      )}
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} options={options} actorRole={access?.role || "user"} busy={busy} onCreate={async (body) => {
        setBusy(true); setError(null); setSuccess(null);
        try {
          await teamApi.createMember({ ...body, send_invite: true, status: "invited", employment_type: "employee", operational_role: "generic" });
          setInviteOpen(false);
          setSuccess("Profilo creato e invito richiesto.");
          await load();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Invito non riuscito.");
        } finally { setBusy(false); }
      }} />
    </main>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  options,
  actorRole,
  busy,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TeamOptions | null;
  actorRole: string;
  busy: boolean;
  onCreate: (body: Partial<TeamMember>) => Promise<void> | void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const actor = normalizeRole(actorRole);
  const roles = Array.from(new Set((options?.tenantRoles || ["admin", "manager", "editor", "user", "viewer"]).map(normalizeRole)))
    .filter((item) => !["owner", "superadmin"].includes(item) && (item !== "admin" || ["owner", "superadmin"].includes(actor)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Invita utente</DialogTitle><DialogDescription>Crea un profilo team e usa il flusso invito reale. Owner e superadmin non sono invitabili.</DialogDescription></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label>Email</Label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div className="grid gap-2"><Label>Nome visualizzato</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="grid gap-2"><Label>Ruolo tenant</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map((item) => <SelectItem key={item} value={item}>{roleLabel(item)}</SelectItem>)}</SelectContent></Select></div>
          <Button disabled={busy || !email.trim() || !name.trim()} onClick={() => void onCreate({ email: email.trim(), display_name: name.trim(), tenant_role: role })} className="bg-indigo-600 text-white hover:bg-indigo-700"><UserPlus className="mr-2 h-4 w-4" />Crea e invita</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
