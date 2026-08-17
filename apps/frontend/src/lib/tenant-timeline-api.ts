"use client";

import { apiFetch } from "@/lib/api";

export type TimelineRecordKind = "company" | "opportunity" | "project";

export type TimelineEvent = {
  id: string;
  contact_id?: string | null;
  company_id?: string | null;
  opportunity_id?: string | null;
  project_id?: string | null;
  type: string;
  channel: string;
  direction?: string | null;
  author_user_id?: string | null;
  author_label: string;
  created_at: string;
  status: string;
  outcome?: string | null;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
  source: string;
};

export type TimelinePage = {
  items: TimelineEvent[];
  next_cursor?: string | null;
  has_more: boolean;
};

export type TimelineFilters = {
  types?: string[];
  operator_id?: string;
  date_from?: string;
  date_to?: string;
  outcome?: string;
  cursor?: string;
  limit?: number;
};

type TimelineTarget = { record_kind: TimelineRecordKind; record_id: string };

function query(target: TimelineTarget, filters: TimelineFilters = {}) {
  const params = new URLSearchParams({ record_kind: target.record_kind, record_id: target.record_id });
  if (filters.types?.length) params.set("types", filters.types.join(","));
  if (filters.operator_id) params.set("operator_id", filters.operator_id);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.cursor) params.set("cursor", filters.cursor);
  params.set("limit", String(filters.limit || 20));
  return params.toString();
}

function post(path: string, body: Record<string, unknown>) {
  return apiFetch<TimelineEvent>(`/tenant/timeline/${path}`, { method: "POST", body: JSON.stringify(body) });
}

export const timelineApi = {
  list: (target: TimelineTarget, filters?: TimelineFilters, signal?: AbortSignal) => (
    apiFetch<TimelinePage>(`/tenant/timeline?${query(target, filters)}`, { signal })
  ),
  note: (body: TimelineTarget & Record<string, unknown>) => post("note", body),
  activity: (body: TimelineTarget & Record<string, unknown>) => post("activity", body),
  appointment: (body: TimelineTarget & Record<string, unknown>) => post("appointment", body),
  call: (body: TimelineTarget & Record<string, unknown>) => post("call", body),
  externalMessage: (body: TimelineTarget & Record<string, unknown>) => post("external-message", body),
};
