"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { CredentialItem } from "@/lib/tenant-credentials-types";
import { ACCESS_SCOPE_LABELS, ENVIRONMENT_LABELS, KIND_LABELS, STATUS_LABELS, formatDate, formatDateTime, label } from "./credentials-utils";
import { CredentialBadge, JsonBlock } from "./credentials-shared";

export function CredentialMetadata({ credential }: { credential: CredentialItem }) {
  const rows = [
    ["Tipo", label(KIND_LABELS, credential.kind)],
    ["Provider", credential.provider || "-"],
    ["Account", credential.account_label || "-"],
    ["Dominio", credential.domain_name || "-"],
    ["Ambiente", label(ENVIRONMENT_LABELS, credential.environment)],
    ["Accesso", label(ACCESS_SCOPE_LABELS, credential.access_scope)],
    ["Owner user ID", credential.owner_user_id || "-"],
    ["Scadenza", formatDate(credential.expires_at)],
    ["Rinnovo", formatDate(credential.renewal_at)],
    ["Rotazione", formatDate(credential.rotation_due_at)],
    ["Auto renew", credential.auto_renew ? "Sì" : "No"],
    ["Secret version", credential.has_secret ? `v${credential.secret_version || 1}` : "Non configurato"],
    ["Ultima rotazione", formatDateTime(credential.last_rotated_at)],
    ["Creata", formatDateTime(credential.created_at)],
    ["Aggiornata", formatDateTime(credential.updated_at)],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CredentialBadge value={credential.status} map={STATUS_LABELS} />
        <CredentialBadge value={credential.environment} map={ENVIRONMENT_LABELS} />
        {credential.has_secret ? <CredentialBadge value="active" map={{ active: "Segreto configurato" }} /> : <CredentialBadge value="revoked" map={{ revoked: "Segreto assente" }} />}
      </div>
      {credential.description ? <p className="rounded-lg border bg-muted/30 p-3 text-sm">{credential.description}</p> : null}
      {credential.login_url ? (
        <Link href={credential.login_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          Apri login URL <ExternalLink className="h-4 w-4" />
        </Link>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(([name, value]) => (
          <div key={name} className="rounded-lg border p-3">
            <p className="text-xs font-semibold text-muted-foreground">{name}</p>
            <p className="mt-1 break-words text-sm">{value}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Metadata non sensibili</p>
        <JsonBlock value={credential.metadata || {}} />
      </div>
    </div>
  );
}

