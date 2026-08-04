import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { WebsiteImageCandidate, WebsiteSnapshot } from './tenant-site-proposals.types';

const clean = (value: string, max = 2000) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const unique = (values: string[], limit: number) => [...new Set(values.map((v) => clean(v)).filter(Boolean))].slice(0, limit);
function absolute(value: string | undefined, base: string) { try { return value ? new URL(value, base).toString() : ''; } catch { return ''; } }
function socialUrl(raw: string, platform: 'linkedin' | 'instagram' | 'facebook') {
  try {
    const url = new URL(raw); const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.endsWith(`${platform}.com`) || /\/(share|sharer|login|dialog)(\/|$)/i.test(url.pathname) || url.pathname === '/' || !url.pathname) return '';
    url.protocol = 'https:'; ['utm_source','utm_medium','utm_campaign','fbclid','igshid'].forEach((key) => url.searchParams.delete(key)); url.hash = '';
    return url.toString();
  } catch { return ''; }
}

@Injectable()
export class TenantSiteProposalsWebsiteExtractorService {
  extract(html: string, sourceUrl: string, finalUrl = sourceUrl): WebsiteSnapshot {
    const $ = cheerio.load(html.slice(0, 1_600_000));
    $('script,style,noscript,iframe,template').remove();
    const title = clean($('title').first().text(), 300);
    const description = clean($('meta[name="description"]').attr('content') || '', 600);
    const headings = unique($('h1,h2,h3').map((_, el) => $(el).text()).get(), 60);
    const paragraphs = unique($('main p,article p,section p,body p').map((_, el) => $(el).text()).get().filter((v) => clean(v).length >= 30), 120);
    const navigation = unique($('nav a,header a').map((_, el) => $(el).text()).get(), 40);
    const ctas = unique($('a,button').map((_, el) => $(el).text()).get().filter((v) => /(contatt|prenot|scopri|richied|preventiv|appuntament|chiama|scriv)/i.test(v)), 30);
    const bodyText = unique([$('body').text()], 1).join(' ').slice(0, 40_000);
    const emails = unique((bodyText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || []), 10);
    const phones = unique((bodyText.match(/(?:\+39\s*)?(?:\d[\s()./-]*){7,15}/g) || []), 10);
    const links = $('a[href]').map((_, el) => absolute($(el).attr('href'), finalUrl)).get();
    const social: Record<string, string> = {};
    (['linkedin','instagram','facebook'] as const).forEach((platform) => { const found = links.map((href) => socialUrl(href, platform)).find(Boolean); if (found) social[platform] = found; });
    const logos: string[] = [];
    const pushImgs = (selector: string) => $(selector).each((_, el) => { const src = absolute($(el).attr('src') || $(el).attr('data-src'), finalUrl); if (src) logos.push(src); });
    pushImgs('header img'); pushImgs('nav img'); pushImgs('img[class*="logo" i],img[id*="logo" i],img[alt*="logo" i],img[src*="logo" i],img[class*="brand" i]');
    $('header svg,nav svg').slice(0, 2).each((_, el) => { const raw = $.html(el); if (raw) logos.push(`data:image/svg+xml;base64,${Buffer.from(raw).toString('base64')}`); });
    ['link[rel="apple-touch-icon"]','link[rel~="icon"]'].forEach((selector) => { const src = absolute($(selector).first().attr('href'), finalUrl); if (src) logos.push(src); });
    const photos: WebsiteImageCandidate[] = [];
    const seenPhotos = new Set<string>();
    const addPhoto = (url: string, alt: string, context: string, kind: WebsiteImageCandidate['kind']) => {
      if (!url || seenPhotos.has(url)) return;
      seenPhotos.add(url);
      photos.push({ url, alt: clean(alt, 240), context: clean(context, 500).toLowerCase(), kind, order: photos.length });
    };
    const ogImage = absolute($('meta[property="og:image"]').attr('content'), finalUrl);
    addPhoto(ogImage, $('meta[property="og:image:alt"]').attr('content') || title, 'og:image hero cover', 'og');
    $('main img,article img,section img,[class*="hero" i] img,[class*="banner" i] img,[class*="cover" i] img').each((_, el) => {
      const node = $(el);
      const url = absolute(node.attr('src') || node.attr('data-src') || node.attr('data-lazy-src'), finalUrl);
      const parent = node.closest('section,article,main,div');
      const context = [node.attr('class'), node.attr('id'), node.attr('alt'), node.attr('title'), parent.attr('class'), parent.attr('id')].filter(Boolean).join(' ');
      const kind: WebsiteImageCandidate['kind'] = /hero|banner|cover/i.test(context) ? 'hero' : node.closest('main').length ? 'main' : 'content';
      addPhoto(url, node.attr('alt') || node.attr('title') || title, context, kind);
    });
    const imageCandidates = photos.map((candidate) => candidate.url).slice(0, 30);
    const colors = unique([
      $('meta[name="theme-color"]').attr('content') || '',
      ...$('[style]').map((_, el) => ($(el).attr('style') || '').match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)/gi) || []).get().flat(),
    ], 30);
    const text = unique([title, description, ...headings, ...paragraphs, ...navigation, ...ctas], 240).join('\n').slice(0, 40_000);
    return { sourceUrl, finalUrl, title, description, headings, paragraphs, navigation, ctas, emails, phones, social, logoCandidates: unique(logos, 12), imageCandidates, photoCandidates: photos.slice(0, 30), colors, text };
  }
}
