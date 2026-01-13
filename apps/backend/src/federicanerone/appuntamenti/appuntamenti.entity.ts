import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'federicanerone', name: 'appuntamenti' })
export class AppuntamentoEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  client_id!: string;

  @Column({ type: 'bigint' })
  treatment_id!: string;

  @Column({ type: 'timestamptz' })
  starts_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ends_at!: Date | null;

  @Column({ type: 'int', nullable: true })
  final_price_cents!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'text', default: 'booked' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  google_event_id!: string | null;

  @Column({ type: 'timestamptz' })
  created_at!: Date;

  @Column({ type: 'timestamptz' })
  updated_at!: Date;
}
