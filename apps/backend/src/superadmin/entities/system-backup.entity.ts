import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum BackupStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum BackupType {
  FULL = 'FULL',
  SCHEMA = 'SCHEMA',
  INCREMENTAL = 'INCREMENTAL',
}

@Entity({ schema: 'public', name: 'system_backups' })
export class SystemBackup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Se null → backup globale, altrimenti backup per tenant specifico */
  @Column({ name: 'tenant_id', nullable: true })
  tenantId!: string;

  @Column({ name: 'tenant_slug', nullable: true })
  tenantSlug!: string;

  @Column({ type: 'enum', enum: BackupType, default: BackupType.FULL })
  type!: BackupType;

  @Column({ type: 'enum', enum: BackupStatus, default: BackupStatus.PENDING })
  status!: BackupStatus;

  /** Dimensione del dump in MB */
  @Column({ name: 'size_mb', type: 'float', default: 0 })
  sizeMb!: number;

  /** Percorso su MinIO S3 */
  @Column({ name: 'storage_path', nullable: true })
  storagePath!: string;

  /** Durata in secondi */
  @Column({ name: 'duration_seconds', type: 'int', default: 0 })
  durationSeconds!: number;

  @Column({ type: 'text', nullable: true })
  error!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date;
}
