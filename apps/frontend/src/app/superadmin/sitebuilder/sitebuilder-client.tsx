"use client";
// apps/frontend/src/app/superadmin/sitebuilder/sitebuilder-client.tsx
// v3: split panel (tools left + preview right) + AI enhance via backend + SEO keywords

import React, { useEffect, useRef, useState } from "react";
import {
  Loader2, Globe, Sparkles, Plus, X, CheckCircle2, Zap, Download,
  ArrowLeft, Eye, ChevronRight, Palette, Building2, History,
  Search, FileText, Monitor, Smartphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSitebuilderJob, type SitebuilderJob } from "@/hooks/useSitebuilderJob";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface StarterSite { slug: string; label: string; previewUrl: string; category: string; isPro: boolean; }
interface DesignScheme { primaryColor?: string; secondaryColor?: string; accentColor?: string; headingFont?: string; bodyFont?: string; }
interface WizardForm {
  tenantId: string; siteDomain: string; siteTitle: string; adminEmail: string;
  businessType: string; businessDescription: string; starterSite: string;
  designScheme: DesignScheme; contentTopics: string[]; locale: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BUSINESS_TYPES = ["Ristorante","eCommerce","Portfolio","Agenzia","Consulenza","Fitness","Medico / Clinica","Avvocato","Immobiliare","Fotografo","Blog","SaaS","Altro"];
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label:"In coda",       color:"text-amber-600", bg:"bg-amber-50 border-amber-200" },
  RUNNING:     { label:"In generazione",color:"text-blue-600",  bg:"bg-blue-50 border-blue-200" },
  DONE:        { label:"Completato",    color:"text-green-700", bg:"bg-green-50 border-green-200" },
  FAILED:      { label:"Fallito",       color:"text-red-600",   bg:"bg-red-50 border-red-200" },
  ROLLED_BACK: { label:"Rollback",      color:"text-red-500",   bg:"bg-red-50 border-red-200" },
};
const WIZARD_STEPS = [
  { id:"info",   label:"Sito",      icon:Globe },
  { id:"desc",   label:"Business",  icon:Building2 },
  { id:"theme",  label:"Tema",      icon:Eye },
  { id:"design", label:"Design",    icon:Palette },
  { id:"topics", label:"Contenuti", icon:Zap },
];

// ── Preview HTML generator ────────────────────────────────────────────────────
function generatePreviewHTML(form: WizardForm): string {
  const p = form.designScheme.primaryColor ?? "#3B82F6";
  const s = form.designScheme.secondaryColor ?? "#8B5CF6";
  const a = form.designScheme.accentColor ?? "#F59E0B";
  const hf = form.designScheme.headingFont ?? "sans-serif";
  const bf = form.designScheme.bodyFont ?? "sans-serif";
  const topics = form.contentTopics.length ? form.contentTopics : ["Home","Chi Siamo","Servizi","Contatti"];
  const cols = [p, s, a];

  const sections = topics.map((t, i) => i === 0 ? `
<section style="background:linear-gradient(135deg,${p}22,${s}11);padding:60px 40px;text-align:center;border-bottom:2px solid ${p}22">
  <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${p};margin-bottom:12px;font-family:${hf}">${form.businessType||"Business"}</div>
  <h1 style="font-size:32px;font-weight:800;margin:0 0 16px;font-family:${hf};color:#111;line-height:1.2">${form.siteTitle||"Nome Sito"}</h1>
  <p style="font-size:15px;color:#555;max-width:500px;margin:0 auto 28px;line-height:1.7;font-family:${bf}">
    ${form.businessDescription ? form.businessDescription.substring(0,130)+(form.businessDescription.length>130?"...":"") : "Inserisci la descrizione del tuo business nel wizard."}
  </p>
  <a href="#" style="display:inline-block;background:${p};color:white;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;font-family:${bf}">Scopri di più</a>
</section>` : `
<section style="padding:40px;border-bottom:1px solid #f0f0f0">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <div style="width:4px;height:24px;background:${cols[i%3]};border-radius:2px"></div>
    <h2 style="font-size:20px;font-weight:700;margin:0;font-family:${hf};color:#111">${t}</h2>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
    ${[1,2,3].map(()=>`
    <div style="background:${cols[i%3]}11;border:1px solid ${cols[i%3]}33;border-radius:10px;padding:16px">
      <div style="width:28px;height:28px;background:${cols[i%3]}44;border-radius:7px;margin-bottom:10px"></div>
      <div style="height:10px;background:${cols[i%3]}55;border-radius:4px;margin-bottom:6px;width:65%"></div>
      <div style="height:8px;background:#eee;border-radius:4px;margin-bottom:4px"></div>
      <div style="height:8px;background:#eee;border-radius:4px;width:80%"></div>
    </div>`).join("")}
  </div>
</section>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:${bf},system-ui,sans-serif;background:#fff}</style></head><body>
<nav style="display:flex;align-items:center;justify-content:space-between;padding:14px 40px;border-bottom:1px solid #eee;position:sticky;top:0;background:white;z-index:10">
  <div style="font-weight:800;font-size:18px;color:${p};font-family:${hf}">${form.siteTitle||"Nome Sito"}</div>
  <div style="display:flex;gap:20px">${topics.slice(0,4).map(t=>`<a href="#" style="font-size:13px;color:#444;text-decoration:none;font-family:${bf}">${t}</a>`).join("")}</div>
  <a href="#" style="background:${p};color:white;padding:8px 18px;border-radius:6px;font-size:13px;text-decoration:none;font-weight:600;font-family:${bf}">Contattaci</a>
</nav>
${sections}
<footer style="background:#111;color:#aaa;text-align:center;padding:24px;font-size:12px;font-family:${bf}">© ${new Date().getFullYear()} ${form.siteTitle||"Nome Sito"} — Tutti i diritti riservati</footer>
</body></html>`;
}

// ── Step Indicator ────────────────────────────────────────────────────────────
function StepIndicator({ currentStep, steps }: { currentStep: number; steps: typeof WIZARD_STEPS }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((step, i) => {
        const done = i < currentStep; const active = i === currentStep; const Icon = step.icon;
        return (
          <React.Fragment key={step.id}>
            {i > 0 && <div className={cn("flex-1 h-px", done ? "bg-primary" : "bg-border")} />}
            <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all",
              done && "bg-primary text-primary-foreground border-primary",
              active && "bg-primary/10 text-primary border-primary",
              !done && !active && "text-muted-foreground border-border")}>
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Topic chips ───────────────────────────────────────────────────────────────
function TopicInput({ topics, onChange }: { topics: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = (v: string) => { const c = v.trim(); if (c && topics.length < 10 && !topics.includes(c)) onChange([...topics, c]); setInput(""); };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[36px]">
        {topics.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-md font-medium">
            {t}<button type="button" onClick={() => onChange(topics.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { e.preventDefault(); add(input); }}}
          placeholder="Es. Home, Servizi, Contatti..." className="text-sm" disabled={topics.length >= 10} />
        <Button type="button" variant="outline" size="sm" onClick={() => add(input)} disabled={!input.trim() || topics.length >= 10}><Plus className="h-4 w-4" /></Button>
      </div>
      <p className="text-xs text-muted-foreground">{topics.length}/10 sezioni</p>
    </div>
  );
}

// ── Site Preview Panel ────────────────────────────────────────────────────────
function SitePreviewPanel({ form, isRunning }: { form: WizardForm; isRunning: boolean }) {
  const [viewport, setViewport] = useState<"desktop"|"mobile">("desktop");
  const html = generatePreviewHTML(form);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anteprima live</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setViewport("desktop")} className={cn("p-1.5 rounded", viewport==="desktop" ? "bg-primary/10 text-primary" : "text-muted-foreground")}><Monitor className="h-3.5 w-3.5" /></button>
          <button onClick={() => setViewport("mobile")} className={cn("p-1.5 rounded", viewport==="mobile" ? "bg-primary/10 text-primary" : "text-muted-foreground")}><Smartphone className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 bg-zinc-100 overflow-auto flex items-start justify-center p-4 relative">
        {isRunning && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">AI al lavoro...</p>
              <p className="text-xs text-muted-foreground">L'anteprima si aggiornerà al completamento</p>
            </div>
          </div>
        )}
        <div className={cn("bg-white shadow-xl rounded-lg overflow-hidden transition-all duration-300", viewport==="desktop" ? "w-full max-w-2xl" : "w-[375px]")}>
          <iframe srcDoc={html} title="Preview" className="w-full border-0" style={{ height: viewport==="desktop" ? "600px" : "700px" }} sandbox="allow-same-origin" />
        </div>
      </div>
    </div>
  );
}

// ── Site Tools Panel ──────────────────────────────────────────────────────────
function SiteToolsPanel({ form, onFormChange, job }: { form: WizardForm; onFormChange: (p: Partial<WizardForm>) => void; job: SitebuilderJob | null }) {
  const { toast } = useToast();
  const base = getApiBaseUrl();
  const token = typeof window !== "undefined" ? window.localStorage.getItem("doflow_token") ?? "" : "";
  const logRef = useRef<HTMLDivElement>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [enhLoading, setEnhLoading] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [metaDesc, setMetaDesc] = useState("");

  const cfg = job ? (STATUS_CONFIG[job.status] ?? STATUS_CONFIG.PENDING) : null;
  const progress = !job ? 0 : job.status==="DONE" ? 100 : job.status==="PENDING" ? 5 : Math.min(90, Math.round((job.logs.length/15)*90));

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [job?.logs]);

  const handleEnhance = async () => {
    setEnhLoading(true);
    try {
      const res = await fetch(`${base}/sitebuilder/enhance-description`, {
        method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
        body: JSON.stringify({ siteTitle:form.siteTitle, businessType:form.businessType, description:form.businessDescription, locale:form.locale }),
      });
      const { enhanced } = await res.json() as { enhanced: string };
      if (enhanced) { onFormChange({ businessDescription: enhanced }); toast({ title:"Descrizione migliorata ✓" }); }
    } catch { toast({ title:"Errore", variant:"destructive" }); }
    finally { setEnhLoading(false); }
  };

  const handleSeo = async () => {
    setSeoLoading(true);
    try {
      const res = await fetch(`${base}/sitebuilder/seo-keywords`, {
        method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
        body: JSON.stringify({ siteTitle:form.siteTitle, businessType:form.businessType, description:form.businessDescription, locale:form.locale }),
      });
      const data = await res.json() as { keywords: string[]; metaDescription: string };
      setKeywords(data.keywords ?? []); setMetaDesc(data.metaDescription ?? "");
      toast({ title:`${data.keywords?.length ?? 0} keyword generate ✓` });
    } catch { toast({ title:"Errore SEO", variant:"destructive" }); }
    finally { setSeoLoading(false); }
  };

  const handleDownload = async () => {
    if (!job) return;
    const res = await fetch(`${base}/sitebuilder/jobs/${job.id}/download`, { headers:{Authorization:`Bearer ${token}`} });
    if (!res.ok) return alert("ZIP non disponibile");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${job.siteDomain}-wordpress.zip`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      {job && cfg && (
        <div className={cn("px-4 py-2 border-b text-xs flex items-center gap-2 shrink-0", cfg.bg)}>
          {job.status==="RUNNING" && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
          {job.status==="DONE" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
          <span className={cn("font-semibold", cfg.color)}>{cfg.label}</span>
          <Progress value={progress} className="flex-1 h-1" />
          <span className="text-muted-foreground shrink-0">{progress}%</span>
        </div>
      )}

      <Tabs defaultValue="design" className="flex flex-col flex-1 overflow-hidden min-h-0">
        <TabsList className="mx-3 mt-3 grid grid-cols-3 h-8 shrink-0">
          <TabsTrigger value="design" className="text-xs"><Palette className="h-3 w-3 mr-1" />Design</TabsTrigger>
          <TabsTrigger value="content" className="text-xs"><FileText className="h-3 w-3 mr-1" />Testi</TabsTrigger>
          <TabsTrigger value="seo" className="text-xs"><Search className="h-3 w-3 mr-1" />SEO</TabsTrigger>
        </TabsList>

        {/* Design tab */}
        <TabsContent value="design" className="flex-1 overflow-y-auto px-4 pb-3 space-y-4 mt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Palette colori</p>
            {[["primaryColor","Primario","#3B82F6"],["secondaryColor","Secondario","#8B5CF6"],["accentColor","Accento","#F59E0B"]].map(([k,l,d]) => (
              <div key={k} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <Label className="text-xs text-muted-foreground">{l}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(form.designScheme as Record<string,string>)[k] ?? d}
                    onChange={(e) => onFormChange({ designScheme:{ ...form.designScheme, [k]:e.target.value } })}
                    className="h-7 w-7 rounded cursor-pointer border border-border" />
                  <code className="text-[10px] text-muted-foreground w-14">{(form.designScheme as Record<string,string>)[k] ?? d}</code>
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Typography</p>
            {[["headingFont","Titoli"],["bodyFont","Corpo"]].map(([k,l]) => (
              <div key={k} className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">{l}</Label>
                <Select value={(form.designScheme as Record<string,string>)[k] ?? ""} onValueChange={(v) => onFormChange({ designScheme:{ ...form.designScheme, [k]:v } })}>
                  <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Font..." /></SelectTrigger>
                  <SelectContent>{["Sans-serif","Serif","Monospace"].map((f) => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sezioni sito</p>
            <TopicInput topics={form.contentTopics} onChange={(t) => onFormChange({ contentTopics:t })} />
          </div>
        </TabsContent>

        {/* Content tab */}
        <TabsContent value="content" className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 mt-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descrizione business</p>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={handleEnhance} disabled={enhLoading}>
                {enhLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Migliora con AI
              </Button>
            </div>
            <Textarea value={form.businessDescription} onChange={(e) => onFormChange({ businessDescription:e.target.value })}
              placeholder="Descrivi il tuo business..." rows={6} className="text-xs resize-none" maxLength={3000} />
            <p className="text-[10px] text-right text-muted-foreground mt-1">{form.businessDescription.length}/3000</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Settore</p>
            <Select value={form.businessType} onValueChange={(v) => onFormChange({ businessType:v })}>
              <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
              <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* SEO tab */}
        <TabsContent value="seo" className="flex-1 overflow-y-auto px-4 pb-3 space-y-3 mt-3">
          <Button onClick={handleSeo} disabled={seoLoading} size="sm" className="w-full gap-2">
            {seoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Genera keyword SEO con AI
          </Button>
          {keywords.length > 0 ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Keyword ({keywords.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => <span key={kw} className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] rounded font-medium">{kw}</span>)}
                </div>
              </div>
              {metaDesc && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Meta description</p>
                  <div className="rounded border bg-muted/30 p-2.5 text-xs leading-relaxed text-muted-foreground">{metaDesc}</div>
                  <p className="text-[10px] text-right text-muted-foreground mt-1">{metaDesc.length}/160</p>
                </div>
              )}
            </div>
          ) : !seoLoading && (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Genera keyword SEO ottimizzate<br/>in base al tuo business</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Build log */}
      {job && (
        <div className="border-t shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 border-b">
            <div className="h-2 w-2 rounded-full bg-red-400" /><div className="h-2 w-2 rounded-full bg-amber-400" /><div className="h-2 w-2 rounded-full bg-green-400" />
            <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">build.log</span>
          </div>
          <div ref={logRef} className="bg-card px-3 py-2 h-28 overflow-y-auto font-mono text-[10px] leading-relaxed">
            {job.logs.length === 0 ? <span className="text-muted-foreground">Avvio...</span>
              : job.logs.map((line: string, i: number) => (
                <div key={i} className={cn(
                  line.includes("✓")||line.includes("complet") ? "text-green-600" :
                  line.includes("ERRORE")||line.includes("fallito") ? "text-red-500" : "text-muted-foreground"
                )}>{line}</div>
              ))}
            {job.status==="RUNNING" && <span className="inline-block w-1.5 h-3 bg-muted-foreground animate-pulse" />}
          </div>
        </div>
      )}

      {/* Download */}
      {job?.status === "DONE" && (
        <div className="p-3 border-t shrink-0">
          <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium hover:bg-green-100 transition-colors">
            <Download className="h-4 w-4" /> Scarica WordPress ZIP
          </button>
        </div>
      )}
    </div>
  );
}

// ── History Row ───────────────────────────────────────────────────────────────
function HistoryRow({ job, onDelete }: { job: SitebuilderJob; onDelete: (id: string) => void }) {
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.PENDING;
  const base = getApiBaseUrl();
  const token = typeof window !== "undefined" ? window.localStorage.getItem("doflow_token") ?? "" : "";
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async () => {
    const res = await fetch(`${base}/sitebuilder/jobs/${job.id}/download`, { headers:{Authorization:`Bearer ${token}`} });
    if (!res.ok) return alert("ZIP non disponibile");
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${job.siteDomain}-wordpress.zip`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!confirm(`Eliminare il job per ${job.siteDomain}?`)) return;
    setDeleting(true);
    try {
      await fetch(`${base}/sitebuilder/jobs/${job.id}`, { method:"DELETE", headers:{Authorization:`Bearer ${token}`} });
      onDelete(job.id);
    } catch { alert("Errore eliminazione"); } finally { setDeleting(false); }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{job.siteDomain}</p>
        <p className="text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
      </div>
      <Badge variant="outline" className={cn("text-xs shrink-0", cfg.bg, cfg.color)}>{cfg.label}</Badge>
      <div className="flex items-center gap-1">
        {job.status==="DONE" && (
          <button onClick={handleDownload} title="Scarica ZIP" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Download className="h-3.5 w-3.5" /></button>
        )}
        <button onClick={handleDelete} disabled={deleting} title="Elimina" className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SitebuilderClient() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"wizard"|"history">("wizard");
  const [wizardStep, setStep] = useState(0);
  const [submitting, setSub] = useState(false);
  const [starterSites, setSites] = useState<StarterSite[]>([]);
  const [history, setHistory] = useState<SitebuilderJob[]>([]);
  const [jobId, setJobId] = useState<string|null>(null);
  const { job } = useSitebuilderJob(jobId);

  const [form, setForm] = useState<WizardForm>({
    tenantId:"public", siteDomain:"", siteTitle:"", adminEmail:"",
    businessType:"", businessDescription:"", starterSite:"",
    designScheme:{}, contentTopics:[], locale:"it",
  });

  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => setForm((p) => ({ ...p, [k]:v }));
  const patch = (p: Partial<WizardForm>) => setForm((f) => ({ ...f, ...p }));

  const base = getApiBaseUrl();
  const token = typeof window !== "undefined" ? window.localStorage.getItem("doflow_token") ?? "" : "";

  useEffect(() => {
    fetch(`${base}/sitebuilder/starter-sites`, { headers:{Authorization:`Bearer ${token}`} })
      .then((r) => r.json()).then((d) => setSites(Array.isArray(d) ? d : [])).catch(console.error);
    fetch(`${base}/sitebuilder/jobs`, { headers:{Authorization:`Bearer ${token}`} })
      .then((r) => r.json()).then((d) => setHistory(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (job?.status==="DONE" || job?.status==="FAILED") {
      fetch(`${base}/sitebuilder/jobs`, { headers:{Authorization:`Bearer ${token}`} })
        .then((r) => r.json()).then((d) => setHistory(Array.isArray(d) ? d : [])).catch(console.error);
    }
  }, [job?.status]);

  const handleSubmit = async () => {
    setSub(true);
    try {
      const res = await apiFetch<{jobId:string}>("/sitebuilder/jobs", { method:"POST", body:JSON.stringify(form), auth:true });
      setJobId(res.jobId);
      toast({ title:"Build avviata! 🚀" });
    } catch (err) { toast({ title:"Errore", description:String(err), variant:"destructive" }); }
    finally { setSub(false); }
  };

  const canNext = [
    !!(form.siteDomain && form.siteTitle && form.adminEmail),
    !!form.businessType, !!form.starterSite, true, form.contentTopics.length >= 1,
  ];

  const isActive = !!jobId && !!job && ["PENDING","RUNNING","DONE"].includes(job.status ?? "");

  // ── Split panel ───────────────────────────────────────────────────────────
  if (isActive) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="flex items-center justify-between px-6 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => { setJobId(null); setStep(0); }} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-sm font-bold">{form.siteDomain || "Sitebuilder"}</h1>
              <p className="text-xs text-muted-foreground">{form.siteTitle} · {form.businessType}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs gap-1.5", STATUS_CONFIG[job?.status ?? "PENDING"]?.bg, STATUS_CONFIG[job?.status ?? "PENDING"]?.color)}>
            {job?.status === "RUNNING" && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
            {job?.status === "DONE" && <CheckCircle2 className="h-3 w-3" />}
            {STATUS_CONFIG[job?.status ?? "PENDING"]?.label}
          </Badge>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden">
            <SiteToolsPanel form={form} onFormChange={patch} job={job ?? null} />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <SitePreviewPanel form={form} isRunning={job?.status==="RUNNING" || job?.status==="PENDING"} />
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Sitebuilder AI WordPress</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Genera un sito completo con AI pronto per SiteGround</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "wizard"|"history")}>
        <TabsList>
          <TabsTrigger value="wizard"><Zap className="h-3.5 w-3.5 mr-1.5" />Nuovo sito</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1.5" />Storico ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="wizard" className="mt-4 space-y-4">
          <StepIndicator currentStep={wizardStep} steps={WIZARD_STEPS} />

          {wizardStep === 0 && (
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Info sito</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs">Dominio *</Label><Input placeholder="shop.acme.it" value={form.siteDomain} onChange={(e) => set("siteDomain",e.target.value.toLowerCase())} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Nome sito *</Label><Input placeholder="Acme Shop" value={form.siteTitle} onChange={(e) => set("siteTitle",e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs">Email admin *</Label><Input type="email" placeholder="admin@acme.it" value={form.adminEmail} onChange={(e) => set("adminEmail",e.target.value)} /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Lingua</Label>
                    <Select value={form.locale} onValueChange={(v) => set("locale",v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[["it","Italiano"],["en","English"],["fr","Français"],["de","Deutsch"]].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select></div>
                </div>
              </CardContent>
            </Card>
          )}

          {wizardStep === 1 && (
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Business</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5"><Label className="text-xs">Settore *</Label>
                  <Select value={form.businessType} onValueChange={(v) => set("businessType",v)}>
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>{BUSINESS_TYPES.map((t)=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrizione</Label>
                  <Textarea placeholder="Descrivi il tuo business... (potrai migliorarlo con AI nel pannello)" value={form.businessDescription}
                    onChange={(e) => set("businessDescription",e.target.value)} rows={5} className="text-sm resize-none" maxLength={3000} />
                  <p className="text-xs text-right text-muted-foreground">{form.businessDescription.length}/3000 · "Migliora con AI" disponibile nel pannello laterale</p>
                </div>
              </CardContent>
            </Card>
          )}

          {wizardStep === 2 && (
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Tema Blocksy</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-80 overflow-y-auto pr-1">
                  {Array.from(new Set(starterSites.map((s) => s.category))).map((cat) => (
                    <div key={cat}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-3">{cat}</p>
                      {starterSites.filter((s) => s.category===cat).map((site) => (
                        <div key={site.slug} onClick={() => set("starterSite",site.slug)}
                          className={cn("flex items-center justify-between px-3 py-2 rounded-md border cursor-pointer transition-all mb-0.5",
                            form.starterSite===site.slug ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30")}>
                          <div className="flex items-center gap-2">
                            <div className={cn("h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0", form.starterSite===site.slug ? "border-primary" : "border-border")}>
                              {form.starterSite===site.slug && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                            </div>
                            <span className="text-sm">{site.label}</span>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold", site.isPro ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700")}>
                              {site.isPro ? "PRO" : "FREE"}
                            </span>
                          </div>
                          <a href={site.previewUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 text-muted-foreground hover:text-foreground" title="Anteprima"><Eye className="h-3.5 w-3.5" /></a>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {wizardStep === 3 && (
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Design (opzionale)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[["primaryColor","Primario","#3B82F6"],["secondaryColor","Secondario","#8B5CF6"],["accentColor","Accento","#F59E0B"]].map(([k,l,d])=>(
                    <div key={k} className="space-y-1.5">
                      <Label className="text-xs">{l}</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={(form.designScheme as Record<string,string>)[k] ?? d}
                          onChange={(e) => set("designScheme",{...form.designScheme,[k]:e.target.value})}
                          className="h-8 w-8 rounded cursor-pointer border" />
                        <Input value={(form.designScheme as Record<string,string>)[k] ?? d}
                          onChange={(e) => set("designScheme",{...form.designScheme,[k]:e.target.value})}
                          className="font-mono text-xs h-8" />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">💡 Potrai modificare colori e font live nel pannello laterale durante la generazione.</p>
              </CardContent>
            </Card>
          )}

          {wizardStep === 4 && (
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Sezioni da generare</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <TopicInput topics={form.contentTopics} onChange={(t) => set("contentTopics",t)} />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["Home","Chi Siamo","Servizi","Portfolio","Contatti","Blog","FAQ","Prezzi"].filter((s) => !form.contentTopics.includes(s)).map((s) => (
                    <button key={s} type="button" onClick={() => { if (form.contentTopics.length < 10) set("contentTopics",[...form.contentTopics,s]); }}
                      className="px-2.5 py-1 text-xs border border-dashed border-primary/40 rounded-md text-primary hover:bg-primary/10 transition-colors">+ {s}</button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-1">
            <Button variant="outline" onClick={() => setStep(Math.max(0,wizardStep-1))} disabled={wizardStep===0}><ArrowLeft className="h-4 w-4 mr-1.5" />Indietro</Button>
            {wizardStep < WIZARD_STEPS.length-1
              ? <Button onClick={() => setStep(wizardStep+1)} disabled={!canNext[wizardStep]}>Avanti<ChevronRight className="h-4 w-4 ml-1.5" /></Button>
              : <Button onClick={handleSubmit} disabled={!canNext.every(Boolean)||submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Genera sito <Zap className="h-4 w-4" />
                </Button>
            }
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card><CardContent className="pt-6">
            {history.length===0
              ? <div className="py-12 text-center text-muted-foreground">
                  <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nessuna build ancora</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab("wizard")}>Crea il primo sito</Button>
                </div>
              : <div className="space-y-2">
                  {history.map((j) => <HistoryRow key={j.id} job={j} onDelete={(id) => setHistory((h) => h.filter((x) => x.id!==id))} />)}
                </div>
            }
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}