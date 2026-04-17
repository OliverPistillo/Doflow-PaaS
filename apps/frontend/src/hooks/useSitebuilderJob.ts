"use client";

import { useEffect, useRef, useState } from 'react';

export type SitebuilderJobStatus =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'not_found'
  | 'UNKNOWN';

export interface SitebuilderJob {
  id: string;
  status: SitebuilderJobStatus;
  token?: string | null;
  exportId?: string | null;
  manifest?: unknown;
}

const TERMINAL_STATUSES: SitebuilderJobStatus[] = ['completed', 'failed', 'not_found'];
const POLL_INTERVAL_MS = 3_000;

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
      const response = await fetch(`/api/sitebuilder/status/${id}`, { cache: 'no-store' });
      const data = (await response.json()) as SitebuilderJob;
      setJob(data);
      setError(null);
      if (TERMINAL_STATUSES.includes(data.status)) stopPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel recupero del job');
    }
  };

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      stopPolling();
      return;
    }

    fetchJob(jobId);
    intervalRef.current = setInterval(() => fetchJob(jobId), POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [jobId]);

  return { job, error, isPolling: intervalRef.current !== null };
}
