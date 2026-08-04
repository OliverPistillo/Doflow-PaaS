import { Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import sharp from 'sharp';
import { getProposalImageCandidates, ProposalImageSlot } from './tenant-site-proposals-image-catalog';
import { JsonObject, ProposalImageSourceMethod, WebsiteImageCandidate, WebsiteSnapshot } from './tenant-site-proposals.types';
import { TenantSiteProposalsWebsiteFetcherService } from './tenant-site-proposals-website-fetcher.service';

const CATALOG_HOST = 'images.unsplash.com';
const PHOTO_TYPES = /^(image\/(jpeg|png|webp|avif|gif))(?:;|$)/i;
const REJECT_HINT = /logo|icon|favicon|avatar|profile|sprite|badge|payment|flag|pixel|tracking/i;
const GOOD_HINT = /hero|banner|cover|feature|treatment|service|studio|clinic|consultation|consulenza|profession/i;
const FINAL_WARNING = 'Nessuna immagine di catalogo ha superato il controllo di raggiungibilità; usato fallback deterministico.';

export type ResolvedProposalImage = { src: string; alt: string; objectPosition: string; sourceMethod: ProposalImageSourceMethod };
export type CatalogResolution = { image: ResolvedProposalImage; index: number; warnings: string[] };
type ValidPhoto = WebsiteImageCandidate & { finalUrl: string; width: number; height: number; ratio: number; area: number };

@Injectable()
export class TenantSiteProposalsImageService {
  private readonly availability = new Map<string, { reachable: boolean; expiresAt: number }>();
  private readonly availabilityTtlMs = 20 * 60 * 1000;
  private readonly availabilityMax = 256;

  constructor(private readonly fetcher: TenantSiteProposalsWebsiteFetcherService) {}

  async resolveImages(snapshot: WebsiteSnapshot | undefined, currentImages: JsonObject, fingerprint: string, category: string | undefined, force: boolean) {
    const warnings: string[] = [];
    const result = {} as Record<ProposalImageSlot, ResolvedProposalImage>;
    const used = new Set<string>();
    for (const slot of ['hero', 'consultation', 'feature'] as ProposalImageSlot[]) {
      const current = currentImages[slot] as JsonObject | undefined;
      const src = String(current?.src || '');
      const method = String(current?.sourceMethod || '');
      const preserve = /^https?:\/\//i.test(src) && (method === 'manual' || (!force && !method));
      if (preserve) {
        result[slot] = { src, alt: String(current?.alt || this.altFor(slot)), objectPosition: String(current?.objectPosition || 'center'), sourceMethod: 'manual' };
        used.add(this.normalize(src));
      }
    }

    const valid = snapshot ? await this.validateWebsiteCandidates(snapshot.photoCandidates || snapshot.imageCandidates.map((url, order) => ({ url, alt: '', context: '', kind: order === 0 ? 'og' : 'content', order }))) : [];
    for (const slot of ['hero', 'consultation', 'feature'] as ProposalImageSlot[]) {
      if (result[slot]) continue;
      const selected = this.rank(valid, slot).find((candidate) => !used.has(this.normalize(candidate.finalUrl)));
      if (!selected) continue;
      result[slot] = { src: selected.finalUrl, alt: selected.alt || this.altFor(slot), objectPosition: 'center', sourceMethod: 'website' };
      used.add(this.normalize(selected.finalUrl));
    }

    for (const slot of ['hero', 'consultation', 'feature'] as ProposalImageSlot[]) {
      if (result[slot]) continue;
      const current = currentImages[slot] as JsonObject | undefined;
      const src = String(current?.src || '');
      if (/^data:image\/(?:webp|png|jpeg);base64,/i.test(src)) {
        result[slot] = { src, alt: String(current?.alt || this.altFor(slot)), objectPosition: String(current?.objectPosition || 'center'), sourceMethod: 'stock_local' };
      }
    }

    for (const slot of ['hero', 'consultation', 'feature'] as ProposalImageSlot[]) {
      if (result[slot]) continue;
      const resolved = await this.resolveReachableCatalogImage(category, slot, fingerprint, used);
      result[slot] = resolved.image;
      warnings.push(...resolved.warnings);
      used.add(this.normalize(resolved.image.src));
    }
    return { images: result, warnings: [...new Set(warnings)] };
  }

  async validateWebsiteCandidates(candidates: WebsiteImageCandidate[]): Promise<ValidPhoto[]> {
    const deduped = new Map<string, WebsiteImageCandidate>();
    for (const candidate of candidates.slice(0, 18)) {
      const normalized = this.normalize(candidate.url);
      if (!normalized || deduped.has(normalized) || REJECT_HINT.test(`${candidate.url} ${candidate.alt} ${candidate.context}`) || /\.svg(?:$|[?#])/i.test(candidate.url) || candidate.url.startsWith('data:')) continue;
      deduped.set(normalized, candidate);
    }
    const valid: ValidPhoto[] = [];
    for (const candidate of deduped.values()) {
      try {
        const fetched = await this.fetcher.fetchImage(candidate.url);
        if (!PHOTO_TYPES.test(fetched.contentType) || /^image\/svg/i.test(fetched.contentType)) continue;
        const metadata = await sharp(fetched.body, { limitInputPixels: 32_000_000, animated: false }).metadata();
        const width = metadata.width || 0; const height = metadata.height || 0; const ratio = height ? width / height : 0; const area = width * height;
        if (width < 720 || height < 480 || area < 450_000 || ratio < 0.45 || ratio > 2.6) continue;
        valid.push({ ...candidate, finalUrl: fetched.finalUrl, width, height, ratio, area });
      } catch { /* una candidata pubblica non valida non blocca la personalizzazione */ }
    }
    return valid;
  }

  rank(candidates: ValidPhoto[], slot: ProposalImageSlot): ValidPhoto[] {
    const target = slot === 'consultation' ? 0.8 : slot === 'hero' ? 1.75 : 1.5;
    const slotHint = slot === 'consultation' ? /consult|studio|clinic|profession|treatment|service/i : slot === 'feature' ? /feature|service|treatment|studio|prodot|detail/i : /hero|banner|cover/i;
    return [...candidates].sort((a, b) => {
      const score = (item: ValidPhoto) => (item.kind === 'og' && slot === 'hero' ? 40 : 0) + (item.kind === 'hero' && slot === 'hero' ? 32 : 0)
        + (slotHint.test(item.context) ? 24 : 0) + (GOOD_HINT.test(item.context) ? 6 : 0)
        + Math.min(18, Math.log2(Math.max(1, item.area / 450_000)) * 6) - Math.abs(item.ratio - target) * 22 - item.order * 0.01;
      return score(b) - score(a) || a.order - b.order || a.finalUrl.localeCompare(b.finalUrl);
    });
  }

  async resolveReachableCatalogImage(category: string | undefined, slot: ProposalImageSlot, fingerprint: string, excludedUrls: Set<string>): Promise<CatalogResolution> {
    const candidates = getProposalImageCandidates(fingerprint, category, slot);
    const preferred = candidates.filter((url) => !excludedUrls.has(this.normalize(url)));
    const ordered = preferred.length ? [...preferred, ...candidates.filter((url) => !preferred.includes(url))] : candidates;
    for (const url of ordered) {
      if (await this.probeCatalogUrl(url)) return { image: { src: url, alt: this.altFor(slot), objectPosition: 'center', sourceMethod: 'catalog' }, index: candidates.indexOf(url), warnings: [] };
    }
    return { image: { src: candidates[0], alt: this.altFor(slot), objectPosition: 'center', sourceMethod: 'catalog_fallback' }, index: 0, warnings: [FINAL_WARNING] };
  }

  async probeCatalogUrl(rawUrl: string): Promise<boolean> {
    const normalized = this.assertCatalogUrl(rawUrl).toString();
    const cached = this.availability.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.reachable;
    let reachable = false;
    try { reachable = await this.probe(normalized, 'HEAD'); }
    catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 403 || status === 405 || status === 501) try { reachable = await this.probe(normalized, 'GET'); } catch { reachable = false; }
    }
    this.cache(normalized, reachable);
    return reachable;
  }

  private async probe(rawUrl: string, method: 'HEAD' | 'GET'): Promise<boolean> {
    let current = rawUrl;
    for (let redirect = 0; redirect <= 2; redirect += 1) {
      const safe = this.assertCatalogUrl(current);
      const response: AxiosResponse = await axios.request({ method, url: safe.toString(), timeout: 5_000, maxRedirects: 0, responseType: method === 'GET' ? 'stream' : undefined,
        headers: { 'User-Agent': 'doFlow-ProposalImageProbe/2.0 (+https://doflow.it)', Accept: 'image/*', ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {}) },
        validateStatus: (status) => status >= 200 && status < 400 });
      if (response.status >= 300) {
        this.destroy(response.data);
        const location = response.headers.location;
        if (!location || redirect === 2) return false;
        current = new URL(location, safe).toString();
        continue;
      }
      const contentType = String(response.headers['content-type'] || '');
      this.destroy(response.data);
      return response.status >= 200 && response.status < 300 && /^image\//i.test(contentType);
    }
    return false;
  }

  private assertCatalogUrl(rawUrl: string) { const url = new URL(rawUrl); if (url.protocol !== 'https:' || url.hostname !== CATALOG_HOST || url.username || url.password) throw new Error('URL catalogo non consentito'); return url; }
  private normalize(rawUrl: string) { try { const url = new URL(rawUrl); url.hash = ''; return url.toString(); } catch { return ''; } }
  private cache(url: string, reachable: boolean) { if (this.availability.size >= this.availabilityMax) this.availability.delete(this.availability.keys().next().value as string); this.availability.set(url, { reachable, expiresAt: Date.now() + this.availabilityTtlMs }); }
  private destroy(value: unknown) { if (value && typeof (value as { destroy?: unknown }).destroy === 'function') (value as { destroy: () => void }).destroy(); }
  private altFor(slot: ProposalImageSlot) { return slot === 'hero' ? 'Ambiente e attività' : slot === 'consultation' ? 'Confronto professionale' : 'Servizi e dettagli'; }
}
