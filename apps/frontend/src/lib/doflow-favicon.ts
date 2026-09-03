export const DOFLOW_THEME_STORAGE_KEY = "doflow_theme"
export const DOFLOW_FAVICON_LINK_ID = "doflow-theme-favicon"
export const DOFLOW_FAVICON_BLACK = "/brand/marchio_logo_nero.svg?v=official-20260902"
export const DOFLOW_FAVICON_WHITE = "/brand/marchio_logo_bianco.svg?v=official-20260902"

export type DoflowThemePreference = "light" | "dark" | "system"
export type DoflowResolvedTheme = "light" | "dark"

export function normalizeThemePreference(value: string | null | undefined): DoflowThemePreference {
  return value === "light" || value === "dark" ? value : "system"
}

export function resolveFaviconTheme(
  preference: string | null | undefined,
  resolvedTheme: string | null | undefined,
  systemDark: boolean,
): DoflowResolvedTheme {
  const normalized = normalizeThemePreference(preference)
  if (normalized === "light" || normalized === "dark") return normalized
  if (resolvedTheme === "light" || resolvedTheme === "dark") return resolvedTheme
  return systemDark ? "dark" : "light"
}

export function faviconHref(theme: DoflowResolvedTheme) {
  return theme === "dark" ? DOFLOW_FAVICON_WHITE : DOFLOW_FAVICON_BLACK
}

export function ensureSingleDoflowFavicon(documentRef: Document, theme: DoflowResolvedTheme) {
  let owner = documentRef.getElementById(DOFLOW_FAVICON_LINK_ID) as HTMLLinkElement | null
  if (!owner || owner.tagName !== "LINK") {
    owner = documentRef.createElement("link")
    owner.id = DOFLOW_FAVICON_LINK_ID
    documentRef.head.appendChild(owner)
  }
  for (const link of documentRef.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')) {
    if (link !== owner) link.remove()
  }
  owner.rel = "icon"
  owner.type = "image/svg+xml"
  owner.href = faviconHref(theme)
  return owner
}
