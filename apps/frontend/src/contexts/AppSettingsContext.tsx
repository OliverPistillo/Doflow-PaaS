"use client";

/**
 * AppSettingsContext — persiste in localStorage le preferenze UI:
 *   - sidebarVariant : inset | sidebar | floating
 *   - sidebarCollapsible : icon | offcanvas | none
 * Il tema (light/dark/system) è gestito da next-themes direttamente.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type SidebarVariant    = "inset" | "sidebar" | "floating";
export type SidebarCollapsible = "icon" | "offcanvas" | "none";

interface AppSettingsContextValue {
  sidebarVariant:     SidebarVariant;
  setSidebarVariant:  (v: SidebarVariant) => void;

  sidebarCollapsible:    SidebarCollapsible;
  setSidebarCollapsible: (c: SidebarCollapsible) => void;

  resetSettings: () => void;
}

const DEFAULT_VARIANT:    SidebarVariant    = "inset";
const DEFAULT_COLLAPSIBLE: SidebarCollapsible = "icon";

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [sidebarVariant, _setVariant]       = useState<SidebarVariant>(DEFAULT_VARIANT);
  const [sidebarCollapsible, _setCollapsible] = useState<SidebarCollapsible>(DEFAULT_COLLAPSIBLE);

  // Idratazione client-side (evita mismatch SSR)
  useEffect(() => {
    _setVariant(readLS("df_sidebar_variant", DEFAULT_VARIANT));
    _setCollapsible(readLS("df_sidebar_collapsible", DEFAULT_COLLAPSIBLE));
  }, []);

  const setSidebarVariant = useCallback((v: SidebarVariant) => {
    _setVariant(v);
    writeLS("df_sidebar_variant", v);
  }, []);

  const setSidebarCollapsible = useCallback((c: SidebarCollapsible) => {
    _setCollapsible(c);
    writeLS("df_sidebar_collapsible", c);
  }, []);

  const resetSettings = useCallback(() => {
    setSidebarVariant(DEFAULT_VARIANT);
    setSidebarCollapsible(DEFAULT_COLLAPSIBLE);
  }, [setSidebarVariant, setSidebarCollapsible]);

  return (
    <AppSettingsContext.Provider value={{
      sidebarVariant,    setSidebarVariant,
      sidebarCollapsible, setSidebarCollapsible,
      resetSettings,
    }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used inside AppSettingsProvider");
  return ctx;
}
