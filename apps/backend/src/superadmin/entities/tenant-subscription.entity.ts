import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Tenant } from './tenant.entity';
import { PlatformModule } from './platform-module.entity';

@Entity({ schema: 'public', name: 'tenant_subscriptions' })
@Index(['tenantId', 'moduleKey'], { unique: true }) // Un modulo per tenant
export class TenantSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string; // <--- AGGIUNTO '!'

  @Column()
  tenantId!: string; // <--- AGGIUNTO '!'

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant; // <--- AGGIUNTO '!'

  @Column()
  moduleKey!: string; // <--- AGGIUNTO '!'

  @ManyToOne(() => PlatformModule)
  @JoinColumn({ name: 'moduleKey', referencedColumnName: 'key' })
  module!: PlatformModule; // <--- AGGIUNTO '!'

  @Column({ default: 'ACTIVE' })
  status!: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED'; // <--- AGGIUNTO '!'

  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt!: Date; // <--- AGGIUNTO '!'

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date; // <--- AGGIUNTO '!'

  @CreateDateColumn()
  assignedAt!: Date; // <--- AGGIUNTO '!'
}