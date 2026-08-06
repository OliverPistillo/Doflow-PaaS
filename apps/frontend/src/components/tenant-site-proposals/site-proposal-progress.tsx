import { Badge } from "@/components/ui/badge";
import type { PreparationProgress, PreparationStatus } from "@/lib/tenant-site-proposals-api";
import { formatDate } from "./site-proposal-utils";

const labels: Record<string, string> = {
  waiting: "In attesa", queueing: "Accodamento", "loading-data": "Caricamento dati attività", "loading-theme": "Caricamento tema",
  identity: "Analisi identità e contatti", "base-content": "Creazione contenuti base", ai: "Personalizzazione AI", local: "Personalizzazione locale",
  images: "Selezione immagini", logo: "Creazione o applicazione logo", validation: "Validazione proposta", html: "Generazione HTML",
  zip: "Creazione ZIP", artifacts: "Salvataggio artefatti", ready: "Pronta", failed: "Preparazione fallita",
};

export function SiteProposalProgress({ value, compact = false }: { value: PreparationProgress & { preparation_status?: PreparationStatus | null }; compact?: boolean }) {
  const status = value.preparationStatus || value.preparation_status || "idle";
  const percent = Math.max(0, Math.min(100, Number(value.progressPercent || 0)));
  const stage = value.progressStage || (status === "queued" ? "waiting" : status === "running" ? "loading-data" : status === "failed" ? "failed" : "ready");
  if (status === "idle" && percent === 0) return <p className="text-xs text-slate-500">Preparazione da avviare</p>;
  const fallback = status === "fallback" || value.provider === "local";
  return <div className={compact ? "min-w-44" : "w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4"}>
    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{labels[stage] || stage}</span><strong className="tabular-nums text-slate-900">{percent}%</strong></div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={labels[stage] || stage} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className={`h-full rounded-full transition-[width] duration-500 ${status === "failed" ? "bg-rose-500" : fallback ? "bg-indigo-500" : "bg-emerald-500"}`} style={{ width: `${percent}%` }} /></div>
    {value.progressMessage ? <p className="mt-1.5 text-xs text-slate-500">{value.progressMessage}</p> : null}
    {!compact ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">{value.provider ? <Badge variant="outline">{value.provider === "gemini" ? "Gemini" : "Fallback locale"}</Badge> : null}{value.progressUpdatedAt ? <span>Aggiornato {formatDate(value.progressUpdatedAt)}</span> : null}</div> : null}
  </div>;
}
