export const AUTOMATION_CATEGORIES = [
  'crm',
  'sales',
  'quotes',
  'projects',
  'finance',
  'team',
  'documents',
  'contracts',
  'paperwork',
  'operations',
  'general',
] as const;

export const AUTOMATION_TRIGGER_TYPES = [
  'scheduled_daily',
  'scheduled_hourly',
  'scheduled_weekly',
  'manual_run',
  'lead_stale',
  'opportunity_stale',
  'commercial_activity_due',
  'quote_sent_followup',
  'quote_accepted',
  'quote_rejected',
  'project_due_soon',
  'project_overdue',
  'project_blocked',
  'task_due_today',
  'task_overdue',
  'milestone_due_soon',
  'milestone_overdue',
  'invoice_due_soon',
  'invoice_overdue',
  'financial_deadline_due_soon',
  'renewal_due_soon',
  'recurring_service_due_soon',
  'time_entry_submitted',
  'member_overloaded',
  'availability_starts_today',
  'contract_due_soon',
  'contract_overdue',
  'contract_waiting_signature',
  'contract_expiring_30_days',
  'paperwork_due_soon',
  'paperwork_overdue',
  'paperwork_blocked',
  'paperwork_missing_required_items',
  'document_uploaded',
  'document_missing_for_entity',
  'daily_digest',
  'executive_risk_detected',
] as const;

export const AUTOMATION_CONDITION_TYPES = [
  'status_equals',
  'status_in',
  'older_than_days',
  'due_within_days',
  'due_before_today',
  'assigned_to_exists',
  'amount_greater_than',
  'priority_equals',
  'priority_in',
  'missing_required_items_count_gt',
  'no_activity_for_days',
  'field_exists',
  'field_not_exists',
] as const;

export const AUTOMATION_ACTION_TYPES = [
  'create_notification',
  'create_task',
  'create_commercial_activity',
  'create_paperwork_dossier',
  'create_paperwork_item',
  'create_contract_checklist_item',
  'update_entity_status',
  'add_activity_log',
  'create_financial_deadline',
  'create_report_snapshot',
  'mark_rule_run',
  'noop',
] as const;

export const AUTOMATION_RUN_MODES = ['manual', 'scheduled', 'event', 'hybrid'] as const;
export const AUTOMATION_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const AUTOMATION_RUN_STATUSES = ['running', 'success', 'partial_success', 'failed', 'skipped'] as const;
export const AUTOMATION_ACTION_STATUSES = ['success', 'failed', 'skipped'] as const;
export const AUTOMATION_SCHEDULE_FREQUENCIES = ['hourly', 'daily', 'weekly'] as const;

export const FINANCE_AUTOMATION_TRIGGERS = new Set<string>([
  'invoice_due_soon',
  'invoice_overdue',
  'financial_deadline_due_soon',
  'renewal_due_soon',
  'recurring_service_due_soon',
]);

export const FINANCE_AUTOMATION_ACTIONS = new Set<string>([
  'create_financial_deadline',
]);

export type AutomationCategory = typeof AUTOMATION_CATEGORIES[number];
export type AutomationTriggerType = typeof AUTOMATION_TRIGGER_TYPES[number];
export type AutomationActionType = typeof AUTOMATION_ACTION_TYPES[number];
export type AutomationRunMode = typeof AUTOMATION_RUN_MODES[number];
export type AutomationPriority = typeof AUTOMATION_PRIORITIES[number];

export type AutomationTemplateSeed = {
  key: string;
  name: string;
  description: string;
  category: AutomationCategory;
  trigger_type: AutomationTriggerType;
  default_conditions?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  default_actions: Array<Record<string, unknown>>;
  default_schedule?: Record<string, unknown> | null;
  default_enabled?: boolean;
  run_mode?: AutomationRunMode;
  priority?: AutomationPriority;
  cooldown_minutes?: number;
};

export const BASE_AUTOMATION_TEMPLATES: AutomationTemplateSeed[] = [
  {
    key: 'quote_sent_followup_7_days',
    name: 'Follow-up preventivo inviato dopo 7 giorni',
    description: 'Crea una notifica interna quando un preventivo inviato resta senza risposta per 7 giorni.',
    category: 'quotes',
    trigger_type: 'quote_sent_followup',
    default_conditions: { older_than_days: 7, status: 'sent' },
    default_actions: [{ type: 'create_notification', priority: 'medium' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'lead_stale_7_days',
    name: 'Lead fermo da 7 giorni',
    description: 'Avvisa il team commerciale quando un lead non riceve aggiornamenti recenti.',
    category: 'crm',
    trigger_type: 'lead_stale',
    default_conditions: { no_activity_for_days: 7 },
    default_actions: [{ type: 'create_notification', priority: 'medium' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'opportunity_stale_14_days',
    name: 'Opportunita ferma da 14 giorni',
    description: 'Avvisa quando una opportunita commerciale non viene aggiornata da due settimane.',
    category: 'sales',
    trigger_type: 'opportunity_stale',
    default_conditions: { no_activity_for_days: 14 },
    default_actions: [{ type: 'create_notification', priority: 'medium' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'task_overdue_notify',
    name: 'Task scaduto',
    description: 'Avvisa sul task operativo scaduto.',
    category: 'projects',
    trigger_type: 'task_overdue',
    default_actions: [{ type: 'create_notification', priority: 'high' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'project_blocked_notify',
    name: 'Progetto bloccato',
    description: 'Avvisa direzione e PM quando un progetto risulta bloccato.',
    category: 'projects',
    trigger_type: 'project_blocked',
    default_actions: [{ type: 'create_notification', priority: 'urgent' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'milestone_due_soon_3_days',
    name: 'Milestone in scadenza entro 3 giorni',
    description: 'Avvisa sulle milestone operative prossime.',
    category: 'projects',
    trigger_type: 'milestone_due_soon',
    default_conditions: { due_within_days: 3 },
    default_actions: [{ type: 'create_notification', priority: 'medium' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'invoice_overdue_ceo_alert',
    name: 'Fattura scaduta CEO/Admin',
    description: 'Avvisa solo owner/admin/superadmin sulle fatture scadute.',
    category: 'finance',
    trigger_type: 'invoice_overdue',
    default_actions: [{ type: 'create_notification', priority: 'urgent', target_roles: ['owner', 'admin', 'superadmin'] }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'renewal_due_30_days',
    name: 'Rinnovo in scadenza entro 30 giorni',
    description: 'Avvisa sui rinnovi economici/operativi imminenti.',
    category: 'finance',
    trigger_type: 'renewal_due_soon',
    default_conditions: { due_within_days: 30 },
    default_actions: [{ type: 'create_notification', priority: 'medium', target_roles: ['owner', 'admin', 'superadmin'] }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'contract_waiting_signature_3_days',
    name: 'Contratto in attesa firma da 3 giorni',
    description: 'Avvisa sui contratti fermi in firma.',
    category: 'contracts',
    trigger_type: 'contract_waiting_signature',
    default_conditions: { older_than_days: 3 },
    default_actions: [{ type: 'create_notification', priority: 'medium' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'contract_expiring_30_days',
    name: 'Contratto in scadenza entro 30 giorni',
    description: 'Avvisa sui contratti con renewal date prossima.',
    category: 'contracts',
    trigger_type: 'contract_expiring_30_days',
    default_conditions: { due_within_days: 30 },
    default_actions: [{ type: 'create_notification', priority: 'medium' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'paperwork_overdue_notify',
    name: 'Dossier amministrativo scaduto',
    description: 'Avvisa sui dossier amministrativi oltre scadenza.',
    category: 'paperwork',
    trigger_type: 'paperwork_overdue',
    default_actions: [{ type: 'create_notification', priority: 'high' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'paperwork_missing_required_items',
    name: 'Scartoffie obbligatorie mancanti',
    description: 'Avvisa quando un dossier ha item obbligatori mancanti.',
    category: 'paperwork',
    trigger_type: 'paperwork_missing_required_items',
    default_conditions: { missing_required_items_count_gt: 0 },
    default_actions: [{ type: 'create_notification', priority: 'medium' }],
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'daily_executive_digest',
    name: 'Digest direzionale giornaliero',
    description: 'Predispone un digest interno senza inviare email.',
    category: 'operations',
    trigger_type: 'daily_digest',
    default_actions: [{ type: 'create_notification', priority: 'low' }],
    default_schedule: { frequency: 'daily', hour: 8 },
    default_enabled: false,
    run_mode: 'scheduled',
  },
  {
    key: 'create_paperwork_from_signed_contract',
    name: 'Crea dossier da contratto firmato',
    description: 'Template manuale per creare un dossier amministrativo da un contratto.',
    category: 'paperwork',
    trigger_type: 'manual_run',
    default_actions: [{ type: 'create_paperwork_dossier' }],
    default_enabled: false,
    run_mode: 'manual',
  },
  {
    key: 'create_followup_activity_from_stale_quote',
    name: 'Crea follow-up da preventivo fermo',
    description: 'Template manuale per creare una attivita commerciale su preventivi fermi.',
    category: 'quotes',
    trigger_type: 'manual_run',
    default_actions: [{ type: 'create_commercial_activity' }],
    default_enabled: false,
    run_mode: 'manual',
  },
];
