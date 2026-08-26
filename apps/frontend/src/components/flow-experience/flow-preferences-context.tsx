"use client";

import * as React from "react";

import {
  preferencesApi,
  type FlowPreferences,
} from "@/lib/tenant-feature-api";

type FlowPreferencesContextValue = {
  preferences?: FlowPreferences;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  update: (patch: Partial<FlowPreferences>) => Promise<FlowPreferences>;
};

const FlowPreferencesContext = React.createContext<FlowPreferencesContextValue | null>(null);

export function FlowExperiencePreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = React.useState<FlowPreferences>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPreferences(await preferencesApi.get());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preferenze non disponibili.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    preferencesApi.get()
      .then((next) => {
        if (active) setPreferences(next);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Preferenze non disponibili.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = React.useCallback(async (patch: Partial<FlowPreferences>) => {
    const next = await preferencesApi.update(patch);
    setPreferences(next);
    setError("");
    return next;
  }, []);

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const attributes = {
      "data-flow-animations": String(preferences?.animationsEnabled !== false),
      "data-flow-reduced-motion": String(preferences?.reducedMotion === true),
      "data-flow-illustrated-empty-states": String(preferences?.illustratedEmptyStates !== false),
      "data-flow-suggestions": String(preferences?.suggestionsEnabled !== false),
      "data-flow-contextual-assistant": String(preferences?.contextualAssistant !== false),
    } as const;
    const previous = Object.fromEntries(
      Object.keys(attributes).map((name) => [name, root.getAttribute(name)]),
    );
    Object.entries(attributes).forEach(([name, value]) => root.setAttribute(name, value));
    return () => {
      Object.entries(previous).forEach(([name, value]) => {
        if (value === null) root.removeAttribute(name);
        else root.setAttribute(name, value);
      });
    };
  }, [preferences]);

  const value = React.useMemo(
    () => ({ preferences, loading, error, reload, update }),
    [error, loading, preferences, reload, update],
  );

  return <FlowPreferencesContext.Provider value={value}>{children}</FlowPreferencesContext.Provider>;
}

export function useFlowExperiencePreferences() {
  const context = React.useContext(FlowPreferencesContext);
  if (!context) {
    throw new Error("useFlowExperiencePreferences richiede FlowExperiencePreferencesProvider");
  }
  return context;
}
