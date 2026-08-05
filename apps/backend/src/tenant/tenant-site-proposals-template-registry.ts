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
  contractVersion: '1.0' | '2.0' | '2.1';
  contentProfile: 'colsova-legacy-v1' | 'proposal-basic-v2' | 'colsova-conversion-v1' | 'beauty-editorial-v1' | 'beauty-conversion-v1';
  templateSize: number;
  isBuiltin: boolean;
  format: 'standalone' | 'modular';
  formatVersion?: '1.0';
  runtimeAdapterStatus: 'ready' | 'pending';
  selectableForProposal: boolean;
  selectableForImport: boolean;
  visible: boolean;
  preview: boolean;
  download: boolean;
  defaultCandidate: boolean;
  recommendationTags: readonly string[];
};

export const SITE_PROPOSAL_TEMPLATE_REGISTRY: readonly SiteProposalTemplateRegistration[] = [
  {
    slug: 'colsova', name: 'Tema Colsova', version: '1.0.0', schemaVersion: '1.0',
    sourceSha256: '2dc5395dee61f351a6b64789736c82453ac78a55bc8d6184bcf120fe0b01a217',
    directory: 'colsova/1.0.0', isActive: true, isLatest: false,
    categoryTags: SITE_PROPOSAL_CATEGORY_TAGS, contractVersion: '1.0', contentProfile: 'colsova-legacy-v1',
    templateSize: 102989, isBuiltin: true, format: 'standalone', runtimeAdapterStatus: 'ready',
    selectableForProposal: true, selectableForImport: true, visible: true, preview: true, download: false, defaultCandidate: false, recommendationTags: [],
  },
  {
    slug: 'colsova', name: 'Tema Colsova', version: '2.0.0', schemaVersion: '2.0',
    sourceSha256: 'f715d5077ca5d9f95ae0801b0dea570449265a3a49a34f4136b83628c7acc312',
    directory: 'colsova/2.0.0', isActive: true, isLatest: false,
    categoryTags: SITE_PROPOSAL_CATEGORY_TAGS, contractVersion: '2.0', contentProfile: 'proposal-basic-v2',
    templateSize: 19929, isBuiltin: true, format: 'standalone', runtimeAdapterStatus: 'ready',
    selectableForProposal: true, selectableForImport: true, visible: true, preview: true, download: false, defaultCandidate: false, recommendationTags: [],
  },
  {
    slug: 'colsova', name: 'Tema Colsova', version: '2.4.1', schemaVersion: '2.0',
    sourceSha256: '395a7f9e77d120558e5e45d3485c65f07be0cb339ad6a207a5562ec8b491d263',
    directory: 'colsova/2.4.1', isActive: true, isLatest: true,
    categoryTags: ['beauty', 'wellness', 'lead-generation'], contractVersion: '2.1',
    contentProfile: 'colsova-conversion-v1', templateSize: 2276156, isBuiltin: true, format: 'modular', formatVersion: '1.0', runtimeAdapterStatus: 'ready',
    selectableForProposal: true, selectableForImport: true, visible: true, preview: true, download: true, defaultCandidate: true,
    recommendationTags: ['lead generation', 'landing commerciale', 'beauty', 'wellness', 'conversione'],
  },
  {
    slug: 'aurea', name: 'Tema Aurea', version: '1.2.0', schemaVersion: '2.0',
    sourceSha256: 'cdc959eaa870485134fc2e93bade901eebf20e0af54d2d8d4113c904790da5a6',
    directory: 'aurea/1.2.0', isActive: true, isLatest: true,
    categoryTags: ['beauty', 'wellness', 'editoriale'], contractVersion: '2.1', contentProfile: 'beauty-editorial-v1',
    templateSize: 384117, isBuiltin: true, format: 'modular', formatVersion: '1.0', runtimeAdapterStatus: 'ready',
    selectableForProposal: true, selectableForImport: true, visible: true, preview: true, download: true, defaultCandidate: true,
    recommendationTags: ['medicina estetica', 'beauty premium', 'wellness', 'professionisti', 'elegante', 'editoriale'],
  },
  {
    slug: 'luce', name: 'Tema Luce', version: '1.2.0', schemaVersion: '2.0',
    sourceSha256: '9f990c78514508cfe832a69e8a5caec21271085bed8eb977ff9dfce9ce6bd2c2',
    directory: 'luce/1.2.0', isActive: true, isLatest: true,
    categoryTags: ['beauty', 'cliniche', 'conversione'], contractVersion: '2.1', contentProfile: 'beauty-conversion-v1',
    templateSize: 347122, isBuiltin: true, format: 'modular', formatVersion: '1.0', runtimeAdapterStatus: 'ready',
    selectableForProposal: true, selectableForImport: true, visible: true, preview: true, download: true, defaultCandidate: true,
    recommendationTags: ['cliniche', 'centro estetico', 'medicina estetica', 'molti servizi', 'conversione', 'prenotazione'],
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
