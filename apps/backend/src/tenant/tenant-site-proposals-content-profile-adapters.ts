import type { ProposalContentProfile } from './tenant-site-proposals.types';

export type RuntimeContentProfile = Exclude<ProposalContentProfile, 'colsova-legacy-v1'>;

export interface ProposalContentProfileAdapter {
  profile: RuntimeContentProfile;
  runtimeReady: true;
  deterministicBuilder:
    | 'proposal-basic'
    | 'colsova-conversion'
    | 'beauty-editorial'
    | 'beauty-conversion';
  generatedContentKeys: readonly string[];
  fixedCounts: Readonly<Record<string, number>>;
  imageSlots: readonly string[];
  paletteKeys: readonly string[];
  protectedContentPaths: readonly string[];
}

const ADAPTERS: Readonly<Record<RuntimeContentProfile, ProposalContentProfileAdapter>> = {
  'proposal-basic-v2': {
    profile: 'proposal-basic-v2',
    runtimeReady: true,
    deterministicBuilder: 'proposal-basic',
    generatedContentKeys: ['hero', 'approach', 'services', 'benefits', 'trustItems', 'faq', 'contact', 'footer'],
    fixedCounts: { services: 3, trustItems: 6, faq: 6, benefits: 3 },
    imageSlots: ['hero', 'approach', 'services'],
    paletteKeys: ['primary', 'primaryDark', 'primarySoft', 'secondary', 'accent', 'surface', 'surfaceAlt', 'text', 'muted', 'border'],
    protectedContentPaths: [],
  },
  'colsova-conversion-v1': {
    profile: 'colsova-conversion-v1',
    runtimeReady: true,
    deterministicBuilder: 'colsova-conversion',
    generatedContentKeys: ['hero', 'consultation', 'servicesIntro', 'services', 'feature', 'trust', 'process', 'faqIntro', 'faq', 'contact', 'footer', 'headerCta'],
    fixedCounts: { services: 3, reviews: 6, faqs: 6, trustItems: 4, consultationHighlights: 3, processSteps: 3 },
    imageSlots: ['logoDefault', 'logoLight', 'hero', 'consultation', 'feature'],
    paletteKeys: ['ink', 'inkSoft', 'muted', 'ivory', 'cream', 'sand', 'sandSoft', 'gold', 'goldDeep', 'white'],
    protectedContentPaths: ['reviews'],
  },
  'beauty-editorial-v1': {
    profile: 'beauty-editorial-v1',
    runtimeReady: true,
    deterministicBuilder: 'beauty-editorial',
    generatedContentKeys: ['hero', 'trust', 'servicesIntro', 'services', 'about', 'results', 'booking', 'newsletter', 'footer'],
    fixedCounts: { services: 4, results: 3, trustItems: 4 },
    imageSlots: ['logoDefault', 'logoLight', 'hero', 'consultation', 'feature'],
    paletteKeys: ['ink', 'gold', 'cream', 'paper', 'dark'],
    protectedContentPaths: [],
  },
  'beauty-conversion-v1': {
    profile: 'beauty-conversion-v1',
    runtimeReady: true,
    deterministicBuilder: 'beauty-conversion',
    generatedContentKeys: ['hero', 'trust', 'servicesIntro', 'services', 'about', 'results', 'cta', 'newsletter', 'footer'],
    fixedCounts: { services: 5, results: 3, reviews: 3, trustItems: 5, ctaItems: 4 },
    imageSlots: ['logoDefault', 'logoLight', 'hero', 'consultation', 'feature'],
    paletteKeys: ['ink', 'accent', 'peach', 'paper', 'soft'],
    protectedContentPaths: ['reviews'],
  },
};

export function isRuntimeContentProfile(profile: string): profile is RuntimeContentProfile {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, profile);
}

export function getProposalContentProfileAdapter(profile: string): ProposalContentProfileAdapter {
  if (!isRuntimeContentProfile(profile)) {
    throw new Error(`Unsupported proposal content profile: ${profile}`);
  }
  return ADAPTERS[profile];
}

export function hasProposalContentProfileAdapter(profile: string): boolean {
  return isRuntimeContentProfile(profile);
}

export function listProposalContentProfileAdapters(): readonly ProposalContentProfileAdapter[] {
  return Object.values(ADAPTERS);
}
