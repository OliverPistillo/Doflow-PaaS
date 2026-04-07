// apps/backend/src/sitebuilder/sitebuilder.style-engine.ts
// FIX: Questo è un file BACKEND - NON usare React.CSSProperties

import { BrickStyles, DesignTokens, BreakpointKey, LayoutStyles, TypographyStyles, VisualStyles, SpacingValue } from './sitebuilder.types';

export class StyleEngine {
  
  static tokensToCSSVariables(tokens: DesignTokens): Record<string, string> {
    const vars: Record<string, string> = {};
    vars['--color-primary'] = tokens.colorPrimary;
    vars['--color-secondary'] = tokens.colorSecondary;
    vars['--color-accent'] = tokens.colorAccent;
    vars['--color-background'] = tokens.colorBackground;
    vars['--color-surface'] = tokens.colorSurface;
    vars['--color-text'] = tokens.colorText;
    vars['--color-text-muted'] = tokens.colorTextMuted;
    vars['--font-heading'] = tokens.fontHeading;
    vars['--font-body'] = tokens.fontBody;
    vars['--font-size-base'] = tokens.fontSizeBase;
    vars['--border-radius-base'] = tokens.borderRadiusBase;
    vars['--transition-base'] = tokens.transitionBase || 'all 0.2s ease';
    return vars;
  }

  static generateCSSVariablesBlock(vars: Record<string, string>, selector = ':root'): string {
    return `${selector} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;
  }

  // FIX: Restituisce Record<string, string|number> invece di React.CSSProperties
  static brickStylesToInline(styles?: BrickStyles): Record<string, string | number> {
    if (!styles) return {};
    const css: Record<string, string | number> = {};
    
    if (styles.layout) {
      const l = styles.layout;
      Object.assign(css, {
        display: l.display, flexDirection: l.flexDirection,
        justifyContent: l.justifyContent, alignItems: l.alignItems,
        gap: l.gap, position: l.position,
        top: l.top, right: l.right, bottom: l.bottom, left: l.left,
        zIndex: l.zIndex, width: l.width, maxWidth: l.maxWidth, minWidth: l.minWidth,
        height: l.height, maxHeight: l.maxHeight, minHeight: l.minHeight,
        margin: this.spacingToString(l.margin),
        padding: this.spacingToString(l.padding),
        overflow: l.overflow,
      });
    }
    
    if (styles.typography) {
      const t = styles.typography;
      Object.assign(css, {
        fontSize: t.fontSize, fontWeight: t.fontWeight,
        lineHeight: t.lineHeight, letterSpacing: t.letterSpacing,
        textAlign: t.textAlign, textTransform: t.textTransform,
        fontFamily: t.fontFamily, color: t.color,
      });
    }
    
    if (styles.visual) {
      const v = styles.visual;
      Object.assign(css, {
        backgroundColor: v.backgroundColor,
        backgroundImage: v.backgroundImage,
        backgroundSize: v.backgroundSize,
        backgroundPosition: v.backgroundPosition,
        borderRadius: v.borderRadius,
        border: v.border, borderColor: v.borderColor,
        boxShadow: v.boxShadow, opacity: v.opacity,
        filter: v.filter, transition: v.transition,
      });
    }
    
    // Rimuovi undefined
    Object.keys(css).forEach(key => {
      if (css[key] === undefined) delete css[key];
    });
    
    return css;
  }

  private static spacingToString(spacing?: SpacingValue): string | undefined {
    if (!spacing) return undefined;
    if (spacing.all) return spacing.all;
    if (spacing.x && spacing.y) return `${spacing.y} ${spacing.x}`;
    if (spacing.top && spacing.right && spacing.bottom && spacing.left) {
      return `${spacing.top} ${spacing.right} ${spacing.bottom} ${spacing.left}`;
    }
    return undefined;
  }
}