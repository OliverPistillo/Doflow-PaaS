// apps/frontend/src/app/superadmin/sales-intelligence/page.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Sparkles, Building2, User, Globe, Loader2, CheckCircle2,
  AlertCircle, Copy, ChevronDown, ChevronUp, Search,
  TrendingUp, Mail, RefreshCw, Clock, Zap, Target,
  ArrowRight, ExternalLink, History, BarChart3, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useSalesIntelJob } from "@/hooks/useSalesIntelJob";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApolloPerson {
  id: string;
  name: string;
  title?: string;
  seniority?: string;
  email?: string;
  linkedin_url?: string;
  city?: string;
  country?: string;
}

interface CompanyLookupResult {
  apolloOrgId: string;
  name: string;
  domain: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: string;
  country?: string;
  city?: string;
  linkedinUrl?: string;
  shortDescription?: string;
  techStack?: string[];
  fundingStage?: string;
  totalFunding?: string;
  people: ApolloPerson[];
}

interface PainPoint {
  id: string;
  title: string;
  evidence: string;
  severity: "high" | "medium" | "low";
  ourSolution: string;
}

interface OutreachHook {
  angle: string;
  hook: string;
  whyItWorks: string;
}

interface EmailVariant {
  variant: string;
  subject: string;
  body: string;
}

interface Campaign {
  id: string;
  status: string;
  generatedAt: string;
  prospect: {
    fullName: string;
    jobTitle?: string;
    email?: string;
    company: {
      name: string;
      domain: string;
      industry?: string;
      employeeCount?: number;
      techStack?: string[];
    };
  };
  strategicAnalysis: {
    painPoints: PainPoint[];
    outreachHooks: OutreachHook[];
    timingRecommendation: string;
    confidenceScore: number;
  };
  emailVariants: EmailVariant[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { label: "Enrichment dati",   progress: 30,  icon: Building2 },
  { label: "Sintesi contesto",  progress: 55,  icon: Globe },
  { label: "Analisi AI",        progress: 78,  icon: Sparkles },
  { label: "Generazione email", progress: 92,  icon: Mail },
  { label: "Completato",        progress: 100, icon: CheckCircle2 },
];

const SEVERITY_CONFIG = {
  high:   { label: "Alto",  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  medium: { label: "Medio", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  low:    { label: "Basso", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
};

const ANGLE_CONFIG: Record<string, { label: string; icon: string }> = {
  curiosity:     { label: "Curiosità",   icon: "✦" },
  direct:        { label: "Diretto",     icon: "→" },
  "value-first": { label: "Value-first", icon: "◈" },
  challenger:    { label: "Challenger",  icon: "⚡" },
};

function initials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── CampaignResults — componente riusabile tra "risultati live" e storico ────

function CampaignResults({ campaign, onCopy }: { campaign: Campaign; onCopy: (t: string) => void }) {
  const [expandedPP, setExpandedPP]   = useState<string | null>(null);
  const [activeEmail, setActiveEmail] = useState<string>(campaign.emailVariants[0]?.variant ?? "direct");

  return (
    <div className="space-y-6">
      {/* Prospect header */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-lg font-bold text-purple-600">
                {initials(campaign.prospect.fullName)}
              </div>
              <div>
                <h2 className="font-semibold">{campaign.prospect.fullName}</h2>
                <p className="text-sm text-muted-foreground">
                  {campaign.prospect.jobTitle} @ {campaign.prospect.company.name}
                </p>
                {campaign.prospect.email && (
                  <p className="text-xs text-muted-foreground mt-0.5">{campaign.prospect.email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {Math.round((campaign.strategicAnalysis?.confidenceScore ?? 0) * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{campaign.strategicAnalysis?.painPoints?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground">Pain points</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{campaign.emailVariants?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground">Email</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {campaign.prospect.company.industry && (
              <Badge variant="secondary">{campaign.prospect.company.industry}</Badge>
            )}
            {campaign.prospect.company.employeeCount && (
              <Badge variant="secondary">{campaign.prospect.company.employeeCount} dipendenti</Badge>
            )}
            {(campaign.prospect.company.techStack ?? []).slice(0, 4).map(t => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs risultati */}
      <Tabs defaultValue="painpoints">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="painpoints"><Target className="w-3.5 h-3.5 mr-1.5" />Pain Points</TabsTrigger>
          <TabsTrigger value="emails"><Mail className="w-3.5 h-3.5 mr-1.5" />Email</TabsTrigger>
          <TabsTrigger value="hooks"><Zap className="w-3.5 h-3.5 mr-1.5" />Hooks</TabsTrigger>
        </TabsList>

        {/* Pain Points */}
        <TabsContent value="painpoints" className="space-y-3 mt-4">
          {(campaign.strategicAnalysis?.painPoints ?? []).map(pp => {
            const conf   = SEVERITY_CONFIG[pp.severity] ?? SEVERITY_CONFIG.medium;
            const isOpen = expandedPP === pp.id;
            return (
              <Card key={pp.id} className="overflow-hidden">
                <button className="w-full text-left" onClick={() => setExpandedPP(isOpen ? null : pp.id)}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{pp.title}</p>
                          {!isOpen && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pp.evidence}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`text-xs ${conf.className}`}>{conf.label}</Badge>
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-4 space-y-3 pl-7">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Evidenza</p>
                          <p className="text-sm">{pp.evidence}</p>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <TrendingUp className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-0.5">Nostra soluzione</p>
                            <p className="text-sm text-green-800 dark:text-green-300">{pp.ourSolution}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </button>
              </Card>
            );
          })}
        </TabsContent>

        {/* Email */}
        <TabsContent value="emails" className="mt-4">
          {(campaign.emailVariants ?? []).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Nessuna email generata.</CardContent>
            </Card>
          ) : (
            <Tabs value={activeEmail} onValueChange={setActiveEmail}>
              <TabsList className="w-full">
                {campaign.emailVariants.map(ev => (
                  <TabsTrigger key={ev.variant} value={ev.variant} className="flex-1 capitalize">{ev.variant}</TabsTrigger>
                ))}
              </TabsList>
              {campaign.emailVariants.map(ev => (
                <TabsContent key={ev.variant} value={ev.variant} className="mt-4">
                  <Card>
                    <CardContent className="pt-4 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-xs text-muted-foreground">OGGETTO</Label>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onCopy(ev.subject)}>
                            <Copy className="w-3 h-3 mr-1" /> Copia
                          </Button>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-sm font-medium">{ev.subject}</div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-xs text-muted-foreground">CORPO</Label>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                            onClick={() => onCopy(`Oggetto: ${ev.subject}\n\n${ev.body}`)}>
                            <Copy className="w-3 h-3 mr-1" /> Copia tutto
                          </Button>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap leading-relaxed">{ev.body}</div>
                      </div>
                      <p className="text-xs text-muted-foreground text-right">{ev.body.split(/\s+/).length} parole</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>

        {/* Hooks */}
        <TabsContent value="hooks" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Timing consigliato</p>
                  <p className="text-sm">{campaign.strategicAnalysis?.timingRecommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {(campaign.strategicAnalysis?.outreachHooks ?? []).map((h, i) => {
            const conf = ANGLE_CONFIG[h.angle] || { label: h.angle, icon: "·" };
            return (
              <Card key={i}>
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span>{conf.icon}</span>
                    <Badge variant="secondary" className="text-xs">{conf.label}</Badge>
                  </div>
                  <p className="text-sm italic">"{h.hook}"</p>
                  <p className="text-xs text-muted-foreground">{h.whyItWorks}</p>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs -ml-2" onClick={() => onCopy(h.hook)}>
                    <Copy className="w-3 h-3 mr-1" /> Copia hook
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type WorkflowView = "lookup" | "select" | "pipeline" | "results";
type PageTab = "nuova" | "storico";

export default function SalesIntelligencePage() {
  const { toast } = useToast();

  // Page-level tab
  const [pageTab, setPageTab] = useState<PageTab>("nuova");

  // Storico
  const [history, setHistory]             = useState<Campaign[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Workflow
  const [workflowView, setWorkflowView]   = useState<WorkflowView>("lookup");
  const [domain, setDomain]               = useState("");
  const [isLooking, setIsLooking]         = useState(false);
  const [lookupResult, setLookupResult]   = useState<CompanyLookupResult | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<ApolloPerson | null>(null);
  const [customEmail, setCustomEmail]     = useState("");
  const [solutionsCatalog, setSolutionsCatalog] = useState("");
  const [jobId, setJobId]                 = useState<string | null>(null);
  const [campaign, setCampaign]           = useState<Campaign | null>(null);

  const { status, progress, campaignId, error } = useSalesIntelJob(jobId);

  // ── Fetch storico ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<Campaign[]>("/sales-intel/campaigns", { auth: true });
      setHistory(data ?? []);
    } catch {
      toast({ title: "Errore caricamento storico", variant: "destructive" });
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Carica storico al primo mount
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Pipeline completion ────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "completed" && campaignId) {
      apiFetch<Campaign>(`/sales-intel/campaigns/${campaignId}`, { auth: true })
        .then(data => {
          setCampaign(data);
          setWorkflowView("results");
          setJobId(null);
          // Aggiunge in cima senza refetch completo
          setHistory(prev => [data, ...prev.filter(c => c.id !== data.id)]);
        })
        .catch(() => toast({ title: "Errore recupero risultati", variant: "destructive" }));
    }
    if (status === "failed") {
      toast({ title: "Analisi fallita", description: error || "Riprova", variant: "destructive" });
      setWorkflowView("select");
      setJobId(null);
    }
  }, [status, campaignId, error]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato negli appunti" });
  };

  const handleReset = () => {
    setWorkflowView("lookup"); setLookupResult(null); setSelectedPerson(null);
    setCampaign(null); setJobId(null); setDomain(""); setCustomEmail("");
    setSelectedCampaign(null);
  };

  const handleLookup = useCallback(async () => {
    const clean = domain.toLowerCase()
      .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
    if (!clean) { toast({ title: "Inserisci un dominio", variant: "destructive" }); return; }
    setIsLooking(true);
    setLookupResult(null);
    setSelectedPerson(null);
    try {
      const data = await apiFetch<CompanyLookupResult>(
        `/sales-intel/lookup?domain=${encodeURIComponent(clean)}`,
        { auth: true }
      );
      setLookupResult(data);
      setWorkflowView("select");
    } catch (e: any) {
      toast({ title: "Dominio non trovato", description: e.message, variant: "destructive" });
    } finally {
      setIsLooking(false);
    }
  }, [domain]);

  const handleAnalyze = useCallback(async () => {
    if (!selectedPerson || !lookupResult) return;
    try {
      const res = await apiFetch<{ jobId: string }>("/sales-intel/analyze", {
        method: "POST", auth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName:            selectedPerson.name,
          companyName:         lookupResult.name,
          domain:              lookupResult.domain,
          email:               customEmail || selectedPerson.email,
          jobTitle:            selectedPerson.title,
          seniority:           selectedPerson.seniority,
          linkedinUrl:         selectedPerson.linkedin_url,
          apolloPersonId:      selectedPerson.id,
          ourSolutionsCatalog: solutionsCatalog || undefined,
        }),
      });
      setJobId(res.jobId);
      setWorkflowView("pipeline");
    } catch (e: any) {
      toast({ title: "Errore avvio analisi", description: e.message, variant: "destructive" });
    }
  }, [selectedPerson, lookupResult, customEmail, solutionsCatalog]);

  const activeStep  = PIPELINE_STEPS.findIndex(s => progress < s.progress);
  const currentStep = activeStep === -1 ? PIPELINE_STEPS.length - 1 : activeStep;

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h1 className="text-xl font-semibold">Sales Intelligence AI</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Cerca un'azienda per dominio, scegli il prospect e genera outreach iper-personalizzato
          </p>
        </div>
        {(workflowView !== "lookup" || selectedCampaign) && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Nuova ricerca
          </Button>
        )}
      </div>

      {/* Page-level tabs */}
      <Tabs value={pageTab} onValueChange={v => {
        setPageTab(v as PageTab);
        if (v === "storico") { fetchHistory(); setSelectedCampaign(null); }
      }}>
        <TabsList>
          <TabsTrigger value="nuova">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Nuova analisi
          </TabsTrigger>
          <TabsTrigger value="storico">
            <History className="w-3.5 h-3.5 mr-1.5" /> Storico
            {history.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{history.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ══ TAB: NUOVA ANALISI ════════════════════════════════════════════════ */}
        <TabsContent value="nuova" className="mt-6">

          {/* LOOKUP */}
          {workflowView === "lookup" && (
            <div className="max-w-xl mx-auto space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    Cerca azienda per dominio
                  </div>
                  <div>
                    <Label htmlFor="domain" className="text-xs mb-1.5 block">
                      Dominio aziendale <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input id="domain" placeholder="acme.it oppure acme.com"
                        value={domain} onChange={e => setDomain(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLookup()} />
                      <Button onClick={handleLookup} disabled={isLooking || !domain.trim()}>
                        {isLooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Apollo cercherà l'azienda e le persone che ci lavorano</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/40 border-dashed">
                <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground text-sm">Come funziona</p>
                  <p>1. Inserisci il dominio → Apollo arricchisce i dati aziendali</p>
                  <p>2. Apollo trova i decision maker dell'azienda</p>
                  <p>3. Scegli il prospect dalla lista</p>
                  <p>4. Gemini analizza pain points e genera le email</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* SELECT */}
          {workflowView === "select" && lookupResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> {lookupResult.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {lookupResult.industry && <p className="text-xs text-muted-foreground">{lookupResult.industry}</p>}
                    {lookupResult.employeeCount && <p className="text-xs text-muted-foreground">{lookupResult.employeeCount.toLocaleString("it")} dipendenti</p>}
                    {lookupResult.country && <p className="text-xs text-muted-foreground">{lookupResult.city ? `${lookupResult.city}, ` : ""}{lookupResult.country}</p>}
                    {lookupResult.fundingStage && <Badge variant="secondary" className="text-xs">{lookupResult.fundingStage}</Badge>}
                    {lookupResult.shortDescription && (
                      <p className="text-xs text-muted-foreground line-clamp-3 pt-1 border-t border-border">{lookupResult.shortDescription}</p>
                    )}
                    {(lookupResult.techStack ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {lookupResult.techStack!.slice(0, 6).map(t => (
                          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Opzioni</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs mb-1 block">Email (se non trovata da Apollo)</Label>
                      <Input placeholder="nome@azienda.it" value={customEmail}
                        onChange={e => setCustomEmail(e.target.value)} className="text-xs h-8" />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Nostre soluzioni (opzionale)</Label>
                      <Textarea placeholder="Descrivi le soluzioni da mappare…" rows={3}
                        value={solutionsCatalog} onChange={e => setSolutionsCatalog(e.target.value)}
                        className="text-xs resize-none" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Seleziona il prospect
                    <span className="text-muted-foreground font-normal ml-1">({lookupResult.people.length} trovate)</span>
                  </p>
                  {selectedPerson && (
                    <Button onClick={handleAnalyze} size="sm">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Analizza {selectedPerson.name.split(" ")[0]}
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  )}
                </div>

                {lookupResult.people.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nessuna persona trovata da Apollo per questo dominio.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lookupResult.people.map(person => (
                      <button key={person.id} onClick={() => setSelectedPerson(selectedPerson?.id === person.id ? null : person)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedPerson?.id === person.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted/40"}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-semibold text-muted-foreground">
                            {initials(person.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{person.name}</p>
                              {selectedPerson?.id === person.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                            </div>
                            {person.title && <p className="text-xs text-muted-foreground truncate mt-0.5">{person.title}</p>}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {person.seniority && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{person.seniority}</Badge>}
                              {person.city && <span className="text-[11px] text-muted-foreground">{person.city}</span>}
                              {person.linkedin_url && (
                                <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-[11px] text-primary flex items-center gap-0.5 hover:underline">
                                  LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPerson && (
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleAnalyze} className="gap-2">
                      <Sparkles className="w-4 h-4" />
                      Avvia analisi per {selectedPerson.name}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PIPELINE */}
          {workflowView === "pipeline" && selectedPerson && lookupResult && (
            <div className="max-w-xl mx-auto">
              <Card>
                <CardContent className="pt-6 pb-8 space-y-8">
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                    <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-semibold text-purple-600">
                      {initials(selectedPerson.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{selectedPerson.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedPerson.title} @ {lookupResult.name}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Analisi in corso...</span><span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  <div className="space-y-3">
                    {PIPELINE_STEPS.map((step, i) => {
                      const done   = progress >= step.progress;
                      const active = i === currentStep && !done;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                            ${done ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                                   : active ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600"
                                            : "bg-muted text-muted-foreground"}`}>
                            {active ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : done ? <CheckCircle2 className="w-3.5 h-3.5" />
                                           : <step.icon className="w-3.5 h-3.5" />}
                          </div>
                          <span className={`text-sm ${done ? "font-medium" : active ? "text-foreground" : "text-muted-foreground"}`}>
                            {step.label}
                          </span>
                          {done && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />}
                        </div>
                      );
                    })}
                  </div>
                  {status === "failed" && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error || "Analisi fallita. Riprova."}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* RESULTS */}
          {workflowView === "results" && campaign && (
            <CampaignResults campaign={campaign} onCopy={handleCopy} />
          )}
        </TabsContent>

        {/* ══ TAB: STORICO ═════════════════════════════════════════════════════ */}
        <TabsContent value="storico" className="mt-6">

          {/* Dettaglio campaign dallo storico */}
          {selectedCampaign ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)}>
                  ← Torna allo storico
                </Button>
                <span className="text-xs text-muted-foreground">
                  Analisi del {formatDate(selectedCampaign.generatedAt)}
                </span>
              </div>
              <CampaignResults campaign={selectedCampaign} onCopy={handleCopy} />
            </div>
          ) : (
            /* Lista campagne */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {history.length} {history.length === 1 ? "analisi generata" : "analisi generate"}
                </p>
                <Button variant="outline" size="sm" onClick={fetchHistory} disabled={historyLoading}>
                  {historyLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>

              {historyLoading && history.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento...
                </div>
              ) : history.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="pt-10 pb-10 text-center">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">Nessuna analisi ancora generata.</p>
                    <p className="text-xs text-muted-foreground mt-1">Le analisi completate appariranno qui automaticamente.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {history.map(c => (
                    <button key={c.id} className="w-full text-left" onClick={() => setSelectedCampaign(c)}>
                      <Card className="hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer">
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-semibold text-purple-600 flex-shrink-0">
                              {initials(c.prospect?.fullName ?? "?")}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium">{c.prospect?.fullName}</p>
                                {c.prospect?.jobTitle && (
                                  <span className="text-xs text-muted-foreground">— {c.prospect.jobTitle}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {c.prospect?.company?.name}
                                {c.prospect?.company?.industry ? ` · ${c.prospect.company.industry}` : ""}
                              </p>
                            </div>

                            {/* Metrics */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-center hidden sm:block">
                                <p className="text-sm font-bold text-purple-600">
                                  {Math.round((c.strategicAnalysis?.confidenceScore ?? 0) * 100)}%
                                </p>
                                <p className="text-[10px] text-muted-foreground">conf.</p>
                              </div>
                              <div className="text-center hidden sm:block">
                                <p className="text-sm font-bold">{c.strategicAnalysis?.painPoints?.length ?? 0}</p>
                                <p className="text-[10px] text-muted-foreground">pain pts</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">{formatDate(c.generatedAt)}</p>
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                  <Badge variant="secondary" className="text-[10px] h-4">
                                    {c.emailVariants?.length ?? 0} email
                                  </Badge>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}