"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CredentialItem, CredentialSecretPayload } from "@/lib/tenant-credentials-types";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import { normalizeError, validateReason } from "./credentials-utils";

export function CredentialRevealDialog({ credential, open, onOpenChange }: { credential?: CredentialItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [reason, setReason] = useState("");
  const [secret, setSecret] = useState<CredentialSecretPayload | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clear = () => {
    setReason("");
    setSecret(null);
    setVisible({});
    setError(null);
  };

  useEffect(() => {
    if (!open) clear();
  }, [open]);

  useEffect(() => {
    if (!open || !secret) return undefined;
    const timeout = window.setTimeout(() => {
      setSecret(null);
      setVisible({});
    }, 60000);
    return () => window.clearTimeout(timeout);
  }, [open, secret]);

  useEffect(() => () => clear(), []);

  const fields = useMemo(() => secret ? secretEntries(secret) : [], [secret]);

  const reveal = async () => {
    const reasonError = validateReason(reason);
    if (reasonError) {
      setError(reasonError);
      return;
    }
    if (!credential) return;
    setLoading(true);
    setError(null);
    try {
      const result = await credentialsApi.reveal(credential.id, reason.trim());
      setSecret(result.secret || result.payload || {});
      setReason("");
    } catch (err) {
      setError(normalizeError(err));
      setSecret(null);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) clear(); onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rivela segreto</DialogTitle>
          <DialogDescription>Flusso protetto e auditato. Non inserire password, token o API key nel motivo.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
          <ShieldAlert className="mr-2 inline h-4 w-4" />
          Copia solo quando necessario: gli appunti di sistema possono conservarne il contenuto.
        </div>
        {!secret ? (
          <div className="grid gap-2">
            <Label htmlFor="reveal-reason">Motivo operativo *</Label>
            <Input id="reveal-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} autoComplete="off" />
          </div>
        ) : null}
        {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        {secret ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Il contenuto viene pulito automaticamente dopo 60 secondi o alla chiusura della modal.</p>
            {fields.length ? fields.map((field) => (
              <div key={field.key} className="grid gap-2 rounded-lg border p-3">
                <Label>{field.label}</Label>
                <div className="flex gap-2">
                  <Input readOnly type={visible[field.key] ? "text" : "password"} value={field.value} autoComplete="off" />
                  <Button type="button" variant="outline" size="icon" aria-label={visible[field.key] ? "Nascondi" : "Mostra"} onClick={() => setVisible((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}>{visible[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                  <Button type="button" variant="outline" size="icon" aria-label={`Copia ${field.label}`} onClick={() => copy(field.value)}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">Nessun campo segreto restituito.</p>}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          {!secret ? <Button onClick={reveal} disabled={loading || !credential}>Conferma reveal</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function secretEntries(secret: CredentialSecretPayload) {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  if (secret.username) rows.push({ key: "username", label: "Username", value: secret.username });
  if (secret.password) rows.push({ key: "password", label: "Password", value: secret.password });
  if (secret.apiKey) rows.push({ key: "apiKey", label: "API key", value: secret.apiKey });
  if (secret.secretKey) rows.push({ key: "secretKey", label: "Secret key", value: secret.secretKey });
  if (secret.token) rows.push({ key: "token", label: "Token", value: secret.token });
  if (secret.privateNotes) rows.push({ key: "privateNotes", label: "Note private", value: secret.privateNotes });
  (secret.recoveryCodes || []).forEach((value, index) => rows.push({ key: `recovery-${index}`, label: `Recovery code ${index + 1}`, value }));
  (secret.customFields || []).forEach((field, index) => rows.push({ key: `custom-${index}`, label: field.label || `Campo ${index + 1}`, value: field.value }));
  return rows;
}

