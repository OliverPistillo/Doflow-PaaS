import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AppuntamentoStatus {
  NEW_LEAD = 'new_lead',
  NO_ANSWER = 'no_answer',
  WAITING = 'waiting',
  BOOKED = 'booked',
  CLOSED_WON = 'closed_won',
  CLOSED_LOST = 'closed_lost',
}

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

  // NB: in DB è text + CHECK constraint. In TS lo tipizziamo con enum.
  @Column({ type: 'text', default: AppuntamentoStatus.BOOKED })
  status!: AppuntamentoStatus;

  @Column({ type: 'text', nullable: true })
  google_event_id!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at!: Date;
}
