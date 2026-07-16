"use client";

import { useEffect, useState } from "react";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import type { CredentialAuditEntry } from "@/lib/tenant-credentials-types";
import { CredentialsEmptyState, CredentialsError, CredentialsLoading, JsonBlock } from "./credentials-shared";
import { formatDateTime, normalizeError } from "./credentials-utils";

export function CredentialAudit({ credentialId }: { credentialId: string }) {
  const [rows, setRows] = useState<CredentialAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    credentialsApi.audit(credentialId).then((data) => { if (active) setRows(data.items || []); }).catch((err) => { if (active) setError(normalizeError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [credentialId]);
  if (loading) return <CredentialsLoading />;
  return (
    <div className="space-y-3">
      <CredentialsError message={error} />
      {rows.length ? rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{row.action} {row.outcome ? `· ${row.outcome}` : ""}</p>
            <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
          </div>
          <p className="text-sm text-muted-foreground">Actor: {row.actor_user_id || "-"} · Reason: {row.reason || "-"}</p>
          {row.metadata ? <JsonBlock value={row.metadata} /> : null}
        </div>
      )) : <CredentialsEmptyState>Nessun audit disponibile.</CredentialsEmptyState>}
    </div>
  );
}

