"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import type { CredentialLink } from "@/lib/tenant-credentials-types";
import { CredentialsEmptyState, CredentialsError, CredentialsLoading } from "./credentials-shared";
import { ENTITY_TYPES, RELATIONS, isUuid, normalizeError } from "./credentials-utils";

export function CredentialLinks({ credentialId }: { credentialId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<CredentialLink[]>([]);
  const [form, setForm] = useState({ entity_type: "project", entity_id: "", relation: "related_to" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ConfirmDialog, confirm } = useConfirm();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await credentialsApi.links(credentialId);
      setRows(data.items || []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [credentialId]);

  const create = async () => {
    if (!isUuid(form.entity_id)) {
      setError("Inserisci un entity_id UUID valido.");
      return;
    }
    try {
      await credentialsApi.createLink(credentialId, { ...form, metadata: {} });
      setForm({ entity_type: "project", entity_id: "", relation: "related_to" });
      await load();
    } catch (err) {
      toast({ title: "Collegamento non creato", description: normalizeError(err), variant: "destructive" });
    }
  };

  const remove = async (row: CredentialLink) => {
    const ok = await confirm({
      title: "Rimuovere questo collegamento?",
      description: "Il collegamento con questa entità verrà eliminato permanentemente.",
      confirmLabel: "Rimuovi",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await credentialsApi.deleteLink(credentialId, row.id);
      setRows((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      toast({ title: "Collegamento non rimosso", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (loading) return <CredentialsLoading />;
  return (
    <div className="space-y-4">
      <CredentialsError message={error} />
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 font-semibold">Aggiungi collegamento</h3>
        <div className="grid gap-3 md:grid-cols-[180px_1fr_180px_auto]">
          <Select value={form.entity_type} onValueChange={(value) => setForm((prev) => ({ ...prev, entity_type: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ENTITY_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Entity ID UUID" value={form.entity_id} onChange={(event) => setForm((prev) => ({ ...prev, entity_id: event.target.value }))} />
          <Select value={form.relation} onValueChange={(value) => setForm((prev) => ({ ...prev, relation: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RELATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={create}>Collega</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Quando un selettore affidabile non esiste, usa un UUID reale dell'entità interna.</p>
      </div>
      {rows.length ? rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{row.entity_type} · {row.relation}</p>
            <p className="text-xs text-muted-foreground">{row.entity_id}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => remove(row)}><Trash2 className="mr-2 h-4 w-4" /> Rimuovi</Button>
        </div>
      )) : <CredentialsEmptyState>Nessun collegamento configurato.</CredentialsEmptyState>}
      <ConfirmDialog />
    </div>
  );
}

