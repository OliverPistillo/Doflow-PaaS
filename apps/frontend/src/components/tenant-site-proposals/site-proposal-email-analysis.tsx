"use client";

import { Badge } from "@/components/ui/badge";
import type { CommercialAnalysis, PersonalizationStatus } from "@/lib/tenant-site-proposals-api";
import { SiteProposalEmailEditor } from "./site-proposal-email-editor";

export function SiteProposalEmailAnalysis({ analysis, status, subject, body, originalSubject, originalBody, onEmailChange }: { analysis: CommercialAnalysis; status?: PersonalizationStatus | null; subject: string; body: string; originalSubject: string; originalBody: string; onAnalysisChange: (next: CommercialAnalysis) => void; onEmailChange: (next: { subject: string; body: string }) => void }) {
  const complete = subject.trim().length >= 8 && body.trim().length >= 250 && body.includes("[LINK_DEMO]");
  const provider = complete && status === "completed" ? "AI" : complete && status === "fallback" ? "Motore locale" : null;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">{provider ? <Badge className={provider === "AI" ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}>{provider}</Badge> : <Badge className="bg-amber-100 text-amber-700">Preparazione incompleta</Badge>}</div>
    <SiteProposalEmailEditor subject={subject} body={body} originalSubject={originalSubject} originalBody={originalBody} onChange={onEmailChange} />
    <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Dettagli tecnici della preparazione</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Provider</dt><dd>{provider || "Non disponibile"}</dd></div><div><dt className="text-muted-foreground">Revisione manuale</dt><dd>{analysis.requiresManualReview ? "Richiesta" : "Non indicata"}</dd></div><div className="sm:col-span-2"><dt className="text-muted-foreground">URL analizzato</dt><dd className="break-all">{String(analysis.sourceUrl || analysis.finalUrl || "Non disponibile")}</dd></div></dl></details>
  </div>;
}
