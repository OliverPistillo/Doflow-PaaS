'use client';

import React, {
  useState, useReducer, useRef, useCallback, useEffect, useMemo,
} from 'react';
import {
  GripVertical, Trash2, Copy, ChevronUp, ChevronDown, Plus, Layers,
  Monitor, Tablet, Smartphone, Undo2, Redo2, Eye, X,
  Type, Image, Link2, Globe, Building2, FileText, Zap, Loader2,
  CheckCircle2, Palette, Search, Settings, Edit3, PanelLeftClose,
  ArrowLeft, Sparkles, ChevronRight, Check, AlertCircle, FolderOpen,
  LayoutTemplate, Move, MousePointerClick, Key, ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// ════════════════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════════════════

type Device = 'desktop' | 'tablet' | 'mobile';

interface BrickItem { title: string; description: string; }

interface Brick {
  id: string;
  type: string;
  headline?: string;
  subheadline?: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  imageUrl?: string;
  image_query?: string;
  items?: BrickItem[];
  bgColor?: string;
  textColor?: string;
}

interface SitePage { slug: string; title: string; bricks: Brick[]; }
interface ParsedXml { strategy?: Record<string, string>; pages: SitePage[]; }

interface DesignScheme {
  primaryColor?: string; secondaryColor?: string;
  accentColor?: string; headingFont?: string;
}

interface WizardForm {
  tenantId: string; siteDomain: string; siteTitle: string;
  adminEmail: string; businessType: string; businessDescription: string;
  starterSite: string; designScheme: DesignScheme;
  contentTopics: string[]; locale: string;
  xmlBlocks?: ParsedXml | null;
}

interface SitebuilderJob {
  id: string;
  status: string;
  siteDomain: string;
  siteTitle: string;
  logs: string[];
  importToken?: string;   // ← token generato dal Processor al DONE
  createdAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
//  BLOCK CATALOG — field definitions per type
// ════════════════════════════════════════════════════════════════════════════

type FieldType = 'text' | 'richtext' | 'url' | 'image' | 'select' | 'items' | 'color';

interface FieldDef {
  key: string; label: string; type: FieldType;
  options?: string[]; placeholder?: string;
}

interface BlockDef {
  label: string; icon: string; description: string;
  fields: FieldDef[];
  defaultProps: Partial<Brick>;
}

const BLOCK_CATALOG: Record<string, BlockDef> = {
  hero: {
    label: 'Hero', icon: '🎯', description: 'Sezione principale con CTA',
    fields: [
      { key: 'headline', label: 'Titolo principale (H1)', type: 'text', placeholder: 'Titolo accattivante...' },
      { key: 'subheadline', label: 'Sottotitolo (H2)', type: 'text', placeholder: 'Proposta di valore...' },
      { key: 'body', label: 'Testo descrittivo', type: 'richtext', placeholder: 'Descrizione dettagliata...' },
      { key: 'cta_text', label: 'Testo CTA', type: 'text', placeholder: 'Scopri di più' },
      { key: 'cta_url', label: 'URL CTA', type: 'url', placeholder: '/contatti' },
      { key: 'imageUrl', label: 'Immagine di sfondo', type: 'image' },
      { key: 'bgColor', label: 'Colore sfondo', type: 'color' },
    ],
    defaultProps: { headline: 'Titolo Principale', subheadline: 'La tua proposta di valore', cta_text: 'Inizia ora', cta_url: '#contatti', bgColor: '#0f172a' },
  },
  features: {
    label: 'Features / Vantaggi', icon: '⭐', description: 'Griglia di vantaggi o caratteristiche',
    fields: [
      { key: 'headline', label: 'Titolo sezione', type: 'text' },
      { key: 'subheadline', label: 'Sottotitolo', type: 'text' },
      { key: 'imageUrl', label: 'Immagine decorativa', type: 'image' },
      { key: 'items', label: 'Voci', type: 'items' },
    ],
    defaultProps: {
      headline: 'Perché sceglierci',
      items: [
        { title: 'Vantaggio 1', description: 'Descrizione del primo vantaggio principale.' },
        { title: 'Vantaggio 2', description: 'Descrizione del secondo vantaggio principale.' },
        { title: 'Vantaggio 3', description: 'Descrizione del terzo vantaggio principale.' },
      ],
    },
  },
  about: {
    label: 'Chi Siamo', icon: '🏢', description: 'Sezione storytelling aziendale',
    fields: [
      { key: 'headline', label: 'Titolo (H1)', type: 'text' },
      { key: 'body', label: 'Testo descrittivo', type: 'richtext' },
      { key: 'imageUrl', label: 'Immagine', type: 'image' },
      { key: 'bgColor', label: 'Colore sfondo', type: 'color' },
    ],
    defaultProps: { headline: 'Chi Siamo', body: 'La nostra storia e missione...' },
  },
  services: {
    label: 'Servizi', icon: '🛠️', description: 'Elenco dei servizi offerti',
    fields: [
      { key: 'headline', label: 'Titolo sezione', type: 'text' },
      { key: 'subheadline', label: 'Sottotitolo', type: 'text' },
      { key: 'items', label: 'Servizi', type: 'items' },
    ],
    defaultProps: {
      headline: 'I Nostri Servizi',
      items: [
        { title: 'Servizio 1', description: 'Descrizione del servizio.' },
        { title: 'Servizio 2', description: 'Descrizione del servizio.' },
      ],
    },
  },
  testimonials: {
    label: 'Testimonianze', icon: '💬', description: 'Citazioni e recensioni clienti',
    fields: [
      { key: 'headline', label: 'Titolo sezione', type: 'text' },
      { key: 'items', label: 'Testimonianze', type: 'items' },
      { key: 'bgColor', label: 'Colore sfondo', type: 'color' },
    ],
    defaultProps: {
      headline: 'Cosa Dicono i Nostri Clienti',
      items: [
        { title: 'Mario Rossi, CEO Azienda X', description: 'Servizio eccellente, risultati straordinari.' },
        { title: 'Laura Bianchi, Freelancer', description: 'Professionalità e competenza al massimo livello.' },
      ],
    },
  },
  faq: {
    label: 'FAQ', icon: '❓', description: 'Domande frequenti',
    fields: [
      { key: 'headline', label: 'Titolo sezione', type: 'text' },
      { key: 'items', label: 'Domande e risposte', type: 'items' },
    ],
    defaultProps: {
      headline: 'Domande Frequenti',
      items: [
        { title: 'Qual è il tempo di consegna?', description: 'Di solito consegniamo entro 2-4 settimane.' },
        { title: 'Offrite assistenza post-lancio?', description: 'Sì, offriamo supporto continuo per tutti i nostri clienti.' },
      ],
    },
  },
  contact: {
    label: 'Contatti', icon: '📧', description: 'Form di contatto',
    fields: [
      { key: 'headline', label: 'Titolo', type: 'text' },
      { key: 'subheadline', label: 'Testo introduttivo', type: 'richtext' },
      { key: 'bgColor', label: 'Colore sfondo', type: 'color' },
    ],
    defaultProps: { headline: 'Contattaci', subheadline: 'Siamo qui per aiutarti. Scrivici!' },
  },
  cta: {
    label: 'Call to Action', icon: '🚀', description: 'Sezione di chiamata all\'azione',
    fields: [
      { key: 'headline', label: 'Titolo', type: 'text' },
      { key: 'subheadline', label: 'Sottotitolo', type: 'text' },
      { key: 'cta_text', label: 'Testo bottone', type: 'text' },
      { key: 'cta_url', label: 'URL bottone', type: 'url' },
      { key: 'bgColor', label: 'Colore sfondo', type: 'color' },
    ],
    defaultProps: { headline: 'Pronto a iniziare?', subheadline: 'Contattaci oggi.', cta_text: 'Inizia ora', cta_url: '#contatti', bgColor: '#1e40af' },
  },
  stats: {
    label: 'Statistiche', icon: '📊', description: 'Numeri e dati aziendali',
    fields: [
      { key: 'headline', label: 'Titolo sezione', type: 'text' },
      { key: 'items', label: 'Statistiche', type: 'items' },
    ],
    defaultProps: {
      headline: 'I Nostri Numeri',
      items: [
        { title: '500+', description: 'Clienti Soddisfatti' },
        { title: '10 anni', description: 'di Esperienza' },
        { title: '98%', description: 'Tasso di Soddisfazione' },
        { title: '24h', description: 'Supporto Attivo' },
      ],
    },
  },
};

// ════════════════════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════════════════════

const uid = () => Math.random().toString(36).slice(2, 9);
const getApiBaseUrl = () =>
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api'
    : 'https://api.doflow.it/api';

// ════════════════════════════════════════════════════════════════════════════
//  INLINE EDITABLE TEXT
// ════════════════════════════════════════════════════════════════════════════

interface EditableProps {
  style?: React.CSSProperties;
  value: string | undefined;
  onChange: (v: string) => void;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  className?: string;
  enabled: boolean;
  placeholder?: string;
}

function Editable({ value, onChange, as: Tag = 'p', className, style, enabled, placeholder }: EditableProps) {
  const ref = useRef<HTMLElement>(null);
  const lastVal = useRef(value ?? '');

  useEffect(() => {
    if (ref.current && !enabled) {
      ref.current.textContent = value ?? '';
      lastVal.current = value ?? '';
    }
  }, [value, enabled]);

  const handleBlur = () => {
    const newVal = ref.current?.textContent ?? '';
    if (newVal !== lastVal.current) { onChange(newVal); lastVal.current = newVal; }
  };

  return React.createElement(Tag, {
    ref,
    contentEditable: enabled,
    suppressContentEditableWarning: true,
    onBlur: handleBlur,
    className: cn(
      className,
      enabled && 'outline-none ring-2 ring-blue-400 ring-offset-2 rounded cursor-text',
      !value && enabled && 'before:content-[attr(data-placeholder)] before:text-gray-400',
    ),
    'data-placeholder': placeholder,
    style,
    dangerouslySetInnerHTML: enabled ? undefined : { __html: value ?? placeholder ?? '' },
    defaultValue: undefined,
    children: enabled ? (value ?? '') : undefined,
  } as React.HTMLAttributes<HTMLElement>);
}

// ════════════════════════════════════════════════════════════════════════════
//  BLOCK RENDERERS — real styled sections
// ════════════════════════════════════════════════════════════════════════════

interface BlockRendererProps {
  brick: Brick;
  design: DesignScheme;
  selected: boolean;
  editing: boolean;
  onUpdate: (patch: Partial<Brick>) => void;
}

function HeroRenderer({ brick, design, editing, onUpdate }: BlockRendererProps) {
  const bg = brick.bgColor ?? '#0f172a';
  const primary = design.primaryColor ?? '#3b82f6';
  return (
    <section style={{ backgroundColor: bg, color: '#fff', fontFamily: design.headingFont ?? 'inherit' }}
      className="relative py-20 px-6 text-center overflow-hidden">
      {brick.imageUrl && (
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: `url(${brick.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}
      <div className="relative z-10 max-w-3xl mx-auto space-y-6">
        <Editable as="h1" value={brick.headline} onChange={(v) => onUpdate({ headline: v })}
          enabled={editing} placeholder="Titolo principale"
          className="text-4xl md:text-5xl font-bold leading-tight text-white" />
        <Editable as="h2" value={brick.subheadline} onChange={(v) => onUpdate({ subheadline: v })}
          enabled={editing} placeholder="Sottotitolo..."
          className="text-xl font-medium text-white/80" />
        {brick.body && (
          <Editable value={brick.body} onChange={(v) => onUpdate({ body: v })}
            enabled={editing} className="text-white/70 text-base max-w-2xl mx-auto leading-relaxed" />
        )}
        {brick.cta_text && (
          <div className="flex gap-3 justify-center flex-wrap pt-2">
            <a href={brick.cta_url ?? '#'} onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white shadow-lg"
              style={{ backgroundColor: primary }}>
              {brick.cta_text}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturesRenderer({ brick, design, editing, onUpdate }: BlockRendererProps) {
  const items = brick.items ?? [];
  const primary = design.primaryColor ?? '#3b82f6';
  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 space-y-2">
          <Editable as="h2" value={brick.headline} onChange={(v) => onUpdate({ headline: v })}
            enabled={editing} placeholder="Titolo sezione"
            className="text-3xl font-bold text-gray-900" style={{ fontFamily: design.headingFont }} />
          {brick.subheadline && (
            <Editable value={brick.subheadline} onChange={(v) => onUpdate({ subheadline: v })}
              enabled={editing} className="text-gray-500 text-lg" />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {items.map((item, i) => (
            <div key={i} className="p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white">
              <div className="w-10 h-10 rounded-lg mb-4 flex items-center justify-center text-white text-lg font-bold"
                style={{ backgroundColor: primary }}>{i + 1}</div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutRenderer({ brick, design, editing, onUpdate }: BlockRendererProps) {
  const bg = brick.bgColor ?? '#f8fafc';
  return (
    <section style={{ backgroundColor: bg }} className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className={cn('flex gap-12 items-center', brick.imageUrl ? 'flex-col md:flex-row' : 'flex-col')}>
          <div className="flex-1 space-y-4">
            <Editable as="h2" value={brick.headline} onChange={(v) => onUpdate({ headline: v })}
              enabled={editing} placeholder="Chi Siamo"
              className="text-3xl font-bold text-gray-900" style={{ fontFamily: design.headingFont }} />
            <Editable value={brick.body ?? brick.subheadline} onChange={(v) => onUpdate({ body: v })}
              enabled={editing} placeholder="La vostra storia..."
              className="text-gray-600 leading-relaxed text-base whitespace-pre-wrap" />
          </div>
          {brick.imageUrl && (
            <div className="flex-1">
              <img src={brick.imageUrl} alt="" className="rounded-2xl shadow-lg w-full object-cover aspect-video" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ServicesRenderer({ brick, design, editing, onUpdate }: BlockRendererProps) {
  const items = brick.items ?? [];
  const primary = design.primaryColor ?? '#3b82f6';
  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <Editable as="h2" value={brick.headline} onChange={(v) => onUpdate({ headline: v })}
            enabled={editing} placeholder="I Nostri Servizi"
            className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: design.headingFont }} />
          {brick.subheadline && (
            <Editable value={brick.subheadline} onChange={(v) => onUpdate({ subheadline: v })}
              enabled={editing} className="text-gray-500 text-lg" />
          )}
        </div>
        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="flex gap-5 p-5 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="w-2 rounded-full flex-shrink-0" style={{ backgroundColor: primary }} />
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">{item.title}</h3>
                <p className="text-gray-500 text-sm mt-1 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsRenderer({ brick, design, editing, onUpdate }: BlockRendererProps) {
  const items = (brick.items ?? []).slice(0, 3);
  const bg = brick.bgColor ?? '#ffffff';
  const primary = design.primaryColor ?? '#3b82f6';
  return (
    <section style={{ backgroundColor: bg }} className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <Editable as="h2" value={brick.headline} onChange={(v) => onUpdate({ headline: v })}
          enabled={editing} placeholder="Testimonianze"
          className="text-3xl font-bold text-center text-gray-900 mb-12" style={{ fontFamily: design.headingFont }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white shadow border border-gray-100">
              <div className="text-2xl mb-3" style={{ color: primary }}>"</div>
              <p className="text-gray-600 text-sm italic leading-relaxed mb-4">{item.description}</p>
              <p className="font-semibold text-gray-900 text-sm">— {item.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqRenderer({ brick, design, editing, onUpdate }: BlockRendererProps) {
  const [open, setOpen] = useState<number | null>(0);
  const items = brick.items ?? [];
  const primary = design.primaryColor ?? '#3b82f6';
  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <Editable as="h2" value={brick.headline} onChange={(v) => onUpdate({ headline: v })}
          enabled={editing} placeholder="FAQ"
          className="text-3xl font-bold text-center text-gray-900 mb-10" style={{ fontFamily: design.headingFont }} />
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex justify-between items-center p-5 text-left font-medium text-gray-900 hover:bg-gray-50">
                {item.title}
                <ChevronRight className={cn('h-4 w-4 text-gray-400 transition-transform', open === i && 'rotate-90')}
                  style={{ color: open === i ? primary : undefined }} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-100">
                  {item.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactRenderer({ brick, design, editing, onUpdate }: BlockRendererProps) {
  const bg = brick.bgColor ?? '#f8fafc';
  const primary = design.primaryColor ?? '#3b82f6';
  return (
    <section style={{ backgroundColor: bg }} className="py-16 px-6">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <div className="space-y-3">
          <Editable as="h2" value={brick.headline} onChange={(v) => onUpdate({ headline: v })}
            enabled={editing} placeholder="Contattaci"
            className="text-3xl font-bold text-gray-900" style={{ fontFamily: design.headingFont }} />
          {brick.subheadline && (
            <Editable value={brick.subheadline} onChange={(v) => onUpdate({ subheadline: v })}
              enabled={editing} className="text-gray-500 text-base" />
          )}
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-left space-y-4">
          {['Nome e Cognome', 'Email', 'Telefono (opzionale)'].map((f) => (
            <div key={f} className="space-y-1">
              <label className="text-xs font-medium text-gray-500">{f}</label>
              <div className="h-10 rounded-lg border border-gray-200 bg-gray-50" />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Messaggio</label>
            <div className="h-24 rounded-lg border border-gray-200 bg-gray-50" />
          </div>
          <button className="w-full py-3 rounded-lg text-white font-medium"
            style={{ backgroundColor: primary }}>Invia messaggio</button>
        </div>
        <p className="text-xs text-gray-400">Form WordPress Contact Form 7 — attivo dopo importazione</p>
      </div>
    </section>
  );
}

function CtaRenderer({ brick, design, editing, onUpdate }: BlockRendererProps) {
  const bg = brick.bgColor ?? (design.primaryColor ?? '#1e40af');
  return (
    <section style={{ backgroundColor: bg, color: '#fff' }} className="py-16 px-6 text-center">
      <div className="max-w-3xl mx-auto space-y-5">
        <Editable as="h2" value={brick.headline} onChange={(v) => onUpdate({ headline: v })}
          enabled={editing} placeholder="Pronto a iniziare?"
          className="text-4xl font-bold text-white" style={{ fontFamily: design.headingFont }} />
        {brick.subheadline && (
          <Editable value={brick.subheadline} onChange={(v) => onUpdate({ subheadline: v })}
            enabled={editing} className="text-white/80 text-lg" />
        )}
        {brick.cta_text && (
          <a href={brick.cta_url ?? '#'} onClick={(e) => e.preventDefault()}
            className="inline-block px-8 py-4 rounded-xl text-gray-900 font-bold text-lg bg-white shadow-xl mt-2">
            {brick.cta_text}
          </a>
        )}
      </div>
    </section>
  );
}

function StatsRenderer({ brick, design }: BlockRendererProps) {
  const items = (brick.items ?? []).slice(0, 4);
  const primary = design.primaryColor ?? '#3b82f6';
  return (
    <section className="py-14 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        {brick.headline && (
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10"
            style={{ fontFamily: design.headingFont }}>{brick.headline}</h2>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl font-black mb-1" style={{ color: primary }}>{item.title}</div>
              <div className="text-gray-500 text-sm">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const BLOCK_RENDERERS: Record<string, React.FC<BlockRendererProps>> = {
  hero: HeroRenderer, features: FeaturesRenderer, about: AboutRenderer,
  services: ServicesRenderer, testimonials: TestimonialsRenderer,
  faq: FaqRenderer, contact: ContactRenderer, cta: CtaRenderer, stats: StatsRenderer,
};

function BlockRenderer(props: BlockRendererProps) {
  const R = BLOCK_RENDERERS[props.brick.type];
  if (!R) return (
    <section className="py-10 px-6 bg-gray-100 text-center text-gray-400">
      Blocco "{props.brick.type}" — renderer non disponibile
    </section>
  );
  return <R {...props} />;
}

// ════════════════════════════════════════════════════════════════════════════
//  EDITOR STATE
// ════════════════════════════════════════════════════════════════════════════

interface EditorState {
  pages: SitePage[];
  pageIndex: number;
  selectedId: string | null;
  editingId: string | null;
  device: Device;
  leftTab: 'layers' | 'palette';
  past: SitePage[][];
  future: SitePage[][];
}

type EditorAction =
  | { type: 'SELECT'; id: string | null }
  | { type: 'SET_EDITING'; id: string | null }
  | { type: 'UPDATE_BRICK'; id: string; patch: Partial<Brick> }
  | { type: 'ADD_BRICK'; brickType: string; afterId?: string }
  | { type: 'DELETE_BRICK'; id: string }
  | { type: 'DUPLICATE_BRICK'; id: string }
  | { type: 'MOVE_BRICK'; id: string; dir: 'up' | 'down' }
  | { type: 'REORDER'; from: number; to: number }
  | { type: 'SET_PAGE'; index: number }
  | { type: 'SET_DEVICE'; device: Device }
  | { type: 'SET_LEFT_TAB'; tab: 'layers' | 'palette' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function pushHistory(past: SitePage[][], pages: SitePage[]): SitePage[][] {
  const next = [...past, pages];
  return next.length > 50 ? next.slice(-50) : next;
}

function mutatePages(state: EditorState, fn: (bricks: Brick[]) => Brick[]): EditorState {
  const pages = state.pages.map((p, i) =>
    i === state.pageIndex ? { ...p, bricks: fn(p.bricks) } : p,
  );
  return {
    ...state, pages,
    past: pushHistory(state.past, state.pages),
    future: [],
  };
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SELECT': return { ...state, selectedId: action.id, editingId: null };
    case 'SET_EDITING': return { ...state, editingId: action.id };

    case 'UPDATE_BRICK':
      return mutatePages(state, (bricks) =>
        bricks.map((b) => b.id === action.id ? { ...b, ...action.patch } : b),
      );

    case 'ADD_BRICK': {
      const def = BLOCK_CATALOG[action.brickType];
      if (!def) return state;
      const newBrick: Brick = { id: uid(), type: action.brickType, ...def.defaultProps };
      return mutatePages(state, (bricks) => {
        if (!action.afterId) return [...bricks, newBrick];
        const idx = bricks.findIndex((b) => b.id === action.afterId);
        const next = [...bricks];
        next.splice(idx + 1, 0, newBrick);
        return next;
      });
    }

    case 'DELETE_BRICK':
      return {
        ...mutatePages(state, (bricks) => bricks.filter((b) => b.id !== action.id)),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case 'DUPLICATE_BRICK':
      return mutatePages(state, (bricks) => {
        const idx = bricks.findIndex((b) => b.id === action.id);
        if (idx < 0) return bricks;
        const dup = { ...bricks[idx], id: uid() };
        return [...bricks.slice(0, idx + 1), dup, ...bricks.slice(idx + 1)];
      });

    case 'MOVE_BRICK':
      return mutatePages(state, (bricks) => {
        const idx = bricks.findIndex((b) => b.id === action.id);
        if (idx < 0) return bricks;
        const next = [...bricks];
        const target = action.dir === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= next.length) return bricks;
        [next[idx], next[target]] = [next[target], next[idx]];
        return next;
      });

    case 'REORDER':
      return mutatePages(state, (bricks) => {
        const next = [...bricks];
        const [moved] = next.splice(action.from, 1);
        next.splice(action.to, 0, moved);
        return next;
      });

    case 'SET_PAGE': return { ...state, pageIndex: action.index, selectedId: null, editingId: null };
    case 'SET_DEVICE': return { ...state, device: action.device };
    case 'SET_LEFT_TAB': return { ...state, leftTab: action.tab };

    case 'UNDO': {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state, pages: prev,
        past: state.past.slice(0, -1),
        future: [state.pages, ...state.future],
      };
    }
    case 'REDO': {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        ...state, pages: next,
        past: [...state.past, state.pages],
        future: rest,
      };
    }

    default: return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  BLOCK WRAPPER — selection, hover, drag
// ════════════════════════════════════════════════════════════════════════════

function BlockWrapper({
  brick, index, total, selected, editing, dispatch, design, onUpdate,
}: {
  brick: Brick; index: number; total: number; selected: boolean; editing: boolean;
  dispatch: React.Dispatch<EditorAction>; design: DesignScheme;
  onUpdate: (patch: Partial<Brick>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const showControls = hovered || selected;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('brickIndex', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData('brickIndex'));
    if (!isNaN(from) && from !== index) dispatch({ type: 'REORDER', from, to: index });
    setDragOver(false);
  };

  return (
    <div
      className={cn(
        'relative group transition-all duration-100',
        selected && 'ring-2 ring-blue-500 ring-offset-0',
        hovered && !selected && 'ring-1 ring-blue-300',
        dragOver && 'ring-2 ring-orange-400 bg-orange-50',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', id: brick.id }); }}
      onDoubleClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_EDITING', id: brick.id }); }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Block label */}
      {showControls && (
        <div className="absolute top-0 left-0 z-30 pointer-events-none">
          <span className="bg-blue-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-br">
            {BLOCK_CATALOG[brick.type]?.icon} {BLOCK_CATALOG[brick.type]?.label ?? brick.type}
          </span>
        </div>
      )}

      {/* Floating toolbar */}
      {showControls && (
        <div className="absolute top-0 right-0 z-30 flex items-center gap-0.5 bg-white border border-gray-200 rounded-bl shadow-lg p-0.5">
          {/* Drag handle */}
          <div draggable onDragStart={handleDragStart}
            className="p-1.5 cursor-grab rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Trascina">
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_BRICK', id: brick.id, dir: 'up' }); }}
            disabled={index === 0} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500" title="Sposta su">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_BRICK', id: brick.id, dir: 'down' }); }}
            disabled={index === total - 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-500" title="Sposta giù">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DUPLICATE_BRICK', id: brick.id }); }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Duplica">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: 'SET_EDITING', id: editing ? null : brick.id });
          }} className={cn('p-1.5 rounded text-gray-500', editing && 'bg-blue-100 text-blue-600')} title="Modifica testo">
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Eliminare questo blocco?')) dispatch({ type: 'DELETE_BRICK', id: brick.id }); }}
            className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600" title="Elimina">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Block content */}
      <BlockRenderer brick={brick} design={design} selected={selected} editing={editing} onUpdate={onUpdate} />

      {/* Drop indicator */}
      {dragOver && <div className="absolute inset-x-0 top-0 h-1 bg-orange-400 rounded" />}

      {/* Add block below */}
      {selected && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_LEFT_TAB', tab: 'palette' }); }}
            className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-full shadow-lg">
            <Plus className="h-3 w-3" /> Aggiungi blocco
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  LEFT PANEL — layers + palette
// ════════════════════════════════════════════════════════════════════════════

function LeftPanel({ state, dispatch, pages }: {
  state: EditorState; dispatch: React.Dispatch<EditorAction>; pages: SitePage[];
}) {
  const currentPage = pages[state.pageIndex];
  const bricks = currentPage?.bricks ?? [];

  return (
    <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col min-h-0">
      {/* Page switcher */}
      <div className="p-3 border-b border-gray-200 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Pagine</p>
        {pages.map((page, i) => (
          <button key={page.slug} onClick={() => dispatch({ type: 'SET_PAGE', index: i })}
            className={cn('w-full text-left px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors',
              state.pageIndex === i ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100')}>
            <Globe className="h-3.5 w-3.5 flex-shrink-0" />
            {page.title}
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        {(['layers', 'palette'] as const).map((tab) => (
          <button key={tab} onClick={() => dispatch({ type: 'SET_LEFT_TAB', tab })}
            className={cn('flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors',
              state.leftTab === tab ? 'bg-white text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700')}>
            {tab === 'layers' ? <><Layers className="h-3.5 w-3.5" /> Layer</> : <><LayoutTemplate className="h-3.5 w-3.5" /> Blocchi</>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {state.leftTab === 'layers' ? (
          <div className="p-2 space-y-1">
            {bricks.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Nessun blocco. Aggiungine uno dalla palette →</p>
            )}
            {bricks.map((brick, i) => (
              <button key={brick.id} onClick={() => dispatch({ type: 'SELECT', id: brick.id })}
                className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                  state.selectedId === brick.id ? 'bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-200' : 'text-gray-600 hover:bg-gray-100')}>
                <span className="text-base">{BLOCK_CATALOG[brick.type]?.icon ?? '📦'}</span>
                <span className="flex-1 truncate">{brick.headline ?? BLOCK_CATALOG[brick.type]?.label ?? brick.type}</span>
                <span className="text-[10px] text-gray-400 font-mono">{i + 1}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <p className="text-[10px] text-gray-400 px-2 pb-1">Clicca per aggiungere alla pagina corrente</p>
            {Object.entries(BLOCK_CATALOG).map(([key, def]) => (
              <button key={key} onClick={() => {
                dispatch({ type: 'ADD_BRICK', brickType: key, afterId: state.selectedId ?? undefined });
                dispatch({ type: 'SET_LEFT_TAB', tab: 'layers' });
              }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all text-gray-700">
                <span className="text-lg">{def.icon}</span>
                <div>
                  <div className="font-medium text-xs">{def.label}</div>
                  <div className="text-[10px] text-gray-400">{def.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  RIGHT PANEL — dynamic properties editor
// ════════════════════════════════════════════════════════════════════════════

function ItemsEditor({ items, onChange }: {
  items: BrickItem[]; onChange: (items: BrickItem[]) => void;
}) {
  const update = (i: number, key: keyof BrickItem, val: string) => {
    const next = items.map((it, idx) => idx === i ? { ...it, [key]: val } : it);
    onChange(next);
  };
  const add = () => onChange([...items, { title: 'Nuovo', description: 'Descrizione...' }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400">VOCE {i + 1}</span>
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600">
              <X className="h-3 w-3" />
            </button>
          </div>
          <Input value={item.title} onChange={(e) => update(i, 'title', e.target.value)}
            placeholder="Titolo" className="h-7 text-xs" />
          <Textarea value={item.description} onChange={(e) => update(i, 'description', e.target.value)}
            placeholder="Descrizione" rows={2} className="text-xs resize-none" />
        </div>
      ))}
      <button onClick={add}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-blue-600 border-2 border-dashed border-blue-200 rounded-lg hover:bg-blue-50">
        <Plus className="h-3 w-3" /> Aggiungi voce
      </button>
    </div>
  );
}

function RightPanel({ state, dispatch }: { state: EditorState; dispatch: React.Dispatch<EditorAction> }) {
  const currentPage = state.pages[state.pageIndex];
  const brick = currentPage?.bricks.find((b) => b.id === state.selectedId);
  const def = brick ? BLOCK_CATALOG[brick.type] : null;

  const update = useCallback((patch: Partial<Brick>) => {
    if (!brick) return;
    dispatch({ type: 'UPDATE_BRICK', id: brick.id, patch });
  }, [brick, dispatch]);

  if (!brick || !def) {
    return (
      <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-6 gap-3">
        <MousePointerClick className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-400 text-center">Clicca su un blocco nel canvas per modificarne le proprietà</p>
        <p className="text-xs text-gray-300 text-center">Doppio click sul testo per editarlo inline</p>
      </div>
    );
  }

  const renderField = (field: FieldDef): React.ReactNode => {
    const val = (brick as unknown as Record<string, unknown>)[field.key];

    switch (field.type) {
      case 'text':
        return (
          <Input value={(val as string) ?? ''} onChange={(e) => update({ [field.key]: e.target.value })}
            placeholder={field.placeholder} className="h-8 text-xs" />
        );
      case 'richtext':
        return (
          <Textarea value={(val as string) ?? ''} onChange={(e) => update({ [field.key]: e.target.value })}
            placeholder={field.placeholder} rows={4} className="text-xs resize-none" />
        );
      case 'url':
        return (
          <Input type="url" value={(val as string) ?? ''} onChange={(e) => update({ [field.key]: e.target.value })}
            placeholder="https://..." className="h-8 text-xs font-mono" />
        );
      case 'image':
        return (
          <div className="space-y-2">
            {(val as string) && (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                <img src={val as string} alt="" className="w-full h-full object-cover" />
                <button onClick={() => update({ [field.key]: undefined })}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded text-white hover:bg-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <Input value={(val as string) ?? ''} onChange={(e) => update({ [field.key]: e.target.value })}
              placeholder="https://esempio.com/immagine.jpg" className="h-8 text-xs font-mono" />
          </div>
        );
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input type="color" value={(val as string) || '#ffffff'}
              onChange={(e) => update({ [field.key]: e.target.value })}
              className="h-8 w-12 rounded border border-gray-200 cursor-pointer p-0.5" />
            <Input value={(val as string) ?? ''} onChange={(e) => update({ [field.key]: e.target.value })}
              placeholder="#ffffff" className="h-8 text-xs font-mono flex-1" />
          </div>
        );
      case 'select':
        return (
          <Select value={(val as string) ?? ''} onValueChange={(v) => update({ [field.key]: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'items':
        return (
          <ItemsEditor items={(val as BrickItem[]) ?? []}
            onChange={(items) => update({ [field.key]: items })} />
        );
      default: return null;
    }
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-2">
        <span className="text-2xl">{def.icon}</span>
        <div>
          <h3 className="font-semibold text-sm text-gray-900">{def.label}</h3>
          <p className="text-[10px] text-gray-400">{def.description}</p>
        </div>
        <button onClick={() => dispatch({ type: 'SELECT', id: null })}
          className="ml-auto p-1 rounded hover:bg-gray-200 text-gray-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Editing hint */}
      <div className="mx-4 mt-3 mb-1 flex items-center gap-2 bg-blue-50 text-blue-600 text-[10px] px-2.5 py-2 rounded-lg">
        <Edit3 className="h-3 w-3 flex-shrink-0" />
        <span>Doppio click sul canvas per editare testi inline</span>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {def.fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {field.label}
            </Label>
            {renderField(field)}
          </div>
        ))}

        {/* Quick actions */}
        <div className="pt-2 border-t border-gray-200 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Azioni</p>
          <button onClick={() => dispatch({ type: 'DUPLICATE_BRICK', id: brick.id })}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 rounded-lg hover:bg-white border border-transparent hover:border-gray-200">
            <Copy className="h-3.5 w-3.5" /> Duplica blocco
          </button>
          <button onClick={() => { if (confirm('Eliminare questo blocco?')) dispatch({ type: 'DELETE_BRICK', id: brick.id }); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100">
            <Trash2 className="h-3.5 w-3.5" /> Elimina blocco
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  CANVAS
// ════════════════════════════════════════════════════════════════════════════

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: '100%', tablet: '768px', mobile: '375px',
};

function EditorCanvas({ state, dispatch, design }: {
  state: EditorState; dispatch: React.Dispatch<EditorAction>; design: DesignScheme;
}) {
  const currentPage = state.pages[state.pageIndex];
  const bricks = currentPage?.bricks ?? [];

  return (
    <div className="flex-1 overflow-auto bg-gray-200 flex justify-center"
      onClick={() => dispatch({ type: 'SELECT', id: null })}>
      <div
        className="min-h-full bg-white shadow-xl transition-all duration-300"
        style={{ width: DEVICE_WIDTHS[state.device], maxWidth: '100%' }}>

        {bricks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-400">
            <LayoutTemplate className="h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">Nessun blocco in questa pagina</p>
            <p className="text-xs">Aggiungi blocchi dal pannello "Blocchi" a sinistra</p>
            <button onClick={() => dispatch({ type: 'SET_LEFT_TAB', tab: 'palette' })}
              className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">
              <Plus className="h-4 w-4" /> Aggiungi blocco
            </button>
          </div>
        ) : (
          bricks.map((brick, i) => (
            <BlockWrapper
              key={brick.id} brick={brick} index={i} total={bricks.length}
              selected={state.selectedId === brick.id}
              editing={state.editingId === brick.id}
              dispatch={dispatch} design={design}
              onUpdate={(patch) => dispatch({ type: 'UPDATE_BRICK', id: brick.id, patch })}
            />
          ))
        )}

        {/* Add block at end */}
        {bricks.length > 0 && (
          <div className="flex items-center justify-center py-6 border-t border-dashed border-gray-200">
            <button onClick={() => dispatch({ type: 'SET_LEFT_TAB', tab: 'palette' })}
              className="flex items-center gap-1 px-4 py-2 text-gray-400 text-xs border border-dashed border-gray-300 rounded-full hover:border-blue-400 hover:text-blue-500 transition-colors">
              <Plus className="h-3 w-3" /> Aggiungi blocco in fondo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  TOP BAR
// ════════════════════════════════════════════════════════════════════════════
function TopBar({
  state, dispatch, pages, form, onGenerate, generating, onBack,
}: {
  state: EditorState; dispatch: React.Dispatch<EditorAction>; pages: SitePage[];
  form: WizardForm; onGenerate: (pages: SitePage[]) => void;
  generating: boolean; onBack: () => void;
}) {
  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center gap-2 px-3 flex-shrink-0 z-40">
      {/* Torna al wizard */}
      <button onClick={onBack} className="flex items-center gap-1 px-2 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-xs">
        <ArrowLeft className="h-3.5 w-3.5" /> Wizard
      </button>

      <div className="w-px h-5 bg-gray-200" />

      {/* Nome sito + pagina corrente */}
      <div className="flex items-center gap-1 text-xs font-medium text-gray-600">
        <Globe className="h-3.5 w-3.5 text-gray-400" />
        {form.siteDomain || 'Sito senza titolo'}
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-blue-600">{pages[state.pageIndex]?.title ?? ''}</span>
      </div>

      <div className="flex-1" />

      {/* Toggle device */}
      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
        {([
          ['desktop', Monitor],
          ['tablet', Tablet],
          ['mobile', Smartphone],
        ] as const).map(([dev, Icon]) => (
          <button key={dev} onClick={() => dispatch({ type: 'SET_DEVICE', device: dev })}
            className={cn('p-1.5 rounded-md transition-colors', state.device === dev ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600')}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* Undo / Redo */}
      <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!state.past.length}
        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500" title="Annulla (Ctrl+Z)">
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => dispatch({ type: 'REDO' })} disabled={!state.future.length}
        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500" title="Ripristina (Ctrl+Y)">
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-5 bg-gray-200" />

      {/* Contatore blocchi */}
      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
        {pages.reduce((acc, p) => acc + p.bricks.length, 0)} blocchi · {pages.length} pagine
      </span>

      {/* MODIFICA: bottone Genera — rimossa icona Download, testo aggiornato */}
      <button onClick={() => onGenerate(state.pages)} disabled={generating}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-sm">
        {generating
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Sparkles className="h-3.5 w-3.5" />}
        {generating ? 'Generazione in corso...' : 'Genera Sito WordPress'}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SITE EDITOR — layout a tre pannelli + status bar token
// ════════════════════════════════════════════════════════════════════════════
function SiteEditor({ xmlBlocks, form, onBack }: {
  xmlBlocks: ParsedXml; form: WizardForm; onBack: () => void;
}) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId]           = useState<string | null>(null);
  const [job, setJob]               = useState<SitebuilderJob | null>(null);
  // MODIFICA: stato feedback per il bottone "Copia Token"
  const [tokenCopied, setTokenCopied] = useState(false);

  const initialPages: SitePage[] = useMemo(() =>
    (xmlBlocks.pages ?? []).map((p) => ({
      ...p,
      bricks: p.bricks.map((b) => ({ ...b, id: b.id || uid() })),
    })), [xmlBlocks]);

  const [state, dispatch] = useReducer(editorReducer, {
    pages: initialPages,
    pageIndex: 0,
    selectedId: null,
    editingId: null,
    device: 'desktop',
    leftTab: 'layers',
    past: [],
    future: [],
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); dispatch({ type: 'UNDO' });
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); dispatch({ type: 'REDO' });
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'SET_EDITING', id: null });
        dispatch({ type: 'SELECT', id: null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // MODIFICA: polling che legge importToken dalla risposta del job
  useEffect(() => {
    if (!jobId) return;
    const base  = getApiBaseUrl();
    const token = localStorage.getItem('doflow_token') ?? '';

    const iv = setInterval(async () => {
      const r    = await fetch(`${base}/sitebuilder/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // La risposta include ora importToken quando status === DONE
      const data = await r.json() as SitebuilderJob;
      setJob(data);

      if (data.status === 'DONE' || data.status === 'FAILED' || data.status === 'ROLLED_BACK') {
        clearInterval(iv);
        setGenerating(false);
        if (data.status === 'DONE') {
          toast({ title: '✅ Sito pronto! Copia il token e importalo su WordPress.' });
        } else {
          toast({ title: '❌ Generazione fallita', variant: 'destructive' });
        }
      }
    }, 2000);

    return () => clearInterval(iv);
  }, [jobId, toast]);

  const handleGenerate = async (pages: SitePage[]) => {
    setGenerating(true);
    setJob(null);
    setTokenCopied(false);
    const base  = getApiBaseUrl();
    const token = localStorage.getItem('doflow_token') ?? '';
    try {
      const payload = {
        tenantId:            form.tenantId,
        siteDomain:          form.siteDomain,
        siteTitle:           form.siteTitle,
        adminEmail:          form.adminEmail,
        businessType:        form.businessType || 'Business',
        businessDescription: form.businessDescription,
        starterSite:         form.starterSite || 'consultant',
        designScheme:        form.designScheme,
        contentTopics:       pages.map((p) => p.title),
        locale:              form.locale || 'it',
        xmlBlocks:           { strategy: xmlBlocks.strategy, pages },
      };
      const r = await fetch(`${base}/sitebuilder/jobs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });
      const data = await r.json() as { jobId: string };
      if (r.ok && data.jobId) {
        setJobId(data.jobId);
        toast({ title: 'Job avviato — generazione WordPress in corso...' });
      } else {
        throw new Error('Risposta backend non valida');
      }
    } catch (err) {
      toast({ title: 'Errore avvio generazione', description: String(err), variant: 'destructive' });
      setGenerating(false);
    }
  };

  // MODIFICA: helper copia token con feedback visivo temporaneo
  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2500);
    } catch {
      toast({ title: 'Copia manuale', description: token, variant: 'default' });
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-white z-[100]">
      <TopBar state={state} dispatch={dispatch} pages={state.pages} form={form}
        onGenerate={handleGenerate} generating={generating} onBack={onBack} />

      {/* ── Status bar ────────────────────────────────────────────────────── */}

      {/* Job RUNNING / FAILED: barra compatta con ultimo log */}
      {job && job.status !== 'DONE' && (
        <div className={cn(
          'px-4 py-2 text-xs flex items-center gap-3 border-b',
          job.status === 'RUNNING'
            ? 'bg-blue-50 border-blue-200 text-blue-800'
            : 'bg-red-50 border-red-200 text-red-800',
        )}>
          {job.status === 'RUNNING' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {job.logs.slice(-1)[0]?.replace(/^\[.*?\] /, '') ?? `Status: ${job.status}`}
        </div>
      )}

      {/* MODIFICA: Job DONE — pannello token prominente */}
      {job && job.status === 'DONE' && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200 px-4 py-3">
          <div className="flex items-start gap-3 max-w-5xl">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {/* Istruzione */}
              <p className="text-xs font-semibold text-green-800 mb-2 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                Sito generato! Copia il token e incollalo nel plugin
                <span className="font-bold italic">DoFlow Importer</span>
                sul tuo sito WordPress.
              </p>

              {/* Token display + bottone copia */}
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm bg-white border border-green-300 rounded-lg px-3 py-2 text-green-900 tracking-widest select-all truncate shadow-inner">
                  {job.importToken ?? '—'}
                </code>
                <button
                  onClick={() => job.importToken && handleCopyToken(job.importToken)}
                  disabled={!job.importToken}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex-shrink-0 shadow-sm',
                    tokenCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-green-300 text-green-700 hover:bg-green-600 hover:text-white hover:border-green-600',
                  )}>
                  {tokenCopied
                    ? <><ClipboardCheck className="h-3.5 w-3.5" /> Copiato!</>
                    : <><Copy className="h-3.5 w-3.5" /> Copia Token</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tre pannelli ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        <LeftPanel state={state} dispatch={dispatch} pages={state.pages} />
        <EditorCanvas state={state} dispatch={dispatch} design={form.designScheme ?? {}} />
        <RightPanel state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}

const BLOCKSY_SITES = [
  // ── FREE ──────────────────────────────────────────────────────────────────
  { slug: 'codespot',        label: 'Codespot',        category: 'Tech',       isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2025/11/Main-Image.jpg' },
  { slug: 'consultant',      label: 'Consultant',      category: 'Business',   isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2024/08/Main-Image.jpg' },
  { slug: 'smile-dent',      label: 'Smile Dent',      category: 'Salute',     isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2024/02/Main-Image.jpg' },
  { slug: 'photo-studio',    label: 'Photo Studio',    category: 'Portfolio',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2023/11/Main-Image-3.jpg' },
  { slug: 'restaurant',      label: 'Restaurant',      category: 'Food',       isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/10/Main-Image.jpg' },
  { slug: 'wood',            label: 'Wood',            category: 'Portfolio',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-27.jpg' },
  { slug: 'wedding',         label: 'Wedding',         category: 'Lifestyle',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-12.jpg' },
  { slug: 'renovation',      label: 'Renovation',      category: 'Business',   isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-26.jpg' },
  { slug: 'beverr',          label: 'Beverr',          category: 'Portfolio',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-24.jpg' },
  { slug: 'catering',        label: 'Catering',        category: 'Food',       isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-23.jpg' },
  { slug: 'barber-shop',     label: 'Barber Shop',     category: 'Salute',     isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-22.jpg' },
  { slug: 'bizconsult',      label: 'BizConsult',      category: 'Business',   isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-21.jpg' },
  { slug: 'gadgets',         label: 'Gadgets',         category: 'eCommerce',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-20.jpg' },
  { slug: 'home-decor',      label: 'Home Decor',      category: 'eCommerce',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-19.jpg' },
  { slug: 'cleaning-service',label: 'Cleaning Service',category: 'Servizi',   isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-18.jpg' },
  { slug: 'car-service',     label: 'Car Service',     category: 'Servizi',    isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-17.jpg' },
  { slug: 'floreo',          label: 'Floreo',          category: 'eCommerce',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-16.jpg' },
  { slug: 'garderobe',       label: 'Garderobe',       category: 'eCommerce',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-15.jpg' },
  { slug: 'petsy',           label: 'Petsy',           category: 'eCommerce',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-14.jpg' },
  { slug: 'justice',         label: 'Justice',         category: 'Business',   isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-13.jpg' },
  { slug: 'web-agency',      label: 'Web Agency',      category: 'Business',   isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-11.jpg' },
  { slug: 'persona',         label: 'Persona',         category: 'Portfolio',  isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-10.jpg' },
  { slug: 'yogi',            label: 'Yogi',            category: 'Sport',      isPro: false, screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2022/09/Main-Image-9.jpg' },
  // ── PRO ───────────────────────────────────────────────────────────────────
  { slug: 'growly',          label: 'Growly',          category: 'Business',   isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2026/03/Main-Image5.jpg' },
  { slug: 'book-store',      label: 'Book Store',      category: 'eCommerce',  isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2026/01/Main-Image.jpg' },
  { slug: 'landscape',       label: 'Landscape',       category: 'Blog',       isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2025/09/Main-Image.jpg' },
  { slug: 'web-studio',      label: 'Web Studio',      category: 'Business',   isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2025/08/Main-Image.jpg' },
  { slug: 'invest-boost',    label: 'Invest Boost',    category: 'Finance',    isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2025/03/Main-Image.jpg' },
  { slug: 'kiddy',           label: 'Kiddy',           category: 'eCommerce',  isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2025/02/Main-Image.jpg' },
  { slug: 'furniture',       label: 'Furniture',       category: 'eCommerce',  isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2024/06/Main-Image.jpg' },
  { slug: 'e-bike',          label: 'E-Bike',          category: 'eCommerce',  isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2024/05/Main-Image.jpg' },
  { slug: 'pottery',         label: 'Pottery',         category: 'eCommerce',  isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2024/04/Main-Image.jpg' },
  { slug: 'smart-home',      label: 'Smart Home',      category: 'eCommerce',  isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2023/12/Main-Image.jpg' },
  { slug: 'daily-news',      label: 'Daily News',      category: 'Blog',       isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2023/11/Main-Image-2.jpg' },
  { slug: 'cosmetic',        label: 'Cosmetic',        category: 'eCommerce',  isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2023/11/Main-Image-1.jpg' },
  { slug: 'real-estate',     label: 'Real Estate',     category: 'Business',   isPro: true,  screenshot: 'https://creativethemes.com/blocksy/wp-content/uploads/2023/11/Main-Image.jpg' },
];

const FONTS = [
  { value: 'Inter, sans-serif', label: 'Inter (moderno)' },
  { value: '"Playfair Display", serif', label: 'Playfair Display (elegante)' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat (corporate)' },
  { value: '"Merriweather", serif', label: 'Merriweather (editoriale)' },
  { value: '"Roboto", sans-serif', label: 'Roboto (clean)' },
];


// ─── THEME SELECTOR ──────────────────────────────────────────────────────────

const SITE_CATEGORIES = ['Tutti', 'Business', 'eCommerce', 'Portfolio', 'Food', 'Salute', 'Sport', 'Tech', 'Finance', 'Lifestyle', 'Servizi', 'Blog'];

function ThemeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [cat, setCat] = React.useState('Tutti');
  const [search, setSearch] = React.useState('');

  const filtered = BLOCKSY_SITES.filter((s) => {
    const matchCat = cat === 'Tutti' || s.category === cat;
    const matchSearch = search === '' || s.label.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-3">
      {/* Search box */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca tema..."
        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
      />

      {/* Category pills - scrollable row */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {SITE_CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap transition-all shrink-0',
              cat === c
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 bg-white'
            )}>
            {c}
          </button>
        ))}
      </div>

      {/* Mosaic grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-2">        {filtered.map((site) => {
          const isSelected = value === site.slug;
          const previewUrl = `https://creativethemes.com/blocksy/starter-site/${site.slug}/`;
          return (
            <div
              key={site.slug}
              className={cn(
                'group rounded-2xl overflow-hidden cursor-pointer transition-all duration-200',
                isSelected
                  ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-200/50 scale-[0.99]'
                  : 'ring-1 ring-gray-200 hover:ring-blue-300 hover:shadow-md hover:-translate-y-0.5',
              )}
              onClick={() => onChange(site.slug)}
            >
              {/* Screenshot image */}
              <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden"
                style={{ height: '240px' }}>
                <img
                  src={site.screenshot}
                  alt={site.label}
                  className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.style.display = 'none';
                    const parent = img.parentElement;
                    if (parent) {
                      const colors: Record<string, string> = {
                        Business: '#dbeafe', eCommerce: '#dcfce7', Portfolio: '#f3e8ff',
                        Food: '#fef3c7', Salute: '#fce7f3', Sport: '#ecfdf5',
                        Tech: '#1e293b', Finance: '#1e3a5f', Blog: '#fdf4ff',
                        Lifestyle: '#fff7ed', Servizi: '#f0fdf4',
                      };
                      const emojis: Record<string, string> = {
                        Business: '💼', eCommerce: '🛒', Portfolio: '🎨',
                        Food: '🍽️', Salute: '💊', Sport: '⚡', Tech: '💻',
                        Finance: '📈', Blog: '✍️', Lifestyle: '✨', Servizi: '🔧',
                      };
                      parent.style.background = colors[site.category] ?? '#f1f5f9';
                      parent.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:6px;opacity:0.7">
                        <span style="font-size:28px">${emojis[site.category] ?? '🌐'}</span>
                        <span style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">${site.category}</span>
                      </div>`;
                    }
                  }}
                />

                {/* Top badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {site.isPro ? (
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                      ★ PRO
                    </span>
                  ) : (
                    <span className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                      FREE
                    </span>
                  )}
                </div>

                {/* Selected checkmark overlay */}
                {isSelected && (
                  <div className="absolute inset-0 bg-blue-600/15 flex items-center justify-center">
                    <div className="bg-blue-600 rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Preview link on hover */}
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 bg-black/70 backdrop-blur-sm text-white text-[9px] px-2 py-1 rounded-lg font-semibold transition-all duration-200 hover:bg-black/90 flex items-center gap-1"
                >
                  Demo ↗
                </a>
              </div>

              {/* Card footer */}
              <div className={cn(
                'px-3 py-2.5 transition-colors',
                isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50',
              )}>
                <div className={cn(
                  'text-[12px] font-semibold leading-tight',
                  isSelected ? 'text-blue-700' : 'text-gray-900',
                )}>{site.label}</div>
                <div className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wide font-medium">{site.category}</div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-xs">Nessun tema trovato per "{search}"</div>
        </div>
      )}

      {/* Count */}
      <div className="text-center text-[10px] text-gray-400">
        {filtered.length} temi disponibili · {BLOCKSY_SITES.filter(s => !s.isPro).length} FREE · {BLOCKSY_SITES.filter(s => s.isPro).length} PRO
      </div>
    </div>
  );
}


function WizardStep({ step, form, setForm }: {
  step: number; form: WizardForm; setForm: (f: WizardForm) => void;
}) {
  const set = (k: keyof WizardForm, v: unknown) => setForm({ ...form, [k]: v });

  if (step === 0) return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Dominio del sito</Label>
        <Input value={form.siteDomain} onChange={(e) => set('siteDomain', e.target.value)}
          placeholder="esempio.com" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Nome del sito</Label>
        <Input value={form.siteTitle} onChange={(e) => set('siteTitle', e.target.value)}
          placeholder="Il tuo sito" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Email admin WordPress</Label>
        <Input type="email" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)}
          placeholder="admin@esempio.com" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Lingua</Label>
        <Select value={form.locale} onValueChange={(v) => set('locale', v)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="it">🇮🇹 Italiano</SelectItem>
            <SelectItem value="en">🇬🇧 English</SelectItem>
            <SelectItem value="fr">🇫🇷 Français</SelectItem>
            <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (step === 1) return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Settore / Tipo di business</Label>
        <Input value={form.businessType} onChange={(e) => set('businessType', e.target.value)}
          placeholder="Es. Agenzia web, Ristorante, Studio medico..." className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Descrizione del business</Label>
        <Textarea value={form.businessDescription}
          onChange={(e) => set('businessDescription', e.target.value)}
          placeholder="Descrivi il tuo business, i tuoi servizi e il tuo target cliente..."
          rows={5} className="resize-none text-sm" />
      </div>
      <ThemeSelector value={form.starterSite} onChange={(v) => set('starterSite', v)} />
    </div>
  );

  if (step === 2) return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-gray-600">Palette colori</Label>
        {([
          ['primaryColor', 'Primario', '#3B82F6'],
          ['secondaryColor', 'Secondario', '#8B5CF6'],
          ['accentColor', 'Accento', '#F59E0B'],
        ] as [keyof DesignScheme, string, string][]).map(([key, label, def]) => (
          <div key={key} className="flex items-center gap-2">
            <input type="color"
              value={(form.designScheme[key] as string) || def}
              onChange={(e) => set('designScheme', { ...form.designScheme, [key]: e.target.value })}
              className="h-8 w-8 rounded cursor-pointer border border-gray-200 p-0.5" />
            <span className="text-xs text-gray-500 w-20">{label}</span>
            <Input value={(form.designScheme[key] as string) || def}
              onChange={(e) => set('designScheme', { ...form.designScheme, [key]: e.target.value })}
              className="font-mono text-xs h-8 flex-1" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-600">Font titoli</Label>
        <Select value={form.designScheme.headingFont ?? ''}
          onValueChange={(v) => set('designScheme', { ...form.designScheme, headingFont: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Scegli font..." /></SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {/* Color preview */}
      <div className="rounded-xl p-4 border space-y-2">
        <div className="h-5 rounded" style={{ backgroundColor: form.designScheme.primaryColor ?? '#3B82F6' }} />
        <div className="flex gap-2">
          <div className="h-3 rounded flex-1" style={{ backgroundColor: form.designScheme.secondaryColor ?? '#8B5CF6' }} />
          <div className="h-3 rounded flex-1" style={{ backgroundColor: form.designScheme.accentColor ?? '#F59E0B' }} />
        </div>
        <p className="text-xs font-bold" style={{ color: form.designScheme.primaryColor ?? '#3B82F6', fontFamily: form.designScheme.headingFont }}>
          Anteprima titolo
        </p>
      </div>
    </div>
  );

  // Step 3: Documento XML
  return <XmlStep form={form} setForm={setForm} />;
}

function XmlStep({ form, setForm }: { form: WizardForm; setForm: (f: WizardForm) => void }) {
  const { toast } = useToast();
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<'xml' | 'manual'>(form.xmlBlocks ? 'xml' : 'manual');
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = form.xmlBlocks as ParsedXml | null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast({ title: 'File non supportato', description: 'Carica un file .xml', variant: 'destructive' });
      return;
    }
    setFileName(file.name); setParsing(true);
    try {
      const xmlContent = await file.text();
      const base = getApiBaseUrl();
      const token = localStorage.getItem('doflow_token') ?? '';
      const r = await fetch(`${base}/sitebuilder/parse-xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ xmlContent }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as ParsedXml;
      setForm({ ...form, xmlBlocks: data, contentTopics: data.pages.map((p) => p.title) });
      toast({ title: `✅ XML parsato — ${data.pages.length} pagine rilevate` });
    } catch (err) {
      toast({ title: 'Errore parsing XML', description: String(err), variant: 'destructive' });
      setFileName(null);
    } finally { setParsing(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['xml', 'manual'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={cn('flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all',
              mode === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
            {m === 'xml' ? '📄 Carica XML master doc' : '✍️ Sezioni manuali + AI'}
          </button>
        ))}
      </div>

      {mode === 'xml' ? (
        <div className="space-y-3">
          <div onClick={() => fileRef.current?.click()}
            className={cn('flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              parsing ? 'border-blue-400 bg-blue-50' :
              parsed ? 'border-green-400 bg-green-50' :
              'border-gray-200 hover:border-blue-300 hover:bg-gray-50')}>
            <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleFile} />
            {parsing ? (
              <><Loader2 className="h-7 w-7 text-blue-500 animate-spin" /><p className="text-sm font-medium text-blue-700">Claude sta analizzando l'XML...</p></>
            ) : parsed ? (
              <><CheckCircle2 className="h-7 w-7 text-green-600" /><p className="text-sm font-medium text-green-700">{fileName}</p>
              <p className="text-xs text-gray-500">{parsed.pages.length} pagine · {parsed.pages.reduce((a, p) => a + (p.bricks?.length ?? 0), 0)} blocchi</p>
              <button onClick={(e) => { e.stopPropagation(); setForm({ ...form, xmlBlocks: null }); setFileName(null); }}
                className="text-[10px] text-red-500 hover:underline">Rimuovi</button></>
            ) : (
              <><FileText className="h-7 w-7 text-gray-300" /><p className="text-sm text-gray-500">Carica il tuo <code className="bg-gray-100 px-1 rounded">sitebuilder_master_doc.xml</code></p>
              <p className="text-xs text-gray-400">Clicca o trascina qui</p></>
            )}
          </div>

          {parsed && parsed.pages.length > 0 && (
            <div className="rounded-xl border bg-white p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pagine rilevate</p>
              {parsed.pages.map((page) => (
                <div key={page.slug} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-medium text-gray-700">{page.title}</span>
                  <div className="flex items-center gap-1">
                    {(page.bricks as Brick[])?.slice(0, 4).map((b, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                        {BLOCK_CATALOG[b.type]?.icon ?? '📦'} {b.type}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Claude genererà i contenuti autonomamente basandosi sulle informazioni business fornite.</p>
          <div className="space-y-2">
            {(form.contentTopics ?? []).map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{t}</span>
                <button onClick={() => setForm({ ...form, contentTopics: form.contentTopics.filter((_, idx) => idx !== i) })}
                  className="text-gray-300 hover:text-red-400"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Home', 'Chi Siamo', 'Servizi', 'Portfolio', 'Contatti', 'Blog', 'FAQ', 'Prezzi']
              .filter((s) => !(form.contentTopics ?? []).includes(s))
              .map((s) => (
                <button key={s}
                  onClick={() => setForm({ ...form, contentTopics: [...(form.contentTopics ?? []), s] })}
                  className="px-2.5 py-1 text-xs border border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50">
                  + {s}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  HISTORY PANEL (modal overlay)
// ════════════════════════════════════════════════════════════════════════════
function HistoryPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [jobs, setJobs]       = useState<SitebuilderJob[]>([]);
  const [loading, setLoading] = useState(false);
  // MODIFICA: traccia quale job ha appena copiato il token (feedback visivo)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const base  = getApiBaseUrl();
    const token = localStorage.getItem('doflow_token') ?? '';
    fetch(`${base}/sitebuilder/jobs`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setJobs(data as SitebuilderJob[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  if (!visible) return null;

  // MODIFICA: copia token con feedback 2.5s
  const handleCopyToken = async (job: SitebuilderJob) => {
    if (!job.importToken) return;
    try {
      await navigator.clipboard.writeText(job.importToken);
      setCopiedId(job.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch { /* fallback silenzioso */ }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-900">Storico Build</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          {!loading && jobs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Nessun build precedente</p>
          )}

          {jobs.map((job) => (
            <div key={job.id} className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 space-y-2">
              {/* Riga info */}
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                  job.status === 'DONE'    ? 'bg-green-500' :
                  job.status === 'RUNNING' ? 'bg-blue-500'  : 'bg-red-400')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{job.siteDomain}</p>
                  <p className="text-xs text-gray-400">{new Date(job.createdAt).toLocaleString('it-IT')}</p>
                </div>
                <Badge variant={job.status === 'DONE' ? 'default' : 'secondary'} className="text-xs">
                  {job.status}
                </Badge>
              </div>

              {/* MODIFICA: token display inline per job DONE */}
              {job.status === 'DONE' && job.importToken && (
                <div className="flex items-center gap-2 bg-green-50 rounded-lg px-2 py-1.5">
                  <Key className="h-3 w-3 text-green-600 flex-shrink-0" />
                  <code className="flex-1 font-mono text-xs text-green-800 truncate select-all">
                    {job.importToken}
                  </code>
                  <button
                    onClick={() => handleCopyToken(job)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0',
                      copiedId === job.id
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-green-300 text-green-700 hover:bg-green-600 hover:text-white',
                    )}>
                    {copiedId === job.id
                      ? <><Check className="h-3 w-3" /> Copiato</>
                      : <><Copy className="h-3 w-3" /> Copia</>}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  HISTORY LIST (inline nel wizard)
// ════════════════════════════════════════════════════════════════════════════
function HistoryList() {
  const [jobs, setJobs]       = useState<SitebuilderJob[]>([]);
  const [loading, setLoading] = useState(true);
  // MODIFICA: traccia quale job ha appena copiato il token
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchJobs = useCallback(() => {
    setLoading(true);
    const base  = getApiBaseUrl();
    const token = localStorage.getItem('doflow_token') ?? '';
    fetch(`${base}/sitebuilder/jobs`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setJobs(data as SitebuilderJob[]))
      .catch(() => toast({ title: 'Errore caricamento storico', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // MODIFICA: rimossa handleDownload, aggiunto handleCopyToken
  const handleCopyToken = async (job: SitebuilderJob) => {
    if (!job.importToken) return;
    try {
      await navigator.clipboard.writeText(job.importToken);
      setCopiedId(job.id);
      setTimeout(() => setCopiedId(null), 2500);
      toast({ title: '✅ Token copiato negli appunti' });
    } catch {
      // Fallback: mostra il token nel toast se clipboard non disponibile
      toast({ title: 'Token', description: job.importToken });
    }
  };

  const handleDelete = async (job: SitebuilderJob) => {
    if (!confirm(`Sei sicuro di voler eliminare definitivamente il sito ${job.siteDomain}?`)) return;
    const base  = getApiBaseUrl();
    const token = localStorage.getItem('doflow_token') ?? '';
    try {
      const res = await fetch(`${base}/sitebuilder/jobs/${job.id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok || res.status === 204) {
        toast({ title: '✅ Sito eliminato con successo' });
        fetchJobs();
      } else {
        throw new Error("Errore durante l'eliminazione dal server");
      }
    } catch (error) {
      toast({ title: 'Errore', description: String(error), variant: 'destructive' });
    }
  };

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );
  if (jobs.length === 0) return null;

  return (
    <div className="mt-10 space-y-3">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-gray-500" /> Storico Creazioni
      </h3>

      <div className="grid grid-cols-1 gap-3">
        {jobs.map((job) => (
          <div key={job.id}
            className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all space-y-3">

            {/* Riga info + delete */}
            <div className="flex items-center gap-4">
              <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0',
                job.status === 'DONE'
                  ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                  : job.status === 'RUNNING'
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-red-500')} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {job.siteDomain || 'Sito senza nome'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">
                    {new Date(job.createdAt).toLocaleString('it-IT')}
                  </span>
                  <Badge
                    variant={job.status === 'DONE' ? 'default' : 'secondary'}
                    className="text-[9px] px-1.5 py-0">
                    {job.status}
                  </Badge>
                </div>
              </div>

              {/* Tasto elimina sempre visibile */}
              <button
                onClick={() => handleDelete(job)}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Elimina definitivamente">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* MODIFICA: token display per i job DONE, al posto del bottone ZIP */}
            {job.status === 'DONE' && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
                <Key className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                <code className="flex-1 font-mono text-xs text-green-900 truncate select-all tracking-wider">
                  {job.importToken ?? '(token non disponibile)'}
                </code>
                {job.importToken && (
                  <button
                    onClick={() => handleCopyToken(job)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex-shrink-0',
                      copiedId === job.id
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-green-300 text-green-700 hover:bg-green-600 hover:text-white hover:border-transparent',
                    )}
                    title="Copia token per DoFlow Importer">
                    {copiedId === job.id
                      ? <><ClipboardCheck className="h-3.5 w-3.5" /> Copiato!</>
                      : <><Copy className="h-3.5 w-3.5" /> Copia Token</>}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  WIZARD CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════
const WIZARD_STEPS = [
  { id: 'base', label: 'Impostazioni Base', icon: Settings },
  { id: 'business', label: 'Business & Tema', icon: Building2 },
  { id: 'design', label: 'Stile Visivo', icon: Palette },
  { id: 'content', label: 'Contenuti', icon: FileText },
];

// ════════════════════════════════════════════════════════════════════════════
//  MAIN EXPORT — SitebuilderClient
// ════════════════════════════════════════════════════════════════════════════

export default function SitebuilderClient() {
  const [wizardStep, setWizardStep] = useState(0);
  const [form, setForm] = useState<WizardForm>({
    tenantId: 'public', siteDomain: '', siteTitle: '', adminEmail: '',
    businessType: '', businessDescription: '', starterSite: '',
    designScheme: { primaryColor: '#3B82F6', secondaryColor: '#8B5CF6', accentColor: '#F59E0B' },
    contentTopics: [], locale: 'it', xmlBlocks: null,
  });
  const [editorMode, setEditorMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const canProceed = [
    !!(form.siteDomain && form.siteTitle && form.adminEmail),
    !!(form.businessType && form.starterSite),
    true,
    !!(form.xmlBlocks?.pages?.length || (form.contentTopics ?? []).length >= 1),
  ];

  const hasBlocks = !!form.xmlBlocks?.pages?.length;

  if (editorMode && form.xmlBlocks) {
    return (
      <SiteEditor
        xmlBlocks={form.xmlBlocks}
        form={form}
        onBack={() => setEditorMode(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 z-[100]">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚀</span>
            <span className="font-bold text-gray-900 text-sm">DoFlow Sitebuilder AI</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {WIZARD_STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              <button onClick={() => i < wizardStep && setWizardStep(i)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  i === wizardStep ? 'bg-blue-600 text-white shadow-md' :
                  i < wizardStep ? 'bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200' :
                  'bg-gray-100 text-gray-400 cursor-not-allowed')}>
                <step.icon className="h-3.5 w-3.5" /> {step.label}
              </button>
              {i < WIZARD_STEPS.length - 1 && (
                <div className={cn('flex-1 h-px', i < wizardStep ? 'bg-blue-300' : 'bg-gray-200')} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {WIZARD_STEPS[wizardStep]?.label} {wizardStep === 3 && hasBlocks ? '— XML caricato ✓' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WizardStep step={wizardStep} form={form} setForm={setForm} />
          </CardContent>
        </Card>

        {/* ▼ MOSTRA STORICO SOLO NELLA PRIMA PAGINA ▼ */}
        {wizardStep === 0 && (
          <HistoryList />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setWizardStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" /> Indietro
          </button>

          <div className="flex items-center gap-2">
            {/* Open editor button (when XML parsed) */}
            {wizardStep === 3 && hasBlocks && (
              <button onClick={() => setEditorMode(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md">
                <Edit3 className="h-4 w-4" /> Apri Editor Visuale
              </button>
            )}

            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <button onClick={() => setWizardStep(wizardStep + 1)} disabled={!canProceed[wizardStep]}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl">
                Avanti <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              !hasBlocks && (
                <button onClick={() => setEditorMode(false)} disabled={!canProceed[wizardStep]}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl">
                  <Sparkles className="h-4 w-4" /> Genera con AI
                </button>
              )
            )}
          </div>
        </div>

        {/* XML parsed info */}
        {wizardStep === 3 && hasBlocks && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Documento XML pronto</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {form.xmlBlocks!.pages.length} pagine con {form.xmlBlocks!.pages.reduce((a, p) => a + (p.bricks?.length ?? 0), 0)} blocchi estratti.
                Apri l'Editor Visuale per modificare i contenuti, le immagini e la struttura prima di generare il ZIP.
              </p>
            </div>
          </div>
        )}
      </div>

      <HistoryPanel visible={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
}