"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import type { CredentialPermission } from "@/lib/tenant-credentials-types";
import { CredentialsEmptyState, CredentialsError, CredentialsLoading } from "./credentials-shared";
import { isUuid, normalizeError } from "./credentials-utils";

export function CredentialPermissions({ credentialId }: { credentialId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<CredentialPermission[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ user_id: "", can_view_metadata: true, can_reveal_secret: false, can_edit: false, can_manage_permissions: false });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [permissions, team] = await Promise.all([
        credentialsApi.permissions(credentialId),
        teamApi.members({ limit: 100, status: "active" }).catch(() => ({ items: [] })),
      ]);
      setRows(permissions.items || []);
      setMembers(team.items || []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [credentialId]);

  const create = async () => {
    if (!isUuid(form.user_id)) {
      setError("Seleziona un utente tenant valido.");
      return;
    }
    try {
      await credentialsApi.createPermission(credentialId, form);
      setForm({ user_id: "", can_view_metadata: true, can_reveal_secret: false, can_edit: false, can_manage_permissions: false });
      toast({ title: "Permesso aggiornato" });
      await load();
    } catch (err) {
      toast({ title: "Permesso non salvato", description: normalizeError(err), variant: "destructive" });
    }
  };

  const update = async (row: CredentialPermission, key: keyof Pick<CredentialPermission, "can_view_metadata" | "can_reveal_secret" | "can_edit" | "can_manage_permissions">, value: boolean) => {
    try {
      await credentialsApi.updatePermission(credentialId, row.id, { [key]: value });
      setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, [key]: value } : item));
    } catch (err) {
      toast({ title: "Permesso non aggiornato", description: normalizeError(err), variant: "destructive" });
    }
  };

  const remove = async (row: CredentialPermission) => {
    if (!window.confirm("Rimuovere questo permesso?")) return;
    try {
      await credentialsApi.deletePermission(credentialId, row.id);
      setRows((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      toast({ title: "Permesso non rimosso", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (loading) return <CredentialsLoading />;
  return (
    <div className="space-y-4">
      <CredentialsError message={error} />
      <div className="rounded-lg border p-4">
        <h3 className="font-semibold">Aggiungi ACL utente</h3>
        <p className="mb-3 text-sm text-muted-foreground">Visualizzare i metadati non implica reveal. Modificare non implica gestire permessi.</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          {members.length ? (
            <Select value={form.user_id} onValueChange={(value) => setForm((prev) => ({ ...prev, user_id: value }))}>
              <SelectTrigger><SelectValue placeholder="Seleziona utente tenant" /></SelectTrigger>
              <SelectContent>{members.filter((member) => member.user_id).map((member) => <SelectItem key={member.id} value={String(member.user_id)}>{member.display_name || member.email}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Input placeholder="User ID UUID" value={form.user_id} onChange={(event) => setForm((prev) => ({ ...prev, user_id: event.target.value }))} />
          )}
          <Button onClick={create}>Aggiungi</Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle labelText="Visualizza metadati" checked={form.can_view_metadata} onChange={(value) => setForm((prev) => ({ ...prev, can_view_metadata: value }))} />
          <Toggle labelText="Rivela segreto" checked={form.can_reveal_secret} onChange={(value) => setForm((prev) => ({ ...prev, can_reveal_secret: value }))} />
          <Toggle labelText="Modifica" checked={form.can_edit} onChange={(value) => setForm((prev) => ({ ...prev, can_edit: value }))} />
          <Toggle labelText="Gestisce permessi" checked={form.can_manage_permissions} onChange={(value) => setForm((prev) => ({ ...prev, can_manage_permissions: value }))} />
        </div>
      </div>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{row.display_name || row.email || row.user_id}</p>
                  <p className="text-xs text-muted-foreground">{row.user_id}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => remove(row)}><Trash2 className="mr-2 h-4 w-4" /> Rimuovi</Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Toggle labelText="Visualizza metadati" checked={row.can_view_metadata} onChange={(value) => update(row, "can_view_metadata", value)} />
                <Toggle labelText="Rivela segreto" checked={row.can_reveal_secret} onChange={(value) => update(row, "can_reveal_secret", value)} />
                <Toggle labelText="Modifica" checked={row.can_edit} onChange={(value) => update(row, "can_edit", value)} />
                <Toggle labelText="Gestisce permessi" checked={row.can_manage_permissions} onChange={(value) => update(row, "can_manage_permissions", value)} />
              </div>
            </div>
          ))}
        </div>
      ) : <CredentialsEmptyState>Nessun ACL specifico configurato.</CredentialsEmptyState>}
    </div>
  );
}

function Toggle({ labelText, checked, onChange }: { labelText: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <Label className="flex items-center gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} /> {labelText}</Label>;
}

