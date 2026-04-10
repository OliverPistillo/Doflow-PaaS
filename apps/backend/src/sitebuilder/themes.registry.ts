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
  // Aggiungerai qui i futuri temi (es. 'doflow-restaurant', 'doflow-lawyer')
};

// ── Pattern per ogni pagina — usato dal plugin DoFlow Studio v8+ ──────────────
// Chiave = nome pagina come selezionato nel wizard frontend
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
    // Usa i pattern Portfolio finché non avremo pattern dedicati
    'doflow-project-gutenverse-hero.php',
    'doflow-project-gutenverse-project-list.php',
    'doflow-gutenverse-cta.php',
  ],
  'Trattamenti': [
    // Per temi clinica/wellness: usa service come fallback
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
  'Home':       'home',
  'Chi Siamo':  'chi-siamo',
  'Servizi':    'servizi',
  'FAQ':        'faq',
  'Contatti':   'contatti',
  'Blog':       'blog',
  'Portfolio':  'portfolio',
  'Casi Studio':'casi-studio',
  'Trattamenti':'trattamenti',
  'Galleria':   'galleria',
};