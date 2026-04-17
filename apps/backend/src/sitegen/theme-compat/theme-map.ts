import { SiteKind } from '../contracts/site-manifest';

const LEGACY_THEME_MAP: Record<SiteKind, string> = {
  agency: 'doflow-zyno',
  startup: 'doflow-first',
  studio: 'doflow-artifice',
  'local-business': 'doflow-konsulty',
  ecommerce: 'doflow-skintiva',
};

export function legacyThemeIdForSiteKind(siteKind: SiteKind): string {
  return LEGACY_THEME_MAP[siteKind] || 'doflow-first';
}
