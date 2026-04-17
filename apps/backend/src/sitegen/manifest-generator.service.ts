import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { randomUUID } from 'crypto';
import {
  SiteBrief,
  SiteCopyDraft,
  SiteGenerationResult,
  SiteManifest,
  SitePage,
  SiteSection,
} from './contracts/site-manifest';
import { SITE_PRESETS, SitePreset } from './site-presets.registry';
import { legacyThemeIdForSiteKind } from './theme-compat/theme-map';

@Injectable()
export class ManifestGeneratorService {
  private readonly logger = new Logger(ManifestGeneratorService.name);
  private readonly genAI?: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async generate(brief: SiteBrief): Promise<SiteGenerationResult> {
    const preset = SITE_PRESETS[brief.siteKind] ?? SITE_PRESETS.agency;
    const copy = await this.generateCopy(brief, preset);

    return {
      copy,
      manifest: this.buildManifest(brief, preset, copy),
    };
  }

  private async generateCopy(brief: SiteBrief, preset: SitePreset): Promise<SiteCopyDraft> {
    const fallback = this.buildDeterministicCopy(brief, preset);

    if (!this.genAI) {
      return fallback;
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
      });

      const prompt = this.buildCopyPrompt(brief, preset, fallback);
      const result = await model.generateContent(prompt);
      const rawText = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawText) as Partial<SiteCopyDraft>;

      return this.mergeCopy(fallback, parsed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Copy generation fallback activated: ${msg}`);
      return fallback;
    }
  }

  private buildCopyPrompt(brief: SiteBrief, preset: SitePreset, fallback: SiteCopyDraft): string {
    return [
      'Sei un senior copywriter CRO per siti web ad alte prestazioni.',
      'Genera copy in italiano, pulito, persuasivo, senza HTML.',
      '',
      `Azienda: ${brief.companyName}`,
      `Tipo sito: ${preset.label}`,
      `Settore: ${brief.industry || 'non specificato'}`,
      `Target: ${brief.targetAudience || 'non specificato'}`,
      `Obiettivi: ${(brief.goals || []).join(', ') || 'lead generation'}`,
      `USP: ${brief.usp || 'non specificato'}`,
      `Tone of voice: ${brief.toneOfVoice || 'professionale'}`,
      `Keyword: ${(brief.keywords || []).join(', ') || 'non specificate'}`,
      `Info aggiuntive: ${brief.additionalInfo || 'nessuna'}`,
      '',
      'Restituisci SOLO JSON valido con queste chiavi:',
      'heroTitle, heroDescription, heroCtaLabel, heroCtaSecondaryLabel, proofHeading, proofStats, servicesHeading, services, processHeading, processSteps, testimonialsHeading, testimonials, faqHeading, faqs, ctaHeading, ctaDescription, ctaLabel',
      '',
      'Esempio di tono: chiaro, concreto, moderno, orientato a conversione.',
      `Suggerimento di riferimento: ${JSON.stringify(fallback)}`,
    ].join('\n');
  }

  private buildDeterministicCopy(brief: SiteBrief, preset: SitePreset): SiteCopyDraft {
    const company = brief.companyName;
    const focus = brief.usp || brief.industry || 'performance e qualità';
    const audience = brief.targetAudience || 'clienti qualificati';
    const goals = brief.goals?.length ? brief.goals.join(', ') : 'contatti e conversioni';

    return {
      heroTitle: `${company}: siti veloci che convertono`,
      heroDescription: `Progettiamo siti web per ${audience}, con attenzione a SEO, velocità e chiarezza del messaggio. Focus su ${focus}.`,
      heroCtaLabel: 'Richiedi una demo',
      heroCtaSecondaryLabel: 'Vedi il metodo',
      proofHeading: 'Numeri che contano',
      proofStats: [
        { value: '99', label: 'Core Web Vitals' },
        { value: '3x', label: 'Più chiarezza' },
        { value: '24h', label: 'Primo concept' },
      ],
      servicesHeading: 'Cosa facciamo',
      services: [
        { title: 'Struttura SEO', description: `Architettura pensata per ${goals}.` },
        { title: 'Design conversione', description: 'Layout puliti, gerarchia forte, CTA chiare.' },
        { title: 'Performance reale', description: 'Asset leggeri, immagini ottimizzate, HTML semantico.' },
      ],
      processHeading: 'Metodo semplice',
      processSteps: [
        { title: 'Brief', description: 'Definiamo obiettivi, tono, struttura e contenuti.' },
        { title: 'Generazione', description: 'Costruiamo le sezioni con blocchi nativi e pattern solidi.' },
        { title: 'Polish', description: 'Raffiniamo copy, UX, mobile e velocità.' },
      ],
      testimonialsHeading: 'Cosa vedono i clienti',
      testimonials: [
        {
          quote: 'Finalmente un sito che sembra vivo e non un template travestito.',
          author: company,
          role: 'Cliente ideale',
        },
      ],
      faqHeading: 'Domande frequenti',
      faqs: [
        { question: 'Quanto è veloce il sito?', answer: 'Progettiamo per caricare rapidamente e restare stabile su mobile.' },
        { question: 'Posso modificare i contenuti?', answer: 'Sì, il risultato finale resta nativo e facilmente editabile.' },
      ],
      ctaHeading: 'Pronto a partire?',
      ctaDescription: `Trasformiamo il brief in un sito chiaro, veloce e orientato ai risultati per ${preset.label.toLowerCase()}.`,
      ctaLabel: 'Parliamone',
    };
  }

  private mergeCopy(fallback: SiteCopyDraft, parsed: Partial<SiteCopyDraft>): SiteCopyDraft {
    return {
      heroTitle: parsed.heroTitle?.trim() || fallback.heroTitle,
      heroDescription: parsed.heroDescription?.trim() || fallback.heroDescription,
      heroCtaLabel: parsed.heroCtaLabel?.trim() || fallback.heroCtaLabel,
      heroCtaSecondaryLabel: parsed.heroCtaSecondaryLabel?.trim() || fallback.heroCtaSecondaryLabel,
      proofHeading: parsed.proofHeading?.trim() || fallback.proofHeading,
      proofStats: Array.isArray(parsed.proofStats) && parsed.proofStats.length ? parsed.proofStats : fallback.proofStats,
      servicesHeading: parsed.servicesHeading?.trim() || fallback.servicesHeading,
      services: Array.isArray(parsed.services) && parsed.services.length ? parsed.services : fallback.services,
      processHeading: parsed.processHeading?.trim() || fallback.processHeading,
      processSteps: Array.isArray(parsed.processSteps) && parsed.processSteps.length ? parsed.processSteps : fallback.processSteps,
      testimonialsHeading: parsed.testimonialsHeading?.trim() || fallback.testimonialsHeading,
      testimonials: Array.isArray(parsed.testimonials) && parsed.testimonials.length ? parsed.testimonials : fallback.testimonials,
      faqHeading: parsed.faqHeading?.trim() || fallback.faqHeading,
      faqs: Array.isArray(parsed.faqs) && parsed.faqs.length ? parsed.faqs : fallback.faqs,
      ctaHeading: parsed.ctaHeading?.trim() || fallback.ctaHeading,
      ctaDescription: parsed.ctaDescription?.trim() || fallback.ctaDescription,
      ctaLabel: parsed.ctaLabel?.trim() || fallback.ctaLabel,
    };
  }

  private buildManifest(brief: SiteBrief, preset: SitePreset, copy: SiteCopyDraft): SiteManifest {
    const now = new Date().toISOString();
    const exportId = randomUUID();
    const siteId = randomUUID();
    const themeId = process.env.DOFLOW_THEME_ID || 'doflow-theme';

    const selectedPages = this.resolvePages(brief.pages, preset);
    const pages = selectedPages.map((pageSlug, index) =>
      this.buildPage(pageSlug, preset, copy, index === 0),
    );

    const brand = {
      name: brief.companyName,
      primaryColor: brief.brand?.primaryColor || '#5344F4',
      secondaryColor: brief.brand?.secondaryColor || '#1E1E26',
      accentColor: brief.brand?.accentColor || '#7C5CFF',
      logoUrl: brief.brand?.logoUrl,
      faviconUrl: brief.brand?.faviconUrl,
    };

    return {
      manifestVersion: 'v1',
      siteId,
      exportId,
      createdAt: now,
      updatedAt: now,
      themeId,
      styleVariation: preset.styleVariation,
      siteKind: brief.siteKind,
      locale: brief.locale || 'it-IT',
      language: brief.language || 'it',
      brand,
      seo: {
        title: `${brief.companyName} — ${preset.seoSeed.titleSuffix}`,
        description:
          brief.additionalInfo?.trim() ||
          `${brief.companyName}: ${preset.seoSeed.descriptionHint}`,
        keywords: brief.keywords,
      },
      media: {
        logos: [],
      },
      pages,
      notes: preset.notes,
      legacyThemeId: legacyThemeIdForSiteKind(brief.siteKind),
    };
  }

  private resolvePages(pages: string[] | undefined, preset: SitePreset): string[] {
    if (pages?.length) {
      return pages;
    }
    return preset.defaultPages;
  }

  private buildPage(slug: string, preset: SitePreset, copy: SiteCopyDraft, isFrontPage: boolean): SitePage {
    const pageKey = this.normalizePageKey(slug);
    const sections = this.buildSectionsForPage(pageKey, preset, copy);
    const title = this.pageTitleFromSlug(slug);

    return {
      slug,
      title,
      isFrontPage,
      sections,
    };
  }

  private buildSectionsForPage(pageKey: string, preset: SitePreset, copy: SiteCopyDraft): SiteSection[] {
    const structure = preset.structure[pageKey as keyof SitePreset['structure']] || preset.structure.home;

    return structure.map((sectionKind): SiteSection => {
      switch (sectionKind) {
        case 'hero':
          return {
            kind: 'hero',
            variant: 'premium',
            blockPattern: 'hero-premium',
            anchor: 'hero',
            content: {
              eyebrow: preset.label,
              heading: copy.heroTitle,
              body: copy.heroDescription,
              ctaLabel: copy.heroCtaLabel,
              ctaHref: '#contact',
              bullets: ['SEO ottimizzata', 'Velocità estrema', 'CRO orientata ai risultati'],
            },
          };
        case 'trust-logos':
          return {
            kind: 'trust-logos',
            blockPattern: 'trust-logos',
            anchor: 'proof',
            content: {
              eyebrow: 'Trust',
              heading: copy.proofHeading,
              items: [],
            },
          };
        case 'proof-stats':
          return {
            kind: 'proof-stats',
            blockPattern: 'proof-stats',
            content: {
              heading: copy.proofHeading,
              stats: copy.proofStats,
            },
          };
        case 'services':
        case 'service-grid':
        case 'features':
        case 'bento-features':
          return {
            kind: sectionKind,
            variant: sectionKind === 'bento-features' ? 'bento' : 'grid',
            blockPattern: sectionKind,
            content: {
              heading: copy.servicesHeading,
              items: copy.services.map((service) => ({
                title: service.title,
                description: service.description,
              })),
            },
          };
        case 'process':
          return {
            kind: 'process',
            blockPattern: 'process',
            content: {
              heading: copy.processHeading,
              items: copy.processSteps.map((step, index) => ({
                step: String(index + 1).padStart(2, '0'),
                title: step.title,
                description: step.description,
              })),
            },
          };
        case 'case-studies':
        case 'case-study-grid':
          return {
            kind: 'case-study-grid',
            blockPattern: 'case-study-grid',
            content: {
              heading: 'Progetti e risultati',
              items: [
                { title: 'Primo incremento visibile', description: 'Architettura più chiara e navigazione più semplice.' },
                { title: 'SEO e velocità', description: 'Markup pulito, immagini ottimizzate, core web vitals sotto controllo.' },
              ],
            },
          };
        case 'testimonials':
          return {
            kind: 'testimonials',
            blockPattern: 'testimonials-grid',
            content: {
              heading: copy.testimonialsHeading,
              items: copy.testimonials.map((t) => ({
                quote: t.quote,
                author: t.author,
                role: t.role,
              })),
            },
          };
        case 'pricing-table':
          return {
            kind: 'pricing-table',
            blockPattern: 'pricing-simple',
            content: {
              heading: 'Piani chiari',
              items: [
                { title: 'Base', description: 'Una soluzione solida per partire subito.' },
                { title: 'Growth', description: 'Più sezioni, più proof, più conversione.' },
                { title: 'Premium', description: 'Custom, performance e copy su misura.' },
              ],
            },
          };
        case 'comparison':
          return {
            kind: 'comparison',
            blockPattern: 'comparison',
            content: {
              heading: 'Perché scegliere Doflow',
              items: [
                { title: 'Velocità', description: 'Siti snelli, senza grasso inutile.' },
                { title: 'SEO', description: 'Gerarchie corrette e contenuti scansionabili.' },
                { title: 'Conversione', description: 'CTA e fiducia nel punto giusto.' },
              ],
            },
          };
        case 'faq':
          return {
            kind: 'faq',
            blockPattern: 'faq-accordion',
            content: {
              heading: copy.faqHeading,
              items: copy.faqs.map((faq) => ({
                question: faq.question,
                answer: faq.answer,
              })),
            },
          };
        case 'cta':
          return {
            kind: 'cta',
            blockPattern: 'cta-strip',
            content: {
              heading: copy.ctaHeading,
              body: copy.ctaDescription,
              ctaLabel: copy.ctaLabel,
              ctaHref: '#contact',
            },
          };
        case 'contact-form':
          return {
            kind: 'contact-form',
            blockPattern: 'contact-compact',
            content: {
              heading: 'Contattaci',
              body: 'Raccontaci il progetto e costruiamo la versione giusta del sito.',
              ctaLabel: 'Invia richiesta',
              ctaHref: '#contact',
            },
          };
        case 'blog-grid':
          return {
            kind: 'blog-grid',
            blockPattern: 'blog-grid',
            content: {
              heading: 'Ultimi contenuti',
              items: [],
            },
          };
        case 'newsletter':
          return {
            kind: 'newsletter',
            blockPattern: 'newsletter',
            content: {
              heading: 'Resta aggiornato',
              body: 'Iscriviti per ricevere insight su design, SEO e conversione.',
              ctaLabel: 'Iscriviti',
            },
          };
        case 'story':
        case 'values':
        case 'timeline':
        case 'team':
        case 'locations':
        case 'featured-products':
        case 'benefits':
        case 'shop':
        case 'product-list':
        case 'results':
          return {
            kind: sectionKind,
            blockPattern: sectionKind,
            content: {
              heading: `${this.prettySectionLabel(sectionKind)} per ${preset.label}`,
              body: 'Sezione generata dal preset e facilmente editabile in WordPress.',
            },
          };
        default:
          return {
            kind: sectionKind,
            blockPattern: sectionKind,
            content: {
              heading: this.prettySectionLabel(sectionKind),
              body: 'Sezione generata automaticamente.',
            },
          };
      }
    });
  }

  private normalizePageKey(slug: string): keyof SitePreset['structure'] | string {
    const normalized = slug.toLowerCase().trim();

    if (normalized === 'home' || normalized === 'homepage') return 'home';
    if (normalized === 'chi-siamo' || normalized === 'about') return 'about';
    if (normalized === 'servizi' || normalized === 'services') return 'services';
    if (normalized === 'prezzi' || normalized === 'pricing') return 'pricing';
    if (normalized === 'contatti' || normalized === 'contact') return 'contact';
    if (normalized === 'blog') return 'blog';
    if (normalized === 'faq') return 'faq';
    if (normalized === 'portfolio' || normalized === 'case-studies' || normalized === 'casi-studio') return 'caseStudies';
    if (normalized === 'product' || normalized === 'prodotto') return 'product';
    if (normalized === 'shop' || normalized === 'negozio') return 'shop';
    return normalized;
  }

  private pageTitleFromSlug(slug: string): string {
    const normalized = slug.replace(/[-_]/g, ' ').trim();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private prettySectionLabel(sectionKind: string): string {
    return sectionKind
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (s) => s.toUpperCase());
  }
}
