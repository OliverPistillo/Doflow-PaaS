import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum TriggerEvent {
  LEAD_STATUS_CHANGE = 'LEAD_STATUS_CHANGE',
  LEAD_CREATED = 'LEAD_CREATED',
  LEAD_SCORE_THRESHOLD = 'LEAD_SCORE_THRESHOLD',
  TICKET_CREATED = 'TICKET_CREATED',
  TICKET_SLA_BREACH = 'TICKET_SLA_BREACH',
  TENANT_TRIAL_EXPIRING = 'TENANT_TRIAL_EXPIRING',
  TENANT_INACTIVE = 'TENANT_INACTIVE',
  INVOICE_OVERDUE = 'INVOICE_OVERDUE',
  DEAL_STAGE_CHANGE = 'DEAL_STAGE_CHANGE',
  SCHEDULED = 'SCHEDULED',
}

export enum ActionType {
  SEND_EMAIL = 'SEND_EMAIL',
  CREATE_NOTIFICATION = 'CREATE_NOTIFICATION',
  UPDATE_STATUS = 'UPDATE_STATUS',
  ASSIGN_TO = 'ASSIGN_TO',
  WEBHOOK = 'WEBHOOK',
  CREATE_TASK = 'CREATE_TASK',
}

@Entity({ schema: 'public', name: 'automation_rules' })
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'enum', enum: TriggerEvent })
  triggerEvent!: TriggerEvent;

  /** Condizioni JSON: es. { "fromStatus": "NEW", "toStatus": "QUALIFIED" } */
  @Column({ type: 'jsonb', default: '{}', name: 'trigger_conditions' })
  triggerConditions!: Record<string, unknown>;

  @Column({ type: 'enum', enum: ActionType })
  actionType!: ActionType;

  /** Configurazione azione: es. { "templateSlug": "lead_qualified", "to": "{{lead.email}}" } */
  @Column({ type: 'jsonb', default: '{}', name: 'action_config' })
  actionConfig!: Record<string, unknown>;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /** Contatore esecuzioni */
  @Column({ name: 'execution_count', type: 'int', default: 0 })
  executionCount!: number;

  @Column({ name: 'last_executed_at', type: 'timestamp', nullable: true })
  lastExecutedAt!: Date;

  /** Cron expression per trigger SCHEDULED */
  @Column({ name: 'cron_expression', nullable: true })
  cronExpression!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
