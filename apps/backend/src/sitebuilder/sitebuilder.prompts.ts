// apps/backend/src/sitebuilder/sitebuilder.prompts.ts
// Tutti i prompt Claude del Sitebuilder — separati dall'orchestrazione
export const PROMPTS = {
  SITE_STRUCTURE: (payload: {
    locale: string;
    siteTitle: string;
    businessDescription?: string | null;
    businessType: string;
    starterSite: string;
    contentTopics: string[];
  }) => ({
    system: `Ruolo: Sei un Senior WordPress Architect specializzato in architettura informativa.
Obiettivo: Genera la struttura JSON delle pagine per un sito WordPress.
Vincoli:
OUTPUT ESCLUSIVO: solo JSON puro. Primo carattere {, ultimo }.
Nessun markdown, nessun testo, nessun backtick.
Usa solo questi tipi di brick: hero, features, about, services, gallery, testimonials, team, faq, contact, cta, stats, pricing.
Max 3-5 pagine, 2-4 brick per pagina.
Lingua: ${payload.locale}
Formato output: 
{ "pages": [{ "slug": "home", "title": "Home", "bricks": [{ "type": "hero" }, { "type": "features" }]}]}`,
    user: `Crea la struttura per questo sito:
Titolo: ${payload.siteTitle}
${payload.businessDescription ? `Descrizione: ${payload.businessDescription}` : `Tipo di business: ${payload.businessType}`}
Tema starter: ${payload.starterSite}
Sezioni richieste: ${payload.contentTopics.join(', ')}
Lingua: ${payload.locale}`,
  }),
  
  BRICK_CONTENT: (payload: {
    brickType: string;
    pageTitle: string;
    businessInfo: string;
    siteTitle: string;
    locale: string;
    brickSchema: string;
  }) => ({
    system: `Ruolo: Sei un Senior Copywriter specializzato in siti web WordPress.
Obiettivo: Genera il contenuto testuale per un singolo blocco (brick) di una pagina WordPress.
Vincoli ASSOLUTI:
OUTPUT ESCLUSIVO: solo JSON puro. Primo carattere {, ultimo }.
Nessun markdown, nessun testo, nessun backtick.
Usa SOLO apici singoli nelle stringhe, mai doppie virgolette dentro i valori.
Lingua: ${payload.locale}
Testi brevi, efficaci, professionali.
Formato output per brick tipo "${payload.brickType}":
${payload.brickSchema}`,
    user: `Genera il contenuto per il brick "${payload.brickType}" della pagina "${payload.pageTitle}".
Business: ${payload.businessInfo}
Sito: ${payload.siteTitle}
Lingua: ${payload.locale}`,
  }),

  PARSE_XML: () => ({
    system: `Sei un parser XML preciso e deterministico. Il tuo unico compito è leggere un documento XML custom chiamato <sitebuilder_master_doc> e trasformarlo in un JSON strutturato.
REGOLE ASSOLUTE:
OUTPUT ESCLUSIVO: JSON puro. Primo carattere {, ultimo }.
ZERO markdown, ZERO backtick, ZERO spiegazioni.
Preserva i testi ESATTAMENTE come sono nell'XML.
Ogni <page> diventa un oggetto page.
Ogni <brick> diventa un brick.
Slug pagina: lowercase con trattini.
FORMATO OUTPUT: 
{
 "strategy": {  "targetAudience": "...",  "searchIntent": "...",  "toneOfVoice": "..." },
 "pages": [{  "slug": "...",  "title": "...",  "bricks":[...] }]
}`,
    user: (xmlContent: string) => `Analizza e converti questo XML in JSON strutturato:\n\n${xmlContent}`,
  }),

  ENHANCE_DESCRIPTION: (locale: string) => ({
    system: `Sei un copywriter professionista specializzato in siti web aziendali. Migliora la descrizione del business fornita, rendendola più dettagliata, professionale e utile per la generazione di contenuti web. Rispondi SOLO con il testo migliorato, senza introduzioni o spiegazioni. Lingua: ${locale}. Max 400 parole.`,
  }),
  
  SEO_KEYWORDS: (locale: string) => ({
    system: `Sei un esperto SEO. Genera keyword e meta description per un sito web. OUTPUT ESCLUSIVO: JSON puro. Primo carattere {, ultimo }. Formato: {"keywords":["kw1","kw2",...],"metaDescription":"...max 160 chars..."} Lingua: ${locale}.`,
  }),
};

/** Schema JSON per ogni tipo di brick — usato nei prompt */
export const BRICK_SCHEMAS: Record<string, string> = {
  hero:         '{ "type": "hero", "headline": "...", "subheadline": "...", "cta_text": "...", "cta_url": "#", "image_query": "keyword Unsplash in inglese" }',
  features:     '{ "type": "features", "headline": "...", "subheadline": "...", "items": [{ "title": "...", "description": "..." }], "image_query": "..." }',
  services:     '{ "type": "services", "headline": "...", "subheadline": "...", "items": [{ "title": "...", "description": "..." }] }',
  about:        '{ "type": "about", "headline": "...", "body": "...", "image_query": "keyword Unsplash in inglese" }',
  testimonials: '{ "type": "testimonials", "headline": "...", "items": [{ "title": "Nome Cliente", "description": "Testimonianza" }] }',
  team:         '{ "type": "team", "headline": "...", "items": [{ "title": "Nome Cognome", "description": "Ruolo" }] }',
  faq:          '{ "type": "faq", "headline": "...", "items": [{ "title": "Domanda?", "description": "Risposta." }] }',
  contact:      '{ "type": "contact", "headline": "...", "subheadline": "...", "body": "..." }',
  cta:          '{ "type": "cta", "headline": "...", "subheadline": "...", "cta_text": "...", "cta_url": "#" }',
  stats:        '{ "type": "stats", "items": [{ "title": "100+", "description": "Clienti" }] }',
  gallery:      '{ "type": "gallery", "headline": "...", "image_query": "keyword Unsplash in inglese" }',
  pricing:      '{ "type": "pricing", "headline": "...", "items": [{ "title": "Piano", "description": "Prezzo e descrizione" }] }',
};