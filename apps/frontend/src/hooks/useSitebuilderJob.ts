// apps/frontend/src/hooks/useSitebuilderJob.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

// ─── Types (mirrors sitebuilder.entity.ts) ───────────────────────────────────
export type SitebuilderJobStatus =
  | "PENDING"
  | "RUNNING"
  | "DONE"
  | "FAILED"
  | "ROLLED_BACK";

export interface SitebuilderJob {
  id: string;
  tenantId: string;
  siteDomain: string;
  siteTitle: string;
  adminEmail: string;
  contentTopics: string[];
  locale: string;
  status: SitebuilderJobStatus;
  logs: string[];
  attemptCount: number;
  siteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const TERMINAL_STATUSES: SitebuilderJobStatus[] = ["DONE", "FAILED", "ROLLED_BACK"];
const POLL_INTERVAL_MS = 3_000;

/**
 * Effettua il polling di GET /sitebuilder/jobs/:jobId ogni 3 secondi.
 * Si ferma automaticamente quando lo status è terminale (DONE/FAILED/ROLLED_BACK).
 * Ritorna null finché il jobId non è impostato.
 */
export function useSitebuilderJob(jobId: string | null) {
  const [job, setJob] = useState<SitebuilderJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const fetchJob = async (id: string) => {
    try {
      const data = await apiFetch<SitebuilderJob>(`/sitebuilder/jobs/${id}`, {
        auth: true,
      });
      setJob(data);
      setError(null);
      if (TERMINAL_STATUSES.includes(data.status)) stopPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel recupero del job");
    }
  };

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      stopPolling();
      return;
    }

    // Fetch immediato + avvia polling
    fetchJob(jobId);
    intervalRef.current = setInterval(() => fetchJob(jobId), POLL_INTERVAL_MS);

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const isPolling = intervalRef.current !== null;

  return { job, error, isPolling };
}