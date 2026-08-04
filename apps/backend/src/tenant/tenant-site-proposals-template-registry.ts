import { NotFoundException } from '@nestjs/common';
import { SITE_PROPOSAL_CATEGORY_TAGS } from './tenant-site-proposals.constants';

export type SiteProposalTemplateRegistration = {
  slug: string;
  name: string;
  version: string;
  schemaVersion: string;
  sourceSha256: string;
  directory: string;
  isActive: boolean;
  isLatest: boolean;
  categoryTags: readonly string[];
  contractVersion: '1.0' | '2.0';
};

export const SITE_PROPOSAL_TEMPLATE_REGISTRY: readonly SiteProposalTemplateRegistration[] = [
  {
    slug: 'colsova', name: 'Tema Colsova', version: '1.0.0', schemaVersion: '1.0',
    sourceSha256: '2dc5395dee61f351a6b64789736c82453ac78a55bc8d6184bcf120fe0b01a217',
    directory: 'colsova/1.0.0', isActive: true, isLatest: false,
    categoryTags: SITE_PROPOSAL_CATEGORY_TAGS, contractVersion: '1.0',
  },
  {
    slug: 'colsova', name: 'Tema Colsova', version: '2.0.0', schemaVersion: '2.0',
    sourceSha256: 'f715d5077ca5d9f95ae0801b0dea570449265a3a49a34f4136b83628c7acc312',
    directory: 'colsova/2.0.0', isActive: true, isLatest: true,
    categoryTags: SITE_PROPOSAL_CATEGORY_TAGS, contractVersion: '2.0',
  },
] as const;

export function getTemplateRegistration(slug: string, version?: string): SiteProposalTemplateRegistration {
  const candidates = SITE_PROPOSAL_TEMPLATE_REGISTRY.filter((item) => item.slug === slug && item.isActive);
  const found = version ? candidates.find((item) => item.version === version) : candidates.find((item) => item.isLatest);
  if (!found) throw new NotFoundException('Template non trovato');
  return found;
}
export function latestTemplateRegistration(slug = 'colsova') {
  return getTemplateRegistration(slug);
}
