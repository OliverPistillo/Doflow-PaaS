// apps/frontend/src/hooks/useSalesIntelJob.ts
"use client";

import { useEffect,useState } from "react";
import { apiFetch } from "@/lib/api";

export type SalesIntelJobStatus = "queued" | "waiting" | "active" | "completed" | "failed" | "not_found";

export interface SalesIntelJobState {
  status: SalesIntelJobStatus;
  progress: number;
  campaignId: string | null;
  error: string | null;
}

const TERMINAL: SalesIntelJobStatus[] = ["completed", "failed", "not_found"];
const POLL_MS = 2500;
const INITIAL_STATE: SalesIntelJobState = {
  status: "queued",
  progress: 0,
  campaignId: null,
  error: null,
};

export function useSalesIntelJob(jobId: string | null) {
  const [result, setResult] = useState<{
    jobId: string | null;
    state: SalesIntelJobState;
  }>({
    jobId: null,
    state: INITIAL_STATE,
  });

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    const fetchJob = async () => {
      try {
        const data = await apiFetch<SalesIntelJobState>(`/sales-intel/status/${jobId}`);
        if (!active) return;
        setResult({ jobId, state: data });
        if (TERMINAL.includes(data.status)) stop();
      } catch {
        if (!active) return;
        setResult({
          jobId,
          state: { ...INITIAL_STATE, error: "Errore di connessione", status: "failed" },
        });
        stop();
      }
    };
    void fetchJob();
    interval = setInterval(() => void fetchJob(), POLL_MS);
    return () => {
      active = false;
      stop();
    };
  }, [jobId]);

  const state = result.jobId === jobId ? result.state : INITIAL_STATE;
  return { ...state, isPolling: Boolean(jobId) && !TERMINAL.includes(state.status) };
}
