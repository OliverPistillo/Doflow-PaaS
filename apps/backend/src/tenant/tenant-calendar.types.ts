export const CALENDAR_EVENT_TYPES = [
  'internal',
  'meeting',
  'call',
  'focus_time',
  'unavailable',
  'task_due',
  'milestone_due',
  'project_deadline',
  'commercial_activity_due',
  'quote_followup',
  'invoice_due',
  'financial_deadline',
  'renewal_due',
  'recurring_service_due',
  'contract_due',
  'contract_signature',
  'contract_expiration',
  'paperwork_due',
  'paperwork_item_due',
  'briefing_due',
  'document_reminder',
  'reminder',
] as const;

export const CALENDAR_EVENT_STATUSES = ['scheduled', 'tentative', 'completed', 'cancelled', 'skipped'] as const;
export const CALENDAR_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const CALENDAR_VISIBILITIES = ['private', 'team', 'admin'] as const;
export const CALENDAR_TRANSPARENCIES = ['busy', 'free'] as const;
export const CALENDAR_SOURCE_TYPES = ['manual', 'system', 'derived', 'automation'] as const;
export const CALENDAR_ATTENDEE_ROLES = ['organizer', 'required', 'optional'] as const;
export const CALENDAR_RESPONSE_STATUSES = ['needs_action', 'accepted', 'declined', 'tentative'] as const;
export const CALENDAR_REMINDER_METHODS = ['in_app', 'notification'] as const;
export const CALENDAR_REMINDER_STATUSES = ['pending', 'sent', 'dismissed', 'failed'] as const;
export const CALENDAR_LINK_RELATIONS = ['related', 'source', 'document', 'task', 'project', 'contract', 'paperwork', 'finance'] as const;
export const PLANNING_VIEW_TYPES = ['calendar', 'agenda', 'timeline', 'workload', 'deadlines', 'team'] as const;

export const FINANCE_CALENDAR_EVENT_TYPES = new Set([
  'invoice_due',
  'financial_deadline',
  'renewal_due',
  'recurring_service_due',
]);

export const DEADLINE_CALENDAR_EVENT_TYPES = [
  'task_due',
  'milestone_due',
  'project_deadline',
  'invoice_due',
  'financial_deadline',
  'renewal_due',
  'contract_due',
  'contract_expiration',
  'paperwork_due',
  'paperwork_item_due',
] as const;

export const BASE_PLANNING_VIEWS = [
  {
    name: 'Agenda operativa',
    view_type: 'agenda',
    filters: { range: 'today' },
  },
  {
    name: 'Calendario team',
    view_type: 'calendar',
    filters: { visibility: ['team', 'admin'] },
  },
  {
    name: 'Timeline progetti',
    view_type: 'timeline',
    filters: { event_type: ['project_deadline', 'milestone_due', 'task_due'] },
  },
  {
    name: 'Scadenze',
    view_type: 'deadlines',
    filters: { deadline_only: true },
  },
  {
    name: 'Workload team',
    view_type: 'workload',
    filters: { group_by: 'user' },
  },
] as const;
