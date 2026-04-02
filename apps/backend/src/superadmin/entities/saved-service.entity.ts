// apps/backend/src/superadmin/entities/saved-service.entity.ts
// Preset di righe fattura riutilizzabili nel form "Nuova Fattura".
// Tabella: public.invoice_service_presets
// Migration SQL: vedi apps/backend/sql/add_invoice_service_presets.sql

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'invoice_service_presets', schema: 'public' })
export class SavedService {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
