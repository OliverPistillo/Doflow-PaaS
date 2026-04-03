// apps/frontend/src/app/superadmin/sitebuilder/sitebuilder-client.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, Globe, Sparkles, Plus, X, RefreshCw,
  CheckCircle2, XCircle, Clock, Zap, Terminal,
  ExternalLink, ChevronRight, ArrowLeft, Puzzle,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSitebuilderJob, type SitebuilderJob, type SitebuilderJobStatus } from "@/hooks/useSitebuilderJob";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateJobPayload {
  tenantId: string;
  siteDomain: string;
  siteTitle: string;
  adminEmail: string;
  adminPassword: string;
  contentTopics: string[];
  plugins: string[];
  locale: string;
}

interface CreateJobResponse {
  jobId: string;
  status: string;
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { id: "dir",     label: "Directory deployment",    icon: "📁" },
  { id: "compose", label: "docker-compose.yml",       icon: "🐳" },
  { id: "llm",     label: "Generazione LLM",          icon: "✨" },
  { id: "up",      label: "docker compose up",        icon: "🚀" },
  { id: "db",      label: "MariaDB ready",            icon: "🛢" },
  { id: "wpinst",  label: "WP core install",          icon: "⚙️" },
  { id: "theme",   label: "Tema & plugin",            icon: "🎨" },
  { id: "blocks",  label: "Blocchi Gutenberg",        icon: "📄" },
];

const STATUS_CONFIG: Record<SitebuilderJobStatus, { label: string; color: string; bg: string }> = {
  PENDING:     { label: "In coda",      color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  RUNNING:     { label: "In esecuzione", color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  DONE:        { label: "Completato",   color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  FAILED:      { label: "Fallito",      color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  ROLLED_BACK: { label: "Rollback",     color: "text-red-500",    bg: "bg-red-50 border-red-200" },
};

const POPULAR_PLUGINS = [
  "contact-form-7",
  "yoast-seo",
  "woocommerce",
  "wordfence",
  "updraftplus",
  "wp-super-cache",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function guessStepFromLog(logs: string[]): number {
  const last = logs.at(-1) ?? "";
  if (last.includes("Blocchi Gutenberg")) return 7;
  if (last.includes("Tema")) return 6;
  if (last.includes("WP core install")) return 5;
  if (last.includes("MariaDB")) return 4;
  if (last.includes("docker compose up")) return 3;
  if (last.includes("LLM") || last.includes("Anthropic")) return 2;
  if (last.includes("docker-compose.yml")) return 1;
  if (last.includes("directory")) return 0;
  return -1;
}

function progressFromStatus(status: SitebuilderJobStatus, stepIndex: number): number {
  if (status === "DONE") return 100;
  if (status === "FAILED" || status === "ROLLED_BACK") return 100;
  if (status === "PENDING") return 0;
  return Math.round(((stepIndex + 1) / PIPELINE_STEPS.length) * 92);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TopicInput({
  topics,
  onChange,
}: {
  topics: string[];
  onChange: (t: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTopic = (val: string) => {
    const clean = val.trim();
    if (clean && topics.length < 10 && !topics.includes(clean)) {
      onChange([...topics, clean]);
    }
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[36px]">
        {topics.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-md font-medium"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(topics.filter((x) => x !== t))}
              className="ml-0.5 opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && input.trim()) {
              e.preventDefault();
              addTopic(input);
            }
          }}
          placeholder="Es. Chi siamo, Servizi..."
          className="text-sm"
          disabled={topics.length >= 10}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addTopic(input)}
          disabled={!input.trim() || topics.length >= 10}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Invio per aggiungere · {topics.length}/10
      </p>
    </div>
  );
}

function PluginInput({
  plugins,
  onChange,
}: {
  plugins: string[];
  onChange: (p: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addPlugin = (slug: string) => {
    const clean = slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (clean && !plugins.includes(clean)) onChange([...plugins, clean]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {plugins.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono"
          >
            {p}
            <button type="button" onClick={() => onChange(plugins.filter((x) => x !== p))}>
              <X className="h-3 w-3 opacity-60 hover:opacity-100" />
            </button>
          </span>
        ))}
      </div>
      {/* Quick-add popular plugins */}
      <div className="flex flex-wrap gap-1.5">
        {POPULAR_PLUGINS.filter((s) => !plugins.includes(s)).map((slug) => (
          <button
            key={slug}
            type="button"
            onClick={() => addPlugin(slug)}
            className="px-2 py-0.5 text-[11px] border border-dashed border-border rounded text-muted-foreground hover:border-primary hover:text-primary transition-colors font-mono"
          >
            + {slug}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) { e.preventDefault(); addPlugin(input); }
          }}
          placeholder="slug-del-plugin (es. akismet)"
          className="text-sm font-mono"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => addPlugin(input)} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Download Button ──────────────────────────────────────────────────────────

function DownloadButton({ jobId, siteDomain }: { jobId: string; siteDomain: string }) {
  const [loading, setLoading] = React.useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      // Chiama l'endpoint che restituisce il blob ZIP in streaming
      const base = getApiBaseUrl(); // es. "https://api.doflow.it/api"
      const token = typeof window !== "undefined"
        ? window.localStorage.getItem("doflow_token") ?? ""
        : "";

      const res = await fetch(`${base}/sitebuilder/jobs/${jobId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      // Crea un link temporaneo e forza il download nel browser
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wp-${siteDomain}-${jobId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Errore download: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />}
      {loading ? "Preparazione ZIP..." : "Scarica cartella WordPress (.zip)"}
    </button>
  );
}

// ─── Job Monitor ──────────────────────────────────────────────────────────────

function JobMonitor({ job }: { job: SitebuilderJob }) {
  const logRef = useRef<HTMLDivElement>(null);
  const stepIndex = guessStepFromLog(job.logs);
  const progress = progressFromStatus(job.status, stepIndex);
  const cfg = STATUS_CONFIG[job.status];
  const isTerminal = ["DONE", "FAILED", "ROLLED_BACK"].includes(job.status);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [job.logs]);

  return (
    <div className="space-y-4">
      {/* Header status */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">{job.siteDomain}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{job.id}</p>
        </div>
        <Badge variant="outline" className={cn("text-xs gap-1.5", cfg.bg, cfg.color)}>
          {job.status === "RUNNING" && (
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          )}
          {job.status === "DONE" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {(job.status === "FAILED" || job.status === "ROLLED_BACK") && <XCircle className="h-3.5 w-3.5" />}
          {job.status === "PENDING" && <Clock className="h-3.5 w-3.5" />}
          {cfg.label}
        </Badge>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{PIPELINE_STEPS[Math.max(0, stepIndex)]?.label ?? "In attesa..."}</span>
          <span>{progress}%</span>
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="grid grid-cols-4 gap-1.5">
        {PIPELINE_STEPS.map((step, i) => {
          const isDone = i < stepIndex;
          const isActive = i === stepIndex && job.status === "RUNNING";
          return (
            <div
              key={step.id}
              className={cn(
                "rounded-md px-2 py-1.5 text-center text-[10px] border transition-all",
                isDone  && "bg-green-50 border-green-200 text-green-700",
                isActive && "bg-blue-50 border-blue-200 text-blue-700",
                !isDone && !isActive && "bg-muted/40 border-border text-muted-foreground",
              )}
            >
              <div className="text-sm mb-0.5">{step.icon}</div>
              <div className="leading-tight">{step.label}</div>
            </div>
          );
        })}
      </div>

      {/* Terminal log */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 border-b border-border">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-[11px] text-muted-foreground font-mono">deployment.log</span>
        </div>
        <div
          ref={logRef}
          className="bg-card p-3 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5"
        >
          {job.logs.length === 0 ? (
            <span className="text-muted-foreground">In attesa di log...</span>
          ) : (
            job.logs.map((line, i) => {
              const isError = line.toLowerCase().includes("error") || line.toLowerCase().includes("fallito");
              const isOk = line.includes("✓") || line.toLowerCase().includes("completato") || line.toLowerCase().includes("ready");
              return (
                <div key={i} className={cn(
                  isError && "text-red-500",
                  isOk    && "text-green-600",
                  !isError && !isOk && "text-muted-foreground",
                )}>
                  {line}
                </div>
              );
            })
          )}
          {job.status === "RUNNING" && (
            <span className="inline-block w-1.5 h-3.5 bg-muted-foreground animate-pulse align-text-bottom ml-0.5" />
          )}
        </div>
      </div>

      {/* Result */}
      {job.status === "DONE" && job.siteUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-sm text-green-700 font-medium flex-1">{job.siteUrl}</span>
            <a href={job.siteUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-100">
                Apri <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </a>
          </div>
          {/* Pulsante download ZIP */}
          <DownloadButton jobId={job.id} siteDomain={job.siteDomain} />
        </div>
      )}
      {(job.status === "FAILED" || job.status === "ROLLED_BACK") && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <p className="font-medium">Job fallito dopo tutti i retry.</p>
          <p className="text-xs mt-0.5">I container orfani sono stati distrutti automaticamente (rollback).</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SitebuilderClient() {
  const { toast } = useToast();

  // ── Form state
  const [step, setStep] = useState<"form" | "monitor">("form");
  const [submitting, setSubmitting] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [form, setForm] = useState<CreateJobPayload>({
    tenantId:      "",
    siteDomain:    "",
    siteTitle:     "",
    adminEmail:    "",
    adminPassword: "",
    contentTopics: [],
    plugins:       [],
    locale:        "it",
  });

  // ── Job polling
  const [jobId, setJobId] = useState<string | null>(null);
  const { job, error: pollError, isPolling } = useSitebuilderJob(jobId);

  const setField = <K extends keyof CreateJobPayload>(k: K, v: CreateJobPayload[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const canSubmit =
    form.tenantId &&
    form.siteDomain &&
    form.siteTitle &&
    form.adminEmail &&
    form.adminPassword.length >= 10 &&
    form.contentTopics.length >= 1 &&
    !submitting;

  // ── AI topic suggestions (chiama il Route Handler Next.js — non Anthropic direttamente)
  const handleSuggest = useCallback(async () => {
    if (!form.siteTitle) return;
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/sitebuilder/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteTitle: form.siteTitle, locale: form.locale }),
      });
      const data = await res.json() as string[];
      setSuggestions(data.filter((s) => !form.contentTopics.includes(s)));
    } catch {
      toast({ title: "Errore AI", description: "Impossibile generare suggerimenti.", variant: "destructive" });
    } finally {
      setSuggestLoading(false);
    }
  }, [form.siteTitle, form.locale, form.contentTopics, toast]);

  // ── Submit
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<CreateJobResponse>("/sitebuilder/jobs", {
        method: "POST",
        body: JSON.stringify(form),
        auth: true,
      });
      setJobId(res.jobId);
      setStep("monitor");
      toast({ title: "Job avviato", description: `ID: ${res.jobId.slice(0, 8)}...` });
    } catch (err) {
      toast({
        title: "Errore",
        description: err instanceof Error ? err.message : "Errore sconosciuto",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Sitebuilder WordPress
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Crea un sito WordPress completo con contenuti generati da AI
          </p>
        </div>
        {step === "monitor" && (
          <Button variant="outline" size="sm" onClick={() => { setStep("form"); setJobId(null); }}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Nuovo job
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {["Configurazione", "Deployment"].map((label, i) => {
          const isCurrent = (step === "form" && i === 0) || (step === "monitor" && i === 1);
          const isDone = step === "monitor" && i === 0;
          return (
            <React.Fragment key={label}>
              {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <div className={cn("flex items-center gap-2 text-sm",
                isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-mono border",
                  isCurrent && "bg-foreground text-background border-foreground",
                  isDone    && "bg-green-100 text-green-700 border-green-300",
                  !isCurrent && !isDone && "border-border",
                )}>
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── FORM ── */}
      {step === "form" && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Sito WordPress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Dominio</Label>
                  <Input placeholder="demo.cliente.it" value={form.siteDomain}
                    onChange={(e) => setField("siteDomain", e.target.value.toLowerCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Titolo sito</Label>
                  <Input placeholder="Acme Corp" value={form.siteTitle}
                    onChange={(e) => setField("siteTitle", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email admin WP</Label>
                  <Input type="email" placeholder="admin@azienda.it" value={form.adminEmail}
                    onChange={(e) => setField("adminEmail", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Password admin</Label>
                  <Input type="password" placeholder="min. 10 caratteri" value={form.adminPassword}
                    onChange={(e) => setField("adminPassword", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tenant ID</Label>
                  <Input placeholder="tenant-slug" value={form.tenantId}
                    onChange={(e) => setField("tenantId", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lingua</Label>
                  <Select value={form.locale} onValueChange={(v) => setField("locale", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[["it","Italiano"],["en","English"],["fr","Français"],["de","Deutsch"],["es","Español"]].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Topic section */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Contenuti (topic)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleSuggest}
                  disabled={!form.siteTitle || suggestLoading}
                >
                  {suggestLoading
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  Suggerisci con AI
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <TopicInput topics={form.contentTopics} onChange={(t) => setField("contentTopics", t)} />
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Suggeriti dall&apos;AI — clicca per aggiungere:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          if (!form.contentTopics.includes(s) && form.contentTopics.length < 10) {
                            setField("contentTopics", [...form.contentTopics, s]);
                            setSuggestions((prev) => prev.filter((x) => x !== s));
                          }
                        }}
                        className="px-2.5 py-1 text-xs border border-dashed border-primary/40 rounded-md text-primary hover:bg-primary/10 transition-colors"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plugins section */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Puzzle className="h-3.5 w-3.5" />
                Plugin da installare (opzionale)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PluginInput plugins={form.plugins} onChange={(p) => setField("plugins", p)} />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-1">
            <Button onClick={handleSubmit} disabled={!canSubmit} size="default" className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Avvia deployment
              <Zap className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── MONITOR ── */}
      {step === "monitor" && (
        <Card className="glass-card">
          <CardContent className="pt-6">
            {!job && !pollError && (
              <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Connessione al job...</span>
              </div>
            )}
            {pollError && (
              <div className="py-8 text-center">
                <p className="text-sm text-destructive">{pollError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setJobId(jobId)}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Riprova
                </Button>
              </div>
            )}
            {job && <JobMonitor job={job} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}