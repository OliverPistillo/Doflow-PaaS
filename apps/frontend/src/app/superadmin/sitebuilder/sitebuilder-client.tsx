// apps/frontend/src/app/superadmin/sitebuilder/sitebuilder-client.tsx
'use client';

import React, { useState, useReducer, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  GripVertical, Trash2, Copy, ChevronUp, ChevronDown, Plus, Layers,
  Monitor, Tablet, Smartphone, Undo2, Redo2, Eye, X,
  Type, Image as ImageIcon, Link2, Globe, Building2, FileText, Zap, Loader2,
  CheckCircle2, Palette, Search, Settings, Edit3, PanelLeftClose,
  ArrowLeft, Sparkles, ChevronRight, Check, AlertCircle, FolderOpen,
  LayoutTemplate, Move, MousePointerClick, Key, ClipboardCheck, Upload,
  LayoutGrid, Grid3X3, List, Star, Lock, Download, ExternalLink
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// ════════════════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════════════════

type Device = 'desktop' | 'tablet' | 'mobile';

interface BrickItem {
  title: string;
  description: string;
}

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

interface SitePage {
  slug: string;
  title: string;
  bricks: Brick[];
}

interface ParsedXml {
  strategy?: Record<string, string>;
  pages: SitePage[];
}

interface DesignScheme {
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
  designScheme: DesignScheme;
  contentTopics: string[];
  locale: string;
  xmlBlocks?: ParsedXml | null;
}

interface SitebuilderJob {
  id: string;
  status: string;
  siteDomain: string;
  siteTitle: string;
  logs: string[];
  importToken?: string;
  createdAt: string;
}

// Template avanzati con anteprime
interface StarterTemplate {
  slug: string;
  label: string;
  category: string;
  isPro: boolean;
  screenshot: string;
  description: string;
  features: string[];
  pages: string[];
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  // FREE TEMPLATES
  {
    slug: 'consultant',
    label: 'Consultant Pro',
    category: 'Business',
    isPro: false,
    screenshot: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
    description: 'Perfetto per consulenti e professionisti',
    features: ['Homepage', 'Chi Siamo', 'Servizi', 'Contatti'],
    pages: ['home', 'about', 'services', 'contact']
  },
  {
    slug: 'restaurant',
    label: 'Gusto Italiano',
    category: 'Food',
    isPro: false,
    screenshot: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    description: 'Ristoranti e attività gastronomiche',
    features: ['Menu', 'Prenotazioni', 'Galleria', 'Contatti'],
    pages: ['home', 'menu', 'gallery', 'contact']
  },
  {
    slug: 'agency',
    label: 'Digital Agency',
    category: 'Business',
    isPro: false,
    screenshot: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    description: 'Agenzie digitali e creative',
    features: ['Portfolio', 'Servizi', 'Team', 'Blog'],
    pages: ['home', 'portfolio', 'services', 'team', 'blog']
  },
  {
    slug: 'medical',
    label: 'HealthCare Plus',
    category: 'Salute',
    isPro: false,
    screenshot: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=800&q=80',
    description: 'Studi medici e strutture sanitarie',
    features: ['Servizi', 'Prenotazioni', 'Staff', 'FAQ'],
    pages: ['home', 'services', 'staff', 'booking', 'faq']
  },
  {
    slug: 'ecommerce',
    label: 'Modern Store',
    category: 'eCommerce',
    isPro: false,
    screenshot: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80',
    description: 'Negozi online moderni',
    features: ['Shop', 'Prodotti', 'Carrello', 'Checkout'],
    pages: ['home', 'shop', 'product', 'cart', 'checkout']
  },
  {
    slug: 'portfolio',
    label: 'Creative Portfolio',
    category: 'Portfolio',
    isPro: false,
    screenshot: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
    description: 'Portfolio creativi e artistici',
    features: ['Galleria', 'Progetti', 'About', 'Contatti'],
    pages: ['home', 'projects', 'gallery', 'about', 'contact']
  },
  
  // PRO TEMPLATES
  {
    slug: 'saas-tech',
    label: 'SaaS Innovate',
    category: 'Tech',
    isPro: true,
    screenshot: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    description: 'Piattaforme SaaS e tech',
    features: ['Pricing', 'Features', 'Demo', 'Dashboard'],
    pages: ['home', 'features', 'pricing', 'demo', 'dashboard']
  },
  {
    slug: 'real-estate',
    label: 'Luxury Estate',
    category: 'Real Estate',
    isPro: true,
    screenshot: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
    description: 'Immobiliare di lusso',
    features: ['Listings', 'Map Search', 'Agenti', 'Blog'],
    pages: ['home', 'listings', 'agents', 'blog', 'contact']
  },
];

const FONTS = [
  { value: 'Inter, sans-serif', label: 'Inter (moderno)' },
  { value: '"Playfair Display", serif', label: 'Playfair Display (elegante)' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat (corporate)' },
  { value: '"Merriweather", serif', label: 'Merriweather (editoriale)' },
  { value: '"Roboto", sans-serif', label: 'Roboto (clean)' },
  { value: '"Poppins", sans-serif', label: 'Poppins (friendly)' },
];

const CATEGORIES = ['Tutti', 'Business', 'Food', 'Tech', 'eCommerce', 'Portfolio', 'Salute', 'Real Estate'];

// ════════════════════════════════════════════════════════════════════════════
//  COMPONENTI WIZARD
// ════════════════════════════════════════════════════════════════════════════

function TemplateSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [category, setCategory] = useState('Tutti');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filtered = STARTER_TEMPLATES.filter((t) => {
    const matchCat = category === 'Tutti' || t.category === category;
    const matchSearch = search === '' || 
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Search e filtri */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca template..."
            className="pl-10 h-10"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 w-8 p-0"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Categorie */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={category === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory(cat)}
            className="whitespace-nowrap"
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Template grid/list */}
      <div className={cn(
        "gap-4",
        viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"
      )}>
        {filtered.map((template) => {
          const isSelected = value === template.slug;
          return (
            <Card
              key={template.slug}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg overflow-hidden group",
                isSelected ? "ring-2 ring-blue-500 shadow-xl" : ""
              )}
              onClick={() => onChange(template.slug)}
            >
              {/* Screenshot */}
              <div className="relative aspect-video bg-gray-100 overflow-hidden">
                <img
                  src={template.screenshot}
                  alt={template.label}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/600x400?text=' + encodeURIComponent(template.label);
                  }}
                />
                {template.isPro && (
                  <Badge className="absolute top-2 right-2 bg-gradient-to-r from-amber-500 to-orange-500">
                    <Star className="h-3 w-3 mr-1" /> PRO
                  </Badge>
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                    <div className="bg-blue-600 rounded-full p-2">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-lg">{template.label}</h3>
                    <p className="text-sm text-gray-500">{template.category}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                
                {/* Features */}
                <div className="flex flex-wrap gap-1">
                  {template.features.slice(0, 3).map((feature, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {template.features.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{template.features.length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nessun template trovato</p>
        </div>
      )}

      {/* Stats */}
      <div className="text-center text-sm text-gray-500">
        {filtered.length} template disponibili · {STARTER_TEMPLATES.filter(t => !t.isPro).length} FREE · {STARTER_TEMPLATES.filter(t => t.isPro).length} PRO
      </div>
    </div>
  );
}

function XmlUpload({ form, setForm }: { form: WizardForm; setForm: (f: WizardForm) => void }) {
  const { toast } = useToast();
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      toast({
        title: 'Formato non valido',
        description: 'Carica un file XML',
        variant: 'destructive'
      });
      return;
    }

    setParsing(true);
    try {
      const content = await file.text();
      const response = await fetch('/api/sitebuilder/parse-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xmlContent: content })
      });

      if (!response.ok) throw new Error('Parsing fallito');

      const data = await response.json() as ParsedXml;
      setForm({ ...form, xmlBlocks: data, contentTopics: data.pages.map(p => p.title) });
      
      toast({
        title: '✅ XML caricato',
        description: `${data.pages.length} pagine rilevate`
      });
    } catch (error) {
      toast({
        title: 'Errore',
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setParsing(false);
    }
  };

  const parsed = form.xmlBlocks;

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          parsing ? "border-blue-400 bg-blue-50" :
          parsed ? "border-green-400 bg-green-50" :
          "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          className="hidden"
          onChange={handleFileUpload}
        />
        
        {parsing ? (
          <div className="space-y-2">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-500" />
            <p className="text-sm font-medium text-blue-700">Analisi XML in corso...</p>
          </div>
        ) : parsed ? (
          <div className="space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-600" />
            <p className="text-sm font-medium text-green-700">XML caricato con successo</p>
            <p className="text-xs text-gray-600">
              {parsed.pages.length} pagine · {parsed.pages.reduce((acc, p) => acc + p.bricks.length, 0)} blocchi
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setForm({ ...form, xmlBlocks: null });
              }}
            >
              Rimuovi
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Carica il tuo XML master doc</p>
            <p className="text-xs text-gray-500">Trascina o clicca per selezionare</p>
          </div>
        )}
      </div>

      {parsed && parsed.pages.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="pages">
            <AccordionTrigger>Pagine rilevate ({parsed.pages.length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {parsed.pages.map((page, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-sm">{page.title}</span>
                    <Badge variant="secondary">{page.bricks.length} blocchi</Badge>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

// ... (continua con gli altri componenti del wizard e l'editor)

export default function SitebuilderClient() {
  const [wizardStep, setWizardStep] = useState(0);
  const [form, setForm] = useState<WizardForm>({
    tenantId: 'public',
    siteDomain: '',
    siteTitle: '',
    adminEmail: '',
    businessType: '',
    businessDescription: '',
    starterSite: '',
    designScheme: { 
      primaryColor: '#3B82F6', 
      secondaryColor: '#8B5CF6', 
      accentColor: '#F59E0B',
      headingFont: 'Inter, sans-serif'
    },
    contentTopics: [],
    locale: 'it',
    xmlBlocks: null,
  });
  const [editorMode, setEditorMode] = useState(false);

  const canProceed = [
    !!(form.siteDomain && form.siteTitle && form.adminEmail),
    !!(form.businessType && form.starterSite),
    true,
    !!(form.xmlBlocks?.pages?.length || form.contentTopics.length >= 1),
  ];

  if (editorMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-4 bg-white border-b">
          <Button variant="ghost" onClick={() => setEditorMode(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Torna al wizard
          </Button>
        </div>
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-center space-y-4">
            <LayoutTemplate className="h-16 w-16 mx-auto text-gray-300" />
            <h2 className="text-2xl font-bold">Editor Visuale</h2>
            <p className="text-gray-600">Qui apparirà l'editor drag-and-drop completo</p>
            <Button onClick={() => setEditorMode(false)}>
              Torna al wizard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white p-2 rounded-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                DoFlow Sitebuilder AI
              </h1>
              <p className="text-xs text-gray-500">Crea il tuo sito WordPress in pochi minuti</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Progress steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {['Impostazioni Base', 'Business & Tema', 'Stile Visivo', 'Contenuti'].map((step, i) => (
              <React.Fragment key={step}>
                <button
                  onClick={() => i < wizardStep && setWizardStep(i)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                    i === wizardStep ? "bg-blue-600 text-white shadow-lg" :
                    i < wizardStep ? "bg-blue-100 text-blue-700 hover:bg-blue-200" :
                    "bg-gray-100 text-gray-400"
                  )}
                >
                  {i === 0 && <Settings className="h-4 w-4" />}
                  {i === 1 && <Building2 className="h-4 w-4" />}
                  {i === 2 && <Palette className="h-4 w-4" />}
                  {i === 3 && <FileText className="h-4 w-4" />}
                  {step}
                </button>
                {i < 3 && <div className={cn("flex-1 h-0.5 mx-4", i < wizardStep ? "bg-blue-300" : "bg-gray-200")} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step content */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            {wizardStep === 0 && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Dominio del sito</Label>
                  <Input
                    value={form.siteDomain}
                    onChange={(e) => setForm({ ...form, siteDomain: e.target.value })}
                    placeholder="esempio.com"
                    className="h-11"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Nome del sito</Label>
                  <Input
                    value={form.siteTitle}
                    onChange={(e) => setForm({ ...form, siteTitle: e.target.value })}
                    placeholder="Il tuo sito"
                    className="h-11"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Email admin WordPress</Label>
                  <Input
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    placeholder="admin@esempio.com"
                    className="h-11"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Lingua</Label>
                  <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v })}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {wizardStep === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Settore / Tipo di business</Label>
                  <Input
                    value={form.businessType}
                    onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                    placeholder="Es. Agenzia web, Ristorante, Studio medico..."
                    className="h-11"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-4 block">Scegli un template</Label>
                  <TemplateSelector
                    value={form.starterSite}
                    onChange={(v) => setForm({ ...form, starterSite: v })}
                  />
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Palette colori</Label>
                  <div className="space-y-3">
                    {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((key) => (
                      <div key={key} className="flex items-center gap-3">
                        <input
                          type="color"
                          value={form.designScheme[key] || '#3B82F6'}
                          onChange={(e) => setForm({
                            ...form,
                            designScheme: { ...form.designScheme, [key]: e.target.value }
                          })}
                          className="h-10 w-10 rounded border cursor-pointer"
                        />
                        <Input
                          value={form.designScheme[key] || ''}
                          onChange={(e) => setForm({
                            ...form,
                            designScheme: { ...form.designScheme, [key]: e.target.value }
                          })}
                          className="flex-1 font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Font titoli</Label>
                  <Select
                    value={form.designScheme.headingFont}
                    onValueChange={(v) => setForm({ ...form, designScheme: { ...form.designScheme, headingFont: v } })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONTS.map((font) => (
                        <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-semibold mb-4 block">Carica XML o genera con AI</Label>
                  <XmlUpload form={form} setForm={setForm} />
                </div>
                
                {!form.xmlBlocks && (
                  <div>
                    <Label className="text-sm font-semibold mb-3 block">Seleziona le pagine da generare</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Home', 'Chi Siamo', 'Servizi', 'Contatti', 'FAQ', 'Blog'].map((page) => (
                        <Button
                          key={page}
                          variant={form.contentTopics.includes(page) ? 'default' : 'outline'}
                          onClick={() => {
                            const topics = form.contentTopics.includes(page)
                              ? form.contentTopics.filter(t => t !== page)
                              : [...form.contentTopics, page];
                            setForm({ ...form, contentTopics: topics });
                          }}
                        >
                          {form.contentTopics.includes(page) && <Check className="h-4 w-4 mr-2" />}
                          {page}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="ghost"
            onClick={() => setWizardStep(Math.max(0, wizardStep - 1))}
            disabled={wizardStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Indietro
          </Button>
          
          {wizardStep < 3 ? (
            <Button
              onClick={() => setWizardStep(wizardStep + 1)}
              disabled={!canProceed[wizardStep]}
              className="px-6"
            >
              Avanti <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => setEditorMode(true)}
              disabled={!canProceed[wizardStep]}
              className="px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Sparkles className="h-4 w-4 mr-2" /> Apri Editor & Genera
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}