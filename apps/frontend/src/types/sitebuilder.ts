// apps/frontend/src/types/sitebuilder.ts
// ════════════════════════════════════════════════════════════════════
//  TIPI CONDIVISI FRONTEND - Sitebuilder v5
// ════════════════════════════════════════════════════════════════════

// ─── Breakpoints & Responsive ─────────────────────────────────────
export type BreakpointKey = 'desktop' | 'tablet' | 'mobile';

export interface BreakpointConfig {
  desktop: { minWidth: number; label: string };
  tablet: { minWidth: number; maxWidth: number; label: string };
  mobile: { maxWidth: number; label: string };
}

export const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  desktop: { minWidth: 1025, label: 'Desktop' },
  tablet: { minWidth: 768, maxWidth: 1024, label: 'Tablet' },
  mobile: { maxWidth: 767, label: 'Mobile' },
};

// ─── Design Tokens ────────────────────────────────────────────────
export interface DesignTokens {
  // Colors
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorBackground: string;
  colorSurface: string;
  colorText: string;
  colorTextMuted: string;
  
  // Typography
  fontHeading: string;
  fontBody: string;
  fontSizeBase: string;
  fontSizeScale: 'minor-second' | 'major-second' | 'minor-third' | 'major-third' | 'perfect-fourth' | 'augmented-fourth' | 'perfect-fifth' | 'golden-ratio';
  
  // Spacing & Borders
  spacingUnit: string;
  spacingScale: 'none' | 'small' | 'medium' | 'large' | 'huge';
  borderRadiusBase: string;
  borderRadiusScale: 'none' | 'small' | 'medium' | 'large' | 'full';
  boxShadowBase: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  transitionBase: string;
}

// ─── Style System ─────────────────────────────────────────────────
export type CssUnit = 'px' | '%' | 'rem' | 'em' | 'vh' | 'vw' | 'auto' | 'none';
export type DisplayValue = 'block' | 'flex' | 'grid' | 'inline' | 'inline-flex' | 'inline-grid' | 'none';
export type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
export type JustifyContent = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
export type AlignItems = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type FontWeight = '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | 'normal' | 'bold';
export type PositionValue = 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';

export interface SpacingValue {
  top?: string; right?: string; bottom?: string; left?: string;
  x?: string; y?: string; all?: string;
}

export interface LayoutStyles {
  display?: DisplayValue;
  flexDirection?: FlexDirection;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  gap?: string;
  rowGap?: string;
  columnGap?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  position?: PositionValue;
  top?: string; right?: string; bottom?: string; left?: string;
  zIndex?: number;
  width?: string; maxWidth?: string; minWidth?: string;
  height?: string; maxHeight?: string; minHeight?: string;
  margin?: SpacingValue;
  padding?: SpacingValue;
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
}

export interface TypographyStyles {
  fontSize?: string;
  fontWeight?: FontWeight;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: TextAlign;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  fontFamily?: string;
  color?: string;
}

export interface VisualStyles {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: string;
  backgroundRepeat?: 'no-repeat' | 'repeat';
  borderRadius?: string;
  border?: string; borderColor?: string; borderWidth?: string; borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  boxShadow?: string;
  opacity?: number;
  filter?: string;
  transition?: string;
  transform?: string;
}

export interface InteractionStyles {
  hover?: Partial<VisualStyles & TypographyStyles>;
  active?: Partial<VisualStyles & TypographyStyles>;
}

export interface ResponsiveOverride {
  layout?: Partial<LayoutStyles>;
  typography?: Partial<TypographyStyles>;
  visual?: Partial<VisualStyles>;
  display?: 'show' | 'hide';
}

export interface BrickStyles {
  layout?: LayoutStyles;
  typography?: TypographyStyles;
  visual?: VisualStyles;
  interactions?: InteractionStyles;
  responsive?: Partial<Record<BreakpointKey, ResponsiveOverride>>;
  tokenRefs?: Record<string, string>;
}

// ─── Brick & Page Structure ───────────────────────────────────────
export interface BrickItem {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export interface Brick {
  id: string;
  type: string;
  label?: string;
  
  // Content fields
  headline?: string;
  subheadline?: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  imageUrl?: string;
  image_query?: string;
  items?: BrickItem[];
  bgColor?: string;
  textColor?: string;
  
  // New style system
  styles?: BrickStyles;
  
  // Nesting support
  children?: Brick[];
  
  // Metadata
  locked?: boolean;
  hidden?: boolean;
  className?: string;
}

export interface SitePage {
  slug: string;
  title: string;
  meta?: { title?: string; description?: string };
  styles?: { backgroundColor?: string; customCSS?: string };
  bricks: Brick[];
}

// ─── Component Library ────────────────────────────────────────────
export interface ComponentDefinition {
  id: string;
  name: string;
  description?: string;
  category: 'layout' | 'content' | 'media' | 'form' | 'navigation' | 'custom';
  brickType: string;
  defaultProps: Record<string, unknown>;
  defaultStyles?: BrickStyles;
  thumbnail?: string;
  isPro?: boolean;
  tags?: string[];
}

// ─── WP Data Output (v2) ──────────────────────────────────────────
export interface WpData {
  meta: {
    siteDomain: string;
    siteTitle: string;
    adminEmail: string;
    businessType: string;
    locale: string;
    starterSite: string;
    generatedAt: string;
    version: '2.0';
  };
  design: {
    tokens: DesignTokens;
    cssVariables: Record<string, string>;
    breakpoints: BreakpointConfig;
    customCSS?: string;
  };
  components: ComponentDefinition[];
  pages: SitePage[];
}

// ─── Wizard Form ──────────────────────────────────────────────────
export interface DesignSchemeDto {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headingFont?: string;
  bodyFont?: string;
}

export interface WizardForm {
  tenantId: string;
  siteDomain: string;
  siteTitle: string;
  adminEmail: string;
  businessType: string;
  businessDescription: string;
  starterSite: string;
  designScheme: DesignSchemeDto;
  contentTopics: string[];
  locale: string;
  xmlBlocks?: { strategy?: Record<string, string>; pages: SitePage[] } | null;
}