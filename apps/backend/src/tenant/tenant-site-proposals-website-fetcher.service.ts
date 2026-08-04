import { BadRequestException, Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { promises as dns } from 'dns';
import { isIP } from 'net';

export type SafeFetchResult = { sourceUrl: string; finalUrl: string; contentType: string; body: Buffer };
const METADATA_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', 'metadata.azure.com']);

function unsafeIpv4(ip: string) {
  const n = ip.split('.').map(Number);
  return n[0] === 0 || n[0] === 10 || n[0] === 127 || n[0] >= 224 || (n[0] === 169 && n[1] === 254)
    || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168)
    || (n[0] === 100 && n[1] >= 64 && n[1] <= 127);
}
export function isUnsafeNetworkAddress(address: string): boolean {
  const value = address.toLowerCase().split('%')[0];
  if (isIP(value) === 4) return unsafeIpv4(value);
  if (isIP(value) !== 6) return true;
  if (value === '::' || value === '::1' || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb') || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('ff')) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? unsafeIpv4(mapped[1]) : false;
}

@Injectable()
export class TenantSiteProposalsWebsiteFetcherService {
  async fetchHomepage(rawUrl: string): Promise<SafeFetchResult> { return this.fetch(rawUrl, { maxBytes: 1.5 * 1024 * 1024, redirects: 3, kind: 'html', timeout: 10_000 }); }
  async fetchImage(rawUrl: string): Promise<SafeFetchResult> { return this.fetch(rawUrl, { maxBytes: 5 * 1024 * 1024, redirects: 2, kind: 'image', timeout: 8_000 }); }

  async assertSafeUrl(rawUrl: string): Promise<URL> {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new BadRequestException('URL pubblico non valido.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new BadRequestException('URL pubblico non consentito.');
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || METADATA_HOSTS.has(host)) throw new BadRequestException('Destinazione di rete non consentita.');
    if (!isIP(host) && !host.includes('.')) throw new BadRequestException('Il sito deve usare un dominio pubblico.');
    let addresses: Array<{ address: string }>;
    try { addresses = await dns.lookup(host, { all: true, verbatim: true }); } catch { throw new BadRequestException('Dominio pubblico non risolvibile.'); }
    if (!addresses.length || addresses.some((entry) => isUnsafeNetworkAddress(entry.address))) throw new BadRequestException('Destinazione di rete non consentita.');
    return url;
  }

  private async fetch(rawUrl: string, options: { maxBytes: number; redirects: number; kind: 'html' | 'image'; timeout: number }): Promise<SafeFetchResult> {
    const sourceUrl = rawUrl;
    let current = rawUrl;
    for (let redirect = 0; redirect <= options.redirects; redirect += 1) {
      const safe = await this.assertSafeUrl(current);
      let response: AxiosResponse<ArrayBuffer>;
      try {
        response = await axios.get<ArrayBuffer>(safe.toString(), {
          responseType: 'arraybuffer', timeout: options.timeout, maxRedirects: 0,
          maxContentLength: options.maxBytes, maxBodyLength: options.maxBytes,
          headers: { 'User-Agent': 'doFlow-ProposalAnalyzer/2.0 (+https://doflow.it)', Accept: options.kind === 'html' ? 'text/html,application/xhtml+xml' : 'image/*' },
          validateStatus: (status) => status >= 200 && status < 400,
        });
      } catch (error) {
        if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')) throw new BadRequestException('Il sito non ha risposto entro il tempo massimo.');
        if (axios.isAxiosError(error) && String(error.message).toLowerCase().includes('maxcontentlength')) throw new BadRequestException('La risposta supera la dimensione massima consentita.');
        throw new BadRequestException('Impossibile recuperare la risorsa pubblica.');
      }
      if (response.status >= 300) {
        const location = response.headers.location;
        if (!location || redirect === options.redirects) throw new BadRequestException('Troppi reindirizzamenti.');
        current = new URL(location, safe).toString();
        continue;
      }
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (options.kind === 'html' ? !/(text\/html|application\/xhtml\+xml)/.test(contentType) : !/^image\//.test(contentType)) throw new BadRequestException('Content-Type della risorsa non consentito.');
      const body = Buffer.from(response.data);
      if (body.length > options.maxBytes) throw new BadRequestException('La risposta supera la dimensione massima consentita.');
      return { sourceUrl, finalUrl: safe.toString(), contentType, body };
    }
    throw new BadRequestException('Troppi reindirizzamenti.');
  }
}
