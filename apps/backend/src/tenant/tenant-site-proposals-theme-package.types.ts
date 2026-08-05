import { JsonObject, ProposalContentProfile } from './tenant-site-proposals.types';

export type ModularThemeRuntimeAdapterStatus = 'ready' | 'pending';
export type ThemePackageFormat = 'standalone' | 'modular';

export type ModularThemeCollection = {
  path: string;
  count: number;
};

export type ModularThemeAsset = {
  path: string;
  mime: 'image/webp' | 'image/png' | 'image/jpeg' | 'image/svg+xml';
  sha256: string;
  size: number;
};

export type ModularThemeSecurity = {
  allowDemoForms: boolean;
  allowExternalHttpsLinks: false;
  networkAccess: false;
};

export type ModularThemeProvenance = {
  sourceType: 'user-supplied-standalone';
  sourceTemplateSha256: string;
  sourceTemplateSize: number;
  normalizations: string[];
};

export type ModularThemeManifest = {
  name: string;
  slug: string;
  version: string;
  schemaVersion: '2.0';
  contractVersion: '2.1';
  formatVersion: '1.0';
  format: 'modular';
  entry: 'template.html';
  styleEntries: string[];
  scriptEntries: string[];
  assetRoot: 'assets';
  contentProfile: ProposalContentProfile;
  runtimeAdapterStatus: ModularThemeRuntimeAdapterStatus;
  categories: string[];
  recommendationTags: string[];
  collections: Record<string, ModularThemeCollection>;
  fixedCounts: Record<string, number>;
  features: Record<string, unknown>;
  paletteKeys: string[];
  imageSlots: string[];
  socialSlots: string[];
  editablePaths: string[];
  protectedPaths: string[];
  textLimits: Record<string, number>;
  assetMap: Record<string, ModularThemeAsset>;
  security: ModularThemeSecurity;
  provenance: ModularThemeProvenance;
};

export type ModularThemeFileInventory = {
  path: string;
  size: number;
  sha256: string;
  kind: 'entry' | 'style' | 'script' | 'asset' | 'documentation' | 'manifest';
};

export type ModularThemePackage = {
  manifest: ModularThemeManifest;
  files: Readonly<Record<string, Buffer>>;
  defaultConfig: JsonObject;
  fileInventory: ModularThemeFileInventory[];
  assetInventory: ModularThemeAsset[];
  sourcePackageSha256: string;
};

export type ThemeValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type ThemeValidationReport = {
  valid: boolean;
  format: ThemePackageFormat;
  checks: Record<string, boolean>;
  warnings: ThemeValidationIssue[];
  errors: ThemeValidationIssue[];
};

export type ThemeCompilationAssetReport = ModularThemeAsset & {
  dataUriSize: number;
  referencesReplaced: number;
};

export type ThemeCompilationReport = {
  format: 'standalone';
  styleEntries: string[];
  scriptEntries: string[];
  assets: ThemeCompilationAssetReport[];
  sourceFileCount: number;
  deterministic: true;
};

export type CompiledThemeArtifact = {
  html: string;
  sha256: string;
  size: number;
  sourcePackageSha256: string;
  assetReport: ThemeCompilationAssetReport[];
  compilationReport: ThemeCompilationReport;
};
