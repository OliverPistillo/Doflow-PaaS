export type SiteKind = 'agency' | 'startup' | 'studio' | 'local-business' | 'ecommerce';

export type SiteStyleVariation =
  | 'agency'
  | 'startup'
  | 'studio'
  | 'ecommerce'
  | 'local-business'
  | 'minimal'
  | 'premium-dark'
  | 'editorial';

export interface SiteBrand {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export interface SiteSeo {
  title: string;
  description: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  canonicalBaseUrl?: string;
}

export interface SiteMedia {
  heroImage?: string;
  heroVideo?: string;
  logos?: string[];
  gallery?: string[];
  avatar?: string;
}

export interface SiteSectionContent {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  bullets?: string[];
  stats?: Array<{ value: string; label: string }>;
  items?: Array<Record<string, unknown>>;
  testimonial?: { quote: string; author: string; role?: string };
  media?: Record<string, string>;
}

export interface SiteSection {
  kind: string;
  variant?: string;
  blockPattern?: string;
  anchor?: string;
  content: SiteSectionContent;
}

export interface SitePage {
  slug: string;
  title: string;
  isFrontPage?: boolean;
  sections: SiteSection[];
}

export interface SiteManifest {
  manifestVersion: 'v1';
  siteId: string;
  exportId: string;
  createdAt: string;
  updatedAt: string;
  themeId: string;
  styleVariation: SiteStyleVariation;
  siteKind: SiteKind;
  locale: string;
  language: string;
  brand: SiteBrand;
  seo: SiteSeo;
  media: SiteMedia;
  pages: SitePage[];
  notes?: string[];
  legacyThemeId?: string;
}

export interface SiteBrief {
  companyName: string;
  siteKind: SiteKind;
  industry?: string;
  targetAudience?: string;
  goals?: string[];
  usp?: string;
  toneOfVoice?: string;
  keywords?: string[];
  pages?: string[];
  additionalInfo?: string;
  locale?: string;
  language?: string;
  brand?: Partial<SiteBrand>;
}

export interface SiteGenerationResponse {
  jobId: string;
  status: string;
}

export interface SiteGenerationStatusResponse {
  status: string;
  token?: string | null;
  exportId?: string | null;
  manifest?: SiteManifest | null;
}
