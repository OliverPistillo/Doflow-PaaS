"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Copy, ArrowRight, ArrowLeft, Wand2, History, Trash2, PlusCircle, AlertTriangle, X, Tag } from "lucide-react";

// --- TIPI E STRUTTURE DATI ---
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

// I temi ora dichiarano anche quali pagine supportano
const AVAILABLE_THEMES = [
  {
    id: 'doflow-starter',
    name: 'DoFlow Premium (Animato)',
    description: 'Design premium con animazioni GSAP.',
    previewColor: 'bg-indigo-900', 
    availablePages: ['Home', 'Chi Siamo', 'Servizi', 'Casi Studio', 'Contatti', 'FAQ']
  },
  {
    id: 'doflow-minimal',
    name: 'Minimal Clean',
    description: 'Design essenziale, ideale per lifestyle e cliniche.',
    previewColor: 'bg-zinc-100',
    availablePages: ['Home', 'Chi Siamo', 'Trattamenti', 'Galleria', 'Contatti']
  }
];

const GOALS = ['Generazione Lead / Contatti', 'Vendita Diretta (E-commerce)', 'Brand Awareness', 'Portfolio / Vetrina', 'Educativo / Informativo'];
const TONES = ['Professionale & Autorevole', 'Amichevole & Empatico', 'Tecnico & Innovativo', 'Creativo & Audace', 'Lusso & Esclusivo'];

export default function SiteBuilderWizard() {
  const [step, setStep] = useState<number>(1);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  
  // Stato del Brief ultra-strutturato
  const [briefData, setBriefData] = useState<BriefData>({ 
    companyName: '', 
    pages: ['Home'], // La Home è sempre pre-selezionata
    goals: [], 
    targetAudience: '', 
    usp: '', 
    toneOfVoice: '', 
    keywords: [], 
    additionalInfo: '' 
  });

  const [currentKeyword, setCurrentKeyword] = useState('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'wizard' | 'history'>('wizard');
  const [history, setHistory] = useState<SavedSite[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('neuro_generated_sites');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setBriefData({ ...briefData, [e.target.name]: e.target.value });
  };

  const toggleArrayItem = (field: 'pages' | 'goals', item: string) => {
    setBriefData(prev => {
      const array = prev[field];
      if (array.includes(item)) {
        // Non permettiamo di deselezionare la Home
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

  // --- FUNZIONI DI SALVATAGGIO E API ---
  const saveToHistory = (token: string, company: string, theme: string) => {
    const newSite: SavedSite = { id: crypto.randomUUID(), companyName: company, theme: theme, token: token, date: new Date().toLocaleString('it-IT') };
    const updatedHistory = [newSite, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('neuro_generated_sites', JSON.stringify(updatedHistory));
  };

  const deleteFromHistory = (id: string) => {
    const updatedHistory = history.filter(site => site.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('neuro_generated_sites', JSON.stringify(updatedHistory));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Token copiato negli appunti!"); 
  };

  const generateSite = async () => {
    setIsLoading(true); setErrorMsg(null); setStep(5);
    try {
      const response = await axios.post('/api/sitebuilder/generate', { themeId: selectedTheme, ...briefData });
      const jobId = response.data.jobId;

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/sitebuilder/status/${jobId}`);
          const { status, token } = statusRes.data;

          if (status === 'completed') {
            clearInterval(pollInterval);
            setExportToken(token);
            saveToHistory(token, briefData.companyName, AVAILABLE_THEMES.find(t => t.id === selectedTheme)?.name || 'Theme');
            setStep(6); setIsLoading(false);
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            setErrorMsg("L'AI ha riscontrato un errore. Controlla i dati e riprova.");
            setStep(4); setIsLoading(false);
          }
        } catch (pollError) {
          clearInterval(pollInterval); setErrorMsg("Errore di connessione durante l'attesa.");
          setStep(4); setIsLoading(false);
        }
      }, 3000);
    } catch (error) {
      setErrorMsg("Impossibile contattare il server."); setStep(4); setIsLoading(false);
    }
  };

  const activeThemeObj = AVAILABLE_THEMES.find(t => t.id === selectedTheme);

  // --- RENDER STORICO ---
  if (viewMode === 'history') {
    // ... (Mantieni il codice dello storico precedente, non è cambiato)
    return (
      <div className="min-h-screen bg-muted/40 p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Storico Generazioni</h1>
          <Button onClick={() => setViewMode('wizard')} variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Nuova Generazione</Button>
        </div>
        <Card className="w-full max-w-4xl shadow-sm border-muted">
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground"><History className="mx-auto h-12 w-12 mb-4 opacity-20" /><p>Nessun sito generato.</p></div>
            ) : (
              <div className="divide-y">
                {history.map((site) => (
                  <div key={site.id} className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                    <div><h3 className="font-semibold text-lg">{site.companyName}</h3><p className="text-sm text-muted-foreground">Tema: {site.theme} • {site.date}</p></div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <code className="bg-muted px-2 py-1 rounded text-xs truncate w-32 md:w-48 border">{site.token.substring(0, 20)}...</code>
                      <Button variant="secondary" size="sm" onClick={() => copyToClipboard(site.token)}><Copy className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteFromHistory(site.id)}><Trash2 className="h-4 w-4" /></Button>
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

  // --- RENDER WIZARD ---
  return (
    <div className="min-h-screen bg-muted/40 p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-end mb-4">
        <Button onClick={() => setViewMode('history')} variant="ghost" className="text-muted-foreground"><History className="mr-2 h-4 w-4" /> Vedi Storico</Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg border-muted">
        <CardHeader className="border-b bg-card">
          <CardTitle className="text-3xl text-primary">Generatore Siti AI</CardTitle>
          <CardDescription className="text-base">
            Step {step} di 4 — {
              step === 1 ? "Selezione Tema" : 
              step === 2 ? "Architettura & Obiettivi" : 
              step === 3 ? "Identità Brand" : 
              step === 4 ? "Brief Aggiuntivo" : 
              step === 5 ? "Generazione..." : "Finito"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8">
          {errorMsg && (
            <div className="mb-6 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-center gap-3 animate-in fade-in">
              <AlertTriangle className="h-5 w-5" /><p>{errorMsg}</p>
            </div>
          )}

          {/* STEP 1: Selezione Tema */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {AVAILABLE_THEMES.map((theme) => (
                  <Card key={theme.id} className={`cursor-pointer transition-all hover:shadow-md border-2 ${selectedTheme === theme.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'}`} onClick={() => setSelectedTheme(theme.id)}>
                    <div className={`h-32 ${theme.previewColor} rounded-t-lg flex items-center justify-center relative overflow-hidden`}>
                       {selectedTheme === theme.id && <div className="absolute inset-0 bg-black/20 flex items-center justify-center"><CheckCircle2 className="text-white h-10 w-10" /></div>}
                    </div>
                    <CardHeader className="p-4">
                      <CardTitle className="text-xl">{theme.name}</CardTitle>
                      <CardDescription className="text-sm mt-2">{theme.description}</CardDescription>
                      <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
                        <span className="text-xs font-semibold w-full text-muted-foreground">Pagine supportate:</span>
                        {theme.availablePages.map(p => (
                          <span key={p} className="text-xs bg-muted px-2 py-1 rounded-md">{p}</span>
                        ))}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              <div className="flex justify-end pt-4">
                <Button disabled={!selectedTheme} onClick={() => setStep(2)} size="lg">Avanti <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* STEP 2: Architettura & Obiettivi */}
          {step === 2 && activeThemeObj && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              
              <div className="space-y-4">
                <Label className="text-lg">Quali pagine vuoi generare?</Label>
                <p className="text-sm text-muted-foreground">Seleziona le pagine che comporranno il sito. L'AI scriverà testi specifici per ognuna di esse.</p>
                <div className="flex flex-wrap gap-3">
                  {activeThemeObj.availablePages.map(page => {
                    const isSelected = briefData.pages.includes(page);
                    const isHome = page === 'Home';
                    return (
                      <Button 
                        key={page} 
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className={isSelected ? "ring-2 ring-primary/20" : ""}
                        onClick={() => toggleArrayItem('pages', page)}
                        disabled={isHome} // La Home non si può deselezionare
                      >
                        {isSelected && <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {page}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <Label className="text-lg">Qual è l'obiettivo principale del sito?</Label>
                <p className="text-sm text-muted-foreground">Puoi selezionare più di un obiettivo. Aiuterà l'AI a posizionare le Call to Action (CTA).</p>
                <div className="flex flex-wrap gap-3">
                  {GOALS.map(goal => {
                    const isSelected = briefData.goals.includes(goal);
                    return (
                      <Button 
                        key={goal} 
                        type="button"
                        variant={isSelected ? "default" : "outline"}
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
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> Indietro</Button>
                <Button onClick={() => setStep(3)} disabled={briefData.pages.length === 0 || briefData.goals.length === 0}>Avanti <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* STEP 3: Identità Brand & Keywords */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nome Azienda / Brand</Label>
                  <Input name="companyName" value={briefData.companyName} onChange={handleInputChange} placeholder="Es. Neuro Agency" />
                </div>
                <div className="space-y-2">
                  <Label>Target Audience (A chi ti rivolgi?)</Label>
                  <Input name="targetAudience" value={briefData.targetAudience} onChange={handleInputChange} placeholder="Es. Imprenditori B2B tra i 30 e i 50 anni" />
                </div>
              </div>

              <div className="space-y-2 border-t pt-6">
                <Label>Unique Selling Proposition (USP)</Label>
                <p className="text-sm text-muted-foreground">Cosa ti rende unico rispetto alla concorrenza? Qual è il tuo punto di forza?</p>
                <Input name="usp" value={briefData.usp} onChange={handleInputChange} placeholder="Es. Consegniamo il sito in 7 giorni invece di 3 mesi, con garanzia di conversione." />
              </div>

              <div className="space-y-4 border-t pt-6">
                <Label>Tono di Voce</Label>
                <div className="flex flex-wrap gap-3">
                  {TONES.map(tone => (
                    <Button 
                      key={tone} type="button"
                      variant={briefData.toneOfVoice === tone ? "default" : "outline"}
                      onClick={() => setBriefData({...briefData, toneOfVoice: tone})}
                    >
                      {tone}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t pt-6">
                <Label>Keywords e Servizi (Premi Invio per aggiungere)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={currentKeyword} 
                    onChange={e => setCurrentKeyword(e.target.value)}
                    onKeyDown={handleAddKeyword}
                    placeholder="Es. Realizzazione Siti Web, SEO, Marketing Automation..." 
                  />
                  <Button type="button" onClick={handleAddKeyword} variant="secondary">Aggiungi</Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {briefData.keywords.length === 0 && <span className="text-sm text-muted-foreground italic">Nessuna keyword inserita.</span>}
                  {briefData.keywords.map(kw => (
                    <span key={kw} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                      <Tag className="h-3 w-3" /> {kw}
                      <X className="h-4 w-4 ml-1 cursor-pointer hover:text-destructive" onClick={() => removeKeyword(kw)} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" /> Indietro</Button>
                <Button onClick={() => setStep(4)} disabled={!briefData.companyName || !briefData.toneOfVoice}>Avanti <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* STEP 4: Brief Aggiuntivo e Avvio */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-4">
                <Label className="text-lg">Informazioni Aggiuntive Libere (Opzionale ma Consigliato)</Label>
                <p className="text-sm text-muted-foreground">Usa questo spazio per incollare la storia dell'azienda, i testi attuali del sito, appunti sparsi, nomi del team, o obiezioni comuni dei clienti che vuoi smontare. L'AI userà queste info come contesto primario.</p>
                <Textarea 
                  name="additionalInfo" 
                  value={briefData.additionalInfo} 
                  onChange={handleInputChange} 
                  className="min-h-[250px] resize-y" 
                  placeholder="Incolla qui tutto il materiale grezzo. Pensa l'AI a mettere in ordine e scrivere in ottica CRO..." 
                />
              </div>
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="mr-2 h-4 w-4" /> Indietro</Button>
                <Button onClick={generateSite} size="lg" className="font-bold">
                  <Wand2 className="mr-2 h-5 w-5" /> Inizia Magia AI
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: Caricamento */}
          {step === 5 && (
            <div className="py-24 flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in-95">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Il Copywriter AI è al lavoro...</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Stiamo analizzando le tue keywords, studiando il target e scrivendo {briefData.pages.length} pagine complete per il tema {activeThemeObj?.name}.
                </p>
              </div>
            </div>
          )}

          {/* STEP 6: Risultato & Token */}
          {step === 6 && (
            <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95">
              <CheckCircle2 className="h-20 w-20 text-emerald-500" />
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Sito Pronto per l'Installazione!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  I testi per le tue {briefData.pages.length} pagine sono stati generati. Copia il token qui sotto, incollalo nel plugin su WordPress e clicca "Installa".
                </p>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 border rounded-lg w-full max-w-lg">
                <code className="flex-1 text-sm text-left px-2 truncate select-all">{exportToken}</code>
                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(exportToken || '')} className="shrink-0"><Copy className="mr-2 h-4 w-4" /> Copia</Button>
              </div>
              <div className="flex gap-4 mt-4">
                <Button variant="outline" onClick={() => setViewMode('history')}>Vedi Storico</Button>
                <Button onClick={() => { setStep(1); setBriefData({ companyName: '', pages: ['Home'], goals: [], targetAudience: '', usp: '', toneOfVoice: '', keywords: [], additionalInfo: '' }); setExportToken(null); setCurrentKeyword(''); }}>
                  Crea nuovo sito
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}