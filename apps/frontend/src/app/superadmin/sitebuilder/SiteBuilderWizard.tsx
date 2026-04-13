"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Copy, ArrowRight, ArrowLeft, Wand2, History, Trash2, PlusCircle, AlertTriangle, X, Tag } from "lucide-react";

// --- TIPI ---
interface BriefData {
  companyName: string;
  pages: string[];
  goals: string[];
  targetAudience: string;
  usp: string;
  toneOfVoice: string;
  keywords: string[];
  additionalInfo: string;
}

interface SavedSite {
  id: string;
  companyName: string;
  theme: string;
  token: string;
  date: string;
}

interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  previewImage?: string;   // path in /public/themes/
  previewColor?: string;   // fallback colore Tailwind
  badge?: string;          // etichetta settore
  availablePages: string[];
}

const AVAILABLE_THEMES: ThemeConfig[] = [
  {
    id: 'doflow-first',
    name: 'DoFlow First',
    description: 'Design premium con blocchi Gutenverse e animazioni GSAP. Perfetto per agenzie, consulenti e professionisti B2B.',
    previewColor: 'bg-indigo-900',
    badge: 'Agenzia / B2B',
    availablePages: ['Home', 'Chi Siamo', 'Servizi', 'Portfolio', 'FAQ', 'Blog', 'Contatti'],
  },
  {
    id: 'doflow-konsulty',
    name: 'DoFlow Konsulty',
    description: 'Stile corporate con hero fotografico e statistiche di impatto. Ideale per consulenti, studi legali e finance.',
    previewImage: '/themes/doflow-konsulty.jpg',
    badge: 'Consulenza / Finance',
    availablePages: ['Home', 'Chi Siamo', 'Servizi', 'Casi Studio', 'FAQ', 'Blog', 'Contatti'],
  },
  {
    id: 'doflow-skintiva',
    name: 'DoFlow Skintiva',
    description: 'Estetica raffinata in toni beige e terracotta. Perfetto per cliniche, beauty center e professionisti del benessere.',
    previewImage: '/themes/doflow-skintiva.jpg',
    badge: 'Beauty / Clinica',
    availablePages: ['Home', 'Chi Siamo', 'Trattamenti', 'FAQ', 'Blog', 'Contatti'],
  },
  {
    id: 'doflow-artifice',
    name: 'DoFlow Artifice',
    description: 'Look futuristico dark con accenti cyan. Pensato per startup AI, aziende tech e robotics.',
    previewImage: '/themes/doflow-artifice.jpg',
    badge: 'Tech / AI / Startup',
    availablePages: ['Home', 'Chi Siamo', 'Servizi', 'Portfolio', 'FAQ', 'Blog', 'Contatti'],
  },
  {
    id: 'doflow-zyno',
    name: 'DoFlow Zyno',
    description: 'Design moderno light con accenti blu elettrico. Ideale per agenzie di digital marketing, SEO e social media.',
    previewImage: '/themes/doflow-zyno.jpg',
    badge: 'Digital Marketing / SEO',
    availablePages: ['Home', 'Chi Siamo', 'Servizi', 'FAQ', 'Blog', 'Contatti'],
  },
];

const GOALS = [
  'Generazione Lead / Contatti',
  'Vendita Diretta (E-commerce)',
  'Brand Awareness',
  'Portfolio / Vetrina',
  'Educativo / Informativo',
];

const TONES = [
  'Professionale & Autorevole',
  'Amichevole & Empatico',
  'Tecnico & Innovativo',
  'Creativo & Audace',
  'Lusso & Esclusivo',
];

export default function SiteBuilderWizard() {
  const [step, setStep] = useState<number>(1);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [briefData, setBriefData] = useState<BriefData>({
    companyName: '',
    pages: ['Home'],
    goals: [],
    targetAudience: '',
    usp: '',
    toneOfVoice: '',
    keywords: [],
    additionalInfo: '',
  });
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'wizard' | 'history'>('wizard');
  const [history, setHistory] = useState<SavedSite[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('doflow_generated_sites');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId);
    setBriefData(prev => ({ ...prev, pages: ['Home'] }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setBriefData({ ...briefData, [e.target.name]: e.target.value });
  };

  const toggleArrayItem = (field: 'pages' | 'goals', item: string) => {
    setBriefData(prev => {
      const array = prev[field];
      if (array.includes(item)) {
        if (item === 'Home') return prev;
        return { ...prev, [field]: array.filter(i => i !== item) };
      }
      return { ...prev, [field]: [...array, item] };
    });
  };

  const handleAddKeyword = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e && e.key !== 'Enter') return;
    if (e) e.preventDefault();
    if (currentKeyword.trim() && !briefData.keywords.includes(currentKeyword.trim())) {
      setBriefData(prev => ({ ...prev, keywords: [...prev.keywords, currentKeyword.trim()] }));
      setCurrentKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    setBriefData(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }));
  };

  const saveToHistory = (token: string, company: string, theme: string) => {
    const newSite: SavedSite = {
      id: crypto.randomUUID(),
      companyName: company,
      theme,
      token,
      date: new Date().toLocaleString('it-IT'),
    };
    const updated = [newSite, ...history];
    setHistory(updated);
    localStorage.setItem('doflow_generated_sites', JSON.stringify(updated));
  };

  const deleteFromHistory = (id: string) => {
    const updated = history.filter(s => s.id !== id);
    setHistory(updated);
    localStorage.setItem('doflow_generated_sites', JSON.stringify(updated));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Token copiato negli appunti!');
  };

  const generateSite = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setStep(5);

    try {
      const response = await axios.post('/api/sitebuilder/generate', {
        themeId: selectedTheme,
        ...briefData,
      });

      const jobId = response.data.jobId;

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/sitebuilder/status/${jobId}`);
          const { status, token } = statusRes.data;

          if (status === 'completed') {
            clearInterval(pollInterval);
            setExportToken(token);
            saveToHistory(
              token,
              briefData.companyName,
              AVAILABLE_THEMES.find(t => t.id === selectedTheme)?.name || selectedTheme || 'Theme',
            );
            setStep(6);
            setIsLoading(false);
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            setErrorMsg("L'AI ha riscontrato un errore. Controlla i dati e riprova.");
            setStep(4);
            setIsLoading(false);
          }
        } catch {
          clearInterval(pollInterval);
          setErrorMsg("Errore di connessione durante l'attesa.");
          setStep(4);
          setIsLoading(false);
        }
      }, 3000);

    } catch {
      setErrorMsg('Impossibile contattare il server.');
      setStep(4);
      setIsLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedTheme(null);
    setBriefData({ companyName: '', pages: ['Home'], goals: [], targetAudience: '', usp: '', toneOfVoice: '', keywords: [], additionalInfo: '' });
    setExportToken(null);
    setCurrentKeyword('');
    setErrorMsg(null);
  };

  const activeThemeObj = AVAILABLE_THEMES.find(t => t.id === selectedTheme);

  // ── Storico ───────────────────────────────────────────────────────────────
  if (viewMode === 'history') {
    return (
      <div className="min-h-screen bg-muted/40 p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Storico Generazioni</h1>
          <Button onClick={() => setViewMode('wizard')} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Nuova Generazione
          </Button>
        </div>
        <Card className="w-full max-w-4xl shadow-sm border-muted">
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <History className="mx-auto h-12 w-12 mb-4 opacity-20" />
                <p>Nessun sito generato.</p>
              </div>
            ) : (
              <div className="divide-y">
                {history.map(site => (
                  <div key={site.id} className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                    <div>
                      <h3 className="font-semibold text-lg">{site.companyName}</h3>
                      <p className="text-sm text-muted-foreground">Tema: {site.theme} • {site.date}</p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <code className="bg-muted px-2 py-1 rounded text-xs truncate w-32 md:w-48 border">
                        {site.token.substring(0, 20)}...
                      </code>
                      <Button variant="secondary" size="sm" onClick={() => copyToClipboard(site.token)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteFromHistory(site.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/40 p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl flex justify-end mb-4">
        <Button onClick={() => setViewMode('history')} variant="ghost" className="text-muted-foreground">
          <History className="mr-2 h-4 w-4" /> Vedi Storico
        </Button>
      </div>

      <Card className="w-full max-w-5xl shadow-lg border-muted">
        <CardHeader className="border-b bg-card">
          <CardTitle className="text-3xl text-primary">Generatore Siti AI</CardTitle>
          <CardDescription className="text-base">
            Step {Math.min(step, 4)} di 4 —{' '}
            {step === 1 ? 'Selezione Tema'
              : step === 2 ? 'Pagine & Obiettivi'
              : step === 3 ? 'Identità Brand'
              : step === 4 ? 'Brief Aggiuntivo'
              : step === 5 ? 'Generazione in corso...'
              : 'Completato!'}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          {errorMsg && (
            <div className="mb-6 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          {/* STEP 1 — Selezione Tema */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {AVAILABLE_THEMES.map(theme => (
                  <Card
                    key={theme.id}
                    className={`cursor-pointer transition-all hover:shadow-md border-2 overflow-hidden ${
                      selectedTheme === theme.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-muted-foreground/20'
                    }`}
                    onClick={() => handleThemeSelect(theme.id)}
                  >
                    {/* Anteprima — immagine reale o colore fallback */}
                    <div className="relative h-44 w-full overflow-hidden rounded-t-lg bg-muted">
                      {theme.previewImage ? (
                        <Image
                          src={theme.previewImage}
                          alt={`Anteprima ${theme.name}`}
                          fill
                          className="object-cover object-top transition-transform duration-300 hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <div className={`absolute inset-0 ${theme.previewColor ?? 'bg-slate-800'}`} />
                      )}
                      {/* Badge settore */}
                      {theme.badge && (
                        <span className="absolute top-3 left-3 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm">
                          {theme.badge}
                        </span>
                      )}
                      {/* Overlay selezione */}
                      {selectedTheme === theme.id && (
                        <div className="absolute inset-0 bg-primary/30 flex items-center justify-center backdrop-blur-[1px]">
                          <CheckCircle2 className="text-white h-12 w-12 drop-shadow-lg" />
                        </div>
                      )}
                    </div>

                    <CardHeader className="p-4 pb-3">
                      <CardTitle className="text-lg">{theme.name}</CardTitle>
                      <CardDescription className="text-sm mt-1 leading-relaxed">{theme.description}</CardDescription>
                      <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
                        <span className="text-xs font-semibold w-full text-muted-foreground mb-1">Pagine disponibili:</span>
                        {theme.availablePages.map(p => (
                          <span key={p} className="text-xs bg-muted px-2 py-0.5 rounded-md">{p}</span>
                        ))}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              <div className="flex justify-end pt-4">
                <Button disabled={!selectedTheme} onClick={() => setStep(2)} size="lg">
                  Avanti <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2 — Pagine & Obiettivi */}
          {step === 2 && activeThemeObj && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-4">
                <Label className="text-lg">Quali pagine vuoi generare?</Label>
                <p className="text-sm text-muted-foreground">
                  L'AI scriverà testi specifici e ottimizzati per ognuna delle pagine selezionate.
                </p>
                <div className="flex flex-wrap gap-3">
                  {activeThemeObj.availablePages.map(page => {
                    const isSelected = briefData.pages.includes(page);
                    const isHome = page === 'Home';
                    return (
                      <Button
                        key={page}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        className={isSelected ? 'ring-2 ring-primary/20' : ''}
                        onClick={() => toggleArrayItem('pages', page)}
                        disabled={isHome}
                      >
                        {isSelected && <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {page}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selezionate: {briefData.pages.join(', ')}
                </p>
              </div>

              <div className="space-y-4 border-t pt-6">
                <Label className="text-lg">Qual è l'obiettivo principale del sito?</Label>
                <div className="flex flex-wrap gap-3">
                  {GOALS.map(goal => {
                    const isSelected = briefData.goals.includes(goal);
                    return (
                      <Button
                        key={goal}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => toggleArrayItem('goals', goal)}
                      >
                        {isSelected && <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {goal}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
                </Button>
                <Button onClick={() => setStep(3)} disabled={briefData.goals.length === 0}>
                  Avanti <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3 — Identità Brand */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nome Azienda / Brand</Label>
                  <Input name="companyName" value={briefData.companyName} onChange={handleInputChange} placeholder="Es. Studio Rossi" />
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Input name="targetAudience" value={briefData.targetAudience} onChange={handleInputChange} placeholder="Es. PMI italiane tra 10 e 50 dipendenti" />
                </div>
              </div>

              <div className="space-y-2 border-t pt-6">
                <Label>Unique Selling Proposition (USP)</Label>
                <Input name="usp" value={briefData.usp} onChange={handleInputChange} placeholder="Es. Sito online in 48h con garanzia soddisfatti o rimborsati" />
              </div>

              <div className="space-y-4 border-t pt-6">
                <Label>Tono di Voce</Label>
                <div className="flex flex-wrap gap-3">
                  {TONES.map(tone => (
                    <Button
                      key={tone}
                      type="button"
                      variant={briefData.toneOfVoice === tone ? 'default' : 'outline'}
                      onClick={() => setBriefData({ ...briefData, toneOfVoice: tone })}
                    >
                      {tone}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t pt-6">
                <Label>Keywords e Servizi (Invio per aggiungere)</Label>
                <div className="flex gap-2">
                  <Input
                    value={currentKeyword}
                    onChange={e => setCurrentKeyword(e.target.value)}
                    onKeyDown={handleAddKeyword}
                    placeholder="Es. Web Design, SEO, Marketing..."
                  />
                  <Button type="button" onClick={handleAddKeyword} variant="secondary">Aggiungi</Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {briefData.keywords.length === 0 && (
                    <span className="text-sm text-muted-foreground italic">Nessuna keyword.</span>
                  )}
                  {briefData.keywords.map(kw => (
                    <span key={kw} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                      <Tag className="h-3 w-3" /> {kw}
                      <X className="h-4 w-4 ml-1 cursor-pointer hover:text-destructive" onClick={() => removeKeyword(kw)} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
                </Button>
                <Button onClick={() => setStep(4)} disabled={!briefData.companyName || !briefData.toneOfVoice}>
                  Avanti <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4 — Brief Aggiuntivo */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-4">
                <Label className="text-lg">Materiale Aggiuntivo (Opzionale ma consigliato)</Label>
                <p className="text-sm text-muted-foreground">
                  Incolla storia dell'azienda, testi attuali, appunti, nomi del team, obiezioni comuni dei clienti.
                  L'AI userà tutto questo come contesto primario per scrivere in modo autentico.
                </p>
                <Textarea
                  name="additionalInfo"
                  value={briefData.additionalInfo}
                  onChange={handleInputChange}
                  className="min-h-[250px] resize-y"
                  placeholder="Incolla qui tutto il materiale grezzo. Pensa l'AI a mettere in ordine..."
                />
              </div>

              {/* Riepilogo con anteprima tema */}
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 border">
                <p className="font-semibold mb-2">📋 Riepilogo generazione</p>
                {activeThemeObj?.previewImage && (
                  <div className="relative h-24 w-full rounded-md overflow-hidden mb-3">
                    <Image
                      src={activeThemeObj.previewImage}
                      alt={activeThemeObj.name}
                      fill
                      className="object-cover object-top"
                      sizes="400px"
                    />
                  </div>
                )}
                <p><strong>Tema:</strong> {activeThemeObj?.name}</p>
                <p><strong>Azienda:</strong> {briefData.companyName}</p>
                <p><strong>Pagine ({briefData.pages.length}):</strong> {briefData.pages.join(', ')}</p>
                <p><strong>Obiettivi:</strong> {briefData.goals.join(', ')}</p>
                <p><strong>Tono:</strong> {briefData.toneOfVoice}</p>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
                </Button>
                <Button onClick={generateSite} size="lg" className="font-bold">
                  <Wand2 className="mr-2 h-5 w-5" /> Inizia Magia AI
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5 — Loading */}
          {step === 5 && (
            <div className="py-24 flex flex-col items-center justify-center space-y-6">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Il Copywriter AI è al lavoro...</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Stiamo scrivendo {briefData.pages.length} {briefData.pages.length === 1 ? 'pagina' : 'pagine'} per il tema{' '}
                  {activeThemeObj?.name}: {briefData.pages.join(', ')}.
                </p>
              </div>
            </div>
          )}

          {/* STEP 6 — Token risultato */}
          {step === 6 && (
            <div className="py-12 flex flex-col items-center text-center space-y-6">
              <CheckCircle2 className="h-20 w-20 text-emerald-500" />
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Sito Pronto per l'Installazione!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {briefData.pages.length} {briefData.pages.length === 1 ? 'pagina generata' : 'pagine generate'}.
                  Copia il token, incollalo nel plugin DoFlow Studio su WordPress e clicca "Genera Sito".
                </p>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 border rounded-lg w-full max-w-lg">
                <code className="flex-1 text-sm text-left px-2 truncate select-all">{exportToken}</code>
                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(exportToken || '')} className="shrink-0">
                  <Copy className="mr-2 h-4 w-4" /> Copia
                </Button>
              </div>
              <div className="flex gap-4 mt-4">
                <Button variant="outline" onClick={() => setViewMode('history')}>Vedi Storico</Button>
                <Button onClick={resetWizard}>Crea nuovo sito</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
