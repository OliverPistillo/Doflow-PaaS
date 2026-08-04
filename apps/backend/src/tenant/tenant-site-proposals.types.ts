export type JsonObject = Record<string, unknown>;

export type CanonicalProposalInput = {
  businessName: string;
  professionalTitle?: string;
  publicContactName?: string;
  contactSource?: string;
  personRoleSource?: string;
  dataCompleteness?: string;
  verifiedAt?: string;
  descriptor?: string;
  category?: string;
  city?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  openingHours?: string;
  services: string[];
  brands: string[];
  socialFacebook?: string;
  socialLinkedIn?: string;
  socialInstagram?: string;
  socialTikTok?: string;
  socialYouTube?: string;
  notes?: string;
  leadPriority?: string;
  overview?: string;
  targetAudience?: string;
  primaryGoal?: string;
  toneOfVoice?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  consultationImageUrl?: string;
  productsImageUrl?: string;
  paletteOverrides?: JsonObject;
  configOverrides?: JsonObject;
  extra: JsonObject;
};
export type RowIssue = {
  code: string;
  message: string;
  path?: string;
  original?: unknown;
  used?: unknown;
  limit?: number;
};

export type PreviewRow = {
  rowIndex: number;
  valid: boolean;
  errors: RowIssue[];
  warnings: RowIssue[];
  canonical?: CanonicalProposalInput;
  sourceRowHash?: string;
  fingerprint?: string;
  siteConfig?: JsonObject;
  displayName?: string;
  sourceRow: Record<string, string>;
};

export type TemplateManifest = {
  name: string;
  slug: string;
  versione: string;
  version: string;
  schemaVersion: string;
  layoutLocked: boolean;
  fixedCounts: {
    treatmentCards?: number;
    productPoints?: number;
    reviews?: number;
    services?: number;
    trustItems?: number;
    consultationHighlights?: number;
    processSteps?: number;
    faqs: number;
  };
  textLimits: JsonObject;
  imageSlots: string[];
  routes: string[];
  categoryTags: string[];
  updatedAt: string;
  sourceSha256: string;
};

export type ProposalContentProfile = 'colsova-legacy-v1' | 'proposal-basic-v2' | 'colsova-conversion-v1';
export type PreparationStatus = 'idle' | 'queued' | 'running' | 'ready' | 'fallback' | 'failed';
export type ProposalPreparationActor = { id?: string | null; email?: string | null; role?: string | null };
export type ProposalPreparationOptions = {
  force: boolean;
  generate: boolean;
  reason: string;
  targetTemplateSlug?: string;
  targetTemplateVersion?: string;
};
export type ProposalPreparationJobData = ProposalPreparationOptions & {
  tenantSchema: string;
  proposalId: string;
  actorUserId: string | null;
  actorEmail: string | null;
};

export type PersonalizationStatus = 'idle' | 'running' | 'completed' | 'fallback' | 'failed';
export type ProposalImageSourceMethod = 'website' | 'catalog' | 'catalog_fallback' | 'manual' | 'stock_local';
export type WebsiteImageCandidate = {
  url: string;
  alt: string;
  context: string;
  kind: 'og' | 'hero' | 'main' | 'content';
  order: number;
};
export type WebsiteSnapshot = {
  sourceUrl: string; finalUrl: string; title: string; description: string;
  headings: string[]; paragraphs: string[]; navigation: string[]; ctas: string[];
  emails: string[]; phones: string[]; social: Record<string, string>;
  logoCandidates: string[]; imageCandidates: string[]; photoCandidates?: WebsiteImageCandidate[]; colors: string[]; text: string;
};

export type AuthUserRef = {
  id: string;
  email?: string | null;
  role: string;
};

export type RenderedHtml = {
  html: string;
  sha256: string;
  size: number;
};

export type GeneratedZip = {
  buffer: Buffer;
  sha256: string;
  size: number;
  entries: string[];
};
