'use client';
import React, { useState, useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Layers, Palette, Monitor, Tablet, Smartphone, Undo2, Redo2, Plus, Settings, Sparkles,
  ChevronRight, GripVertical, Eye, Lock, Copy, Trash2, Type, Image, Link2, Box, Component,
  Globe, Building2, FileText, Zap, Loader2, CheckCircle2, Search, Edit3, PanelLeftClose,
  ArrowLeft, Check, AlertCircle, FolderOpen, LayoutTemplate, Move, MousePointerClick, Key,
  ClipboardCheck, X, ChevronUp, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

// ════════════════════════════════════════════════════════════════════════════
//  IMPORTS NUOVI COMPONENTI & TYPES
// ════════════════════════════════════════════════════════════════════════════
import {
  StylePanel, LayerTree, Canvas, ResponsiveToolbar, ComponentLibrary
} from '@/components/editor';
import { useMergedStyles } from '@/lib/style-utils';
import {
  Brick, BrickStyles, SitePage, DesignTokens, BreakpointKey,
  DEFAULT_BREAKPOINTS, ComponentDefinition, WpData
} from '@/types/sitebuilder';

// ════════════════════════════════════════════════════════════════════════════
//  TYPES & CONSTANTS
// ════════════════════════════════════════════════════════════════════════════
type Device = BreakpointKey; // Alias per compatibilità UI

// Interfaccia per il form del wizard (usa primaryColor)
interface DesignSchemeDto {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  headingFont?: string;
}

interface WizardForm {
  tenantId: string;
  siteDomain: string;
  siteTitle: string;
  adminEmail: string;
  businessType: string;
  businessDescription: string;
  starterSite: string;
  designScheme: DesignSchemeDto; // Changed type here
  contentTopics: string[];
  locale: string;
  xmlBlocks?: { strategy?: Record<string, string>; pages: SitePage[] } | null;
}

interface SitebuilderJob {
  id: string;
  status: string;
  siteDomain: string;
  siteTitle: string;
  logs: string[];
  importToken?: string;
  createdAt: string;
  wpData?: WpData | null;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const getApiBaseUrl = () =>
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.doflow.it/api';

// ════════════════════════════════════════════════════════════════════════════
//  EDITOR STATE & REDUCER
// ════════════════════════════════════════════════════════════════════════════
interface EditorState {
  pages: SitePage[];
  pageIndex: number;
  selectedId: string | null;
  editingId: string | null;
  device: Device;
  leftPanel: 'layers' | 'components' | 'pages';
  rightPanel: 'styles' | 'settings' | 'seo' | 'none';
  designTokens: DesignTokens;
  zoom: number;
  showGuides: boolean;
  past: SitePage[][];
  future: SitePage[][];
}

type EditorAction =
  | { type: 'SELECT'; id: string | null }
  | { type: 'SET_EDITING'; id: string | null }
  | { type: 'UPDATE_BRICK'; id: string; patch: Partial<Brick> }
  | { type: 'UPDATE_STYLES'; id: string; styles: Partial<BrickStyles> }
  | { type: 'ADD_BRICK'; brickType: string; afterId?: string }
  | { type: 'DELETE_BRICK'; id: string }
  | { type: 'DUPLICATE_BRICK'; id: string }
  | { type: 'REORDER'; from: number; to: number } // Expects INDICES
  | { type: 'SET_PAGE'; index: number }
  | { type: 'SET_BREAKPOINT'; device: Device }
  | { type: 'SET_LEFT_PANEL'; panel: 'layers' | 'components' | 'pages' }
  | { type: 'SET_RIGHT_PANEL'; panel: 'styles' | 'settings' | 'seo' | 'none' }
  | { type: 'UPDATE_TOKENS'; tokens: Partial<DesignTokens> }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'TOGGLE_GUIDES' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function pushHistory(past: SitePage[][], pages: SitePage[]): SitePage[][] {
  const next = [...past, pages];
  return next.length > 50 ? next.slice(-50) : next;
}

function mutatePages(state: EditorState, fn: (bricks: Brick[]) => Brick[]): EditorState {
  const pages = state.pages.map((p, i) =>
    i === state.pageIndex ? { ...p, bricks: fn(p.bricks) } : p
  );
  return { ...state, pages, past: pushHistory(state.past, state.pages), future: [] };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SELECT': return { ...state, selectedId: action.id, editingId: null };
    case 'SET_EDITING': return { ...state, editingId: action.id };
    
    case 'UPDATE_BRICK':
      return mutatePages(state, (bricks) =>
        bricks.map((b: Brick) => b.id === action.id ? { ...b, ...action.patch } : b)
      );
      
    case 'UPDATE_STYLES': {
      return mutatePages(state, (bricks) =>
        bricks.map((b: Brick) => b.id === action.id ? { ...b, styles: { ...b.styles, ...action.styles } } : b)
      );
    }

    case 'ADD_BRICK': {
      const def = BLOCK_CATALOG[action.brickType];
      if (!def) return state;
      const newBrick: Brick = { id: uid(), type: action.brickType, ...def.defaultProps };
      return mutatePages(state, (bricks) => {
        if (!action.afterId) return [...bricks, newBrick];
        const idx = bricks.findIndex((b: Brick) => b.id === action.afterId);
        const next = [...bricks];
        next.splice(idx + 1, 0, newBrick);
        return next;
      });
    }

    case 'DELETE_BRICK':
      return {
        ...mutatePages(state,  (bricks) => bricks.filter((b: Brick) => b.id !== action.id)),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case 'DUPLICATE_BRICK':
      return mutatePages(state, (bricks) => {
        const idx = bricks.findIndex((b: Brick) => b.id === action.id);
        if (idx < 0) return bricks;
        const dup = { ...bricks[idx], id: uid(), label: `${bricks[idx].label || bricks[idx].type} (Copy)` };
        return [...bricks.slice(0, idx + 1), dup, ...bricks.slice(idx + 1)];
      });

    case 'REORDER':
      return mutatePages(state, (bricks) => {
        const next = [...bricks];
        // action.from e action.to sono ora garantiti essere numeri (indici)
        const [moved] = next.splice(action.from, 1);
        next.splice(action.to, 0, moved);
        return next;
      });

    case 'SET_PAGE': return { ...state, pageIndex: action.index, selectedId: null, editingId: null };
    case 'SET_BREAKPOINT': return { ...state, device: action.device };
    case 'SET_LEFT_PANEL': return { ...state, leftPanel: action.panel };
    case 'SET_RIGHT_PANEL': return { ...state, rightPanel: action.panel };
    case 'UPDATE_TOKENS': return { ...state, designTokens: { ...state.designTokens, ...action.tokens } };
    case 'SET_ZOOM': return { ...state, zoom: action.zoom };
    case 'TOGGLE_GUIDES': return { ...state, showGuides: !state.showGuides };

    case 'UNDO': {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { ...state, pages: prev, past: state.past.slice(0, -1), future: [state.pages, ...state.future] };
    }
    case 'REDO': {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { ...state, pages: next, past: [...state.past, state.pages], future: rest };
    }

    default: return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  BLOCK CATALOG (Compatibilità con renderers esistenti)
// ════════════════════════════════════════════════════════════════════════════
type FieldType = 'text' | 'richtext' | 'url' | 'image' | 'select' | 'items' | 'color';
interface FieldDef { key: string; label: string; type: FieldType; placeholder?: string; }
interface BlockDef { label: string; icon: string; description: string; fields: FieldDef[]; defaultProps: Partial<Brick>; }

const BLOCK_CATALOG: Record<string, BlockDef> = {
  hero: {
    label: 'Hero', icon: '🎯', description: 'Sezione principale con CTA',
    fields: [{ key: 'headline', label: 'Titolo (H1)', type: 'text' }, { key: 'subheadline', label: 'Sottotitolo', type: 'text' }, { key: 'cta_text', label: 'Testo CTA', type: 'text' }, { key: 'cta_url', label: 'URL CTA', type: 'url' }, { key: 'imageUrl', label: 'Immagine', type: 'image' }],
    defaultProps: { headline: 'Benvenuti nel tuo sito', subheadline: 'La tua proposta di valore unica', cta_text: 'Scopri di più', cta_url: '#contatti', bgColor: '#0f172a' },
  },
  features: {
    label: 'Features', icon: '⭐', description: 'Griglia vantaggi',
    fields: [{ key: 'headline', label: 'Titolo', type: 'text' }, { key: 'items', label: 'Voci', type: 'items' }],
    defaultProps: { headline: 'Perché sceglierci', items: [{ title: 'Qualità', description: 'Materiali premium e cura dei dettagli.' }, { title: 'Supporto', description: 'Assistenza dedicata 24/7.' }] },
  },
  about: { label: 'Chi Siamo', icon: '🏢', description: 'Storytelling aziendale', fields: [{ key: 'headline', label: 'Titolo', type: 'text' }, { key: 'body', label: 'Testo', type: 'richtext' }], defaultProps: { headline: 'La nostra storia', body: 'Fondata nel 2010, la nostra azienda...' } },
  contact: { label: 'Contatti', icon: '📧', description: 'Form di contatto', fields: [{ key: 'headline', label: 'Titolo', type: 'text' }], defaultProps: { headline: 'Contattaci' } },
  cta: { label: 'Call to Action', icon: '🚀', description: 'Sezione CTA', fields: [{ key: 'headline', label: 'Titolo', type: 'text' }, { key: 'cta_text', label: 'Bottone', type: 'text' }], defaultProps: { headline: 'Pronto a iniziare?', cta_text: 'Inizia ora', cta_url: '#contatti', bgColor: '#1e40af' } },
};

// ════════════════════════════════════════════════════════════════════════════
//  BLOCK RENDERERS (Adattati per supportare Design Tokens & Styles)
// ════════════════════════════════════════════════════════════════════════════
interface BlockRendererProps {
  brick: Brick;
  designTokens: DesignTokens;
  selected: boolean;
  editing: boolean;
  onUpdate: (patch: Partial<Brick>) => void;
}

function EditableText({ value, onChange, as: Tag = 'p', editing, placeholder, className }: any) {
  return (
    <Tag
      contentEditable={editing}
      suppressContentEditableWarning
      onBlur={(e: any) => onChange?.(e.currentTarget.textContent)}
      className={cn('outline-none', editing && 'ring-2 ring-blue-400 ring-offset-2 rounded px-1', !value && editing && 'text-gray-400', className)}
      data-placeholder={placeholder}
    >
      {value || (editing ? '' : placeholder)}
    </Tag>
  );
}

function HeroRenderer({ brick, designTokens, editing, onUpdate }: BlockRendererProps) {
  const bg = brick.bgColor || designTokens.colorBackground;
  return (
    <section className="relative py-20 px-6 text-center overflow-hidden" style={{ backgroundColor: bg, color: designTokens.colorText }}>
      <EditableText as="h1" value={brick.headline} onChange={(v: string) => onUpdate({ headline: v })} editing={editing} placeholder="Titolo principale" className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: designTokens.fontHeading }} />
      <EditableText as="h2" value={brick.subheadline} onChange={(v: string) => onUpdate({ subheadline: v })} editing={editing} placeholder="Sottotitolo" className="text-xl opacity-80 mb-8" />
      {brick.cta_text && (
        <button className="px-6 py-3 rounded-lg font-semibold text-white shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: designTokens.colorPrimary }}>
          {brick.cta_text}
        </button>
      )}
    </section>
  );
}

function FeaturesRenderer({ brick, designTokens, editing, onUpdate }: BlockRendererProps) {
  return (
    <section className="py-16 px-6">
      <EditableText as="h2" value={brick.headline} onChange={(v: string) => onUpdate({ headline: v })} editing={editing} placeholder="Titolo sezione" className="text-3xl font-bold text-center mb-12" style={{ fontFamily: designTokens.fontHeading }} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {(brick.items || []).map((item, i) => (
          <div key={i} className="p-6 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center text-white font-bold" style={{ backgroundColor: designTokens.colorPrimary }}>{i + 1}</div>
            <h3 className="font-semibold text-lg mb-2" style={{ fontFamily: designTokens.fontHeading }}>{item.title}</h3>
            <p className="text-gray-600">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Wrapper generico per renderer
function BlockRendererWrapper({ brick, designTokens, selected, editing, onUpdate }: BlockRendererProps) {
  const R = brick.type === 'hero' ? HeroRenderer : brick.type === 'features' ? FeaturesRenderer : null;
  if (!R) return <div className="p-8 text-center text-gray-400 border-2 border-dashed rounded-xl">Blocco "{brick.type}" non riconosciuto</div>;
  return <R brick={brick} designTokens={designTokens} selected={selected} editing={editing} onUpdate={onUpdate} />;
}

// ════════════════════════════════════════════════════════════════════════════
//  EDITOR LAYOUT COMPONENT
// ════════════════════════════════════════════════════════════════════════════
function EditorView({ 
  pages, pageIndex, designTokens, form, onBack 
}: { 
  pages: SitePage[]; pageIndex: number; designTokens: DesignTokens; form: WizardForm; onBack: () => void;
}) {
  const { toast } = useToast();
  
  // FIX: designTokens è ora un oggetto completo e tipizzato correttamente
  const [state, dispatch] = useReducer(editorReducer, {
    pages, pageIndex, selectedId: null, editingId: null,
    device: 'desktop', leftPanel: 'layers', rightPanel: 'styles',
    designTokens: designTokens, // Usiamo direttamente la prop
    zoom: 1, showGuides: true, past: [], future: []
  });

  const [generating, setGenerating] = useState(false);
  const [job, setJob] = useState<SitebuilderJob | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const currentPage = state.pages[state.pageIndex];
  const selectedBrick = currentPage?.bricks.find((b: Brick) => b.id === state.selectedId);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); dispatch({ type: 'REDO' }); }
      if (e.key === 'Escape') dispatch({ type: 'SELECT', id: null });
      if (e.key === 'Delete' && state.selectedId) { e.preventDefault(); dispatch({ type: 'DELETE_BRICK', id: state.selectedId! }); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.selectedId]);

  // Polling job status
  useEffect(() => {
    if (!job?.id || job.status === 'DONE' || job.status === 'FAILED') return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/sitebuilder/jobs/${job.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('doflow_token') || ''}` }
        });
        if (!res.ok) throw new Error('Network error');
        const data = await res.json() as SitebuilderJob;
        setJob(data);
        if (data.status !== 'RUNNING') {
          clearInterval(iv);
          setGenerating(false);
          toast({ title: data.status === 'DONE' ? '✅ Sito pronto!' : '❌ Generazione fallita', variant: data.status === 'DONE' ? 'default' : 'destructive' });
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [job, toast]);

  const handleGenerate = async () => {
    setGenerating(true); setTokenCopied(false);
    try {
      const payload = {
        tenantId: form.tenantId, siteDomain: form.siteDomain, siteTitle: form.siteTitle,
        adminEmail: form.adminEmail, businessType: form.businessType || 'Business',
        businessDescription: form.businessDescription, starterSite: form.starterSite || 'business',
        designScheme: form.designScheme, 
        // Mappa i tokens correnti dell'editor nel formato atteso dal backend
        designTokens: {
           primaryColor: state.designTokens.colorPrimary,
           secondaryColor: state.designTokens.colorSecondary,
           accentColor: state.designTokens.colorAccent,
           headingFont: state.designTokens.fontHeading,
           bodyFont: state.designTokens.fontBody
        },
        contentTopics: state.pages.map((p: SitePage) => p.title), locale: form.locale || 'it',
        xmlBlocks: { pages: state.pages }
      };
      const res = await fetch(`${getApiBaseUrl()}/sitebuilder/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('doflow_token') || ''}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json() as { jobId: string };
      if (res.ok) {
        toast({ title: '🚀 Job avviato' });
        const jobRes = await fetch(`${getApiBaseUrl()}/sitebuilder/jobs/${data.jobId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('doflow_token') || ''}` } });
        setJob(await jobRes.json() as SitebuilderJob);
      } else throw new Error('Errore backend');
    } catch (err) {
      toast({ title: 'Errore', description: String(err), variant: 'destructive' });
      setGenerating(false);
    }
  };

  const handleCopyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2500);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* TOP BAR */}
      <header className="h-14 border-b bg-white flex items-center px-4 gap-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 px-2 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Wizard
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <Globe className="h-3.5 w-3.5 text-gray-400" />
          {form.siteDomain || 'Sito'} <span className="text-gray-300">/</span> <span className="text-blue-600">{currentPage?.title}</span>
        </div>
        <div className="flex-1" />
        
        <ResponsiveToolbar currentBreakpoint={state.device} onChange={(d) => dispatch({ type: 'SET_BREAKPOINT', device: d })} />
        <div className="w-px h-5 bg-gray-200" />
        
        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!state.past.length} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><Undo2 className="h-3.5 w-3.5" /></button>
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={!state.future.length} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><Redo2 className="h-3.5 w-3.5" /></button>
        <div className="w-px h-5 bg-gray-200" />
        
        <button onClick={() => dispatch({ type: 'SET_LEFT_PANEL', panel: state.leftPanel === 'layers' ? 'components' : 'layers' })} className="p-1.5 rounded bg-blue-50 text-blue-600">
          {state.leftPanel === 'layers' ? <Layers className="h-4 w-4" /> : <Component className="h-4 w-4" />}
        </button>
        <button onClick={() => dispatch({ type: 'SET_RIGHT_PANEL', panel: state.rightPanel === 'styles' ? 'none' : 'styles' })} className={cn('p-1.5 rounded', state.rightPanel !== 'none' && 'bg-blue-50 text-blue-600')}>
          <Palette className="h-4 w-4" />
        </button>
        
        <div className="w-px h-5 bg-gray-200" />
        <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? 'Generazione...' : 'Genera Sito'}
        </button>
      </header>

      {/* STATUS BAR (Token/Progress) */}
      {job && job.status === 'DONE' && job.importToken && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center gap-3 shrink-0">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-xs font-medium text-green-800 flex-1">Sito pronto! Copia il token per il plugin WP.</span>
          <code className="font-mono text-xs bg-white px-2 py-1 rounded border border-green-200 select-all truncate max-w-[200px]">{job.importToken}</code>
          <button onClick={() => handleCopyToken(job.importToken!)} className="flex items-center gap-1 px-3 py-1 bg-white border border-green-300 text-green-700 rounded text-xs hover:bg-green-600 hover:text-white transition-colors">
            {tokenCopied ? <><ClipboardCheck className="h-3 w-3" /> Copiato</> : <><Copy className="h-3 w-3" /> Copia</>}
          </button>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT PANEL */}
        <aside className="w-72 border-r bg-white flex flex-col shrink-0">
          <Tabs value={state.leftPanel} onValueChange={(v) => dispatch({ type: 'SET_LEFT_PANEL', panel: v as any })} className="flex flex-col h-full">
            <TabsList className="grid grid-cols-3 h-auto p-1 bg-gray-100 rounded-none border-b">
              <TabsTrigger value="layers" className="text-[10px] py-1.5"><Layers className="h-3 w-3 mr-1 inline" />Layer</TabsTrigger>
              <TabsTrigger value="components" className="text-[10px] py-1.5"><Component className="h-3 w-3 mr-1 inline" />Libreria</TabsTrigger>
              <TabsTrigger value="pages" className="text-[10px] py-1.5"><Globe className="h-3 w-3 mr-1 inline" />Pagine</TabsTrigger>
            </TabsList>
            <TabsContent value="layers" className="flex-1 overflow-hidden mt-0">
              <LayerTree
                bricks={currentPage?.bricks || []}
                selectedId={state.selectedId}
                expandedIds={new Set()} 
                onToggleExpand={() => {}}
                onSelect={(id) => dispatch({ type: 'SELECT', id })}
                onUpdate={(id, patch) => dispatch({ type: 'UPDATE_BRICK', id, patch })}
                onDuplicate={(id) => dispatch({ type: 'DUPLICATE_BRICK', id })}
                onDelete={(id) => dispatch({ type: 'DELETE_BRICK', id })}
                // FIX: Converti ID (string) in indici (number) prima di dispatchare
                onReorder={(fromId, toId) => {
                    const bricks = currentPage?.bricks || [];
                    const fromIndex = bricks.findIndex((b: Brick) => b.id === fromId);
                    const toIndex = bricks.findIndex((b: Brick) => b.id === toId);
                    if (fromIndex > -1 && toIndex > -1) {
                        dispatch({ type: 'REORDER', from: fromIndex, to: toIndex });
                    }
                }}
              />
            </TabsContent>
            <TabsContent value="components" className="flex-1 overflow-hidden mt-0">
              <ComponentLibrary
                components={Object.entries(BLOCK_CATALOG).map(([k, v]) => ({ id: k, name: v.label, brickType: k, description: v.description, category: 'content' as const, defaultProps: v.defaultProps as Record<string, unknown> }))}
                onAdd={(id) => dispatch({ type: 'ADD_BRICK', brickType: id, afterId: state.selectedId || undefined })}
              />
            </TabsContent>
            <TabsContent value="pages" className="flex-1 overflow-y-auto p-2 space-y-1 mt-0">
              {state.pages.map((p, i) => (
                <button key={p.slug} onClick={() => dispatch({ type: 'SET_PAGE', index: i })}
                  className={cn('w-full text-left px-3 py-2 rounded text-sm', state.pageIndex === i ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50')}>
                  {p.title}
                </button>
              ))}
            </TabsContent>
          </Tabs>
        </aside>

        {/* CANVAS */}
        <main className="flex-1 overflow-auto bg-gray-200 flex items-center justify-center p-8 relative">
          <Canvas
            pages={state.pages}
            pageIndex={state.pageIndex}
            selectedId={state.selectedId}
            device={state.device}
            designTokens={state.designTokens}
            zoom={state.zoom}
            showGuides={state.showGuides}
            snapToGrid={false}
            onSelect={(id) => dispatch({ type: 'SELECT', id })}
            onUpdate={(id, patch) => dispatch({ type: 'UPDATE_BRICK', id, patch })}
            onAddBrick={(type, parentId, index) => dispatch({ type: 'ADD_BRICK', brickType: type, afterId: state.selectedId ?? undefined })}            // customBrickRenderer rimosso poiché non supportato da Canvas
          />
        </main>

        {/* RIGHT PANEL */}
        {state.rightPanel === 'styles' && selectedBrick && (
          <aside className="w-80 border-l bg-white flex flex-col shrink-0">
            <StylePanel
              brick={selectedBrick}
              designTokens={state.designTokens}
              breakpoint={state.device}
              onUpdateStyles={(styles) => dispatch({ type: 'UPDATE_STYLES', id: selectedBrick.id, styles })}
              onUpdateTokens={(tokens) => dispatch({ type: 'UPDATE_TOKENS', tokens })}
            />
          </aside>
        )}
        {!state.rightPanel || state.rightPanel === 'none' ? (
          <div className="w-0 shrink-0" />
        ) : null}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  WIZARD & MAIN EXPORT
// ════════════════════════════════════════════════════════════════════════════
const WIZARD_STEPS = [
  { id: 'base', label: 'Impostazioni Base', icon: Settings },
  { id: 'business', label: 'Business & Tema', icon: Building2 },
  { id: 'design', label: 'Stile Visivo', icon: Palette },
  { id: 'content', label: 'Contenuti', icon: FileText },
];

export default function SitebuilderClient() {
  const [wizardStep, setWizardStep] = useState(0);
  
  const [form, setForm] = useState<WizardForm>({
    tenantId: 'public', siteDomain: '', siteTitle: '', adminEmail: '',
    businessType: '', businessDescription: '', starterSite: 'business',
    designScheme: { primaryColor: '#3B82F6', secondaryColor: '#8B5CF6', accentColor: '#F59E0B', headingFont: 'Inter' },
    contentTopics: [], locale: 'it', xmlBlocks: null,
  });
  
  const [editorMode, setEditorMode] = useState(false);

  const canProceed = [
    !!(form.siteDomain && form.siteTitle && form.adminEmail),
    !!form.businessType,
    true,
    !!(form.xmlBlocks?.pages?.length || form.contentTopics.length >= 1),
  ];

  if (editorMode) {
    return (
      <EditorView
        pages={form.xmlBlocks?.pages || [{ slug: 'home', title: 'Home', bricks: [] }]}
        pageIndex={0}
        // FIX: Mappatura corretta dei colori del wizard verso DesignTokens
        designTokens={{
          colorPrimary: form.designScheme.primaryColor ?? '#3B82F6',
          colorSecondary: form.designScheme.secondaryColor ?? '#8B5CF6',
          colorAccent: form.designScheme.accentColor ?? '#F59E0B',
          colorBackground: '#ffffff',
          colorSurface: '#f8fafc',
          colorText: '#0f172a',
          colorTextMuted: '#64748b',
          fontHeading: form.designScheme.headingFont ?? 'Inter, sans-serif',
          fontBody: 'Inter, sans-serif',
          fontSizeBase: '1rem',
          fontSizeScale: 'major-third',
          spacingUnit: '0.25rem',
          spacingScale: 'medium',
          borderRadiusBase: '0.5rem',
          borderRadiusScale: 'medium',
          boxShadowBase: 'md',
          transitionBase: 'all 0.2s ease',
        }}
        form={form}
        onBack={() => setEditorMode(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b py-4 px-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-blue-600" />
        <span className="font-bold text-lg text-gray-900">DoFlow Sitebuilder AI</span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-8">
          {WIZARD_STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              <button onClick={() => i < wizardStep && setWizardStep(i)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  i === wizardStep ? 'bg-blue-600 text-white shadow-md' : i < wizardStep ? 'bg-blue-100 text-blue-700 cursor-pointer' : 'bg-gray-100 text-gray-400')}>
                <step.icon className="h-3.5 w-3.5" /> {step.label}
              </button>
              {i < WIZARD_STEPS.length - 1 && <div className={cn('flex-1 h-px', i < wizardStep ? 'bg-blue-300' : 'bg-gray-200')} />}
            </React.Fragment>
          ))}
        </div>

        <Card className="shadow-sm mb-6">
          <CardContent className="pt-6">
            {wizardStep === 0 && (
              <div className="space-y-4">
                <div><Label>Dominio</Label><Input value={form.siteDomain} onChange={e => setForm({...form, siteDomain: e.target.value})} placeholder="sito.it" /></div>
                <div><Label>Nome Sito</Label><Input value={form.siteTitle} onChange={e => setForm({...form, siteTitle: e.target.value})} placeholder="Il mio brand" /></div>
                <div><Label>Email Admin</Label><Input type="email" value={form.adminEmail} onChange={e => setForm({...form, adminEmail: e.target.value})} placeholder="admin@sito.it" /></div>
              </div>
            )}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div><Label>Settore</Label><Input value={form.businessType} onChange={e => setForm({...form, businessType: e.target.value})} placeholder="Es. Ristorante, Agenzia, Studio..." /></div>
                <div><Label>Template Starter</Label>
                  <select className="w-full h-10 rounded-md border px-3" value={form.starterSite} onChange={e => setForm({...form, starterSite: e.target.value})}>
                    <option value="business">Business</option><option value="restaurant">Restaurant</option><option value="agency">Agency</option>
                  </select>
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map(k => (
                    <div key={k}><Label>{k.replace('Color', '')}</Label>
                      <Input type="color" value={(form.designScheme[k] as string) || '#3B82F6'} onChange={e => setForm({...form, designScheme: {...form.designScheme, [k]: e.target.value}})} className="h-10 p-1 w-full cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Seleziona le pagine da generare o carica un XML master doc.</p>
                <div className="flex flex-wrap gap-2">
                  {['Home', 'Chi Siamo', 'Servizi', 'Contatti', 'FAQ', 'Blog'].map(t => (
                    <button key={t} onClick={() => setForm({...form, contentTopics: form.contentTopics.includes(t) ? form.contentTopics.filter(x => x !== t) : [...form.contentTopics, t]})}
                      className={cn('px-3 py-1.5 rounded-lg text-xs border', form.contentTopics.includes(t) ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <button onClick={() => setWizardStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0} className="px-4 py-2 text-sm text-gray-500 disabled:opacity-30">Indietro</button>
          {wizardStep < WIZARD_STEPS.length - 1 ? (
            <button onClick={() => setWizardStep(wizardStep + 1)} disabled={!canProceed[wizardStep]} className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-40">Avanti</button>
          ) : (
            <button onClick={() => setEditorMode(true)} disabled={!canProceed[wizardStep]} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40 font-medium">Apri Editor & Genera</button>
          )}
        </div>
      </div>
    </div>
  );
}