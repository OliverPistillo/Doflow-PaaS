"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import {
  DOFLOW_THEME_STORAGE_KEY,
  ensureSingleDoflowFavicon,
  normalizeThemePreference,
  resolveFaviconTheme,
} from "@/lib/doflow-favicon"

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)"

export function FaviconThemeManager() {
  const { theme, resolvedTheme } = useTheme()

  React.useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK_QUERY)
    let reconciling = false
    const apply = (preference: string | null | undefined = theme) => {
      if (reconciling) return
      reconciling = true
      ensureSingleDoflowFavicon(
        document,
        resolveFaviconTheme(preference, resolvedTheme, media.matches),
      )
      reconciling = false
    }
    const onSystemTheme = () => {
      if (normalizeThemePreference(theme) === "system") apply("system")
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === DOFLOW_THEME_STORAGE_KEY) apply(event.newValue)
    }
    const observer = new MutationObserver(() => apply())

    apply()
    media.addEventListener("change", onSystemTheme)
    window.addEventListener("storage", onStorage)
    observer.observe(document.head, { childList: true })
    return () => {
      observer.disconnect()
      media.removeEventListener("change", onSystemTheme)
      window.removeEventListener("storage", onStorage)
    }
  }, [resolvedTheme, theme])

  return null
}
