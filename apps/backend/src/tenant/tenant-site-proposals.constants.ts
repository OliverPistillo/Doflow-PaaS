export const SITE_PROPOSALS_TENANT = 'doflow';

export const COLSOVA_TEMPLATE = {
  slug: 'colsova',
  name: 'Tema Colsova',
  version: '1.0.0',
  schemaVersion: '1.0',
  sourceSha256: '2dc5395dee61f351a6b64789736c82453ac78a55bc8d6184bcf120fe0b01a217',
} as const;

export const SITE_PROPOSAL_CATEGORY_TAGS = [
  'medicina estetica',
  'dermatologia',
  'chirurgia estetica',
  'odontoiatria estetica',
  'beauty clinic',
  'centro estetico',
  'skincare',
  'benessere',
  'wellness',
  'studio medico',
  'professionista sanitario',
  'fisioterapia',
  'nutrizione',
];

export const CSV_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxRows: 50,
  maxColumns: 100,
  maxCellChars: 20_000,
};

export const ALLOWED_CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream',
]);

export const IMPORT_STATUSES = ['preview', 'confirmed', 'generated', 'partial', 'failed'] as const;
export const PROPOSAL_STATUSES = ['draft', 'ready', 'generated', 'error', 'archived'] as const;
export const GENERATION_STATUSES = ['running', 'completed', 'failed'] as const;

export const ACTIVITY = {
  proposalCreated: 'PROPOSAL_CREATED',
  importConfirmed: 'IMPORT_CONFIRMED',
  proposalUpdated: 'PROPOSAL_UPDATED',
  crmLinkUpdated: 'CRM_LINK_UPDATED',
  versionCreated: 'VERSION_CREATED',
  versionRestored: 'VERSION_RESTORED',
  generationStarted: 'GENERATION_STARTED',
  generated: 'GENERATED',
  generationFailed: 'GENERATION_FAILED',
  proposalArchived: 'PROPOSAL_ARCHIVED',
} as const;

export const ROUTE_REDIRECT_ANCHORS: Record<string, string> = {
  shop: '#prodotti',
  treatmentsOverview: '#trattamenti',
  faceTreatments: '#trattamenti',
  botox: '#trattamenti',
  biorivitalization: '#trattamenti',
  peeling: '#trattamenti',
  fillerTreatments: '#trattamenti',
  fillerLips: '#trattamenti',
  fillerFace: '#trattamenti',
  harmonization: '#trattamenti',
  bodyTreatments: '#trattamenti',
  remodeling: '#trattamenti',
  firmness: '#trattamenti',
  bodyConsultation: '#trattamenti',
  contactPage: '#contatti',
  bookingPage: '#contatti',
  account: '#home',
  cart: '#home',
  privacy: '#contatti',
  cookie: '#contatti',
};

export const GENERATED_STORAGE_PREFIX = 'doflow/site-proposals';
