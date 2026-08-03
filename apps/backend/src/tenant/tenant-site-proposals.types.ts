export type JsonObject = Record<string, unknown>;

export type CanonicalProposalInput = {
  businessName: string;
  professionalTitle?: string;
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
};

export type TemplateManifest = {
  name: string;
  slug: string;
  versione: string;
  version: string;
  schemaVersion: string;
  layoutLocked: boolean;
  fixedCounts: {
    treatmentCards: number;
    productPoints: number;
    reviews: number;
    faqs: number;
  };
  textLimits: JsonObject;
  imageSlots: string[];
  routes: string[];
  categoryTags: string[];
  updatedAt: string;
  sourceSha256: string;
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
