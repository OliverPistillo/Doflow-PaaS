"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommercialEmptyState, CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";
import { listSiteProposalActivity, type SiteProposalActivity } from "@/lib/tenant-site-proposals-api";
import { formatDate, getErrorMessage } from "./site-proposal-utils";

const labels: Record<string, string> = { PROPOSAL_CREATED: "Proposta creata", IMPORT_CONFIRMED: "Import confermato", PROPOSAL_UPDATED: "Proposta aggiornata", CRM_LINK_UPDATED: "Collegamenti CRM aggiornati", VERSION_CREATED: "Versione creata", VERSION_RESTORED: "Versione ripristinata", GENERATION_STARTED: "Generazione avviata", GENERATED: "Proposta generata", GENERATION_FAILED: "Generazione non riuscita", PROPOSAL_ARCHIVED: "Proposta archiviata" };
function safeMetadata(metadata?: Record<string, unknown>) { const keys = ["version", "status", "templateVersion", "reason", "restoredFrom"].filter((key) => metadata?.[key] !== undefined); return keys.map((key) => `${key}: ${String(metadata?.[key])}`).join(" · "); }
export function SiteProposalActivityPanel({ proposalId }: { proposalId: string }) { const [items, setItems] = useState<SiteProposalActivity[]>([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const load = useCallback(async (offset = 0) => { setLoading(true); try { const result = await listSiteProposalActivity(proposalId, { limit: 50, offset }); setItems((current) => offset ? [...current, ...result.items] : result.items); setTotal(result.total); setError(null); } catch (value) { setError(getErrorMessage(value)); } finally { setLoading(false); } }, [proposalId]); useEffect(() => {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) {
      void load();
    }
  });
  return () => {
    cancelled = true;
  };
}, [load]); return <CommercialSectionCard title="Attività">{error ? <p className="text-sm text-rose-600">{error}</p> : null}{!loading && items.length === 0 ? <CommercialEmptyState>Nessuna attività registrata.</CommercialEmptyState> : <ol className="space-y-4 border-l border-border pl-5">{items.map((item) => <li key={item.id} className="relative"><span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-white bg-primary/100" /><p className="text-sm font-medium text-foreground">{labels[item.action] || "Attività proposta"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.created_at)}{item.actor_email ? ` · ${item.actor_email}` : ""}</p>{safeMetadata(item.metadata) ? <p className="mt-1 text-xs text-muted-foreground">{safeMetadata(item.metadata)}</p> : null}</li>)}</ol>}{items.length < total ? <Button className="mt-5" variant="outline" disabled={loading} onClick={() => void load(items.length)}>Carica altre attività</Button> : null}</CommercialSectionCard>; }
