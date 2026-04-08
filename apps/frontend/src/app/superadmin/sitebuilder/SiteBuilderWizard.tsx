"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Copy, ArrowRight, ArrowLeft, Wand2, History, Trash2, PlusCircle, AlertTriangle } from "lucide-react";

// --- TIPI ---
interface BriefData {
  companyName: string;
  problemSolved: string;
  services: string;
}

interface SavedSite {
  id: string;
  companyName: string;
  theme: string;
  token: string;
  date: string;
}

export default function SiteBuilderWizard() {
  // Stati del Wizard
  const [step, setStep] = useState<number>(1);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [briefData, setBriefData] = useState<BriefData>({ companyName: '', problemSolved: '', services: '' });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stati dello Storico
  const [viewMode, setViewMode] = useState<'wizard' | 'history'>('wizard');
  const [history, setHistory] = useState<SavedSite[]>([]);

  // Carica lo storico al mount
  useEffect(() => {
    const saved = localStorage.getItem('neuro_generated_sites');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setBriefData({ ...briefData, [e.target.name]: e.target.value });
  };

  const saveToHistory = (token: string, company: string, theme: string) => {
    const newSite: SavedSite = {
      id: crypto.randomUUID(),
      companyName: company,
      theme: theme,
      token: token,
      date: new Date().toLocaleString('it-IT')
    };
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
    alert("Token copiato negli appunti!"); // Sostituibile con un Toast di shadcn
  };

  // Funzione con Polling per BullMQ
  const generateSite = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setStep(3);
    
    try {
      // 1. Invia il lavoro alla coda
      const response = await axios.post('/api/sitebuilder/generate', {
        themeId: selectedTheme,
        ...briefData
      });
      
      const jobId = response.data.jobId;

      // 2. Inizia il Polling per controllare lo stato
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/sitebuilder/status/${jobId}`);
          const { status, token } = statusRes.data;

          if (status === 'completed') {
            clearInterval(pollInterval);
            setExportToken(token);
            saveToHistory(token, briefData.companyName, selectedTheme || 'Sconosciuto');
            setStep(4);
            setIsLoading(false);
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            setErrorMsg("L'Intelligenza Artificiale ha riscontrato un errore (probabile timeout o configurazione API). Riprova.");
            setStep(2);
            setIsLoading(false);
          }
          // Se status è 'waiting' o 'active', continua a ciclare...
        } catch (pollError) {
          clearInterval(pollInterval);
          setErrorMsg("Errore di connessione durante l'attesa del risultato.");
          setStep(2);
          setIsLoading(false);
        }
      }, 3000); // Controlla ogni 3 secondi

    } catch (error) {
      console.error("Errore di avvio generazione", error);
      setErrorMsg("Impossibile contattare il server per avviare la generazione.");
      setStep(2);
      setIsLoading(false);
    }
  };

  // --- RENDER STORICO ---
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
                <p>Nessun sito generato finora.</p>
              </div>
            ) : (
              <div className="divide-y">
                {history.map((site) => (
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

  // --- RENDER WIZARD ---
  return (
    <div className="min-h-screen bg-muted/40 p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-end mb-4">
        <Button onClick={() => setViewMode('history')} variant="ghost" className="text-muted-foreground">
          <History className="mr-2 h-4 w-4" /> Vedi Storico
        </Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg border-muted">
        <CardHeader className="border-b bg-card">
          <CardTitle className="text-3xl text-primary">Generatore Siti AI</CardTitle>
          <CardDescription className="text-base">
            Step {step} di 4 — {
              step === 1 ? "Selezione Architettura" : 
              step === 2 ? "Briefing Cliente" : 
              step === 3 ? "Generazione in corso" : "Completato"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8">
          
          {/* Mostra Errori */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex items-center gap-3 animate-in fade-in">
              <AlertTriangle className="h-5 w-5" />
              <p>{errorMsg}</p>
            </div>
          )}

          {/* STEP 1: Selezione Tema */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card 
                  className={`cursor-pointer transition-all hover:border-primary/50 ${selectedTheme === 'neuro-agency-01' ? 'border-primary ring-2 ring-primary/20' : ''}`}
                  onClick={() => setSelectedTheme('neuro-agency-01')}
                >
                  <div className="h-40 bg-muted rounded-t-xl flex items-center justify-center border-b">
                    <span className="text-muted-foreground font-medium">Anteprima Immagine</span>
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg">Modern Agency Dark</CardTitle>
                    <CardDescription>Ottimizzato per agenzie di servizi B2B.</CardDescription>
                  </CardHeader>
                </Card>
              </div>
              <div className="flex justify-end pt-4">
                <Button disabled={!selectedTheme} onClick={() => setStep(2)} size="lg">
                  Avanti <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Briefing */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome Azienda</Label>
                  <Input id="companyName" name="companyName" value={briefData.companyName} onChange={handleInputChange} placeholder="Es. Rossi Srl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="problemSolved">Problema del target (Agitation)</Label>
                  <Textarea id="problemSolved" name="problemSolved" value={briefData.problemSolved} onChange={handleInputChange} className="min-h-[100px]" placeholder="Es. Spendono troppo in Ads senza convertire in preventivi qualificati." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="services">Servizi Chiave (separati da virgola)</Label>
                  <Input id="services" name="services" value={briefData.services} onChange={handleInputChange} placeholder="Es. SEO E-E-A-T, Landing Page, CRO" />
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
                </Button>
                <Button onClick={generateSite} disabled={!briefData.companyName || !briefData.services}>
                  <Wand2 className="mr-2 h-4 w-4" /> Genera Neuro-Copy
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Caricamento */}
          {step === 3 && (
            <div className="py-24 flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in-95">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Generazione in corso...</h2>
                <p className="text-muted-foreground">BullMQ sta interrogando Google Gemini. Attendi qualche secondo...</p>
              </div>
            </div>
          )}

          {/* STEP 4: Risultato & Token */}
          {step === 4 && (
            <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95">
              <CheckCircle2 className="h-20 w-20 text-emerald-500" />
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Sito Generato con Successo!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Il tuo Neuro-Copy è stato salvato nello storico. Copia il token qui sotto e incollalo nel plugin su WordPress.
                </p>
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 border rounded-lg w-full max-w-lg">
                <code className="flex-1 text-sm text-left px-2 truncate select-all">{exportToken}</code>
                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(exportToken || '')} className="shrink-0">
                  <Copy className="mr-2 h-4 w-4" /> Copia
                </Button>
              </div>
              
              <div className="flex gap-4 mt-4">
                <Button variant="outline" onClick={() => setViewMode('history')}>
                  Vedi Storico
                </Button>
                <Button onClick={() => { setStep(1); setBriefData({ companyName: '', problemSolved: '', services: '' }); setExportToken(null); }}>
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