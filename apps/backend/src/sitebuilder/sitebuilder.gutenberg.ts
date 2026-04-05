// apps/backend/src/sitebuilder/sitebuilder.gutenberg.ts
// Costruisce blocchi Gutenberg HTML da brick JSON.
// I valori dinamici sono sempre escaped per evitare HTML/JSON injection.

import { SitebuilderJobPayload } from './sitebuilder.producer.service';

export interface BrickContent {
  type: string;
  headline?: string;
  subheadline?: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  items?: Array<{ title: string; description: string }>;
  image_query?: string;
  imageUrl?: string;
}

export interface SitePage {
  slug: string;
  title: string;
  bricks: BrickContent[];
}

// ─── Escape helpers ───────────────────────────────────────────────────────────

/** Escape per attributi HTML e testo nei blocchi Gutenberg */
function esc(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#34;')
    .replace(/'/g, '&#39;');
}

/** Escape per URL negli attributi href — rimuove caratteri pericolosi */
function escUrl(url: string | undefined | null): string {
  if (!url) return '#';
  const trimmed = url.trim();
  // Blocca javascript: e data: scheme
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#';
  return esc(trimmed);
}

/** Testo libero: escape solo &, < e > (le virgolette sono OK nel corpo HTML) */
function escText(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Block builders ───────────────────────────────────────────────────────────

function heroBlock(brick: BrickContent, payload: SitebuilderJobPayload): string {
  const headline    = escText(brick.headline ?? payload.siteTitle);
  const subheadline = escText(brick.subheadline);
  const ctaText     = escText(brick.cta_text);
  const ctaUrl      = escUrl(brick.cta_url);
  const imgSrc      = escUrl(brick.imageUrl);
  const imgAlt      = esc(brick.headline ?? payload.siteTitle);

  return `<!-- wp:group {"align":"full","className":"wp-block-hero","style":{"spacing":{"padding":{"top":"80px","bottom":"80px"}}}} -->
<div class="wp-block-group alignfull wp-block-hero">
<!-- wp:heading {"level":1,"textAlign":"center"} --><h1 class="wp-block-heading has-text-align-center">${headline}</h1><!-- /wp:heading -->
${subheadline ? `<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">${subheadline}</p><!-- /wp:paragraph -->` : ''}
${ctaText ? `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link" href="${ctaUrl}">${ctaText}</a></div><!-- /wp:button --></div><!-- /wp:buttons -->` : ''}
${imgSrc ? `<!-- wp:image {"align":"center","sizeSlug":"large"} --><figure class="wp-block-image aligncenter size-large"><img src="${imgSrc}" alt="${imgAlt}"/></figure><!-- /wp:image -->` : ''}
</div><!-- /wp:group -->`;
}

function featuresBlock(brick: BrickContent): string {
  const headline    = escText(brick.headline ?? 'Servizi');
  const subheadline = escText(brick.subheadline);
  const columns     = (brick.items ?? []).map((item) => `<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">${escText(item.title)}</h3><!-- /wp:heading -->
<!-- wp:paragraph --><p>${escText(item.description)}</p><!-- /wp:paragraph -->
</div><!-- /wp:column -->`).join('\n');

  return `<!-- wp:group {"align":"wide","className":"wp-block-features"} -->
<div class="wp-block-group alignwide wp-block-features">
<!-- wp:heading {"textAlign":"center"} --><h2 class="wp-block-heading has-text-align-center">${headline}</h2><!-- /wp:heading -->
${subheadline ? `<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">${subheadline}</p><!-- /wp:paragraph -->` : ''}
<!-- wp:columns -->
<div class="wp-block-columns">
${columns}
</div><!-- /wp:columns -->
</div><!-- /wp:group -->`;
}

function aboutBlock(brick: BrickContent): string {
  const headline = escText(brick.headline ?? 'Chi Siamo');
  const body     = escText(brick.body ?? brick.subheadline);
  const imgSrc   = escUrl(brick.imageUrl);

  return `<!-- wp:group {"align":"wide","className":"wp-block-about"} -->
<div class="wp-block-group alignwide wp-block-about">
<!-- wp:columns {"verticalAlignment":"center"} -->
<div class="wp-block-columns are-vertically-aligned-center">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading --><h2 class="wp-block-heading">${headline}</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>${body}</p><!-- /wp:paragraph -->
</div><!-- /wp:column -->
${imgSrc ? `<!-- wp:column --><div class="wp-block-column"><!-- wp:image {"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img src="${imgSrc}" alt=""/></figure><!-- /wp:image --></div><!-- /wp:column -->` : ''}
</div><!-- /wp:columns -->
</div><!-- /wp:group -->`;
}

function testimonialsBlock(brick: BrickContent): string {
  const headline = escText(brick.headline ?? 'Testimonianze');
  const columns  = (brick.items ?? []).slice(0, 3).map((item) => `<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:quote --><blockquote class="wp-block-quote"><p>${escText(item.description)}</p><cite>${escText(item.title)}</cite></blockquote><!-- /wp:quote -->
</div><!-- /wp:column -->`).join('\n');

  return `<!-- wp:group {"align":"wide","className":"wp-block-testimonials"} -->
<div class="wp-block-group alignwide wp-block-testimonials">
<!-- wp:heading {"textAlign":"center"} --><h2 class="wp-block-heading has-text-align-center">${headline}</h2><!-- /wp:heading -->
<!-- wp:columns --><div class="wp-block-columns">
${columns}
</div><!-- /wp:columns -->
</div><!-- /wp:group -->`;
}

function faqBlock(brick: BrickContent): string {
  const headline = escText(brick.headline ?? 'FAQ');
  const items    = (brick.items ?? []).map((item) => `<!-- wp:details -->
<details class="wp-block-details"><summary>${escText(item.title)}</summary><p>${escText(item.description)}</p></details>
<!-- /wp:details -->`).join('\n');

  return `<!-- wp:group {"align":"wide","className":"wp-block-faq"} -->
<div class="wp-block-group alignwide wp-block-faq">
<!-- wp:heading {"textAlign":"center"} --><h2 class="wp-block-heading has-text-align-center">${headline}</h2><!-- /wp:heading -->
${items}
</div><!-- /wp:group -->`;
}

function contactBlock(brick: BrickContent): string {
  const headline    = escText(brick.headline ?? 'Contatti');
  const subheadline = escText(brick.subheadline ?? brick.body);

  return `<!-- wp:group {"align":"wide","className":"wp-block-contact"} -->
<div class="wp-block-group alignwide wp-block-contact">
<!-- wp:heading {"textAlign":"center"} --><h2 class="wp-block-heading has-text-align-center">${headline}</h2><!-- /wp:heading -->
${subheadline ? `<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">${subheadline}</p><!-- /wp:paragraph -->` : ''}
<!-- wp:shortcode -->[contact-form-7 id="1" title="Modulo di contatto 1"]<!-- /wp:shortcode -->
</div><!-- /wp:group -->`;
}

function ctaBlock(brick: BrickContent): string {
  const headline    = escText(brick.headline);
  const subheadline = escText(brick.subheadline);
  const ctaText     = escText(brick.cta_text);
  const ctaUrl      = escUrl(brick.cta_url);

  return `<!-- wp:group {"align":"full","className":"wp-block-cta","style":{"spacing":{"padding":{"top":"60px","bottom":"60px"}}}} -->
<div class="wp-block-group alignfull wp-block-cta" style="padding-top:60px;padding-bottom:60px">
<!-- wp:heading {"textAlign":"center"} --><h2 class="wp-block-heading has-text-align-center">${headline}</h2><!-- /wp:heading -->
${subheadline ? `<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">${subheadline}</p><!-- /wp:paragraph -->` : ''}
${ctaText ? `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link" href="${ctaUrl}">${ctaText}</a></div><!-- /wp:button --></div><!-- /wp:buttons -->` : ''}
</div><!-- /wp:group -->`;
}

function statsBlock(brick: BrickContent): string {
  const columns = (brick.items ?? []).slice(0, 4).map((item) => `<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading {"textAlign":"center","level":3} --><h3 class="wp-block-heading has-text-align-center">${escText(item.title)}</h3><!-- /wp:heading -->
<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">${escText(item.description)}</p><!-- /wp:paragraph -->
</div><!-- /wp:column -->`).join('\n');

  return `<!-- wp:group {"align":"wide","className":"wp-block-stats"} -->
<div class="wp-block-group alignwide wp-block-stats">
<!-- wp:columns --><div class="wp-block-columns">
${columns}
</div><!-- /wp:columns -->
</div><!-- /wp:group -->`;
}

function galleryBlock(brick: BrickContent): string {
  const imgSrc = escUrl(brick.imageUrl);
  return `<!-- wp:gallery {"columns":3,"linkTo":"none","align":"wide"} -->
<figure class="wp-block-gallery alignwide has-nested-images columns-3">
${imgSrc ? `<!-- wp:image {"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img src="${imgSrc}" alt="Gallery"/></figure><!-- /wp:image -->` : ''}
</figure><!-- /wp:gallery -->`;
}

function defaultBlock(brick: BrickContent): string {
  return `<!-- wp:paragraph --><p>${escText(brick.headline ?? brick.body)}</p><!-- /wp:paragraph -->`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function bricksToGutenberg(
  bricks: BrickContent[],
  payload: SitebuilderJobPayload,
): string {
  return bricks.map((brick) => {
    switch (brick.type) {
      case 'hero':         return heroBlock(brick, payload);
      case 'features':
      case 'services':     return featuresBlock(brick);
      case 'about':        return aboutBlock(brick);
      case 'testimonials': return testimonialsBlock(brick);
      case 'faq':          return faqBlock(brick);
      case 'contact':      return contactBlock(brick);
      case 'cta':          return ctaBlock(brick);
      case 'stats':        return statsBlock(brick);
      case 'gallery':      return galleryBlock(brick);
      default:             return defaultBlock(brick);
    }
  }).join('\n\n');
}

/** Escape per contenuto XML/WXR */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}