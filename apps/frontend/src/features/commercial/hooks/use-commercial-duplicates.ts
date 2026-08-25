"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DuplicateGroup } from "@/features/commercial/duplicates";
import { commercialApi } from "@/lib/tenant-commercial-api";

type DuplicateState = {
  groups: DuplicateGroup[];
  ignored: DuplicateGroup[];
  analyzedAt?: string;
  loading: boolean;
  error?: string;
};

export function useCommercialDuplicates() {
  const [state, setState] = useState<DuplicateState>({
    groups: [],
    ignored: [],
    loading: true,
  });
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const result = await commercialApi.duplicateGroups(controller.signal);
      setState({
        groups: result.groups as DuplicateGroup[],
        ignored: result.ignored as DuplicateGroup[],
        analyzedAt: result.analyzedAt,
        loading: false,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Analisi duplicati non disponibile",
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => controllerRef.current?.abort();
  }, [refresh]);

  const decide = useCallback(async (
    leftId: string,
    rightId: string,
    decision: "ignored" | "pending",
  ) => {
    await commercialApi.decideDuplicate(leftId, rightId, decision);
    await refresh();
  }, [refresh]);

  return { ...state, refresh, decide };
}
