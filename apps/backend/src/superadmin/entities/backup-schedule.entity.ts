import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum ScheduleFrequency {
  HOURLY   = 'HOURLY',
  DAILY    = 'DAILY',
  WEEKLY   = 'WEEKLY',
  MONTHLY  = 'MONTHLY',
}

export enum ScheduleBackupType {
  FULL        = 'FULL',
  SCHEMA      = 'SCHEMA',
  INCREMENTAL = 'INCREMENTAL',
}

/**
 * Pianificazione backup automatici.
 * tenantId = null  → schedule globale (superadmin)
 * tenantId = uuid  → schedule per tenant specifico
 */
@Entity({ schema: 'public', name: 'backup_schedules' })
export class BackupSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'tenant_slug', nullable: true })
  tenantSlug!: string | null;

  @Column({ name: 'tenant_name', nullable: true })
  tenantName!: string | null;

  @Column({ type: 'enum', enum: ScheduleFrequency, default: ScheduleFrequency.DAILY })
  frequency!: ScheduleFrequency;

  @Column({ type: 'enum', enum: ScheduleBackupType, default: ScheduleBackupType.FULL })
  backupType!: ScheduleBackupType;

  /** Ora del giorno 0-23 */
  @Column({ type: 'int', default: 2 })
  hour!: number;

  /** Giorno della settimana 0=dom 1=lun … 6=sab (usato se WEEKLY) */
  @Column({ name: 'day_of_week', type: 'int', nullable: true })
  dayOfWeek!: number | null;

  /** Giorno del mese 1-28 (usato se MONTHLY) */
  @Column({ name: 'day_of_month', type: 'int', nullable: true })
  dayOfMonth!: number | null;

  /** Giorni di retention: i backup più vecchi vengono eliminati */
  @Column({ name: 'retention_days', type: 'int', default: 30 })
  retentionDays!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt!: Date | null;

  @Column({ name: 'next_run_at', type: 'timestamp', nullable: true })
  nextRunAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}