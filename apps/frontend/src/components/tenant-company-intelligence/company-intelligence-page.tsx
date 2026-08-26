"use client";

import * as React from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalTenantAccess } from "@/contexts/TenantAccessContext";
import { useOptionalDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import {
  companyIntelligenceApi,
  type CompanyIntelligenceReport,
} from "@/lib/tenant-feature-api";

const runningStates = new Set(["queued", "collecting", "technical", "ai", "processing"]);

function reportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function CompanyIntelligencePage() {
  const tenantAccess = useOptionalTenantAccess();
  const doflowIdentity = useOptionalDoflowIdentity();
  const [reports, setReports] = React.useState<CompanyIntelligenceReport[]>([]);
  const [selected, setSelected] = React.useState<CompanyIntelligenceReport>();
  const [requestedUrl, setRequestedUrl] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState("");
  const canAnalyze = doflowIdentity
    ? doflowIdentity.hasCapability("canCreateLeads")
    : Boolean(tenantAccess?.canCreate("crm"));

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await companyIntelligenceApi.list({ limit: 30 });
      setReports(page.items);
      setSelected((current) => current
        ? page.items.find((item) => item.id === current.id) || current
        : page.items[0]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Company Intelligence non disponibile.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  React.useEffect(() => {
    if (!selected || !runningStates.has(selected.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const report = await companyIntelligenceApi.report(selected.id);
        setSelected(report);
        setReports((current) => current.map((item) => item.id === report.id ? report : item));
      } catch {
        window.clearInterval(timer);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [selected]);

  const analyze = async () => {
    if (!canAnalyze || !requestedUrl.trim()) return;
    setAnalyzing(true);
    try {
      const report = await companyIntelligenceApi.analyze({
        requestedUrl: requestedUrl.trim(),
      });
      if (!report) {
        toast.info("Provider Company Intelligence non configurato.");
        return;
      }
      setReports((current) => [report, ...current.filter((item) => item.id !== report.id)]);
      setSelected(report);
      setRequestedUrl("");
      toast.success("Analisi salvata.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Analisi non avviata.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="w-full space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Company Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidenze verificabili e opportunità commerciali, senza risultati simulati.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()}>
          <RefreshCw className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
          Aggiorna
        </Button>
      </header>

      {canAnalyze ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-5" />Nuova analisi</CardTitle>
            <CardDescription>Il backend applica controlli URL, limiti e provider configurati.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="intelligence-url">Dominio o sito pubblico</Label>
              <Input id="intelligence-url" inputMode="url" value={requestedUrl} onChange={(event) => setRequestedUrl(event.target.value)} placeholder="https://azienda.example" />
            </div>
            <Button type="button" disabled={!requestedUrl.trim() || analyzing} onClick={() => void analyze()}>
              {analyzing ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Search />}
              Analizza
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">Analisi recenti</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-xl" />) : null}
            {!loading && !reports.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nessuna analisi disponibile.</p> : null}
            {reports.map((report) => (
              <button
                type="button"
                key={report.id}
                onClick={() => setSelected(report)}
                className={"w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  + (selected?.id === report.id ? "bg-accent text-accent-foreground" : "bg-card text-card-foreground hover:bg-muted")}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{report.companyName || report.requestedUrl}</span>
                </span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <Badge variant="secondary">{report.status}</Badge>
                  <span className="text-[11px] text-muted-foreground">{reportDate(report.createdAt)}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{selected?.companyName || "Report"}</CardTitle>
            <CardDescription className="break-all">{selected?.requestedUrl || "Seleziona un’analisi."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selected ? (
              <div className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">
                <div><Globe2 className="mx-auto mb-3 size-10" />Nessun report selezionato.</div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge>{selected.status}</Badge>
                  {(selected.providers || []).map((provider) => (
                    <Badge key={provider.provider} variant={provider.configured ? "outline" : "secondary"}>
                      {provider.provider}: {provider.configured ? provider.status || "configurato" : "non configurato"}
                    </Badge>
                  ))}
                </div>
                {runningStates.has(selected.status) ? (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                      Analisi server in corso. Il report si aggiornerà automaticamente.
                    </p>
                  </div>
                ) : null}
                {selected.error ? (
                  <p role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />{selected.error}
                  </p>
                ) : null}
                {selected.notFoundInApollo ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Apollo non dispone ancora di dati per questo dominio.</p>
                ) : null}
                {selected.shortDescription || selected.summary ? <p className="text-sm leading-7">{selected.shortDescription || selected.summary}</p> : null}
                {selected.industry || selected.employeeCount !== undefined || selected.annualRevenue || selected.city || selected.country || selected.fundingStage || selected.totalFunding ? (
                  <section>
                    <h3 className="mb-3 font-semibold">Profilo aziendale</h3>
                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {selected.industry ? <div className="rounded-xl border p-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="size-3.5" />Settore</dt><dd className="mt-1 text-sm font-medium">{selected.industry}</dd></div> : null}
                      {selected.employeeCount !== undefined ? <div className="rounded-xl border p-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="size-3.5" />Dipendenti stimati</dt><dd className="mt-1 text-sm font-medium">{selected.employeeCount.toLocaleString("it-IT")}</dd></div> : null}
                      {selected.annualRevenue ? <div className="rounded-xl border p-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Landmark className="size-3.5" />Ricavi stimati</dt><dd className="mt-1 text-sm font-medium">{selected.annualRevenue}</dd></div> : null}
                      {selected.city || selected.country ? <div className="rounded-xl border p-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" />Sede</dt><dd className="mt-1 text-sm font-medium">{[selected.city, selected.country].filter(Boolean).join(", ")}</dd></div> : null}
                      {selected.fundingStage ? <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Ultimo round</dt><dd className="mt-1 text-sm font-medium">{selected.fundingStage}</dd></div> : null}
                      {selected.totalFunding ? <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">Funding totale</dt><dd className="mt-1 text-sm font-medium">{selected.totalFunding}</dd></div> : null}
                    </dl>
                    {selected.linkedinUrl?.startsWith("https://") ? <a href={selected.linkedinUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">Profilo LinkedIn aziendale<ExternalLink className="size-3.5" /></a> : null}
                  </section>
                ) : null}
                {selected.techStack?.length ? (
                  <section><h3 className="mb-3 flex items-center gap-2 font-semibold"><Server className="size-4" />Tecnologie rilevate</h3><div className="flex flex-wrap gap-2">{selected.techStack.map((technology) => <Badge key={technology} variant="secondary">{technology}</Badge>)}</div></section>
                ) : null}
                {selected.people?.length ? (
                  <section>
                    <h3 className="mb-3 font-semibold">Persone chiave</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selected.people.map((person) => <article key={person.id || person.name} className="rounded-xl border p-3"><p className="text-sm font-medium">{person.name}</p>{person.title ? <p className="mt-1 text-sm text-muted-foreground">{person.title}</p> : null}<div className="mt-2 flex flex-wrap items-center gap-2">{person.seniority ? <Badge variant="outline">{person.seniority}</Badge> : null}{person.city || person.country ? <span className="text-xs text-muted-foreground">{[person.city, person.country].filter(Boolean).join(", ")}</span> : null}{person.linkedinUrl?.startsWith("https://") ? <a href={person.linkedinUrl} target="_blank" rel="noreferrer" aria-label={`LinkedIn di ${person.name}`} className="ml-auto text-primary"><ExternalLink className="size-4" /></a> : null}</div></article>)}
                    </div>
                  </section>
                ) : null}
                {selected.fundingEvents?.length ? (
                  <section><h3 className="mb-3 font-semibold">Eventi di funding</h3><div className="space-y-2">{selected.fundingEvents.map((event, index) => <div key={event.id || index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><span>{event.series || "Round"}{event.date ? ` · ${event.date}` : ""}</span><strong>{event.amount !== undefined ? new Intl.NumberFormat("it-IT", { style: "currency", currency: event.currency || "USD", maximumFractionDigits: 0 }).format(event.amount) : "Importo non disponibile"}</strong></div>)}</div></section>
                ) : null}
                {selected.scores && Object.keys(selected.scores).length ? (
                  <section>
                    <h3 className="mb-3 font-semibold">Indicatori</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(selected.scores).map(([label, score]) => (
                        <div key={label} className="rounded-xl border p-3">
                          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                            <span className="capitalize">{label.replaceAll("_", " ")}</span><strong>{score}/100</strong>
                          </div>
                          <Progress value={score} />
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {selected.findings?.length ? (
                  <section>
                    <h3 className="mb-3 font-semibold">Evidenze</h3>
                    <div className="space-y-2">
                      {selected.findings.map((finding, index) => (
                        <div key={finding.id || index} className="rounded-xl border p-3">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{finding.title}</p>
                              {finding.description ? <p className="mt-1 text-sm text-muted-foreground">{finding.description}</p> : null}
                            </div>
                            {finding.evidenceKind ? <Badge variant="outline">{finding.evidenceKind}</Badge> : null}
                          </div>
                          {finding.sourceUrl ? (
                            <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline">
                              Fonte<ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
