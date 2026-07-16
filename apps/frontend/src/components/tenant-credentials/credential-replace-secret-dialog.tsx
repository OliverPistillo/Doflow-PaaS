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

export function CredentialReplaceSecretDialog({ credential, open, onOpenChange, onDone }: { credential?: CredentialItem | null; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [secret, setSecret] = useState<CredentialSecretPayload>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clear = () => {
    setSecret({});
    setReason("");
    setError(null);
  };
  useEffect(() => { if (!open) clear(); }, [open]);
  useEffect(() => () => clear(), []);

  const submit = async () => {
    if (!credential) return;
    const payload = cleanSecretPayload(secret);
    if (!hasUsableSecret(payload)) {
      setError("Inserisci almeno un campo segreto.");
      return;
    }
    if (credential.has_secret) {
      const reasonError = validateReason(reason);
      if (reasonError) {
        setError(reasonError);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      await credentialsApi.replaceSecret(credential.id, { secret: payload, reason: reason.trim() || undefined });
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
          <DialogTitle>{credential?.has_secret ? "Sostituisci segreto" : "Configura segreto"}</DialogTitle>
          <DialogDescription>Il vecchio segreto non viene mostrato e il form non viene precompilato.</DialogDescription>
        </DialogHeader>
        {credential?.has_secret ? (
          <div className="grid gap-2">
            <Label>Motivo operativo *</Label>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} autoComplete="off" />
            <p className="text-xs text-muted-foreground">Non inserire password, token, API key o altri segreti nel motivo.</p>
          </div>
        ) : null}
        <CredentialSecretForm value={secret} onChange={setSecret} disabled={loading} />
        {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit} disabled={loading}>{credential?.has_secret ? "Sostituisci" : "Salva segreto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

