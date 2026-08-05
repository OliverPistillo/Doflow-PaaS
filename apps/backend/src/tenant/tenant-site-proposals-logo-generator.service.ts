import { BadRequestException, Injectable } from '@nestjs/common';
import { JsonObject, ProposalContentProfile } from './tenant-site-proposals.types';
import { sha256 } from './tenant-site-proposals-validation';

export type GeneratedProposalLogo = {
  bytes: Buffer;
  dataUri: string;
  sha256: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  sourceMethod: 'generated';
  mime: 'image/svg+xml';
};

export type GeneratedProposalLogoSet = {
  defaultLogo: GeneratedProposalLogo;
  lightLogo: GeneratedProposalLogo;
  metadata: JsonObject;
};

const SAFE_FALLBACKS = [
  { dark: '#172033', accent: '#9B6B35', light: '#FFFFFF', lightAccent: '#E7C38D' },
  { dark: '#17312C', accent: '#2F7668', light: '#FFFFFF', lightAccent: '#9AD8CB' },
  { dark: '#2F2135', accent: '#8A5A86', light: '#FFFFFF', lightAccent: '#DDB9D9' },
] as const;
const HONORIFICS = new Set(['dott', 'dottssa', 'ssa', 'dr', 'prof', 'profssa']);

@Injectable()
export class TenantSiteProposalsLogoGeneratorService {
  generate(input: { businessName: string; descriptor?: string; palette?: JsonObject; contentProfile: ProposalContentProfile; fingerprint: string }): GeneratedProposalLogoSet {
    const businessName = this.clean(input.businessName, 80);
    if (!businessName) throw new BadRequestException('Nome attività non valido per il logo');
    const descriptor = this.clean(input.descriptor || '', 56);
    const fingerprint = sha256(`${input.fingerprint}:${businessName}:${descriptor}:${input.contentProfile}`);
    const fallback = SAFE_FALLBACKS[parseInt(fingerprint.slice(0, 8), 16) % SAFE_FALLBACKS.length];
    const palette = this.palette(input.palette, fallback);
    const initials = this.initials(businessName);
    const layout = ['circle', 'rounded', 'linear'][parseInt(fingerprint.slice(8, 16), 16) % 3];
    const defaultLogo = this.logo(businessName, descriptor, initials, layout, palette.dark, palette.accent, false);
    const lightLogo = this.logo(businessName, descriptor, initials, layout, palette.light, palette.lightAccent, true);
    return {
      defaultLogo,
      lightLogo,
      metadata: { sourceMethod: 'generated', fingerprint, contentProfile: input.contentProfile, initials, layout },
    };
  }

  private logo(name: string, descriptor: string, initials: string, layout: string, text: string, accent: string, light: boolean): GeneratedProposalLogo {
    const mark = layout === 'circle'
      ? `<circle cx="120" cy="120" r="78" fill="none" stroke="${accent}" stroke-width="10"/><text x="120" y="138" text-anchor="middle" fill="${text}" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="700">${this.xml(initials)}</text>`
      : layout === 'rounded'
        ? `<rect x="42" y="42" width="156" height="156" rx="38" fill="${accent}"/><text x="120" y="138" text-anchor="middle" fill="${light ? '#172033' : '#FFFFFF'}" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="700">${this.xml(initials)}</text>`
        : `<path d="M48 171L120 51l72 120M76 135h88" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><text x="120" y="218" text-anchor="middle" fill="${text}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700">${this.xml(initials)}</text>`;
    const descriptorNode = descriptor ? `<text x="250" y="151" fill="${text}" opacity="0.82" font-family="Arial,Helvetica,sans-serif" font-size="25" letter-spacing="1.2">${this.xml(descriptor)}</text>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 240" width="960" height="240" role="img" aria-label="${this.xml(`Logo ${name}`)}"><title>${this.xml(`Logo ${name}`)}</title>${mark}<text x="250" y="112" fill="${text}" font-family="Arial,Helvetica,sans-serif" font-size="58" font-weight="700">${this.xml(name)}</text>${descriptorNode}</svg>`;
    const bytes = Buffer.from(svg, 'utf8');
    return { bytes, dataUri: `data:image/svg+xml;base64,${bytes.toString('base64')}`, sha256: sha256(bytes), size: bytes.length, width: 960, height: 240, alt: `Logo ${name}`, sourceMethod: 'generated', mime: 'image/svg+xml' };
  }

  private palette(value: JsonObject | undefined, fallback: typeof SAFE_FALLBACKS[number]) {
    const colors = Object.values(value || {}).filter((item): item is string => typeof item === 'string' && /^#[0-9a-f]{6}$/i.test(item));
    const dark = colors.find((color) => this.luminance(color) <= 0.28) || fallback.dark;
    const accent = colors.find((color) => this.contrast(color, '#FFFFFF') >= 3 && color.toLowerCase() !== dark.toLowerCase()) || fallback.accent;
    return { dark, accent, light: fallback.light, lightAccent: fallback.lightAccent };
  }

  private initials(value: string) {
    const words = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const meaningful = words.filter((word) => !HONORIFICS.has(word.toLocaleLowerCase('it-IT').replace(/[^a-z]/g, '')));
    const selected = (meaningful.length ? meaningful : words).slice(0, 3);
    return selected.map((word) => [...word][0].toLocaleUpperCase('it-IT')).join('') || 'DF';
  }

  private clean(value: string, limit: number) {
    return String(value || '').normalize('NFKC').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
  }

  private xml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
  private luminance(hex: string) {
    const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }
  private contrast(left: string, right: string) { const values = [this.luminance(left), this.luminance(right)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05); }
}
