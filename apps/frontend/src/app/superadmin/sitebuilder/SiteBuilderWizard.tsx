"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, History, Loader2, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { GOAL_OPTIONS, SITE_PRESETS, TONE_OPTIONS } from '@/types/site-brief';
import type { SiteBrief, SiteGenerationStatusResponse, SiteManifest, SiteKind } from '@/types/site-manifest';
import type { SitePresetSummary } from '@/types/site-brief';

interface SavedSite {
  id: string;
  companyName: string;
  siteKind: SiteKind;
  presetLabel: string;
  token: string;
  manifest?: SiteManifest | null;
  date: string;
}

const DEFAULT_BRIEF: SiteBrief = {
  companyName: '',
  siteKind: 'agency',
  industry: '',
  targetAudience: '',
  goals: [],
  usp: '',
  toneOfVoice: '',
  keywords: [],
  pages: ['home'],
  additionalInfo: '',
  locale: 'it-IT',
  language: 'it',
  brand: {
    primaryColor: '#5344F4',
    secondaryColor: '#111827',
    accentColor: '#22D3EE',
  },
};

const SITE_KIND_LABELS: Record<SiteKind, string> = {
  agency: 'Agency',
  startup: 'Startup',
  studio: 'Studio',
  'local-business': 'Local Business',
  ecommerce: 'Ecommerce',
};

function clampPages(pages: string[], required: string[] = ['home']) {
  const merged = Array.from(new Set([...required, ...pages]));
  return merged;
}


export default function SiteBuilderWizard() {
  const [step, setStep] = useState(1);
  const [viewMode, setViewMode] = useState<'wizard' | 'history'>('wizard');
  const [brief, setBrief] = useState<SiteBrief>(DEFAULT_BRIEF);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>(DEFAULT_BRIEF.pages ?? ['home']);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [manifest, setManifest] = useState<SiteManifest | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedSite[]>([]);

  const selectedPreset = useMemo(
    () => SITE_PRESETS.find((preset) => preset.id === brief.siteKind) ?? SITE_PRESETS[0],
    [brief.siteKind],
  );

  const availablePages = useMemo(() => selectedPreset.defaultPages, [selectedPreset]);

  useEffect(() => {
    const saved = localStorage.getItem('doflow_generated_sites_v2');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        localStorage.removeItem('doflow_generated_sites_v2');
      }
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/sitebuilder/status/${jobId}`);
        const data = (await res.json()) as SiteGenerationStatusResponse;

        if (cancelled) return;

        if (data.status === 'completed') {
          window.clearInterval(interval);
          setToken(data.token ?? null);
          setManifest(data.manifest ?? null);
          setIsGenerating(false);
          setStep(5);

          const record: SavedSite = {
            id: crypto.randomUUID(),
            companyName: brief.companyName,
            siteKind: brief.siteKind,
            presetLabel: selectedPreset.label,
            token: data.token ?? '',
            manifest: data.manifest ?? null,
            date: new Date().toLocaleString('it-IT'),
          };

          setHistory((prev) => {
            const updated = [record, ...prev].slice(0, 20);
            localStorage.setItem('doflow_generated_sites_v2', JSON.stringify(updated));
            return updated;
          });
        } else if (data.status === 'failed') {
          window.clearInterval(interval);
          setErrorMsg('La generazione è fallita. Controlla i dati e riprova.');
          setIsGenerating(false);
          setStep(4);
        }
      } catch {
        if (!cancelled) {
          setErrorMsg('Errore durante il polling dello stato.');
          setIsGenerating(false);
          setStep(4);
        }
        window.clearInterval(interval);
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [brief.companyName, brief.siteKind, jobId, selectedPreset.label]);

  useEffect(() => {
    setSelectedPages(selectedPreset.defaultPages);
  }, [selectedPreset.id]);

  const updateBrief = <K extends keyof SiteBrief>(key: K, value: SiteBrief[K]) => {
    setBrief((prev) => ({ ...prev, [key]: value }));
  };

  const togglePage = (page: string) => {
    if (page === 'home') return;
    setSelectedPages((prev) => (prev.includes(page) ? prev.filter((item) => item !== page) : [...prev, page]));
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) => (prev.includes(goal) ? prev.filter((item) => item !== goal) : [...prev, goal]));
  };

  const addKeyword = () => {
    const kw = currentKeyword.trim();
    if (!kw) return;
    updateBrief('keywords', Array.from(new Set([...(brief.keywords ?? []), kw])));
    setCurrentKeyword('');
  };

  const removeKeyword = (kw: string) => {
    updateBrief('keywords', (brief.keywords ?? []).filter((item) => item !== kw));
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    localStorage.setItem('doflow_generated_sites_v2', JSON.stringify(updated));
  };

  const selectPreset = (preset: SitePresetSummary) => {
    setBrief((prev) => ({
      ...prev,
      siteKind: preset.id,
      pages: preset.defaultPages,
    }));
    setSelectedPages(preset.defaultPages);
    setSelectedGoals([]);
    setStep(2);
  };

  const generateSite = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setJobId(null);
    setToken(null);
    setManifest(null);
    setStep(4);

    try {
      const payload: SiteBrief = {
        ...brief,
        goals: selectedGoals,
        pages: clampPages(selectedPages),
      };

      const res = await fetch('/api/sitebuilder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Errore nella richiesta di generazione');
      }

      const data = await res.json() as { jobId?: string; status?: string };
      if (!data.jobId) {
        throw new Error('jobId mancante nella risposta');
      }

      setJobId(data.jobId);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Impossibile contattare il server.');
      setIsGenerating(false);
      setStep(3);
    }
  };

  const preset = selectedPreset;

  if (viewMode === 'history') {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/80">DoFlow</p>
            <h1 className="text-3xl font-semibold">Storico generazioni</h1>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('wizard')}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <Sparkles className="h-4 w-4" /> Nuovo sito
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/30">
          {history.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-10 text-center text-white/60">
              <History className="h-12 w-12 opacity-30" />
              <p>Nessun sito generato ancora.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {history.map((site) => (
                <div key={site.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{site.companyName}</h3>
                      <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200">{SITE_KIND_LABELS[site.siteKind]}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/50">Preset: {site.presetLabel} • {site.date}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="max-w-[240px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
                      {site.token ? `${site.token.slice(0, 18)}...` : 'Token non disponibile'}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(site.token)}
                      className="rounded-xl border border-white/10 bg-white/5 p-2 transition hover:bg-white/10"
                      aria-label="Copia token"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteHistoryItem(site.id)}
                      className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-2 text-rose-200 transition hover:bg-rose-500/20"
                      aria-label="Elimina sito dallo storico"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/80">Sitebuilder interno</p>
          <h1 className="text-4xl font-semibold tracking-tight">Brief → Manifest → Publish</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Genera siti SEO-first, veloci, orientati alla conversione e pensati per mobile.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setViewMode('history')}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <History className="h-4 w-4" /> Storico
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/30">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">Step {Math.min(step, 4)} di 4</span>
              <span>{step === 1 ? 'Preset sito' : step === 2 ? 'Pagine e obiettivi' : step === 3 ? 'Brand e contenuti' : 'Generazione'}</span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {errorMsg && (
              <div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-100">
                <p className="flex items-center gap-2 text-sm font-medium"><X className="h-4 w-4" /> {errorMsg}</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold">Scegli la base del sito</h2>
                  <p className="mt-1 text-sm text-white/60">Ogni preset forza strutture più sensate per velocità, SEO e conversione.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {SITE_PRESETS.map((item) => {
                    const active = item.id === brief.siteKind;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectPreset(item)}
                        className={`rounded-3xl border p-5 text-left transition ${active ? 'border-cyan-300/40 bg-cyan-400/10 ring-1 ring-cyan-300/30' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold">{item.label}</h3>
                            <p className="mt-2 text-sm leading-6 text-white/60">{item.description}</p>
                          </div>
                          {active && <CheckCircle2 className="h-6 w-6 shrink-0 text-cyan-300" />}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.focusBullets.map((bullet) => (
                            <span key={bullet} className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/75">{bullet}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:scale-[1.01]"
                  >
                    Avanti <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-7">
                <div>
                  <h2 className="text-2xl font-semibold">Pagine e obiettivi</h2>
                  <p className="mt-1 text-sm text-white/60">Le pagine selezionate influenzano copy, gerarchie e sezioni generate.</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-white/80">Pagine da generare</p>
                  <div className="flex flex-wrap gap-2">
                    {availablePages.map((page) => {
                      const active = selectedPages.includes(page);
                      const locked = page === 'home';
                      return (
                        <button
                          key={page}
                          type="button"
                          disabled={locked}
                          onClick={() => togglePage(page)}
                          className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-black/20 text-white/70 hover:bg-white/5'} ${locked ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-white/50">Home sempre inclusa. Selezionate: {selectedPages.join(', ')}</p>
                </div>

                <div className="space-y-3 border-t border-white/10 pt-6">
                  <p className="text-sm font-medium text-white/80">Obiettivo principale</p>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((goal) => {
                      const active = selectedGoals.includes(goal);
                      return (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => toggleGoal(goal)}
                          className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-black/20 text-white/70 hover:bg-white/5'}`}
                        >
                          {goal}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between border-t border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" /> Indietro
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={selectedGoals.length === 0}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Avanti <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-7">
                <div>
                  <h2 className="text-2xl font-semibold">Brand, copy e SEO base</h2>
                  <p className="mt-1 text-sm text-white/60">Inserisci il materiale che serve a creare un sito credibile e già orientato alla conversione.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome brand" value={brief.companyName} onChange={(value) => updateBrief('companyName', value)} placeholder="Es. Studio Rossi" />
                  <Field label="Settore / industry" value={brief.industry ?? ''} onChange={(value) => updateBrief('industry', value)} placeholder="Es. marketing, legal, clinic" />
                  <Field label="Target audience" value={brief.targetAudience ?? ''} onChange={(value) => updateBrief('targetAudience', value)} placeholder="Es. PMI italiane 10-50 dipendenti" />
                  <Field label="USP" value={brief.usp ?? ''} onChange={(value) => updateBrief('usp', value)} placeholder="Es. siti online in 10 giorni" />
                </div>

                <div className="space-y-3 border-t border-white/10 pt-6">
                  <p className="text-sm font-medium text-white/80">Tone of voice</p>
                  <div className="flex flex-wrap gap-2">
                    {TONE_OPTIONS.map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => updateBrief('toneOfVoice', tone)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${brief.toneOfVoice === tone ? 'border-fuchsia-300/40 bg-fuchsia-400/10 text-fuchsia-100' : 'border-white/10 bg-black/20 text-white/70 hover:bg-white/5'}`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/10 pt-6">
                  <p className="text-sm font-medium text-white/80">Brand colors</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Primary" value={brief.brand?.primaryColor ?? ''} onChange={(value) => updateBrief('brand', { ...brief.brand, primaryColor: value })} placeholder="#5344F4" />
                    <Field label="Secondary" value={brief.brand?.secondaryColor ?? ''} onChange={(value) => updateBrief('brand', { ...brief.brand, secondaryColor: value })} placeholder="#111827" />
                    <Field label="Accent" value={brief.brand?.accentColor ?? ''} onChange={(value) => updateBrief('brand', { ...brief.brand, accentColor: value })} placeholder="#22D3EE" />
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white/80">Keyword e servizi</p>
                    <span className="text-xs text-white/50">Invio per aggiungere</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={currentKeyword}
                      onChange={(e) => setCurrentKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addKeyword();
                        }
                      }}
                      placeholder="Es. SEO, branding, conversione"
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/40"
                    />
                    <button
                      type="button"
                      onClick={addKeyword}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
                    >
                      Aggiungi
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(brief.keywords ?? []).length === 0 ? (
                      <span className="text-sm text-white/45">Nessuna keyword ancora.</span>
                    ) : (
                      (brief.keywords ?? []).map((kw) => (
                        <span key={kw} className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-sm text-white/80">
                          {kw}
                          <button type="button" onClick={() => removeKeyword(kw)} aria-label={`Rimuovi ${kw}`}>
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/10 pt-6">
                  <p className="text-sm font-medium text-white/80">Note aggiuntive</p>
                  <textarea
                    value={brief.additionalInfo ?? ''}
                    onChange={(e) => updateBrief('additionalInfo', e.target.value)}
                    placeholder="Brief grezzo, obiezioni, riferimenti, vincoli, note su SEO o styling..."
                    className="min-h-44 w-full rounded-3xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/40"
                  />
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="grid gap-3 text-sm text-white/70 md:grid-cols-2">
                    <p><span className="text-white/40">Preset:</span> {preset.label}</p>
                    <p><span className="text-white/40">Pagine:</span> {selectedPages.join(', ')}</p>
                    <p><span className="text-white/40">Goal:</span> {selectedGoals.join(', ') || 'non selezionato'}</p>
                    <p><span className="text-white/40">Target:</span> {brief.targetAudience || 'non specificato'}</p>
                  </div>
                </div>

                <div className="flex justify-between border-t border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" /> Indietro
                  </button>
                  <button
                    type="button"
                    onClick={generateSite}
                    disabled={!brief.companyName || !brief.toneOfVoice || selectedGoals.length === 0 || isGenerating}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wand2 className="h-4 w-4" /> Genera sito
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex min-h-[340px] flex-col items-center justify-center gap-6 py-10 text-center">
                <Loader2 className="h-14 w-14 animate-spin text-cyan-300" />
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Il motore sta scrivendo il manifest</h2>
                  <p className="max-w-xl text-sm text-white/60">
                    Stiamo creando la struttura, il copy e l’output pronto per WordPress. Niente fumo, solo blocchi e ordine.
                  </p>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6 py-4 text-center">
                <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-400" />
                <div>
                  <h2 className="text-3xl font-semibold">Sito pronto</h2>
                  <p className="mt-2 text-sm text-white/60">Copia il token e importalo nel plugin WordPress per pubblicare il sito.</p>
                </div>

                <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 text-left">
                  <code className="min-w-0 flex-1 truncate px-3 py-2 text-sm text-white/75">{token ?? 'token non disponibile'}</code>
                  <button
                    type="button"
                    onClick={() => token && copyToClipboard(token)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950"
                  >
                    <Copy className="h-4 w-4" /> Copia
                  </button>
                </div>

                {manifest && (
                  <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-5 text-left text-sm text-white/70">
                    <p className="font-semibold text-white">Manifest summary</p>
                    <p className="mt-2"><span className="text-white/45">Site kind:</span> {manifest.siteKind}</p>
                    <p><span className="text-white/45">Style:</span> {manifest.styleVariation}</p>
                    <p><span className="text-white/45">Pages:</span> {manifest.pages.length}</p>
                    <p><span className="text-white/45">Export ID:</span> {manifest.exportId}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button type="button" onClick={() => setViewMode('history')} className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10">Vedi storico</button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setBrief(DEFAULT_BRIEF);
                      setSelectedGoals([]);
                      setSelectedPages(['home']);
                      setCurrentKeyword('');
                      setJobId(null);
                      setToken(null);
                      setManifest(null);
                      setErrorMsg(null);
                    }}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950"
                  >
                    Nuovo sito
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-white/45">Preset attivo</p>
            <h3 className="mt-2 text-2xl font-semibold">{preset.label}</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">{preset.description}</p>
            <div className="mt-5 space-y-2 text-sm text-white/70">
              <p><span className="text-white/40">SEO hint:</span> {preset.seoHint}</p>
              <p><span className="text-white/40">Legacy theme:</span> {preset.legacyThemeId}</p>
              <p><span className="text-white/40">Style variation:</span> {preset.styleVariation}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.18em] text-white/45">Pilastri</p>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li>SEO ottimizzata</li>
              <li>Velocità estrema</li>
              <li>CRO orientata alla conversione</li>
              <li>Mobile first</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white/80">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/40"
      />
    </label>
  );
}
