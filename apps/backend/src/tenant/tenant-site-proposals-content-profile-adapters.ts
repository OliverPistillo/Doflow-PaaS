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
  requiredVisibleTextPaths: readonly string[];
  minimumVisibleChanges: number;
  visibleChangeRequirements: readonly (readonly string[])[];
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
    requiredVisibleTextPaths: [
      'content.hero.title', 'content.hero.description', 'content.services.0.description',
      'content.services.1.description', 'content.services.2.description', 'content.approach.description',
      'content.contact.cta', 'content.footer.text',
    ],
    minimumVisibleChanges: 4,
    visibleChangeRequirements: [
      ['content.hero.title', 'content.hero.description'],
      ['content.services.0.description', 'content.services.1.description', 'content.services.2.description'],
      ['content.contact.cta'], ['content.approach.description', 'content.footer.text'],
    ],
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
    requiredVisibleTextPaths: [
      'content.hero.title', 'content.hero.description', 'content.consultation.paragraphs.0',
      'content.servicesIntro.description', 'content.services.0.description', 'content.services.1.description',
      'content.services.2.description', 'content.feature.description', 'content.faqIntro.description',
      'content.process.description', 'content.contact.description', 'content.headerCta',
      'content.footer.description',
    ],
    minimumVisibleChanges: 7,
    visibleChangeRequirements: [
      ['content.hero.title', 'content.hero.description'],
      ['content.services.0.description', 'content.services.1.description', 'content.services.2.description'],
      ['content.headerCta', 'content.contact.description'],
      ['content.consultation.paragraphs.0', 'content.feature.description', 'content.process.description', 'content.footer.description'],
    ],
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
    requiredVisibleTextPaths: [
      'content.hero.title', 'content.hero.description', 'content.servicesIntro.title',
      'content.services.0.description', 'content.services.1.description', 'content.services.2.description',
      'content.services.3.description', 'content.about.description', 'content.results.items.0.quote',
      'content.results.items.1.quote', 'content.results.items.2.quote', 'content.booking.description',
      'content.booking.cta', 'content.newsletter.description', 'content.footer.description',
    ],
    minimumVisibleChanges: 8,
    visibleChangeRequirements: [
      ['content.hero.title', 'content.hero.description'],
      ['content.services.0.description', 'content.services.1.description', 'content.services.2.description', 'content.services.3.description'],
      ['content.booking.cta'],
      ['content.about.description', 'content.booking.description', 'content.newsletter.description', 'content.footer.description'],
    ],
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
    requiredVisibleTextPaths: [
      'content.hero.title', 'content.hero.description', 'content.servicesIntro.title',
      'content.services.0.description', 'content.services.1.description', 'content.services.2.description',
      'content.services.3.description', 'content.services.4.description', 'content.about.description',
      'content.results.title', 'content.trust.0.description', 'content.trust.1.description',
      'content.trust.2.description', 'content.trust.3.description', 'content.trust.4.description',
      'content.cta.description', 'content.cta.button', 'content.newsletter.title', 'content.footer.description',
    ],
    minimumVisibleChanges: 10,
    visibleChangeRequirements: [
      ['content.hero.title', 'content.hero.description'],
      ['content.services.0.description', 'content.services.1.description', 'content.services.2.description', 'content.services.3.description', 'content.services.4.description'],
      ['content.cta.button', 'content.cta.description'],
      ['content.about.description', 'content.newsletter.title', 'content.footer.description'],
    ],
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
