// apps/backend/src/sitebuilder/sitebuilder.types.ts

// ════════════════════════════════════════════════════════════════════
//  STYLE SYSTEM - Design tokens & CSS properties
// ════════════════════════════════════════════════════════════════════

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
  gridAutoFlow?: string;
  position?: PositionValue;
  top?: string; right?: string; bottom?: string; left?: string;
  zIndex?: number;
  width?: string; maxWidth?: string; minWidth?: string;
  height?: string; maxHeight?: string; minHeight?: string;
  margin?: SpacingValue;
  padding?: SpacingValue;
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  overflowX?: 'visible' | 'hidden' | 'scroll' | 'auto';
  overflowY?: 'visible' | 'hidden' | 'scroll' | 'auto';
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
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  borderRadius?: string;
  borderTopLeftRadius?: string; borderTopRightRadius?: string;
  borderBottomLeftRadius?: string; borderBottomRightRadius?: string;
  border?: string; borderTop?: string; borderRight?: string;
  borderBottom?: string; borderLeft?: string;
  borderColor?: string; borderWidth?: string; borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  boxShadow?: string;
  opacity?: number;
  filter?: string;
  transition?: string;
  transform?: string;
}

export interface InteractionStyles {
  hover?: Partial<VisualStyles & TypographyStyles>;
  active?: Partial<VisualStyles & TypographyStyles>;
  focus?: Partial<VisualStyles & TypographyStyles>;
  animations?: Array<{
    name: string;
    duration?: string;
    timing?: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    delay?: string;
    iteration?: 'infinite' | number;
  }>;
}

// ════════════════════════════════════════════════════════════════════
//  RESPONSIVE BREAKPOINTS
// ════════════════════════════════════════════════════════════════════

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

export interface ResponsiveOverride {
  layout?: Partial<LayoutStyles>;
  typography?: Partial<TypographyStyles>;
  visual?: Partial<VisualStyles>;
  display?: 'show' | 'hide'; // nascondi elemento su breakpoint
}

// ════════════════════════════════════════════════════════════════════
//  DESIGN TOKENS / GLOBAL STYLES
// ════════════════════════════════════════════════════════════════════

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
  
  // Spacing
  spacingUnit: string;
  spacingScale: 'none' | 'small' | 'medium' | 'large' | 'huge';
  
  // Borders & Shadows
  borderRadiusBase: string;
  borderRadiusScale: 'none' | 'small' | 'medium' | 'large' | 'full';
  boxShadowBase: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  
  // Transitions
  transitionBase: string;
}

export interface GlobalStyles {
  tokens: DesignTokens;
  cssVariables: Record<string, string>; // generated from tokens
  customCSS?: string; // user-added custom CSS
}

// ════════════════════════════════════════════════════════════════════
//  COMPONENT / SYMBOL SYSTEM
// ════════════════════════════════════════════════════════════════════

export interface ComponentDefinition {
  id: string;
  name: string;
  description?: string;
  category: 'layout' | 'content' | 'media' | 'form' | 'navigation' | 'custom';
  thumbnail?: string;
  
  // Structure
  brickType: string;
  defaultProps: Record<string, unknown>;
  defaultStyles?: BrickStyles;
  
  // Slots (for nested components)
  slots?: Array<{
    name: string;
    description: string;
    accepts: string[]; // allowed brick types
    multiple?: boolean;
  }>;
  
  isPro?: boolean;
  tags?: string[];
}

export interface ComponentInstance {
  componentId: string;
  instanceId: string;
  overrides: {
    content?: Record<string, unknown>;
    styles?: BrickStyles;
  };
  // Nested content for slots
  slots?: Record<string, Brick[]>;
}

// ════════════════════════════════════════════════════════════════════
//  EXTENDED BRICK INTERFACE
// ════════════════════════════════════════════════════════════════════

export interface BrickStyles {
  layout?: LayoutStyles;
  typography?: TypographyStyles;
  visual?: VisualStyles;
  interactions?: InteractionStyles;
  // Responsive overrides per breakpoint
  responsive?: Partial<Record<BreakpointKey, ResponsiveOverride>>;
  // Reference to global token (e.g., "colorPrimary" instead of "#3B82F6")
  tokenRefs?: Record<string, string>;
}

export interface BrickItem {
  title: string;
  description: string;
  image?: string;
  url?: string;
  styles?: BrickStyles; // per-item styling
}

export interface Brick {
  id: string;
  type: string;
  
  // Content (existing)
  headline?: string;
  subheadline?: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  imageUrl?: string;
  image_query?: string;
  items?: BrickItem[];
  
  // NEW: Styling system
  styles?: BrickStyles;
  
  // NEW: Component system
  componentInstance?: ComponentInstance;
  
  // NEW: Container support (nesting)
  children?: Brick[];
  
  // Metadata
  label?: string; // for layer tree
  locked?: boolean;
  hidden?: boolean;
  conditions?: {
    showIf?: string; // simple conditional logic
  };
}

// ════════════════════════════════════════════════════════════════════
//  PAGE & SITE STRUCTURE
// ════════════════════════════════════════════════════════════════════

export interface SitePage {
  slug: string;
  title: string;
  meta?: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };
  styles?: {
    backgroundColor?: string;
    customCSS?: string;
  };
  bricks: Brick[];
}

export interface SiteStructure {
  strategy?: {
    targetAudience: string;
    searchIntent: string;
    toneOfVoice: string;
  };
  pages: SitePage[];
}

// ════════════════════════════════════════════════════════════════════
//  WP DATA OUTPUT (consumed by plugin)
// ════════════════════════════════════════════════════════════════════

export interface WpData {
  meta: {
    siteDomain: string;
    siteTitle: string;
    adminEmail: string;
    businessType: string;
    locale: string;
    starterSite: string;
    generatedAt: string;
    version: string; // '2.0' per nuovo formato
  };
  
  design: {
    tokens: DesignTokens;
    cssVariables: Record<string, string>;
    breakpoints: BreakpointConfig;
    customCSS?: string;
  };
  
  components: ComponentDefinition[]; // libreria usata nel sito
  
  pages: SitePage[];
  
  // SEO & Performance
  seo?: {
    globalMeta: Record<string, string>;
    structuredData?: Record<string, unknown>;
  };
}