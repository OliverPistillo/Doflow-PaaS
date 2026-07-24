"use client";

import Link from "next/link";
import { Archive, Eye, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CredentialItem } from "@/lib/tenant-credentials-types";
import { ACCESS_SCOPE_LABELS, ENVIRONMENT_LABELS, KIND_LABELS, STATUS_LABELS, formatDate, formatDateTime, label } from "./credentials-utils";
import { CredentialBadge, CredentialsEmptyState } from "./credentials-shared";

export function CredentialsList({
  items,
  onReveal,
  onRotate,
  onArchive,
  compact,
}: {
  items: CredentialItem[];
  onReveal?: (item: CredentialItem) => void;
  onRotate?: (item: CredentialItem) => void;
  onArchive?: (item: CredentialItem) => void;
  compact?: boolean;
}) {
  if (!items.length) return <CredentialsEmptyState>Nessuna credenziale presente.</CredentialsEmptyState>;

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-lg border lg:block">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Titolo</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Ambiente</th>
              <th className="px-3 py-2">Stato</th>
              <th className="px-3 py-2">Scadenza</th>
              <th className="px-3 py-2">Rinnovo</th>
              <th className="px-3 py-2">Rotazione</th>
              <th className="px-3 py-2">Segreto</th>
              <th className="px-3 py-2">Aggiornata</th>
              <th className="px-3 py-2">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="max-w-[220px] px-3 py-3">
                  <Link href={`/credentials/${item.id}`} className="font-semibold hover:underline">{item.title}</Link>
                  <p className="truncate text-xs text-muted-foreground">{item.account_label || item.domain_name || item.login_url || ""}</p>
                </td>
                <td className="px-3 py-3">{label(KIND_LABELS, item.kind)}</td>
                <td className="px-3 py-3">{item.provider || "-"}</td>
                <td className="px-3 py-3"><CredentialBadge value={item.environment} map={ENVIRONMENT_LABELS} /></td>
                <td className="px-3 py-3"><CredentialBadge value={item.status} map={STATUS_LABELS} /></td>
                <td className="px-3 py-3">{formatDate(item.expires_at)}</td>
                <td className="px-3 py-3">{formatDate(item.renewal_at)}</td>
                <td className="px-3 py-3">{formatDate(item.rotation_due_at)}</td>
                <td className="px-3 py-3">{item.has_secret ? `v${item.secret_version || 1}` : "Non configurato"}</td>
                <td className="px-3 py-3">{formatDateTime(item.updated_at)}</td>
                <td className="px-3 py-3">
                  <RowActions item={item} onReveal={onReveal} onRotate={onRotate} onArchive={onArchive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 lg:hidden">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/credentials/${item.id}`} className="font-semibold hover:underline">{item.title}</Link>
                  <p className="text-xs text-muted-foreground">{label(KIND_LABELS, item.kind)} · {item.provider || "Provider non indicato"}</p>
                </div>
                <CredentialBadge value={item.status} map={STATUS_LABELS} />
              </div>
              {!compact ? (
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Ambiente: {label(ENVIRONMENT_LABELS, item.environment)}</span>
                  <span>Accesso: {label(ACCESS_SCOPE_LABELS, item.access_scope)}</span>
                  <span>Scadenza: {formatDate(item.expires_at)}</span>
                  <span>Rotazione: {formatDate(item.rotation_due_at)}</span>
                </div>
              ) : null}
              <RowActions item={item} onReveal={onReveal} onRotate={onRotate} onArchive={onArchive} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RowActions({ item, onReveal, onRotate, onArchive }: { item: CredentialItem; onReveal?: (item: CredentialItem) => void; onRotate?: (item: CredentialItem) => void; onArchive?: (item: CredentialItem) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline"><Link href={`/credentials/${item.id}`}><Eye className="mr-2 h-3.5 w-3.5" /> Apri</Link></Button>
      {item.has_secret && onReveal ? <Button size="sm" variant="outline" onClick={() => onReveal(item)}><KeyRound className="mr-2 h-3.5 w-3.5" /> Rivela</Button> : null}
      {onRotate ? <Button size="sm" variant="outline" onClick={() => onRotate(item)}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Ruota</Button> : null}
      {onArchive && item.status !== "archived" ? <Button size="sm" variant="outline" onClick={() => onArchive(item)}><Archive className="mr-2 h-3.5 w-3.5" /> Archivia</Button> : null}
    </div>
  );
}

