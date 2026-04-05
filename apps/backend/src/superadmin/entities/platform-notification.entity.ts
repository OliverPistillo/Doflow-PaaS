import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, Index,
} from 'typeorm';

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
  BROADCAST = 'BROADCAST',
}

export enum NotificationChannel {
  PLATFORM = 'PLATFORM',   // Visibile nel centro notifiche
  EMAIL = 'EMAIL',          // Inviata via email
  REALTIME = 'REALTIME',    // Push WebSocket
  ALL = 'ALL',              // Tutti i canali
}

@Entity({ schema: 'public', name: 'platform_notifications' })
@Index(['targetTenantId'])
@Index(['isRead'])
@Index(['createdAt'])
export class PlatformNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.INFO })
  type!: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel, default: NotificationChannel.PLATFORM })
  channel!: NotificationChannel;

  /** null = broadcast globale a tutti i tenant */
  @Column({ name: 'target_tenant_id', nullable: true })
  targetTenantId!: string;

  /** null = a tutti gli utenti del tenant */
  @Column({ name: 'target_user_email', nullable: true })
  targetUserEmail!: string;

  /** Chi ha generato la notifica (sistema o superadmin email) */
  @Column({ name: 'sender', default: 'SYSTEM' })
  sender!: string;

  @Column({ name: 'is_read', default: false })
  isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt!: Date;

  /** Link opzionale da aprire al click */
  @Column({ name: 'action_url', nullable: true })
  actionUrl!: string;

  /** JSON metadata libero */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
