"use client";
// apps/frontend/src/app/superadmin/sitebuilder/sitebuilder-client.tsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, Globe, Sparkles, Plus, X, RefreshCw,
  CheckCircle2, XCircle, Clock, Zap, Download,
  ArrowLeft, ExternalLink, Eye, ChevronRight,
  Palette, Building2, History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSitebuilderJob, type SitebuilderJob } from "@/hooks/useSitebuilderJob";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StarterSite {
  slug: string;
  label: string;
  previewUrl: string;
  category: string;
}

interface DesignScheme {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  headingFont?: string;
  bodyFont?: string;
}

interface WizardForm {
  tenantId:            string;
  siteDomain:          string;
  siteTitle:           string;
  adminEmail:          string;
  businessType:        string;
  businessDescription: string;
  starterSite:         string;
  designScheme:        DesignScheme;
  contentTopics:       string[];
  locale:              string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  "Ristorante", "eCommerce", "Portfolio", "Agenzia", "Consulenza",
  "Fitness", "Medico / Clinica", "Avvocato / Studio Legale",
  "Immobiliare", "Fotografo", "Blog", "SaaS / Software", "Altro",
];

const HEADING_FONTS = ["Sans-serif (moderno)", "Serif (elegante)", "Monospace (tecnico)"];
const BODY_FONTS    = ["Sans-serif", "Serif", "System"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: "In coda",      color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  RUNNING:     { label: "In esecuzione", color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  DONE:        { label: "Completato",   color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  FAILED:      { label: "Fallito",      color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  ROLLED_BACK: { label: "Rollback",     color: "text-red-500",    bg: "bg-red-50 border-red-200" },
};

const WIZARD_STEPS = [
  { id: "info",    label: "Sito",       icon: Globe },
  { id: "desc",    label: "Business",   icon: Building2 },
  { id: "theme",   label: "Tema",       icon: Eye },
  { id: "design",  label: "Design",     icon: Palette },
  { id: "topics",  label: "Contenuti",  icon: Zap },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep, steps }: {
  currentStep: number;
  steps: typeof WIZARD_STEPS;
}) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((step, i) => {
        const done    = i < currentStep;
        const active  = i === currentStep;
        const Icon    = step.icon;
        return (
          <React.Fragment key={step.id}>
            {i > 0 && <div className={cn("flex-1 h-px", done ? "bg-primary" : "bg-border")} />}
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all",
              done   && "bg-primary text-primary-foreground border-primary",
              active && "bg-primary/10 text-primary border-primary",
              !done && !active && "text-muted-foreground border-border",
            )}>
              {done
                ? <CheckCircle2 className="h-3.5 w-3.5" />
                : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Topic chips ──────────────────────────────────────────────────────────────

function TopicInput({ topics, onChange }: {
  topics: string[];
  onChange: (t: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = (v: string) => {
    const c = v.trim();
    if (c && topics.length < 10 && !topics.includes(c)) onChange([...topics, c]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[36px]">
        {topics.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-md font-medium">
            {t}
            <button type="button" onClick={() => onChange(topics.filter((x) => x !== t))}>
              <X className="h-3 w-3 opacity-60 hover:opacity-100" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { e.preventDefault(); add(input); }}}
          placeholder="Es. Home, Chi siamo, Servizi..." className="text-sm"
          disabled={topics.length >= 10} />
        <Button type="button" variant="outline" size="sm" onClick={() => add(input)} disabled={!input.trim() || topics.length >= 10}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Invio per aggiungere · {topics.length}/10</p>
    </div>
  );
}

// ─── Job Monitor ──────────────────────────────────────────────────────────────

function JobMonitor({ job, onReset }: { job: SitebuilderJob; onReset: () => void }) {
  const logRef = useRef<HTMLDivElement>(null);
  const cfg    = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.PENDING;
  const isTerminal = ["DONE", "FAILED", "ROLLED_BACK"].includes(job.status);
  const progress   = job.status === "DONE" ? 100 : job.status === "PENDING" ? 0 :
    Math.min(90, Math.round((job.logs.length / 15) * 90));

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job.logs]);

  const handleDownload = async () => {
    const base  = getApiBaseUrl();
    const token = typeof window !== "undefined" ? window.localStorage.getItem("doflow_token") ?? "" : "";
    const res   = await fetch(`${base}/sitebuilder/jobs/${job.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return alert("Errore download");
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${job.siteDomain}-wordpress.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{job.siteDomain}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{job.id.slice(0, 8)}...</p>
        </div>
        <Badge variant="outline" className={cn("text-xs gap-1.5", cfg.bg, cfg.color)}>
          {job.status === "RUNNING" && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
          {job.status === "DONE"    && <CheckCircle2 className="h-3.5 w-3.5" />}
          {cfg.label}
        </Badge>
      </div>

      <div className="space-y-1">
        <Progress value={progress} className="h-1.5" />
        <p className="text-xs text-muted-foreground text-right">{progress}%</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 border-b">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="ml-2 text-[11px] text-muted-foreground font-mono">build.log</span>
        </div>
        <div ref={logRef} className="bg-card p-3 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
          {job.logs.length === 0
            ? <span className="text-muted-foreground">Avvio in corso...</span>
            : job.logs.map((line: string, i: number) => (
              <div key={i} className={cn(
                line.includes("✓") || line.includes("completat") ? "text-green-600" :
                line.includes("ERRORE") || line.includes("fallito") ? "text-red-500" :
                "text-muted-foreground",
              )}>{line}</div>
            ))
          }
          {job.status === "RUNNING" && <span className="inline-block w-1.5 h-3.5 bg-muted-foreground animate-pulse align-text-bottom" />}
        </div>
      </div>

      {job.status === "DONE" && (
        <div className="space-y-2">
          <button onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium hover:bg-green-100 transition-colors">
            <Download className="h-4 w-4" />
            Scarica WordPress ZIP
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Importa su SiteGround seguendo il file LEGGIMI.md incluso nello ZIP
          </p>
        </div>
      )}

      {isTerminal && (
        <Button variant="outline" size="sm" onClick={onReset} className="w-full">
          <Plus className="h-4 w-4 mr-1.5" /> Nuovo sito
        </Button>
      )}
    </div>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({ job }: { job: SitebuilderJob }) {
  const cfg    = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.PENDING;
  const base   = getApiBaseUrl();
  const token  = typeof window !== "undefined" ? window.localStorage.getItem("doflow_token") ?? "" : "";

  const handleDownload = async () => {
    const res = await fetch(`${base}/sitebuilder/jobs/${job.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return alert("ZIP non disponibile");
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${job.siteDomain}-wordpress.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{job.siteDomain}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(job.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <Badge variant="outline" className={cn("text-xs shrink-0", cfg.bg, cfg.color)}>{cfg.label}</Badge>
      {job.status === "DONE" && (
        <button onClick={handleDownload} title="Scarica ZIP">
          <Download className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SitebuilderClient() {
  const { toast } = useToast();
  const [tab, setTab]         = useState<"wizard" | "history">("wizard");
  const [wizardStep, setStep] = useState(0);
  const [submitting, setSub]  = useState(false);
  const [suggestLoading, setSugL] = useState(false);
  const [starterSites, setSites]  = useState<StarterSite[]>([]);
  const [history, setHistory]     = useState<SitebuilderJob[]>([]);
  const [jobId, setJobId]         = useState<string | null>(null);

  const { job } = useSitebuilderJob(jobId);

  const [form, setForm] = useState<WizardForm>({
    tenantId:            "public",
    siteDomain:          "",
    siteTitle:           "",
    adminEmail:          "",
    businessType:        "",
    businessDescription: "",
    starterSite:         "",
    designScheme:        {},
    contentTopics:       [],
    locale:              "it",
  });

  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Carica starter sites e storico al mount
  useEffect(() => {
    const token = window.localStorage.getItem("doflow_token") ?? "";
    const base  = getApiBaseUrl();
    fetch(`${base}/sitebuilder/starter-sites`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then(setSites).catch(console.error);
    fetch(`${base}/sitebuilder/jobs`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then(setHistory).catch(console.error);
  }, []);

  // Refresh history quando job è DONE
  useEffect(() => {
    if (job?.status === "DONE" || job?.status === "FAILED") {
      const token = window.localStorage.getItem("doflow_token") ?? "";
      const base  = getApiBaseUrl();
      fetch(`${base}/sitebuilder/jobs`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then(setHistory).catch(console.error);
    }
  }, [job?.status]);

  // AI: migliora descrizione (pattern Buildly)
  const handleEnhance = useCallback(async () => {
    if (!form.businessDescription.trim() && !form.siteTitle.trim()) return;
    setSugL(true);
    try {
      const res = await fetch("/api/sitebuilder/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteTitle:   form.siteTitle,
          businessType: form.businessType,
          description: form.businessDescription,
          locale:      form.locale,
        }),
      });
      const { enhanced } = await res.json() as { enhanced: string };
      set("businessDescription", enhanced);
      toast({ title: "Descrizione migliorata con AI ✓" });
    } catch {
      toast({ title: "Errore", variant: "destructive" });
    } finally { setSugL(false); }
  }, [form.businessDescription, form.siteTitle, form.businessType, form.locale, toast]);

  // Submit
  const handleSubmit = async () => {
    setSub(true);
    try {
      const res = await apiFetch<{ jobId: string }>("/sitebuilder/jobs", {
        method: "POST",
        body: JSON.stringify(form),
        auth: true,
      });
      setJobId(res.jobId);
      toast({ title: "Build avviata!", description: `Job ID: ${res.jobId.slice(0, 8)}...` });
    } catch (err) {
      toast({ title: "Errore", description: String(err), variant: "destructive" });
    } finally { setSub(false); }
  };

  const canNext = [
    form.siteDomain && form.siteTitle && form.adminEmail,
    form.businessType,
    form.starterSite,
    true, // design è opzionale
    form.contentTopics.length >= 1,
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Sitebuilder AI WordPress
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Genera un sito WordPress completo con AI e scaricalo pronto per SiteGround
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "wizard" | "history")}>
        <TabsList>
          <TabsTrigger value="wizard"><Zap className="h-3.5 w-3.5 mr-1.5" />Nuovo sito</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1.5" />Storico build ({history.length})</TabsTrigger>
        </TabsList>

        {/* ─── WIZARD TAB ─── */}
        <TabsContent value="wizard" className="mt-4 space-y-4">
          {jobId && job ? (
            <Card className="glass-card">
              <CardContent className="pt-6">
                <JobMonitor job={job} onReset={() => { setJobId(null); setStep(0); }} />
              </CardContent>
            </Card>
          ) : (
            <>
              <StepIndicator currentStep={wizardStep} steps={WIZARD_STEPS} />

              {/* ── Step 0: Info sito ── */}
              {wizardStep === 0 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Informazioni sito
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Dominio *</Label>
                        <Input placeholder="shop.acme.it" value={form.siteDomain}
                          onChange={(e) => set("siteDomain", e.target.value.toLowerCase())} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome sito *</Label>
                        <Input placeholder="Acme Shop" value={form.siteTitle}
                          onChange={(e) => set("siteTitle", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Email admin *</Label>
                        <Input type="email" placeholder="admin@acme.it" value={form.adminEmail}
                          onChange={(e) => set("adminEmail", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Lingua</Label>
                        <Select value={form.locale} onValueChange={(v) => set("locale", v)}>
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
              )}

              {/* ── Step 1: Descrizione business ── */}
              {wizardStep === 1 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Tipo di Business
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Settore *</Label>
                      <Select value={form.businessType} onValueChange={(v) => set("businessType", v)}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Descrivi il tuo business</Label>
                        <Button variant="outline" size="sm" className="h-6 text-xs gap-1"
                          onClick={handleEnhance} disabled={suggestLoading || !form.siteTitle}>
                          {suggestLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Migliora con AI
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Es. Siamo un ristorante italiano nel centro di Milano, fondato nel 2010. Offriamo cucina tradizionale lombarda con ingredienti locali. Aperto a pranzo e cena, con menu degustazione e carta dei vini..."
                        value={form.businessDescription}
                        onChange={(e) => set("businessDescription", e.target.value)}
                        rows={5} className="text-sm resize-none" maxLength={3000}
                      />
                      <p className="text-xs text-right text-muted-foreground">
                        {form.businessDescription.length}/3000 caratteri
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Step 2: Tema Blocksy ── */}
              {wizardStep === 2 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Scegli il tema Blocksy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-1">
                      {/* Raggruppa per categoria */}
                      {Array.from(new Set(starterSites.map((s) => s.category))).map((cat) => (
                        <div key={cat}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 mt-2">{cat}</p>
                          {starterSites.filter((s) => s.category === cat).map((site) => (
                            <div key={site.slug}
                              onClick={() => set("starterSite", site.slug)}
                              className={cn(
                                "flex items-center justify-between px-3 py-2 rounded-md border cursor-pointer transition-all mb-1",
                                form.starterSite === site.slug
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border hover:border-primary/50 hover:bg-muted/30",
                              )}>
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                                  form.starterSite === site.slug ? "border-primary" : "border-border",
                                )}>
                                  {form.starterSite === site.slug && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </div>
                                <span className="text-sm font-medium">{site.label}</span>
                              </div>
                              <a href={site.previewUrl} target="_blank" rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                title="Anteprima tema">
                                <Eye className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Step 3: Design Scheme ── */}
              {wizardStep === 3 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Personalizzazione design (opzionale)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["primaryColor",   "Colore primario",   "#3B82F6"],
                        ["secondaryColor", "Colore secondario", "#8B5CF6"],
                        ["accentColor",    "Colore accento",    "#F59E0B"],
                      ].map(([key, label, def]) => (
                        <div key={key} className="space-y-1.5">
                          <Label className="text-xs">{label}</Label>
                          <div className="flex items-center gap-2">
                            <input type="color"
                              value={(form.designScheme as Record<string, string>)[key] ?? def}
                              onChange={(e) => set("designScheme", { ...form.designScheme, [key]: e.target.value })}
                              className="h-8 w-8 rounded cursor-pointer border border-border" />
                            <Input value={(form.designScheme as Record<string, string>)[key] ?? def}
                              onChange={(e) => set("designScheme", { ...form.designScheme, [key]: e.target.value })}
                              className="font-mono text-xs h-8" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Font titoli</Label>
                        <Select value={form.designScheme.headingFont ?? ""}
                          onValueChange={(v) => set("designScheme", { ...form.designScheme, headingFont: v })}>
                          <SelectTrigger className="text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                          <SelectContent>
                            {HEADING_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Font testo</Label>
                        <Select value={form.designScheme.bodyFont ?? ""}
                          onValueChange={(v) => set("designScheme", { ...form.designScheme, bodyFont: v })}>
                          <SelectTrigger className="text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                          <SelectContent>
                            {BODY_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Questi colori vengono applicati al tema Blocksy tramite le Global Styles di WordPress.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* ── Step 4: Contenuti/Topic ── */}
              {wizardStep === 4 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Sezioni/Pagine da generare
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <TopicInput topics={form.contentTopics} onChange={(t) => set("contentTopics", t)} />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {["Home", "Chi Siamo", "Servizi", "Portfolio", "Contatti", "Blog", "FAQ", "Prezzi"].filter((s) => !form.contentTopics.includes(s)).map((s) => (
                        <button key={s} type="button"
                          onClick={() => { if (form.contentTopics.length < 10) set("contentTopics", [...form.contentTopics, s]); }}
                          className="px-2.5 py-1 text-xs border border-dashed border-primary/40 rounded-md text-primary hover:bg-primary/10 transition-colors">
                          + {s}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={() => setStep(Math.max(0, wizardStep - 1))}
                  disabled={wizardStep === 0}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Indietro
                </Button>

                {wizardStep < WIZARD_STEPS.length - 1 ? (
                  <Button onClick={() => setStep(wizardStep + 1)}
                    disabled={!canNext[wizardStep]}>
                    Avanti <ChevronRight className="h-4 w-4 ml-1.5" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit}
                    disabled={!canNext.every(Boolean) || submitting}
                    className="gap-2">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Genera sito <Zap className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ─── HISTORY TAB ─── */}
        <TabsContent value="history" className="mt-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              {history.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nessuna build ancora</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab("wizard")}>
                    Crea il tuo primo sito
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((j) => <HistoryRow key={j.id} job={j} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}