"use client";

import { apiFetch } from "@/lib/api";

export type CalendarParams = Record<string, string | number | boolean | null | undefined>;
export type ListResponse<T> = { items: T[]; total?: number; limit?: number; offset?: number };

export type CalendarSummary = {
  eventsToday: number;
  eventsThisWeek: number;
  overdueEvents: number;
  conflictsCount: number;
  deadlinesThisWeek: number;
  teamUnavailableToday: number;
  nextEventAt?: string | null;
  remindersDue: number;
  derivedEventsCount: number;
  sources?: Record<string, boolean>;
};

export type CalendarOptions = {
  event_types: string[];
  statuses: string[];
  priorities: string[];
  visibilities: string[];
  transparencies: string[];
  attendee_roles: string[];
  response_statuses: string[];
  reminder_methods: string[];
  link_relations: string[];
  source_types: string[];
  deadline_event_types: string[];
  view_types: string[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  event_type: string;
  status: string;
  priority: string;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean;
  timezone?: string | null;
  location?: string | null;
  meeting_url?: string | null;
  color?: string | null;
  visibility: string;
  transparency: string;
  owner_user_id?: string | null;
  assigned_to_user_id?: string | null;
  created_by?: string | null;
  source_type?: string | null;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  source_fingerprint?: string | null;
  is_system_generated?: boolean;
  is_locked?: boolean;
  recurrence_rule?: string | null;
  recurrence_until?: string | null;
  parent_event_id?: string | null;
  reminders_config?: unknown;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

export type CalendarAttendee = {
  id: string;
  event_id: string;
  user_id?: string | null;
  contact_id?: string | null;
  name?: string | null;
  email?: string | null;
  role: string;
  response_status: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CalendarReminder = {
  id: string;
  event_id: string;
  remind_at: string;
  method: string;
  status: string;
  sent_at?: string | null;
  dismissed_at?: string | null;
  error_message?: string | null;
  event_title?: string | null;
  event_type?: string | null;
  start_at?: string | null;
};

export type CalendarLink = {
  id: string;
  event_id: string;
  entity_type: string;
  entity_id: string;
  relation_type: string;
  metadata?: unknown;
  created_at?: string | null;
};

export type PlanningView = {
  id: string;
  name: string;
  description?: string | null;
  view_type: string;
  filters?: unknown;
  layout_config?: unknown;
  is_default?: boolean;
  is_system?: boolean;
  is_shared?: boolean;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PlanningActivity = {
  id: string;
  action: string;
  event_id?: string | null;
  view_id?: string | null;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: unknown;
  created_at?: string | null;
};

export type CalendarAgenda = { date?: string; items: CalendarEvent[]; total?: number };
export type CalendarWorkload = { range?: unknown; items: Array<Record<string, unknown>> };
export type CalendarConflict = { range?: unknown; items: Array<Record<string, unknown>>; total?: number };
export type CalendarAvailability = { range?: unknown; events: CalendarEvent[]; teamAvailability: Array<Record<string, unknown>> };
export type CreateCalendarEventInput = Partial<CalendarEvent>;
export type UpdateCalendarEventInput = Partial<CalendarEvent>;

function qs(params?: CalendarParams) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const calendarApi = {
  getCalendarSummary: () => apiFetch<CalendarSummary>("/tenant/calendar/summary"),
  getCalendarOptions: () => apiFetch<CalendarOptions>("/tenant/calendar/options"),
  listCalendarEvents: (params?: CalendarParams) => apiFetch<ListResponse<CalendarEvent>>(`/tenant/calendar/events${qs(params)}`),
  createCalendarEvent: (body: CreateCalendarEventInput) => apiFetch<CalendarEvent>("/tenant/calendar/events", { method: "POST", body: JSON.stringify(body) }),
  getCalendarEvent: (eventId: string) => apiFetch<CalendarEvent>(`/tenant/calendar/events/${eventId}`),
  updateCalendarEvent: (eventId: string, body: UpdateCalendarEventInput) => apiFetch<CalendarEvent>(`/tenant/calendar/events/${eventId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCalendarEvent: (eventId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/calendar/events/${eventId}`, { method: "DELETE" }),
  completeCalendarEvent: (eventId: string) => apiFetch<CalendarEvent>(`/tenant/calendar/events/${eventId}/complete`, { method: "PATCH", body: JSON.stringify({}) }),
  cancelCalendarEvent: (eventId: string) => apiFetch<CalendarEvent>(`/tenant/calendar/events/${eventId}/cancel`, { method: "PATCH", body: JSON.stringify({}) }),
  exportCalendarEvent: (eventId: string) => apiFetch<Record<string, unknown>>(`/tenant/calendar/events/${eventId}/export`),
  listEventAttendees: (eventId: string) => apiFetch<ListResponse<CalendarAttendee>>(`/tenant/calendar/events/${eventId}/attendees`),
  createEventAttendee: (eventId: string, body: Partial<CalendarAttendee>) => apiFetch<CalendarAttendee>(`/tenant/calendar/events/${eventId}/attendees`, { method: "POST", body: JSON.stringify(body) }),
  updateEventAttendee: (eventId: string, attendeeId: string, body: Partial<CalendarAttendee>) => apiFetch<CalendarAttendee>(`/tenant/calendar/events/${eventId}/attendees/${attendeeId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEventAttendee: (eventId: string, attendeeId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/calendar/events/${eventId}/attendees/${attendeeId}`, { method: "DELETE" }),
  listEventReminders: (eventId: string) => apiFetch<ListResponse<CalendarReminder>>(`/tenant/calendar/events/${eventId}/reminders`),
  createEventReminder: (eventId: string, body: Partial<CalendarReminder>) => apiFetch<CalendarReminder>(`/tenant/calendar/events/${eventId}/reminders`, { method: "POST", body: JSON.stringify(body) }),
  dismissReminder: (reminderId: string) => apiFetch<CalendarReminder>(`/tenant/calendar/reminders/${reminderId}/dismiss`, { method: "PATCH", body: JSON.stringify({}) }),
  deleteReminder: (reminderId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/calendar/reminders/${reminderId}`, { method: "DELETE" }),
  getDueReminders: () => apiFetch<ListResponse<CalendarReminder>>("/tenant/calendar/reminders/due"),
  listEventLinks: (eventId: string) => apiFetch<ListResponse<CalendarLink>>(`/tenant/calendar/events/${eventId}/links`),
  createEventLink: (eventId: string, body: Partial<CalendarLink>) => apiFetch<CalendarLink>(`/tenant/calendar/events/${eventId}/links`, { method: "POST", body: JSON.stringify(body) }),
  deleteEventLink: (eventId: string, linkId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/calendar/events/${eventId}/links/${linkId}`, { method: "DELETE" }),
  getCalendarAgenda: (params?: CalendarParams) => apiFetch<CalendarAgenda>(`/tenant/calendar/agenda${qs(params)}`),
  getCalendarWeek: (params?: CalendarParams) => apiFetch<ListResponse<CalendarEvent>>(`/tenant/calendar/week${qs(params)}`),
  getCalendarTimeline: (params?: CalendarParams) => apiFetch<ListResponse<CalendarEvent>>(`/tenant/calendar/timeline${qs(params)}`),
  getCalendarDeadlines: (params?: CalendarParams) => apiFetch<ListResponse<CalendarEvent>>(`/tenant/calendar/deadlines${qs(params)}`),
  getCalendarWorkload: (params?: CalendarParams) => apiFetch<CalendarWorkload>(`/tenant/calendar/workload${qs(params)}`),
  getCalendarConflicts: (params?: CalendarParams) => apiFetch<CalendarConflict>(`/tenant/calendar/conflicts${qs(params)}`),
  getCalendarAvailability: (params?: CalendarParams) => apiFetch<CalendarAvailability>(`/tenant/calendar/availability${qs(params)}`),
  getDerivedPreview: () => apiFetch<{ total: number; items: CalendarEvent[] }>("/tenant/calendar/derived-preview"),
  syncDerivedEvents: () => apiFetch<{ matched: number; created: number; updated: number; skippedLocked: number }>("/tenant/calendar/sync-derived", { method: "POST", body: JSON.stringify({}) }),
  listPlanningViews: (params?: CalendarParams) => apiFetch<ListResponse<PlanningView>>(`/tenant/calendar/views${qs(params)}`),
  createPlanningView: (body: Partial<PlanningView>) => apiFetch<PlanningView>("/tenant/calendar/views", { method: "POST", body: JSON.stringify(body) }),
  getPlanningView: (viewId: string) => apiFetch<PlanningView>(`/tenant/calendar/views/${viewId}`),
  updatePlanningView: (viewId: string, body: Partial<PlanningView>) => apiFetch<PlanningView>(`/tenant/calendar/views/${viewId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePlanningView: (viewId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/calendar/views/${viewId}`, { method: "DELETE" }),
  getCalendarActivity: (params?: CalendarParams) => apiFetch<ListResponse<PlanningActivity>>(`/tenant/calendar/activity${qs(params)}`),
  exportCalendar: (params?: CalendarParams) => apiFetch<Record<string, unknown>>(`/tenant/calendar/export${qs(params)}`),
};
