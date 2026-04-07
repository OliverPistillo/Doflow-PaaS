// apps/frontend/src/app/superadmin/sitebuilder/SiteBuilderWizard.tsx
"use client";

import React, { useState } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, Copy, ArrowRight, ArrowLeft, Wand2 } from "lucide-react";

// --- TIPI ---
interface BriefData {
  companyName: string;
  problemSolved: string;
  services: string;
}

export default function SiteBuilderWizard() {
  const [step, setStep] = useState<number>(1);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [briefData, setBriefData] = useState<BriefData>({ companyName: '', problemSolved: '', services: '' });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exportToken, setExportToken] = useState<string | null>(null);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setBriefData({ ...briefData, [e.target.name]: e.target.value });
  };

  const generateSite = async () => {
    setIsLoading(true);
    setStep(3);
    
    try {
      const response = await axios.post('/api/sitebuilder/generate', {
        themeId: selectedTheme,
        ...briefData
      });
      
      setExportToken(response.data.token);
      setStep(4);
    } catch (error) {
      console.error("Errore durante la generazione", error);
      alert("Si è verificato un errore con l'AI.");
      setStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (exportToken) {
      navigator.clipboard.writeText(exportToken);
      // Qui potresti usare un toast di shadcn per notificare "Copiato!"
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 p-8 flex items-start justify-center">
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

          {/* STEP 2: Briefing Dati CRM */}
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
                <p className="text-muted-foreground">L'Intelligenza Artificiale sta assemblando i blocchi e applicando i bias cognitivi.</p>
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
                  Il tuo Neuro-Copy è pronto. Copia il token di esportazione qui sotto e incollalo nel plugin proprietario su WordPress per importare la pagina.
                </p>
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-muted/50 border rounded-lg w-full max-w-lg">
                <code className="flex-1 text-sm text-left px-2 truncate select-all">{exportToken}</code>
                <Button variant="secondary" size="sm" onClick={copyToClipboard} className="shrink-0">
                  <Copy className="mr-2 h-4 w-4" /> Copia
                </Button>
              </div>
              
              <Button variant="link" onClick={() => { setStep(1); setBriefData({ companyName: '', problemSolved: '', services: '' }); setExportToken(null); }} className="mt-4">
                Crea un nuovo sito
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}