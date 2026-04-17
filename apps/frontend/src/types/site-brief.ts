import { SiteKind, SiteStyleVariation } from './site-manifest';

export interface SitePresetSummary {
  id: SiteKind;
  label: string;
  description: string;
  styleVariation: SiteStyleVariation;
  legacyThemeId: string;
  defaultPages: string[];
  seoHint: string;
  focusBullets: string[];
}

export const SITE_PRESETS: SitePresetSummary[] = [
  {
    id: 'agency',
    label: 'Agency',
    description: 'Perfetto per agenzie, consulenti e servizi B2B con forte bisogno di proof e lead generation.',
    styleVariation: 'agency',
    legacyThemeId: 'doflow-zyno',
    defaultPages: ['home', 'about', 'services', 'case-studies', 'contact'],
    seoHint: 'Agenzia web performance-first',
    focusBullets: ['hero chiaro', 'proof immediata', 'CTA visibile', 'SEO pulita'],
  },
  {
    id: 'startup',
    label: 'Startup',
    description: 'Pensato per prodotti nuovi, SaaS e team che devono spiegare valore in pochi secondi.',
    styleVariation: 'startup',
    legacyThemeId: 'doflow-first',
    defaultPages: ['home', 'product', 'pricing', 'about', 'contact'],
    seoHint: 'Startup moderna e scalabile',
    focusBullets: ['value proposition', 'feature grid', 'pricing', 'conversione rapida'],
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Per studi creativi, brand premium e progetti visual-driven senza perdere velocità.',
    styleVariation: 'studio',
    legacyThemeId: 'doflow-artifice',
    defaultPages: ['home', 'services', 'case-studies', 'about', 'contact'],
    seoHint: 'Studio digitale premium',
    focusBullets: ['visual forte', 'tipografia pulita', 'case study', 'trust'],
  },
  {
    id: 'local-business',
    label: 'Local Business',
    description: 'Per attività locali, studi professionali e business che vivono di contatti qualificati.',
    styleVariation: 'local-business',
    legacyThemeId: 'doflow-konsulty',
    defaultPages: ['home', 'services', 'faq', 'contact'],
    seoHint: 'Business locale ad alta conversione',
    focusBullets: ['local SEO', 'trust', 'servizi chiari', 'contatto immediato'],
  },
  {
    id: 'ecommerce',
    label: 'Ecommerce',
    description: 'Per cataloghi, brand retail e negozi che devono vendere veloce e senza attrito.',
    styleVariation: 'ecommerce',
    legacyThemeId: 'doflow-skintiva',
    defaultPages: ['home', 'shop', 'about', 'faq', 'contact'],
    seoHint: 'Ecommerce veloce e orientato alla vendita',
    focusBullets: ['cards leggere', 'categorie chiare', 'trust', 'checkout senza attriti'],
  },
];

export const GOAL_OPTIONS = [
  'Generazione Lead / Contatti',
  'Vendita Diretta (E-commerce)',
  'Brand Awareness',
  'Portfolio / Vetrina',
  'Educativo / Informativo',
] as const;

export const TONE_OPTIONS = [
  'Professionale & Autorevole',
  'Amichevole & Empatico',
  'Tecnico & Innovativo',
  'Creativo & Audace',
  'Lusso & Esclusivo',
] as const;

export const SITE_KINDS = SITE_PRESETS.map((preset) => preset.id) as SiteKind[];
