"use client";

/**
 * AppSettingsContext — persiste in localStorage le preferenze UI:
 *   - sidebarVariant : inset | sidebar | floating
 *   - sidebarCollapsible : icon
 * Il tema (light/dark/system) è gestito da next-themes direttamente.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type SidebarVariant    = "inset" | "sidebar" | "floating";
export type SidebarCollapsible = "icon";

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

function readSidebarCollapsible(): SidebarCollapsible {
  if (typeof window === "undefined") return DEFAULT_COLLAPSIBLE;
  try {
    const raw = localStorage.getItem("df_sidebar_collapsible");
    if (!raw) return DEFAULT_COLLAPSIBLE;
    const parsed = JSON.parse(raw);
    if (parsed === "icon") return "icon";

    // Migrazione automatica di preferenze obsolete: "none" disattivava il trigger.
    localStorage.setItem("df_sidebar_collapsible", JSON.stringify(DEFAULT_COLLAPSIBLE));
    return DEFAULT_COLLAPSIBLE;
  } catch {
    writeLS("df_sidebar_collapsible", DEFAULT_COLLAPSIBLE);
    return DEFAULT_COLLAPSIBLE;
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
    _setCollapsible(readSidebarCollapsible());
  }, []);

  const setSidebarVariant = useCallback((v: SidebarVariant) => {
    _setVariant(v);
    writeLS("df_sidebar_variant", v);
  }, []);

  const setSidebarCollapsible = useCallback((_c: SidebarCollapsible) => {
    _setCollapsible("icon");
    writeLS("df_sidebar_collapsible", "icon");
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
