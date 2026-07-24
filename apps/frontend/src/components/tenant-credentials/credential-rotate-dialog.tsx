"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CredentialItem, CredentialSecretPayload } from "@/lib/tenant-credentials-types";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import { CredentialSecretForm } from "./credential-secret-form";
import { cleanSecretPayload, hasUsableSecret, normalizeError, validateReason } from "./credentials-utils";

export function CredentialRotateDialog({ credential, open, onOpenChange, onDone }: { credential?: CredentialItem | null; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [secret, setSecret] = useState<CredentialSecretPayload>({});
  const [reason, setReason] = useState("");
  const [nextRotation, setNextRotation] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clear = () => {
    setSecret({});
    setReason("");
    setNextRotation("");
    setConfirm(false);
    setError(null);
  };
  useEffect(() => { if (!open) clear(); }, [open]);
  useEffect(() => () => clear(), []);

  const submit = async () => {
    if (!credential) return;
    const reasonError = validateReason(reason);
    const payload = cleanSecretPayload(secret);
    if (reasonError) return setError(reasonError);
    if (!hasUsableSecret(payload)) return setError("Inserisci il nuovo segreto.");
    if (!confirm) return setError("Conferma che il vecchio segreto non sarà più recuperabile dal vault.");
    setLoading(true);
    setError(null);
    try {
      await credentialsApi.rotate(credential.id, { secret: payload, reason: reason.trim(), next_rotation_due_at: nextRotation || undefined });
      clear();
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) clear(); onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ruota credenziale</DialogTitle>
          <DialogDescription>Inserisci un nuovo segreto. Il vecchio valore non sarà più recuperabile dal vault.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Motivo operativo *</Label>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} autoComplete="off" />
          </div>
          <div className="grid gap-2">
            <Label>Prossima rotazione opzionale</Label>
            <Input type="date" value={nextRotation} onChange={(event) => setNextRotation(event.target.value)} />
          </div>
        </div>
        <CredentialSecretForm value={secret} onChange={setSecret} disabled={loading} />
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
          Confermo di avere inserito il nuovo segreto corretto e che il precedente non deve più essere recuperabile dal vault.
        </label>
        {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit} disabled={loading}>Ruota credenziale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

