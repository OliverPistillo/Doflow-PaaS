"use client";

import { useEffect, useState } from "react";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import type { CredentialRotation } from "@/lib/tenant-credentials-types";
import { CredentialsEmptyState, CredentialsError, CredentialsLoading } from "./credentials-shared";
import { formatDate, formatDateTime, normalizeError } from "./credentials-utils";

export function CredentialRotations({ credentialId }: { credentialId: string }) {
  const [rows, setRows] = useState<CredentialRotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    credentialsApi.rotations(credentialId).then((data) => { if (active) setRows(data.items || []); }).catch((err) => { if (active) setError(normalizeError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [credentialId]);
  if (loading) return <CredentialsLoading />;
  return (
    <div className="space-y-3">
      <CredentialsError message={error} />
      {rows.length ? rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">v{row.previous_secret_version || "-"} → v{row.new_secret_version || "-"}</p>
            <span className="text-xs text-muted-foreground">{formatDateTime(row.rotated_at || row.created_at)}</span>
          </div>
          <p className="text-sm text-muted-foreground">Utente: {row.rotated_by || "-"} · Prossima rotazione: {formatDate(row.next_rotation_due_at)}</p>
          <p className="mt-2 text-sm">{row.reason || "Motivo non indicato"}</p>
        </div>
      )) : <CredentialsEmptyState>Nessuna rotazione registrata.</CredentialsEmptyState>}
    </div>
  );
}

