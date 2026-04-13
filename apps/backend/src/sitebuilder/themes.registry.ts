// apps/backend/src/sitebuilder/themes.registry.ts

// ── Pattern per la homepage (legacy flat array) ───────────────────────────────
// Usato dal plugin v5/v6 per retrocompatibilità
export const THEMES_REGISTRY: Record<string, string[]> = {
  'doflow-first': [
    'doflow-home-gutenverse-hero.php',
    'doflow-home-gutenverse-clients.php',
    'doflow-home-gutenverse-services.php',
    'doflow-home-gutenverse-process.php',
    'doflow-gutenverse-benefit.php',
    'doflow-home-gutenverse-pricing.php',
    'doflow-gutenverse-testimonials.php',
    'doflow-home-gutenverse-faq.php',
    'doflow-gutenverse-cta.php',
  ],
  // Temi gutenverse-pages: usano layout dal tema stesso, non servono pattern qui
  'doflow-konsulty': [],
  'doflow-skintiva': [],
  'doflow-artifice': [
    'company_name',],
  'doflow-zyno': [],
};

// ── Pattern per ogni pagina — usato dal plugin DoFlow Studio v8+ ──────────────
export const PAGE_PATTERNS: Record<string, string[]> = {
  'Home': [
    'doflow-home-gutenverse-hero.php',
    'doflow-home-gutenverse-clients.php',
    'doflow-home-gutenverse-services.php',
    'doflow-home-gutenverse-process.php',
    'doflow-gutenverse-benefit.php',
    'doflow-home-gutenverse-pricing.php',
    'doflow-gutenverse-testimonials.php',
    'doflow-home-gutenverse-faq.php',
    'doflow-gutenverse-cta.php',
  ],
  'Chi Siamo': [
    'doflow-about-gutenverse-hero.php',
    'doflow-about-gutenverse-who-we.php',
    'doflow-about-gutenverse-goals.php',
    'doflow-about-gutenverse-journey.php',
    'doflow-about-gutenverse-team.php',
    'doflow-gutenverse-cta.php',
  ],
  'Servizi': [
    'doflow-service-gutenverse-hero.php',
    'doflow-service-gutenverse-services.php',
    'doflow-gutenverse-benefit.php',
    'doflow-service-gutenverse-pricing.php',
    'doflow-service-gutenverse-testimonials.php',
    'doflow-gutenverse-cta.php',
  ],
  'FAQ': [
    'doflow-faq-gutenverse-hero.php',
    'doflow-faq-gutenverse-general.php',
    'doflow-faq-gutenverse-pricing.php',
    'doflow-gutenverse-cta.php',
  ],
  'Contatti': [
    'doflow-contact-gutenverse-hero.php',
    'doflow-contact-gutenverse-information.php',
  ],
  'Blog': [
    'doflow-blog-gutenverse-hero.php',
    'doflow-gutenverse-blog.php',
  ],
  'Portfolio': [
    'doflow-project-gutenverse-hero.php',
    'doflow-project-gutenverse-project-list.php',
    'doflow-gutenverse-cta.php',
  ],
  'Casi Studio': [
    'doflow-project-gutenverse-hero.php',
    'doflow-project-gutenverse-project-list.php',
    'doflow-gutenverse-cta.php',
  ],
  'Trattamenti': [
    'doflow-service-gutenverse-hero.php',
    'doflow-service-gutenverse-services.php',
    'doflow-gutenverse-cta.php',
  ],
  'Galleria': [
    'doflow-project-gutenverse-project-list.php',
  ],
};

// ── Slug URL per ogni nome pagina ─────────────────────────────────────────────
export const PAGE_SLUGS: Record<string, string> = {
  'Home':         'home',
  'Chi Siamo':    'chi-siamo',
  'Servizi':      'servizi',
  'FAQ':          'faq',
  'Contatti':     'contatti',
  'Blog':         'blog',
  'Portfolio':    'portfolio',
  'Casi Studio':  'casi-studio',
  'Trattamenti':  'trattamenti',
  'Galleria':     'galleria',
};

// ── Configurazione temi gutenverse-pages ─────────────────────────────────────
// Per i temi che usano gutenverse-pages/*.json (doflow-konsulty, skintiva, artifice)
// le pagine disponibili vengono lette dal tema stesso — non serve PAGE_PATTERNS.
// Qui mappiamo solo i token AI necessari per ogni tema.
export const THEME_TOKENS: Record<string, string[]> = {
  'doflow-first': [],

  'doflow-konsulty': [
    'company_name', 'contact_heading', 'contact_description', 'contact_cta',
    'contact_email', 'contact_phone', 'contact_address',
    'cta_description', 'cta_button', 'cta_button_secondary',
    'milestones_heading', 'milestones_focus',
    'stat1_number', 'stat1_label', 'stat2_number', 'stat2_label',
    'stat3_number', 'stat3_label', 'stat4_number', 'stat4_label',
    'partners_heading', 'partners_focus',
  ],

  'doflow-skintiva': [
    'company_name', 'contact_heading', 'contact_description', 'contact_cta',
    'contact_email', 'contact_phone', 'contact_address',
    'why_heading', 'why_description',
    'feature1_title', 'feature1_text', 'feature2_title', 'feature2_text',
    'feature3_title', 'feature3_text',
  ],

  'doflow-artifice': [
    'company_name', 'contact_heading', 'contact_focus', 'contact_description',
    'contact_cta', 'contact_email', 'contact_phone', 'contact_address',
    'cta_heading', 'cta_description', 'cta_button',
    'about_heading', 'about_description',
    'feature1_title', 'feature1_text', 'feature2_title', 'feature2_text', 'feature3_title', 'feature3_text',
    'stats_heading', 'stats_focus',
    'stat1_number', 'stat1_label', 'stat2_number', 'stat2_label',
    'stat3_number', 'stat3_label', 'stat4_number', 'stat4_label',
    'newsletter_heading', 'newsletter_focus', 'newsletter_text', 'newsletter_cta',
    'partners_heading', 'partners_focus',
  ],

  'doflow-zyno': [
    'company_name', 'contact_email', 'contact_phone', 'contact_cta', 'contact_heading',
    'cta_description', 'cta_button',
    'about_heading', 'about_focus', 'about_description', 'about_cta',
    'stat1_number', 'stat1_label', 'stat2_number', 'stat2_label',
    'stat3_number', 'stat3_label', 'stat4_number', 'stat4_label',
    'clients_heading',
    'process_heading', 'process_focus', 'process_description',
    'step1_title', 'step1_desc', 'step2_title', 'step2_desc', 'step3_title', 'step3_desc',
    'faq_heading', 'faq_focus',
    'faq1_question', 'faq1_answer', 'faq2_question', 'faq2_answer', 'faq3_question', 'faq3_answer',
    'values_heading', 'values_focus', 'value1_text', 'value2_text',
  ],
};