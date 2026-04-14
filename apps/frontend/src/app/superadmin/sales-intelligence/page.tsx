// apps/frontend/src/app/superadmin/sales-intelligence/page.tsx
"use client";

import React, { useState, useCallback } from "react";
import {
  Sparkles, Building2, User, Globe, Loader2, CheckCircle2,
  AlertCircle, Copy, ChevronDown, ChevronUp, Search,
  TrendingUp, Mail, RefreshCw, Clock, Zap, Target,
  ArrowRight, ExternalLink,
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
  photo_url?: string;
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
  { label: "Enrichment dati",    progress: 30,  icon: Building2 },
  { label: "Sintesi contesto",   progress: 55,  icon: Globe },
  { label: "Analisi AI",         progress: 78,  icon: Sparkles },
  { label: "Generazione email",  progress: 92,  icon: Mail },
  { label: "Completato",         progress: 100, icon: CheckCircle2 },
];

const SEVERITY_CONFIG = {
  high:   { label: "Alto",  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  medium: { label: "Medio", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  low:    { label: "Basso", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
};

const ANGLE_CONFIG: Record<string, { label: string; icon: string }> = {
  curiosity:    { label: "Curiosità",   icon: "✦" },
  direct:       { label: "Diretto",     icon: "→" },
  "value-first": { label: "Value-first", icon: "◈" },
  challenger:   { label: "Challenger",  icon: "⚡" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PersonCard({
  person,
  selected,
  onSelect,
}: {
  person: ApolloPerson;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-semibold text-muted-foreground">
          {person.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{person.name}</p>
            {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
          </div>
          {person.title && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{person.title}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {person.seniority && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{person.seniority}</Badge>
            )}
            {person.city && (
              <span className="text-[11px] text-muted-foreground">{person.city}</span>
            )}
            {person.linkedin_url && (
              <a
                href={person.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[11px] text-primary flex items-center gap-0.5 hover:underline"
              >
                LinkedIn <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type View = "lookup" | "select" | "pipeline" | "results";

export default function SalesIntelligencePage() {
  const { toast } = useToast();

  // Step 1 — domain lookup
  const [domain, setDomain]             = useState("");
  const [isLooking, setIsLooking]       = useState(false);
  const [lookupResult, setLookupResult] = useState<CompanyLookupResult | null>(null);

  // Step 2 — person selection
  const [selectedPerson, setSelectedPerson] = useState<ApolloPerson | null>(null);
  const [customEmail, setCustomEmail]       = useState("");
  const [solutionsCatalog, setSolutionsCatalog] = useState("");

  // Step 3+ — pipeline & results
  const [jobId, setJobId]       = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [view, setView]         = useState<View>("lookup");
  const [expandedPP, setExpandedPP]   = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string>("direct");

  const { status, progress, campaignId, error } = useSalesIntelJob(jobId);

  // Fetch campaign when completed
  React.useEffect(() => {
    if (status === "completed" && campaignId) {
      apiFetch<Campaign>(`/sales-intel/campaigns/${campaignId}`, { auth: true })
        .then(data => { setCampaign(data); setView("results"); setJobId(null); })
        .catch(() => toast({ title: "Errore nel recupero risultati", variant: "destructive" }));
    }
    if (status === "failed") {
      toast({ title: "Analisi fallita", description: error || "Riprova", variant: "destructive" });
      setView("select");
      setJobId(null);
    }
  }, [status, campaignId, error]);

  // ── Step 1: domain lookup ──
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
      setView("select");
    } catch (e: any) {
      toast({ title: "Dominio non trovato", description: e.message, variant: "destructive" });
    } finally {
      setIsLooking(false);
    }
  }, [domain]);

  // ── Step 2: start analysis ──
  const handleAnalyze = useCallback(async () => {
    if (!selectedPerson || !lookupResult) return;

    try {
      const res = await apiFetch<{ jobId: string }>(
        "/sales-intel/analyze",
        {
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
        }
      );
      setJobId(res.jobId);
      setView("pipeline");
    } catch (e: any) {
      toast({ title: "Errore avvio analisi", description: e.message, variant: "destructive" });
    }
  }, [selectedPerson, lookupResult, customEmail, solutionsCatalog]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato negli appunti" });
  };

  const handleReset = () => {
    setView("lookup"); setLookupResult(null); setSelectedPerson(null);
    setCampaign(null); setJobId(null); setDomain(""); setCustomEmail("");
  };

  const activeStep = PIPELINE_STEPS.findIndex(s => progress < s.progress);
  const currentStep = activeStep === -1 ? PIPELINE_STEPS.length - 1 : activeStep;

  // ─── RENDER ──────────────────────────────────────────────────────────────────

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
        {(view !== "lookup") && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Nuova ricerca
          </Button>
        )}
      </div>

      {/* ── VIEW: LOOKUP ── */}
      {view === "lookup" && (
        <div className="max-w-xl mx-auto space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                Cerca azienda per dominio
              </div>
              <div>
                <Label htmlFor="domain" className="text-xs mb-1.5 block">
                  Dominio aziendale <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    placeholder="acme.it oppure acme.com"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLookup()}
                    className="flex-1"
                  />
                  <Button onClick={handleLookup} disabled={isLooking || !domain.trim()}>
                    {isLooking
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Search className="w-4 h-4" />
                    }
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Apollo cercherà l'azienda e le persone che ci lavorano
                </p>
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

      {/* ── VIEW: SELECT PERSON ── */}
      {view === "select" && lookupResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Company card */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> {lookupResult.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lookupResult.industry && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">{lookupResult.industry}</span>
                  </div>
                )}
                {lookupResult.employeeCount && (
                  <div className="text-xs text-muted-foreground">
                    {lookupResult.employeeCount.toLocaleString("it")} dipendenti
                  </div>
                )}
                {lookupResult.country && (
                  <div className="text-xs text-muted-foreground">{lookupResult.city ? `${lookupResult.city}, ` : ""}{lookupResult.country}</div>
                )}
                {lookupResult.fundingStage && (
                  <Badge variant="secondary" className="text-xs">{lookupResult.fundingStage}</Badge>
                )}
                {lookupResult.shortDescription && (
                  <p className="text-xs text-muted-foreground line-clamp-3 pt-1 border-t border-border">
                    {lookupResult.shortDescription}
                  </p>
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

            {/* Optional fields */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Opzioni aggiuntive
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs mb-1 block">Email prospect (se non trovata da Apollo)</Label>
                  <Input
                    placeholder="nome@azienda.it"
                    value={customEmail}
                    onChange={e => setCustomEmail(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Nostre soluzioni (opzionale)</Label>
                  <Textarea
                    placeholder="Descrivi brevemente le soluzioni da mappare…"
                    rows={3}
                    value={solutionsCatalog}
                    onChange={e => setSolutionsCatalog(e.target.value)}
                    className="text-xs resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* People list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Seleziona il prospect
                <span className="text-muted-foreground font-normal ml-1">
                  ({lookupResult.people.length} persone trovate)
                </span>
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
                  <p className="text-xs mt-1">Prova con un dominio alternativo o controlla su LinkedIn.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lookupResult.people.map(person => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    selected={selectedPerson?.id === person.id}
                    onSelect={() => setSelectedPerson(
                      selectedPerson?.id === person.id ? null : person
                    )}
                  />
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

      {/* ── VIEW: PIPELINE ── */}
      {view === "pipeline" && selectedPerson && lookupResult && (
        <div className="max-w-xl mx-auto">
          <Card>
            <CardContent className="pt-6 pb-8 space-y-8">
              {/* Recap */}
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-semibold text-purple-600">
                  {selectedPerson.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium">{selectedPerson.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPerson.title} @ {lookupResult.name}
                  </p>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Analisi in corso...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {PIPELINE_STEPS.map((step, i) => {
                  const done   = progress >= step.progress;
                  const active = i === currentStep && !done;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                        ${done   ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                                 : active ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600"
                                          : "bg-muted text-muted-foreground"}`}>
                        {active
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : done
                            ? <CheckCircle2 className="w-3.5 h-3.5" />
                            : <step.icon className="w-3.5 h-3.5" />
                        }
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

      {/* ── VIEW: RESULTS ── */}
      {view === "results" && campaign && (
        <div className="space-y-6">

          {/* Prospect header */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-lg font-bold text-purple-600">
                    {campaign.prospect.fullName.split(" ").map(n => n[0]).slice(0, 2).join("")}
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
                      {Math.round(campaign.strategicAnalysis.confidenceScore * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Confidence</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{campaign.strategicAnalysis.painPoints.length}</div>
                    <div className="text-xs text-muted-foreground">Pain points</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{campaign.emailVariants.length}</div>
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

          {/* Tabs */}
          <Tabs defaultValue="painpoints">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="painpoints"><Target className="w-3.5 h-3.5 mr-1.5" />Pain Points</TabsTrigger>
              <TabsTrigger value="emails"><Mail className="w-3.5 h-3.5 mr-1.5" />Email</TabsTrigger>
              <TabsTrigger value="hooks"><Zap className="w-3.5 h-3.5 mr-1.5" />Hooks</TabsTrigger>
            </TabsList>

            {/* Pain Points */}
            <TabsContent value="painpoints" className="space-y-3 mt-4">
              {campaign.strategicAnalysis.painPoints.map(pp => {
                const conf   = SEVERITY_CONFIG[pp.severity];
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

            {/* Emails */}
            <TabsContent value="emails" className="mt-4">
              <Tabs value={expandedEmail} onValueChange={setExpandedEmail}>
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
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleCopy(ev.subject)}>
                              <Copy className="w-3 h-3 mr-1" /> Copia
                            </Button>
                          </div>
                          <div className="p-3 bg-muted rounded-lg text-sm font-medium">{ev.subject}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <Label className="text-xs text-muted-foreground">CORPO</Label>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleCopy(`Oggetto: ${ev.subject}\n\n${ev.body}`)}>
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
            </TabsContent>

            {/* Hooks */}
            <TabsContent value="hooks" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Timing consigliato</p>
                      <p className="text-sm">{campaign.strategicAnalysis.timingRecommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {campaign.strategicAnalysis.outreachHooks.map((h, i) => {
                const conf = ANGLE_CONFIG[h.angle] || { label: h.angle, icon: "·" };
                return (
                  <Card key={i}>
                    <CardContent className="pt-4 pb-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{conf.icon}</span>
                        <Badge variant="secondary" className="text-xs">{conf.label}</Badge>
                      </div>
                      <p className="text-sm italic">"{h.hook}"</p>
                      <p className="text-xs text-muted-foreground">{h.whyItWorks}</p>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs -ml-2" onClick={() => handleCopy(h.hook)}>
                        <Copy className="w-3 h-3 mr-1" /> Copia hook
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}