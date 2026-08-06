"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { credentialsApi } from "@/lib/tenant-credentials-api";
import type { CredentialItem, CredentialsDashboard, CredentialsOptions } from "@/lib/tenant-credentials-types";
import { CredentialRevealDialog } from "./credential-reveal-dialog";
import { CredentialRotateDialog } from "./credential-rotate-dialog";
import { CredentialsFilters, type CredentialFilters } from "./credentials-filters";
import { CredentialsList } from "./credentials-list";
import { CredentialsSummaryCards } from "./credentials-summary-cards";
import { CredentialsError, CredentialsHeader, CredentialsLoading } from "./credentials-shared";
import { assertMetadataOnlyExport, downloadJson, normalizeError } from "./credentials-utils";

export function CredentialsOverviewPage({ mode = "all" }: { mode?: "all" | "expiring" | "renewals" | "rotation" }) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<CredentialsDashboard | null>(null);
  const [options, setOptions] = useState<CredentialsOptions | null>(null);
  const [items, setItems] = useState<CredentialItem[]>([]);
  const [filters, setFilters] = useState<CredentialFilters>({ sort: "updated_at", dir: "desc" });
  const [selected, setSelected] = useState<CredentialItem | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ConfirmDialog, confirm } = useConfirm();

  const title = mode === "expiring" ? "Credenziali in scadenza" : mode === "renewals" ? "Rinnovi credenziali" : mode === "rotation" ? "Rotazioni dovute" : "Accessi e credenziali";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...filters, limit: 50 };
      const listPromise = mode === "expiring" ? credentialsApi.expiring(params) : mode === "renewals" ? credentialsApi.renewalsDue(params) : mode === "rotation" ? credentialsApi.rotationDue(params) : credentialsApi.list(params);
      const [summaryData, optionsData, listData] = await Promise.all([
        credentialsApi.dashboard().catch(() => null),
        credentialsApi.options().catch(() => null),
        listPromise,
      ]);
      setSummary(summaryData);
      setOptions(optionsData);
      setItems(listData.items || []);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [mode, filters.search, filters.kind, filters.environment, filters.status, filters.access_scope, filters.sort, filters.dir]);

  const exportAll = async () => {
    try {
      const payload = await credentialsApi.exportAll();
      assertMetadataOnlyExport(payload);
      downloadJson(`doflow-credentials-metadata-${new Date().toISOString().slice(0, 10)}.json`, payload);
    } catch (err) {
      toast({ title: "Export bloccato", description: normalizeError(err), variant: "destructive" });
    }
  };

  const archive = async (item: CredentialItem) => {
    const ok = await confirm({
      title: "Archivia credenziale?",
      description: "La credenziale verrà archiviata e non apparirà più nelle liste operative.",
      confirmLabel: "Archivia",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await credentialsApi.archive(item.id);
      toast({ title: "Credenziale archiviata" });
      await load();
    } catch (err) {
      toast({ title: "Archive non riuscito", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6">
      <CredentialsHeader title={title} description="Vault interno metadata-only per accessi operativi, con reveal auditato e controllato dal backend.">
        <Button asChild><Link href="/credentials/new"><Plus className="mr-2 h-4 w-4" /> Nuova credenziale</Link></Button>
        <Button variant="outline" onClick={exportAll}><Download className="mr-2 h-4 w-4" /> Esporta metadati</Button>
      </CredentialsHeader>
      <CredentialsError message={error} />
      <CredentialsSummaryCards summary={summary} />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link href="/credentials/expiring">In scadenza</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/credentials/renewals-due">Rinnovi</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/credentials/rotation-due">Rotazioni</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/credentials/activity">Attività</Link></Button>
      </div>
      <CredentialsFilters filters={filters} options={options} onChange={setFilters} />
      {loading ? <CredentialsLoading /> : (
        <CredentialsList
          items={items}
          onReveal={(item) => { setSelected(item); setRevealOpen(true); }}
          onRotate={(item) => { setSelected(item); setRotateOpen(true); }}
          onArchive={archive}
        />
      )}
      <CredentialRevealDialog credential={selected} open={revealOpen} onOpenChange={setRevealOpen} />
      <CredentialRotateDialog credential={selected} open={rotateOpen} onOpenChange={setRotateOpen} onDone={load} />
      <ConfirmDialog />
    </div>
  );
}

