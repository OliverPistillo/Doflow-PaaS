import { SiteKind, SiteStyleVariation } from './contracts/site-manifest';

export interface SitePreset {
  id: SiteKind;
  label: string;
  styleVariation: SiteStyleVariation;
  legacyThemeId: string;
  defaultPages: string[];
  seoSeed: {
    titleSuffix: string;
    descriptionHint: string;
  };
  structure: {
    home: string[];
    about: string[];
    services: string[];
    pricing: string[];
    contact: string[];
    blog: string[];
    faq: string[];
    caseStudies: string[];
    product?: string[];
    shop?: string[];
  };
  notes: string[];
}

export const SITE_PRESETS: Record<SiteKind, SitePreset> = {
  agency: {
    id: 'agency',
    label: 'Agency',
    styleVariation: 'agency',
    legacyThemeId: 'doflow-zyno',
    defaultPages: ['home', 'about', 'services', 'case-studies', 'contact'],
    seoSeed: {
      titleSuffix: 'Agenzia web performance-first',
      descriptionHint: 'Siti veloci, SEO-ready e orientati alla conversione.',
    },
    structure: {
      home: ['hero', 'trust-logos', 'proof-stats', 'services', 'case-studies', 'testimonials', 'cta'],
      about: ['story', 'values', 'timeline', 'team', 'cta'],
      services: ['service-grid', 'process', 'faq', 'cta'],
      pricing: ['pricing-table', 'comparison', 'faq', 'cta'],
      contact: ['contact-form', 'locations', 'faq'],
      blog: ['blog-grid', 'newsletter', 'cta'],
      faq: ['faq', 'cta'],
      caseStudies: ['case-study-grid', 'results', 'cta'],
      product: ['featured-products', 'benefits', 'cta'],
      shop: ['featured-products', 'benefits', 'cta'],
    },
    notes: ['Focus su autorevolezza, proof e lead generation.'],
  },
  startup: {
    id: 'startup',
    label: 'Startup',
    styleVariation: 'startup',
    legacyThemeId: 'doflow-first',
    defaultPages: ['home', 'product', 'pricing', 'about', 'contact'],
    seoSeed: {
      titleSuffix: 'Startup moderna e scalabile',
      descriptionHint: 'Valore chiaro, prodotto spiegato bene, CTA aggressive ma pulite.',
    },
    structure: {
      home: ['hero', 'proof-stats', 'features', 'process', 'pricing-table', 'cta'],
      about: ['story', 'values', 'team', 'cta'],
      services: ['features', 'process', 'faq', 'cta'],
      pricing: ['pricing-table', 'comparison', 'faq', 'cta'],
      contact: ['contact-form', 'faq'],
      blog: ['blog-grid', 'cta'],
      faq: ['faq', 'cta'],
      caseStudies: ['case-study-grid', 'results', 'cta'],
      product: ['hero', 'features', 'comparison', 'cta'],
      shop: ['featured-products', 'benefits', 'cta'],
    },
    notes: ['Tono rapido, diretto, orientato a prodotto e fiducia.'],
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    styleVariation: 'studio',
    legacyThemeId: 'doflow-artifice',
    defaultPages: ['home', 'services', 'case-studies', 'about', 'contact'],
    seoSeed: {
      titleSuffix: 'Studio digitale premium',
      descriptionHint: 'Visual forte, ma sempre leggibile, premium e conversion-focused.',
    },
    structure: {
      home: ['hero', 'trust-logos', 'bento-features', 'case-studies', 'testimonials', 'cta'],
      about: ['story', 'values', 'team', 'timeline', 'cta'],
      services: ['bento-features', 'process', 'faq', 'cta'],
      pricing: ['pricing-table', 'faq', 'cta'],
      contact: ['contact-form', 'locations', 'cta'],
      blog: ['blog-grid', 'newsletter', 'cta'],
      faq: ['faq', 'cta'],
      caseStudies: ['case-study-grid', 'results', 'cta'],
      product: ['hero', 'features', 'cta'],
      shop: ['featured-products', 'benefits', 'cta'],
    },
    notes: ['Più visuale, ma niente caos tipografico o peso inutile.'],
  },
  'local-business': {
    id: 'local-business',
    label: 'Local Business',
    styleVariation: 'local-business',
    legacyThemeId: 'doflow-konsulty',
    defaultPages: ['home', 'services', 'faq', 'contact'],
    seoSeed: {
      titleSuffix: 'Business locale ad alta conversione',
      descriptionHint: 'Trust immediato, contatti chiari, servizi spiegati senza fumo.',
    },
    structure: {
      home: ['hero', 'proof-stats', 'services', 'testimonials', 'faq', 'cta'],
      about: ['story', 'values', 'team', 'cta'],
      services: ['service-grid', 'process', 'faq', 'cta'],
      pricing: ['pricing-table', 'faq', 'cta'],
      contact: ['contact-form', 'locations', 'faq'],
      blog: ['blog-grid', 'cta'],
      faq: ['faq', 'cta'],
      caseStudies: ['case-study-grid', 'results', 'cta'],
      product: ['featured-products', 'benefits', 'cta'],
      shop: ['featured-products', 'benefits', 'cta'],
    },
    notes: ['Concentrarsi su fiducia, local SEO e chiamate alla azione.'],
  },
  ecommerce: {
    id: 'ecommerce',
    label: 'Ecommerce',
    styleVariation: 'ecommerce',
    legacyThemeId: 'doflow-skintiva',
    defaultPages: ['home', 'shop', 'about', 'faq', 'contact'],
    seoSeed: {
      titleSuffix: 'Ecommerce veloce e orientato alla vendita',
      descriptionHint: 'Focus su prodotti, categorie, trust e checkout senza attriti.',
    },
    structure: {
      home: ['hero', 'trust-logos', 'featured-products', 'benefits', 'testimonials', 'cta'],
      about: ['story', 'values', 'team', 'cta'],
      services: ['featured-products', 'process', 'faq', 'cta'],
      pricing: ['pricing-table', 'faq', 'cta'],
      contact: ['contact-form', 'faq'],
      blog: ['blog-grid', 'newsletter', 'cta'],
      faq: ['faq', 'cta'],
      caseStudies: ['case-study-grid', 'results', 'cta'],
      product: ['hero', 'featured-products', 'comparison', 'cta'],
      shop: ['featured-products', 'benefits', 'cta'],
    },
    notes: ['Serve catalogo pulito, cards leggere e immagini ottimizzate.'],
  },
};

export const SITE_PRESET_IDS = Object.keys(SITE_PRESETS) as SiteKind[];
