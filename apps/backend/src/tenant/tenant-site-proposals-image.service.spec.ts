import axios from 'axios';
import sharp from 'sharp';
import { getProposalImageCandidates } from './tenant-site-proposals-image-catalog';
import { TenantSiteProposalsImageService } from './tenant-site-proposals-image.service';
import { WebsiteImageCandidate, WebsiteSnapshot } from './tenant-site-proposals.types';

jest.mock('axios', () => ({ __esModule: true, default: { request: jest.fn(), isAxiosError: (error: any) => Boolean(error?.isAxiosError) } }));

const request = axios.request as jest.Mock;
const publicUrl = (name: string) => `https://public.example/${name}.jpg`;
const candidate = (name: string, kind: WebsiteImageCandidate['kind'] = 'content', context = ''): WebsiteImageCandidate => ({ url: publicUrl(name), alt: name, context, kind, order: 0 });
const snapshot = (photos: WebsiteImageCandidate[]): WebsiteSnapshot => ({ sourceUrl: 'https://public.example', finalUrl: 'https://public.example/', title: '', description: '', headings: [], paragraphs: [], navigation: [], ctas: [], emails: [], phones: [], social: {}, logoCandidates: [], imageCandidates: photos.map((x) => x.url), photoCandidates: photos, colors: [], text: '' });

describe('proposal image pipeline', () => {
  let fetchImage: jest.Mock;
  let service: TenantSiteProposalsImageService;
  let landscape: Buffer;
  let portrait: Buffer;
  let small: Buffer;

  beforeAll(async () => {
    landscape = await sharp({ create: { width: 1400, height: 800, channels: 3, background: '#718096' } }).jpeg().toBuffer();
    portrait = await sharp({ create: { width: 800, height: 1100, channels: 3, background: '#8a6f5a' } }).png().toBuffer();
    small = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#888888' } }).webp().toBuffer();
  });
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ status: 200, headers: { 'content-type': 'image/jpeg' }, data: undefined });
    fetchImage = jest.fn(async (url: string) => ({ sourceUrl: url, finalUrl: url, contentType: 'image/jpeg', body: landscape }));
    service = new TenantSiteProposalsImageService({ fetchImage } as any);
  });

  it('uses a suitable og:image as hero before the catalog', async () => {
    const result = await service.resolveImages(snapshot([candidate('og', 'og', 'hero cover')]), {}, 'fp', 'generic', false);
    expect(result.images.hero).toMatchObject({ src: publicUrl('og'), sourceMethod: 'website' });
  });
  it('prefers a hero candidate before catalog candidates', async () => {
    const result = await service.resolveImages(snapshot([candidate('hero', 'hero', 'hero banner')]), {}, 'fp', 'generic', false);
    expect(result.images.hero.sourceMethod).toBe('website');
  });
  it.each(['logo', 'favicon', 'avatar', 'tracking-pixel'])('excludes %s candidates from photographic slots', async (hint) => {
    const valid = await service.validateWebsiteCandidates([candidate(hint, 'content', hint)]);
    expect(valid).toEqual([]); expect(fetchImage).not.toHaveBeenCalled();
  });
  it('excludes images below the documented dimensions', async () => {
    fetchImage.mockResolvedValue({ finalUrl: publicUrl('small'), contentType: 'image/webp', body: small });
    await expect(service.validateWebsiteCandidates([candidate('small')])).resolves.toEqual([]);
  });
  it('excludes non-image content types and SVG photographs', async () => {
    fetchImage.mockResolvedValueOnce({ finalUrl: publicUrl('html'), contentType: 'text/html', body: landscape });
    expect(await service.validateWebsiteCandidates([candidate('html')])).toEqual([]);
    expect(await service.validateWebsiteCandidates([{ ...candidate('vector'), url: 'https://public.example/vector.svg' }])).toEqual([]);
  });
  it('treats SSRF and private redirect failures as an unusable candidate', async () => {
    fetchImage.mockRejectedValue(new Error('Destinazione di rete non consentita'));
    await expect(service.validateWebsiteCandidates([candidate('private')])).resolves.toEqual([]);
  });
  it('deduplicates normalized candidate URLs before downloading', async () => {
    await service.validateWebsiteCandidates([candidate('same'), candidate('same')]);
    expect(fetchImage).toHaveBeenCalledTimes(1);
  });
  it('assigns different site images to all slots when alternatives exist', async () => {
    const photos = [candidate('hero', 'hero', 'hero cover'), candidate('person', 'main', 'consultation studio'), candidate('room', 'content', 'feature service')];
    const result = await service.resolveImages(snapshot(photos), {}, 'fp', 'generic', false);
    expect(new Set(Object.values(result.images).map((image) => image.src)).size).toBe(3);
    expect(Object.values(result.images).every((image) => image.sourceMethod === 'website')).toBe(true);
  });
  it('prefers portrait ratios for consultation and landscape for feature', async () => {
    fetchImage.mockImplementation(async (url: string) => ({ finalUrl: url, contentType: 'image/jpeg', body: url.includes('portrait') ? portrait : landscape }));
    const valid = await service.validateWebsiteCandidates([candidate('portrait', 'main', 'consultation'), candidate('landscape', 'content', 'feature service')]);
    expect(service.rank(valid, 'consultation')[0].url).toContain('portrait');
    expect(service.rank(valid, 'feature')[0].url).toContain('landscape');
  });
  it('falls back to catalog for every missing site image', async () => {
    const result = await service.resolveImages(undefined, {}, 'fp', 'generic', false);
    expect(Object.values(result.images).every((image) => image.sourceMethod === 'catalog')).toBe(true);
  });
  it('preserves explicit manual images even with force', async () => {
    const result = await service.resolveImages(undefined, { hero: { src: publicUrl('manual'), alt: 'Manuale', sourceMethod: 'manual' } }, 'fp', 'generic', true);
    expect(result.images.hero).toMatchObject({ src: publicUrl('manual'), sourceMethod: 'manual' });
  });
  it('records website sourceMethod on validated photographs', async () => {
    const result = await service.resolveImages(snapshot([candidate('site', 'og')]), {}, 'fp', 'generic', false);
    expect(result.images.hero.sourceMethod).toBe('website');
  });

  it('returns the first reachable catalog URL with one request', async () => {
    const result = await service.resolveReachableCatalogImage('generic', 'hero', 'one', new Set());
    expect(result.image.sourceMethod).toBe('catalog'); expect(request).toHaveBeenCalledTimes(1);
  });
  it('tries the second URL when the first fails', async () => {
    request.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ status: 200, headers: { 'content-type': 'image/jpeg' } });
    const result = await service.resolveReachableCatalogImage('generic', 'hero', 'two', new Set());
    expect(result.index).toBe(1); expect(request).toHaveBeenCalledTimes(2);
  });
  it('tries the third URL when the first two fail', async () => {
    request.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ status: 200, headers: { 'content-type': 'image/jpeg' } });
    const result = await service.resolveReachableCatalogImage('generic', 'hero', 'three', new Set());
    expect(result.index).toBe(2); expect(request).toHaveBeenCalledTimes(3);
  });
  it('rejects non-2xx, non-image and timeout probes', async () => {
    request.mockResolvedValueOnce({ status: 404, headers: {} }).mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'text/html' } }).mockRejectedValueOnce({ isAxiosError: true, code: 'ETIMEDOUT' }).mockResolvedValue({ status: 200, headers: { 'content-type': 'image/jpeg' } });
    const result = await service.resolveReachableCatalogImage('generic', 'hero', 'status', new Set());
    expect(result.image.src).toBeTruthy(); expect(request.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
  it('rejects redirects outside the server-side catalog host', async () => {
    request.mockResolvedValueOnce({ status: 302, headers: { location: 'https://evil.example/image.jpg' } }).mockResolvedValue({ status: 200, headers: { 'content-type': 'image/jpeg' } });
    const result = await service.resolveReachableCatalogImage('generic', 'hero', 'redirect', new Set());
    expect(result.index).not.toBe(0);
  });
  it('keeps a non-empty deterministic fallback and warning when all URLs fail', async () => {
    request.mockRejectedValue(new Error('offline'));
    const result = await service.resolveReachableCatalogImage('generic', 'feature', 'none', new Set());
    expect(result.image.src).toMatch(/^https:\/\/images\.unsplash\.com/); expect(result.image.sourceMethod).toBe('catalog_fallback'); expect(result.warnings[0]).toContain('fallback deterministico');
  });
  it('prefers an alternative to a URL already used by another slot', async () => {
    const ordered = getProposalImageCandidates('excluded', 'generic', 'hero');
    const result = await service.resolveReachableCatalogImage('generic', 'hero', 'excluded', new Set([ordered[0]]));
    expect(result.image.src).not.toBe(ordered[0]);
  });
  it('caches reachable and unreachable probes within the TTL', async () => {
    const url = getProposalImageCandidates('cache', 'generic', 'hero')[0];
    await service.probeCatalogUrl(url); await service.probeCatalogUrl(url);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('probes again after cache expiry', async () => {
    const url = getProposalImageCandidates('expired', 'generic', 'hero')[0];
    await service.probeCatalogUrl(url);
    const cache = (service as any).availability as Map<string, { reachable: boolean; expiresAt: number }>;
    cache.get(new URL(url).toString())!.expiresAt = Date.now() - 1;
    await service.probeCatalogUrl(url);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
