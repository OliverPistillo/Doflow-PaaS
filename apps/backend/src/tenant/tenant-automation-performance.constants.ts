export const DOFLOW_AUTOMATION_PERFORMANCE_QUEUE = 'doflow-automation-performance';
export const AUTOMATION_RUN_JOB = 'automation-run';
export const PERFORMANCE_EVENT_JOB = 'performance-event';

export type AutomationRunJobData = {
  schema: string;
  runId: string;
  outboxId: string;
};

export type PerformanceEventJobData = {
  schema: string;
  sourceTable: 'commerce_outbox' | 'delivery_outbox';
  sourceId: string;
};
