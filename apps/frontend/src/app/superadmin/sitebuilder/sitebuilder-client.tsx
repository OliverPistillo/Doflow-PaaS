"use client";
// apps/frontend/src/app/superadmin/sitebuilder/sitebuilder-client.tsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, Globe, Sparkles, Plus, X, CheckCircle2,
  Zap, Download, ArrowLeft, Eye, ChevronRight,
  Palette, Building2, History, Search, Type,
  FileText, Copy, RefreshCw, Trash2,
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
  isPro: boolean;
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
  /** Blocchi JSON parsati dall'XML — se presenti saltano la generazione LLM */
  xmlBlocks?:          { strategy?: Record<string, string>; pages: unknown[] } | null;
}

interface SeoResult {
  keywords: string[];
  metaTitle: string;
  metaDescription: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  "Ristorante", "eCommerce", "Portfolio", "Agenzia", "Consulenza",
  "Fitness", "Medico / Clinica", "Avvocato / Studio Legale",
  "Immobiliare", "Fotografo", "Blog", "SaaS / Software", "Altro",
];

const HEADING_FONTS = [
  { value: "Inter, sans-serif",    label: "Inter (moderno)" },
  { value: "Playfair Display, serif", label: "Playfair (elegante)" },
  { value: "Poppins, sans-serif",  label: "Poppins (pulito)" },
  { value: "Montserrat, sans-serif", label: "Montserrat (corporate)" },
  { value: "Lora, serif",          label: "Lora (classico)" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: "In coda",       color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  RUNNING:     { label: "In esecuzione", color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  DONE:        { label: "Completato",    color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  FAILED:      { label: "Fallito",       color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  ROLLED_BACK: { label: "Rollback",      color: "text-red-500",    bg: "bg-red-50 border-red-200" },
};

const WIZARD_STEPS = [
  { id: "info",      label: "Sito",      icon: Globe },
  { id: "desc",      label: "Business",  icon: Building2 },
  { id: "theme",     label: "Tema",      icon: Eye },
  { id: "design",    label: "Design",    icon: Palette },
  { id: "documento", label: "Documento", icon: FileText },
];

// ─── Site Preview Component ───────────────────────────────────────────────────

function SitePreview({ form }: { form: WizardForm }) {
  const primary   = form.designScheme.primaryColor   ?? "#3B82F6";
  const secondary = form.designScheme.secondaryColor ?? "#8B5CF6";
  const accent    = form.designScheme.accentColor    ?? "#F59E0B";
  const font      = form.designScheme.headingFont    ?? "Inter, sans-serif";

  const sectionColors: Record<string, string> = {
    home: primary, hero: primary, "chi siamo": secondary, about: secondary,
    servizi: "#10B981", services: "#10B981", portfolio: "#8B5CF6",
    contatti: "#6B7280", contact: "#6B7280", blog: "#F59E0B",
    faq: "#EC4899", prezzi: "#14B8A6", pricing: "#14B8A6",
  };

  const getColor = (topic: string) =>
    sectionColors[topic.toLowerCase()] ?? primary;

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border overflow-hidden">
      {/* Browser bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b shrink-0">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-2 bg-white rounded text-[10px] text-gray-500 px-2 py-0.5 border text-center truncate">
          {form.siteDomain || "tuosito.it"}
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto" style={{ fontFamily: font }}>
        {/* Navbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-white sticky top-0 z-10 shadow-sm">
          <span className="font-bold text-xs" style={{ color: primary }}>
            {form.siteTitle || "Nome Sito"}
          </span>
          <div className="flex gap-3">
            {((form.contentTopics ?? []).slice(0, 4)).map((t) => (
              <span key={t} className="text-[9px] text-gray-500">{t}</span>
            ))}
          </div>
          <div className="text-[9px] px-2 py-1 rounded text-white" style={{ backgroundColor: primary }}>
            Contattaci
          </div>
        </div>

        {/* Hero section */}
        <div className="relative px-6 py-10 text-center overflow-hidden" style={{ backgroundColor: `${primary}12` }}>
          <div className="absolute inset-0 opacity-5" style={{
            background: `radial-gradient(circle at 30% 50%, ${primary}, transparent 60%), radial-gradient(circle at 70% 50%, ${secondary}, transparent 60%)`,
          }} />
          <div className="relative">
            <div className="inline-block text-[9px] px-2 py-0.5 rounded-full mb-2 font-medium" style={{ backgroundColor: `${accent}20`, color: accent }}>
              {form.businessType || "Business"}
            </div>
            <h1 className="font-bold text-sm mb-2 leading-tight" style={{ color: "#111" }}>
              {form.siteTitle || "Il Tuo Sito Web"}
            </h1>
            <p className="text-[9px] text-gray-500 mb-3 max-w-xs mx-auto leading-relaxed line-clamp-2">
              {form.businessDescription || "Descrizione del tuo business e dei servizi che offri ai tuoi clienti."}
            </p>
            <div className="flex gap-2 justify-center">
              <button className="text-[9px] px-3 py-1.5 rounded text-white font-medium" style={{ backgroundColor: primary }}>
                Scopri di più
              </button>
              <button className="text-[9px] px-3 py-1.5 rounded border font-medium" style={{ borderColor: primary, color: primary }}>
                Contattaci
              </button>
            </div>
          </div>
        </div>

        {/* Sections */}
        {(form.contentTopics ?? []).map((topic, i) => (
          <div key={topic} className={cn("px-5 py-5 border-b", i % 2 === 0 ? "bg-white" : "bg-gray-50")}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-1 rounded-full" style={{ backgroundColor: getColor(topic) }} />
              <span className="font-semibold text-[10px]" style={{ color: getColor(topic) }}>{topic}</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-1.5 bg-gray-200 rounded-full w-3/4" />
              <div className="h-1.5 bg-gray-200 rounded-full w-full" />
              <div className="h-1.5 bg-gray-200 rounded-full w-2/3" />
            </div>
            {i % 3 === 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded p-2" style={{ backgroundColor: `${getColor(topic)}10` }}>
                    <div className="h-1.5 bg-gray-200 rounded mb-1 w-2/3" />
                    <div className="h-1 bg-gray-100 rounded w-full" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Footer */}
        <div className="px-5 py-4 text-center" style={{ backgroundColor: "#111" }}>
          <span className="text-[9px] text-gray-400">© 2025 {form.siteTitle || "Sito"} · Tutti i diritti riservati</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tools Panel ─────────────────────────────────────────────────────────────

function ToolsPanel({
  form, job, onFormChange,
}: {
  form: WizardForm;
  job: SitebuilderJob | null;
  onFormChange: (updates: Partial<WizardForm>) => void;
}) {
  const { toast } = useToast();
  const logRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab]   = useState<"colors" | "seo">("colors");
  const [seoLoading, setSeoLoading] = useState(false);
  const [seo, setSeo]               = useState<SeoResult | null>(null);
  const [copied, setCopied]         = useState<string | null>(null);
  const base  = getApiBaseUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("doflow_token") ?? "" : "";

  const cfg      = STATUS_CONFIG[job?.status ?? "PENDING"] ?? STATUS_CONFIG.PENDING;
  const progress = !job ? 0 : job.status === "DONE" ? 100 : job.status === "PENDING" ? 5 :
    Math.min(92, Math.round((job.logs.length / 14) * 92));
  const isDone   = job?.status === "DONE";

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.logs]);

  const handleSeo = async () => {
    setSeoLoading(true);
    try {
      const res = await fetch(`${base}/sitebuilder/seo-keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          siteTitle: form.siteTitle, businessType: form.businessType,
          description: form.businessDescription, locale: form.locale,
        }),
      });
      const data = await res.json() as SeoResult;
      setSeo(data);
    } catch { toast({ title: "Errore SEO", variant: "destructive" }); }
    finally { setSeoLoading(false); }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const setColor = (key: keyof DesignScheme, val: string) =>
    onFormChange({ designScheme: { ...form.designScheme, [key]: val } });

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* Status + progress */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{form.siteDomain || "Generazione sito"}</span>
          <Badge variant="outline" className={cn("text-xs gap-1", cfg.bg, cfg.color)}>
            {job?.status === "RUNNING" && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
            {isDone && <CheckCircle2 className="h-3 w-3" />}
            {cfg.label}
          </Badge>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Log box */}
      <div className="shrink-0 rounded-lg border overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 border-b">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-[10px] text-muted-foreground ml-1 font-mono">build.log</span>
        </div>
        <div ref={logRef} className="bg-card p-2.5 h-28 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5">
          {!job?.logs?.length
            ? <span className="text-muted-foreground">Avvio in corso...</span>
            : job.logs.map((line: string, i: number) => (
              <div key={i} className={cn(
                line.includes("✓") || line.includes("completat") ? "text-green-600" :
                line.includes("ERRORE") || line.includes("fallito") ? "text-red-500" :
                "text-muted-foreground",
              )}>{line}</div>
            ))}
          {job?.status === "RUNNING" && <span className="inline-block w-1.5 h-3 bg-muted-foreground animate-pulse" />}
        </div>
      </div>

      {/* Tools tabs */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex gap-1 mb-2 shrink-0">
          {([["colors", Palette, "Colori & Font"], ["seo", Search, "SEO"]] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all flex-1 justify-center",
                activeTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}>
              <Icon className="h-3 w-3" />{label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
          {/* ── Colori & Font ── */}
          {activeTab === "colors" && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Palette colori</p>
                {([
                  ["primaryColor",   "Primario",   "#3B82F6"],
                  ["secondaryColor", "Secondario", "#8B5CF6"],
                  ["accentColor",    "Accento",    "#F59E0B"],
                ] as [keyof DesignScheme, string, string][]).map(([key, label, def]) => (
                  <div key={key} className="flex items-center gap-2">
                    <input type="color"
                      value={(form.designScheme as Record<string, string>)[key] ?? def}
                      onChange={(e) => setColor(key, e.target.value)}
                      className="h-7 w-7 rounded cursor-pointer border border-border" />
                    <span className="text-xs text-muted-foreground w-20">{label}</span>
                    <Input
                      value={(form.designScheme as Record<string, string>)[key] ?? def}
                      onChange={(e) => setColor(key, e.target.value)}
                      className="font-mono text-xs h-7 flex-1" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font</p>
                <Select value={form.designScheme.headingFont ?? ""}
                  onValueChange={(v) => onFormChange({ designScheme: { ...form.designScheme, headingFont: v } })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Scegli font titoli..." /></SelectTrigger>
                  <SelectContent>
                    {HEADING_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Color preview */}
              <div className="rounded-lg p-3 border" style={{ fontFamily: form.designScheme.headingFont ?? "Inter, sans-serif" }}>
                <div className="h-5 rounded-full mb-2" style={{ backgroundColor: form.designScheme.primaryColor ?? "#3B82F6" }} />
                <div className="flex gap-1.5 mb-2">
                  <div className="h-3 rounded flex-1" style={{ backgroundColor: form.designScheme.secondaryColor ?? "#8B5CF6" }} />
                  <div className="h-3 rounded flex-1" style={{ backgroundColor: form.designScheme.accentColor ?? "#F59E0B" }} />
                </div>
                <p className="text-xs font-bold" style={{ color: form.designScheme.primaryColor ?? "#3B82F6" }}>Titolo Esempio</p>
                <p className="text-[10px] text-muted-foreground">Testo del corpo del sito</p>
              </div>
            </>
          )}

          {/* ── SEO ── */}
          {activeTab === "seo" && (
            <>
              <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleSeo} disabled={seoLoading}>
                {seoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                Analizza SEO con AI
              </Button>
              {seo && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Meta Title</p>
                      <button onClick={() => copyText(seo.metaTitle, "title")} className="text-[10px] text-muted-foreground hover:text-foreground">
                        {copied === "title" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="rounded border p-2 text-xs bg-muted/30">{seo.metaTitle}</div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{seo.metaTitle.length} caratteri</span>
                      <span className={seo.metaTitle.length <= 60 ? "text-green-600" : "text-red-500"}>
                        {seo.metaTitle.length <= 60 ? "✓ Ottimale" : "Troppo lungo"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Meta Description</p>
                      <button onClick={() => copyText(seo.metaDescription, "desc")} className="text-[10px] text-muted-foreground hover:text-foreground">
                        {copied === "desc" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <div className="rounded border p-2 text-xs bg-muted/30 leading-relaxed">{seo.metaDescription}</div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{seo.metaDescription.length} caratteri</span>
                      <span className={seo.metaDescription.length <= 160 ? "text-green-600" : "text-red-500"}>
                        {seo.metaDescription.length <= 160 ? "✓ Ottimale" : "Troppo lunga"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Keywords ({seo.keywords.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {seo.keywords.map((kw) => (
                        <span key={kw} className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded cursor-pointer"
                          onClick={() => copyText(kw, kw)} title="Copia keyword">
                          {copied === kw ? "✓" : kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {!seo && !seoLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Clicca per generare meta title, description e keyword SEO ottimizzati per il tuo sito.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Download button */}
      {isDone && (
        <button onClick={async () => {
          const res = await fetch(`${base}/sitebuilder/jobs/${job!.id}/download`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `${form.siteDomain}-wordpress.zip`;
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);
        }}
          className="shrink-0 w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Download className="h-4 w-4" /> Scarica WordPress ZIP
        </button>
      )}
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {WIZARD_STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <React.Fragment key={step.id}>
            {i > 0 && <div className={cn("flex-1 h-px", done ? "bg-primary" : "bg-border")} />}
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all",
              done && "bg-primary text-primary-foreground border-primary",
              active && "bg-primary/10 text-primary border-primary",
              !done && !active && "text-muted-foreground border-border",
            )}>
              {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Topic Chips ──────────────────────────────────────────────────────────────

function TopicInput({ topics, onChange }: { topics: string[]; onChange: (t: string[]) => void }) {
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
            <button onClick={() => onChange(topics.filter((x) => x !== t))}><X className="h-3 w-3 opacity-60" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { e.preventDefault(); add(input); } }}
          placeholder="Es. Home, Chi siamo, Servizi..." className="text-sm"
          disabled={topics.length >= 10} />
        <Button type="button" variant="outline" size="sm" onClick={() => add(input)} disabled={!input.trim() || topics.length >= 10}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{topics.length}/10 sezioni</p>
    </div>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────

// ─── XML Upload Step ─────────────────────────────────────────────────────────

interface ParsedXmlBlocks {
  strategy?: Record<string, string>;
  pages: Array<{ slug: string; title: string; bricks: unknown[] }>;
}

function XmlUploadStep({
  form, onXmlParsed, onTopicsChange, apiBase, token,
}: {
  form: WizardForm;
  onXmlParsed: (blocks: ParsedXmlBlocks, topics: string[]) => void;
  onTopicsChange: (topics: string[]) => void;
  apiBase: string;
  token: string;
}) {
  const { toast } = useToast();
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<"xml" | "manual">(form.xmlBlocks ? "xml" : "manual");
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = form.xmlBlocks as ParsedXmlBlocks | null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xml")) {
      toast({ title: "Formato non supportato", description: "Carica un file .xml", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    setParsing(true);
    try {
      const xmlContent = await file.text();
      const res = await fetch(`${apiBase}/sitebuilder/parse-xml`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ xmlContent }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ParsedXmlBlocks;
      const topics = data.pages.map((p) => p.title);
      onXmlParsed(data, topics);
      toast({ title: `XML parsato ✓ — ${data.pages.length} pagine rilevate` });
    } catch (err) {
      toast({ title: "Errore parsing XML", description: String(err), variant: "destructive" });
      setFileName(null);
    } finally { setParsing(false); }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Documento Contenuti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          <button onClick={() => setMode("xml")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
              mode === "xml" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
            <FileText className="h-4 w-4" /> Carica XML master doc
          </button>
          <button onClick={() => setMode("manual")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
              mode === "manual" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
            <Zap className="h-4 w-4" /> Sezioni manuali + AI
          </button>
        </div>

        {/* XML Upload mode */}
        {mode === "xml" && (
          <div className="space-y-3">
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                parsing ? "border-primary/50 bg-primary/5" :
                parsed ? "border-green-500 bg-green-50" :
                "border-border hover:border-primary/50 hover:bg-muted/30",
              )}>
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleFile} />
              {parsing ? (
                <>
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium">Claude sta analizzando l'XML...</p>
                  <p className="text-xs text-muted-foreground">Estrazione blocchi in corso</p>
                </>
              ) : parsed ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <p className="text-sm font-medium text-green-700">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{parsed.pages.length} pagine · {parsed.pages.reduce((acc, p) => acc + (p.bricks?.length ?? 0), 0)} blocchi estratti</p>
                  <button onClick={(e) => { e.stopPropagation(); onXmlParsed({ pages: [] } as any, []); setFileName(null); }}
                    className="text-[10px] text-red-500 hover:underline mt-1">Rimuovi</button>
                </>
              ) : (
                <>
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Trascina qui il tuo <code className="bg-muted px-1 rounded">sitebuilder_master_doc.xml</code></p>
                  <p className="text-xs text-muted-foreground">oppure clicca per sfogliare</p>
                </>
              )}
            </div>

            {/* Parsed pages preview */}
            {parsed && parsed.pages.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pagine rilevate</p>
                {parsed.pages.map((page) => (
                  <div key={page.slug} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                    <span className="text-sm font-medium">{page.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{page.bricks?.length ?? 0} blocchi</span>
                      <div className="flex gap-0.5">
                        {(page.bricks as Array<{ type: string }>)?.slice(0, 4).map((b, i) => (
                          <span key={i} className="text-[9px] px-1 py-0.5 bg-primary/10 text-primary rounded">{b.type}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {parsed.strategy && (
                  <div className="pt-1">
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-semibold">Tono:</span> {parsed.strategy.toneOfVoice}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!parsed && (
              <p className="text-xs text-muted-foreground text-center">
                Il file XML viene analizzato da Claude che estrae titoli, testi, CTA e struttura delle pagine
                senza riscrivere nulla — i testi SEO/CRO vengono preservati integralmente.
              </p>
            )}
          </div>
        )}

        {/* Manual mode */}
        {mode === "manual" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Claude genererà i contenuti autonomamente in base al titolo sito e alla descrizione business.
            </p>
            <TopicInput topics={form.contentTopics ?? []} onChange={onTopicsChange} />
            <div className="flex flex-wrap gap-1.5">
              {["Home","Chi Siamo","Servizi","Portfolio","Contatti","Blog","FAQ","Prezzi"]
                .filter((s) => !(form.contentTopics ?? []).includes(s))
                .map((s) => (
                  <button key={s} onClick={() => {
                    if ((form.contentTopics ?? []).length < 10) onTopicsChange([...(form.contentTopics ?? []), s]);
                  }} className="px-2.5 py-1 text-xs border border-dashed border-primary/40 rounded-md text-primary hover:bg-primary/10 transition-colors">
                    + {s}
                  </button>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── History Row ─────────────────────────────────────────────────────────────

function HistoryRow({ job, onDelete }: { job: SitebuilderJob; onDelete: (id: string) => void }) {
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.PENDING;
  const base = getApiBaseUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("doflow_token") ?? "" : "";
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async () => {
    const res = await fetch(`${base}/sitebuilder/jobs/${job.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return alert("ZIP non disponibile");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${job.siteDomain}-wordpress.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!confirm(`Eliminare il job per ${job.siteDomain}?`)) return;
    setDeleting(true);
    try {
      await fetch(`${base}/sitebuilder/jobs/${job.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      onDelete(job.id);
    } catch { alert("Errore durante l'eliminazione"); }
    finally { setDeleting(false); }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{job.siteDomain}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(job.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <Badge variant="outline" className={cn("text-xs shrink-0", cfg.bg, cfg.color)}>{cfg.label}</Badge>
      <div className="flex items-center gap-1">
        {job.status === "DONE" && (
          <button onClick={handleDownload} title="Scarica ZIP"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={handleDelete} disabled={deleting} title="Elimina"
          className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SitebuilderClient() {
  const { toast } = useToast();
  const [tab, setTab]         = useState<"wizard" | "history">("wizard");
  const [wizardStep, setStep] = useState(0);
  const [submitting, setSub]  = useState(false);
  const [starterSites, setSites] = useState<StarterSite[]>([]);
  const [history, setHistory]    = useState<SitebuilderJob[]>([]);
  const [jobId, setJobId]        = useState<string | null>(null);

  const { job } = useSitebuilderJob(jobId);

  const [form, setForm] = useState<WizardForm>({
    tenantId: "public", siteDomain: "", siteTitle: "", adminEmail: "",
    businessType: "", businessDescription: "", starterSite: "",
    designScheme: { primaryColor: "#3B82F6", secondaryColor: "#8B5CF6", accentColor: "#F59E0B" },
    contentTopics: [], locale: "it", xmlBlocks: null,
  });

  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const base  = getApiBaseUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("doflow_token") ?? "" : "";

  useEffect(() => {
    fetch(`${base}/sitebuilder/starter-sites`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setSites(Array.isArray(d) ? d : [])).catch(console.error);
    fetch(`${base}/sitebuilder/jobs`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setHistory(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (job?.status === "DONE" || job?.status === "FAILED") {
      fetch(`${base}/sitebuilder/jobs`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((d) => setHistory(Array.isArray(d) ? d : [])).catch(console.error);
    }
  }, [job?.status]);

  const handleSubmit = async () => {
    setSub(true);
    try {
      const res = await apiFetch<{ jobId: string }>("/sitebuilder/jobs", {
        method: "POST", body: JSON.stringify(form), auth: true,
      });
      setJobId(res.jobId);
      toast({ title: "Build avviata!", description: `Job ID: ${res.jobId.slice(0, 8)}...` });
    } catch (err) {
      toast({ title: "Errore", description: String(err), variant: "destructive" });
    } finally { setSub(false); }
  };

  const canNext = [
    !!(form.siteDomain && form.siteTitle && form.adminEmail),
    !!form.businessType,
    !!form.starterSite,
    true,
    // Ultimo step: valido se ha caricato XML OPPURE ha almeno 1 topic manuale
    !!(form.xmlBlocks?.pages?.length || (form.contentTopics ?? []).length >= 1),
  ];

  const showSplitPanel = !!jobId && !!job;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" /> Sitebuilder AI WordPress
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Genera un sito WordPress completo con AI — pronto per SiteGround
          </p>
        </div>
        {showSplitPanel && (
          <Button variant="outline" size="sm" onClick={() => { setJobId(null); setStep(0); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Nuovo sito
          </Button>
        )}
      </div>

      {/* ─── SPLIT PANEL (job in corso o completato) ─── */}
      {showSplitPanel ? (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-160px)] min-h-[600px]">
          {/* Left: tools */}
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-4 h-full">
              <ToolsPanel
                form={form}
                job={job}
                onFormChange={(updates) => setForm((p) => ({ ...p, ...updates,
                  contentTopics: updates.contentTopics ?? p.contentTopics ?? [],
                  designScheme: updates.designScheme ? { ...p.designScheme, ...updates.designScheme } : p.designScheme,
                }))}
              />
            </CardContent>
          </Card>

          {/* Right: preview */}
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2 px-4 pt-4 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Anteprima sito
                </CardTitle>
                <span className="text-[10px] text-muted-foreground italic">
                  Preview simulata — aggiornata in tempo reale
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-3 h-[calc(100%-52px)]">
              <SitePreview form={form} />
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ─── TABS (wizard + history) ─── */
        <Tabs value={tab} onValueChange={(v) => setTab(v as "wizard" | "history")}>
          <TabsList>
            <TabsTrigger value="wizard"><Zap className="h-3.5 w-3.5 mr-1.5" />Nuovo sito</TabsTrigger>
            <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1.5" />Storico ({history.length})</TabsTrigger>
          </TabsList>

          {/* Wizard */}
          <TabsContent value="wizard" className="mt-4 space-y-4 max-w-2xl">
            <StepIndicator currentStep={wizardStep} />

            {/* Step 0: Info sito */}
            {wizardStep === 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informazioni sito</CardTitle></CardHeader>
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
                          {[["it","Italiano"],["en","English"],["fr","Français"],["de","Deutsch"],["es","Español"]].map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Business */}
            {wizardStep === 1 && (
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo di Business</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Settore *</Label>
                    <Select value={form.businessType} onValueChange={(v) => set("businessType", v)}>
                      <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descrivi il tuo business</Label>
                    <Textarea
                      placeholder="Es. Siamo un ristorante nel centro di Milano, aperto dal 2010. Offriamo cucina tradizionale con ingredienti locali..."
                      value={form.businessDescription}
                      onChange={(e) => set("businessDescription", e.target.value)}
                      rows={5} className="text-sm resize-none" maxLength={3000}
                    />
                    <p className="text-xs text-right text-muted-foreground">{form.businessDescription.length}/3000</p>
                    <p className="text-xs text-muted-foreground">💡 Potrai migliorare la descrizione con AI nel pannello di generazione.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Tema */}
            {wizardStep === 2 && (
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scegli il tema Blocksy</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-y-auto pr-1 space-y-0.5">
                    {Array.from(new Set(starterSites.map((s) => s.category))).map((cat) => (
                      <div key={cat}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1.5 sticky top-0 bg-card">{cat}</p>
                        {starterSites.filter((s) => s.category === cat).map((site) => (
                          <div key={site.slug} onClick={() => set("starterSite", site.slug)}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-md border cursor-pointer transition-all mb-0.5",
                              form.starterSite === site.slug ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30",
                            )}>
                            <div className="flex items-center gap-2">
                              <div className={cn("h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                                form.starterSite === site.slug ? "border-primary" : "border-border")}>
                                {form.starterSite === site.slug && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                              </div>
                              <span className={cn("text-sm", form.starterSite === site.slug ? "text-primary font-medium" : "")}>{site.label}</span>
                              <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold",
                                site.isPro ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700")}>
                                {site.isPro ? "PRO" : "FREE"}
                              </span>
                            </div>
                            <a href={site.previewUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Anteprima">
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

            {/* Step 3: Design */}
            {wizardStep === 3 && (
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personalizzazione design</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {([["primaryColor","Primario","#3B82F6"],["secondaryColor","Secondario","#8B5CF6"],["accentColor","Accento","#F59E0B"]] as [keyof DesignScheme, string, string][]).map(([key, label, def]) => (
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
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font titoli</Label>
                    <Select value={form.designScheme.headingFont ?? ""}
                      onValueChange={(v) => set("designScheme", { ...form.designScheme, headingFont: v })}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>{HEADING_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">Potrai modificare colori e font in tempo reale dal pannello di generazione.</p>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Documento XML */}
            {wizardStep === 4 && (
              <XmlUploadStep
                form={form}
                onXmlParsed={(xmlBlocks, topics) => {
                  set("xmlBlocks", xmlBlocks);
                  if (topics.length > 0) set("contentTopics", topics);
                }}
                onTopicsChange={(t) => set("contentTopics", t)}
                apiBase={base}
                token={token}
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-1">
              <Button variant="outline" onClick={() => setStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Indietro
              </Button>
              {wizardStep < WIZARD_STEPS.length - 1 ? (
                <Button onClick={() => setStep(wizardStep + 1)} disabled={!canNext[wizardStep]}>
                  Avanti <ChevronRight className="h-4 w-4 ml-1.5" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canNext.every(Boolean) || submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Genera sito <Zap className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TabsContent>

          {/* History */}
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
                    {history.map((j) => (
                      <HistoryRow key={j.id} job={j}
                        onDelete={(id) => setHistory((h) => h.filter((x) => x.id !== id))} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}