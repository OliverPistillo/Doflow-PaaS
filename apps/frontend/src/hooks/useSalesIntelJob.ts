// apps/frontend/src/hooks/useSalesIntelJob.ts
"use client";

import { useEffect, useRef, useState } from "react";
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

export function useSalesIntelJob(jobId: string | null) {
  const [state, setState] = useState<SalesIntelJobState>({
    status: "queued",
    progress: 0,
    campaignId: null,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const fetch = async (id: string) => {
    try {
      const data = await apiFetch<SalesIntelJobState>(`/sales-intel/status/${id}`, { auth: true });
      setState(data);
      if (TERMINAL.includes(data.status)) stop();
    } catch (e) {
      setState(s => ({ ...s, error: "Errore di connessione", status: "failed" }));
      stop();
    }
  };

  useEffect(() => {
    if (!jobId) { setState({ status: "queued", progress: 0, campaignId: null, error: null }); stop(); return; }
    fetch(jobId);
    intervalRef.current = setInterval(() => fetch(jobId), POLL_MS);
    return stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return { ...state, isPolling: intervalRef.current !== null };
}
