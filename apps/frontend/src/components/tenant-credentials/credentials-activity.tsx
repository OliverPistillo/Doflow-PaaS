"use client";

import { useEffect, useState } from "react";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import type { CredentialActivity } from "@/lib/tenant-credentials-types";
import { CredentialsEmptyState, CredentialsError, CredentialsHeader, CredentialsLoading, JsonBlock } from "./credentials-shared";
import { formatDateTime, normalizeError } from "./credentials-utils";

export function CredentialsActivityPage() {
  const [rows, setRows] = useState<CredentialActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    credentialsApi.activity({ limit: 100 }).then((data) => setRows(data.items || [])).catch((err) => setError(normalizeError(err))).finally(() => setLoading(false));
  }, []);
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <CredentialsHeader title="Attività credenziali" description="Audit globale autorizzato del vault accessi." />
      <CredentialsError message={error} />
      {loading ? <CredentialsLoading /> : rows.length ? rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{row.action} {row.outcome ? `· ${row.outcome}` : ""}</p>
            <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
          </div>
          <p className="text-sm text-muted-foreground">Actor: {row.actor_user_id || "-"} · Credential ID: {row.credential_id || "-"}</p>
          {row.metadata ? <JsonBlock value={row.metadata} /> : null}
        </div>
      )) : <CredentialsEmptyState>Nessuna attività disponibile.</CredentialsEmptyState>}
    </div>
  );
}

