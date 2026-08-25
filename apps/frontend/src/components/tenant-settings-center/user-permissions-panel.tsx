"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Send, UserRoundX, X } from "lucide-react";
import type { TeamMember, TeamOptions } from "@/lib/tenant-team-api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Initials, SettingsBadge, SettingsEmpty } from "./settings-center-ui";
import {
  effectivePermission,
  canOverrideModule,
  isAdministrativeRole,
  normalizeRole,
  roleLabel,
  SETTINGS_MODULES,
  statusMeta,
  type PermissionState,
} from "./settings-center-model";

export function UserPermissionsPanel({
  member,
  permissions,
  options,
  actorRole,
  canManage,
  lastOwner,
  busy,
  onClose,
  onSave,
  onInvite,
  onStatusChange,
}: {
  member: TeamMember | null;
  permissions: PermissionState[];
  options: TeamOptions | null;
  actorRole: string;
  canManage: boolean;
  lastOwner: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (role: string, permissions: PermissionState[]) => Promise<void> | void;
  onInvite: () => Promise<void> | void;
  onStatusChange: (status: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<PermissionState[]>([]);
  const [role, setRole] = useState("user");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setDraft(permissions);
        setRole(normalizeRole(member?.tenant_role));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [member, permissions]);

  const actor = normalizeRole(actorRole);
  const memberRole = normalizeRole(member?.tenant_role);
  const adminRole = isAdministrativeRole(memberRole);
  const roleLocked = !canManage || memberRole === "owner" || memberRole === "superadmin" || lastOwner || !member?.user_id;
  const roleOptions = useMemo(() => {
    const fromApi = options?.tenantRoles || ["admin", "manager", "editor", "user", "viewer"];
    return Array.from(new Set(fromApi.map(normalizeRole).filter((item) => {
      if (["owner", "superadmin"].includes(item)) return item === memberRole;
      if (item === "admin" && !["owner", "superadmin"].includes(actor)) return item === memberRole;
      return true;
    }).concat(memberRole))).filter(Boolean);
  }, [actor, memberRole, options?.tenantRoles]);

  if (!member) return <aside className="rounded-2xl border border-slate-200/80 bg-white p-5"><SettingsEmpty className="min-h-72">Seleziona un utente per vedere ruolo e permessi effettivi.</SettingsEmpty></aside>;
  const status = statusMeta(member.status);

  const updatePermission = (moduleKey: string, key: keyof PermissionState, checked: boolean) => {
    setDraft((current) => {
      const existing = effectivePermission(member, moduleKey, current);
      const next = { ...existing, [key]: checked };
      if (key === "can_view" && !checked) Object.assign(next, { can_create: false, can_update: false, can_delete: false, can_manage: false });
      if (key !== "can_view" && checked) next.can_view = true;
      return [...current.filter((item) => item.module_key !== moduleKey), next];
    });
  };

  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3"><Initials name={member.display_name} className="h-12 w-12 text-sm" /><div><h2 className="font-semibold text-slate-950">{member.display_name}</h2><p className="text-xs text-slate-500">{member.email}</p><div className="mt-1"><SettingsBadge label={status.label} tone={status.tone} /></div></div></div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Chiudi dettaglio"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-5">
        <Label>Ruolo base</Label>
        <Select value={role} disabled={roleLocked} onValueChange={setRole}>
          <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
          <SelectContent>{roleOptions.map((item) => <SelectItem key={item} value={item}>{roleLabel(item)}</SelectItem>)}</SelectContent>
        </Select>
        {lastOwner ? <p className="mt-2 text-xs text-amber-700">Il ruolo dell’ultimo proprietario non può essere rimosso.</p> : null}
      </div>
      <div className="mt-5">
        <div className="mb-3"><p className="text-sm font-semibold text-slate-900">Permessi e aree</p><p className="text-xs text-slate-500">{adminRole ? "Il ruolo amministrativo mantiene accesso completo previsto dal backend." : "Valori effettivi: ruolo base più override salvati."}</p></div>
        <div className="space-y-2">
          {SETTINGS_MODULES.map((module) => {
            const permission = effectivePermission(member, module.key, draft);
            const protectedModule = !canOverrideModule(member.tenant_role, module.key);
            return (
              <div key={module.key} className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">{module.label}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <PermissionCheck label="Visualizza" checked={permission.can_view} disabled={!canManage || adminRole || protectedModule} onChange={(checked) => updatePermission(module.key, "can_view", checked)} />
                  <PermissionCheck label="Crea" checked={permission.can_create} disabled={!canManage || adminRole || protectedModule} onChange={(checked) => updatePermission(module.key, "can_create", checked)} />
                  <PermissionCheck label="Modifica" checked={permission.can_update} disabled={!canManage || adminRole || protectedModule} onChange={(checked) => updatePermission(module.key, "can_update", checked)} />
                  <PermissionCheck label="Elimina" checked={permission.can_delete} disabled={!canManage || adminRole || protectedModule} onChange={(checked) => updatePermission(module.key, "can_delete", checked)} />
                </div>
                {protectedModule ? <p className="mt-2 text-[11px] text-slate-400">Questo modulo sensibile non può essere concesso tramite override a ruoli non amministrativi.</p> : null}
              </div>
            );
          })}
        </div>
      </div>
      {canManage && !adminRole ? <Button onClick={() => void onSave(role, draft)} disabled={busy} className="mt-5 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salva permessi</Button> : null}
      {canManage && role !== memberRole && adminRole && !roleLocked ? <Button onClick={() => void onSave(role, draft)} disabled={busy} className="mt-5 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"><Save className="mr-2 h-4 w-4" />Salva ruolo</Button> : null}
      {canManage && !member.user_id ? <Button variant="outline" onClick={() => void onInvite()} disabled={busy} className="mt-3 w-full rounded-xl"><Send className="mr-2 h-4 w-4" />Reinvia invito</Button> : null}
      {canManage && memberRole !== "owner" ? <Button variant="outline" onClick={() => void onStatusChange(member.status === "suspended" ? "active" : "suspended")} disabled={busy} className="mt-3 w-full rounded-xl text-slate-700"><UserRoundX className="mr-2 h-4 w-4" />{member.status === "suspended" ? "Riattiva profilo" : "Sospendi profilo"}</Button> : null}
    </aside>
  );
}

function PermissionCheck({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-2 text-slate-600"><Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} /><span>{label}</span></label>;
}
