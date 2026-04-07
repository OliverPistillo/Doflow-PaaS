// apps/frontend/src/lib/style-utils.ts
import { useState, useCallback, CSSProperties } from 'react';
import { BrickStyles, BreakpointKey, DesignTokens } from '@/types/sitebuilder';

/**
 * Merge styles con supporto responsive e token resolution
 */
export function useMergedStyles(
  baseStyles?: BrickStyles,
  overrides?: Partial<BrickStyles>,
  breakpoint?: BreakpointKey,
  tokens?: DesignTokens
): CSSProperties {
  // 1. Merge base + overrides
  let merged: BrickStyles = {
    layout: { ...baseStyles?.layout, ...overrides?.layout },
    typography: { ...baseStyles?.typography, ...overrides?.typography },
    visual: { ...baseStyles?.visual, ...overrides?.visual },
    interactions: { ...baseStyles?.interactions, ...overrides?.interactions },
    responsive: { ...baseStyles?.responsive, ...overrides?.responsive },
    tokenRefs: { ...baseStyles?.tokenRefs, ...overrides?.tokenRefs },
  };
  
  // 2. Applica responsive overrides se breakpoint specificato
  if (breakpoint && merged.responsive?.[breakpoint]) {
    const resp = merged.responsive[breakpoint];
    if (resp?.display === 'hide') {
      return { display: 'none' };
    }
    if (resp?.layout) merged.layout = { ...merged.layout, ...resp.layout };
    if (resp?.typography) merged.typography = { ...merged.typography, ...resp.typography };
    if (resp?.visual) merged.visual = { ...merged.visual, ...resp.visual };
  }
  
  // 3. Risolve token references
  if (tokens && merged.tokenRefs) {
    const tokenMap: Record<string, string> = {
      'colorPrimary': tokens.colorPrimary,
      'colorSecondary': tokens.colorSecondary,
      'colorAccent': tokens.colorAccent,
      'colorBackground': tokens.colorBackground,
      'colorSurface': tokens.colorSurface,
      'colorText': tokens.colorText,
      'fontHeading': tokens.fontHeading,
      'fontBody': tokens.fontBody,
      'borderRadiusBase': tokens.borderRadiusBase,
    };
    
    if (merged.visual?.backgroundColor && merged.tokenRefs.backgroundColor) {
      merged.visual.backgroundColor = tokenMap[merged.tokenRefs.backgroundColor] || merged.visual.backgroundColor;
    }
    if (merged.typography?.color && merged.tokenRefs.textColor) {
      merged.typography.color = tokenMap[merged.tokenRefs.textColor] || merged.typography.color;
    }
    if (merged.typography?.fontFamily && merged.tokenRefs.fontFamily) {
      merged.typography.fontFamily = tokenMap[merged.tokenRefs.fontFamily] || merged.typography.fontFamily;
    }
  }
  
  // 4. Converte in CSSProperties
  return brickStylesToInline(merged);
}

/**
 * Converte BrickStyles in React.CSSProperties
 */
export function brickStylesToInline(styles?: BrickStyles): CSSProperties {
  if (!styles) return {};
  
  const css: CSSProperties = {};
  
  // Layout
  if (styles.layout) {
    const l = styles.layout;
    Object.assign(css, {
      display: l.display,
      flexDirection: l.flexDirection,
      justifyContent: l.justifyContent,
      alignItems: l.alignItems,
      gap: l.gap,
      position: l.position,
      top: l.top, right: l.right, bottom: l.bottom, left: l.left,
      zIndex: l.zIndex,
      width: l.width, maxWidth: l.maxWidth, minWidth: l.minWidth,
      height: l.height, maxHeight: l.maxHeight, minHeight: l.minHeight,
      margin: spacingToString(l.margin),
      padding: spacingToString(l.padding),
      overflow: l.overflow,
    });
  }
  
  // Typography
  if (styles.typography) {
    const t = styles.typography;
    Object.assign(css, {
      fontSize: t.fontSize,
      fontWeight: t.fontWeight as any,
      lineHeight: t.lineHeight,
      letterSpacing: t.letterSpacing,
      textAlign: t.textAlign,
      textTransform: t.textTransform,
      fontFamily: t.fontFamily,
      color: t.color,
    });
  }
  
  // Visual
  if (styles.visual) {
    const v = styles.visual;
    Object.assign(css, {
      backgroundColor: v.backgroundColor,
      backgroundImage: v.backgroundImage,
      backgroundSize: v.backgroundSize,
      backgroundPosition: v.backgroundPosition,
      borderRadius: v.borderRadius,
      border: v.border,
      boxShadow: v.boxShadow,
      opacity: v.opacity,
      filter: v.filter,
      transition: v.transition,
    });
  }
  
  // Rimuovi undefined
  Object.keys(css).forEach(key => {
    if (css[key as keyof typeof css] === undefined) {
      delete css[key as keyof typeof css];
    }
  });
  
  return css;
}

function spacingToString(spacing?: any): string | undefined {
  if (!spacing) return undefined;
  if (spacing.all) return spacing.all;
  if (spacing.x && spacing.y) return `${spacing.y} ${spacing.x}`;
  if (spacing.top && spacing.right && spacing.bottom && spacing.left) {
    return `${spacing.top} ${spacing.right} ${spacing.bottom} ${spacing.left}`;
  }
  return undefined;
}

/**
 * Genera classi utility da styles (per WordPress output)
 */
export function stylesToUtilityClasses(styles?: BrickStyles): string[] {
  if (!styles) return [];
  const classes: string[] = [];
  
  if (styles.layout?.display) classes.push(`d-${styles.layout.display}`);
  if (styles.layout?.flexDirection) classes.push(`flex-${styles.layout.flexDirection}`);
  if (styles.typography?.textAlign) classes.push(`text-${styles.typography.textAlign}`);
  if (styles.typography?.fontWeight) classes.push(`font-${styles.typography.fontWeight}`);
  if (styles.visual?.backgroundColor) classes.push(`bg-[${styles.visual.backgroundColor}]`);
  if (styles.visual?.borderRadius) classes.push(`rounded-[${styles.visual.borderRadius}]`);
  
  return classes;
}

/**
 * Hook per gestire lo stato degli styles nell'editor
 */
export function useStyleEditor(initialStyles?: BrickStyles) {
  const [styles, setStyles] = useState<BrickStyles>(initialStyles || {});
  
  const update = useCallback((path: string, value: any) => {
    setStyles(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let current: any = next;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) current[key] = {};
        current = current[key];
      }
      
      const lastKey = keys[keys.length - 1];
      if (value === '' || value === null || value === undefined) {
        delete current[lastKey];
      } else {
        current[lastKey] = value;
      }
      
      return { ...next };
    });
  }, []);
  
  const reset = useCallback(() => {
    setStyles(initialStyles || {});
  }, [initialStyles]);
  
  return { styles, update, reset, setStyles };
}