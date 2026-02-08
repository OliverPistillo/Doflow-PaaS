import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { DealStage } from '../enums/deal-stage.enum';

@Entity('platform_deals')
export class PlatformDeal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // --- CORREZIONE QUI SOTTO ---
  // Abbiamo unito "name: 'title'" e "nullable: true" in un'unica colonna.
  @Column({ name: 'title', nullable: true }) 
  title!: string;

  @Column({ name: 'client_name', nullable: true })
  clientName!: string;

  // MONEY: Salviamo in centesimi (integer) per evitare errori di virgola mobile
  // Es: €100.50 -> 10050
  @Column({ name: 'value_cents', type: 'int', default: 0 })
  valueCents!: number;

  // PROBABILITY: Salviamo in Basis Points (bps) (0 - 10000)
  // Es: 50.5% -> 5050
  @Column({ name: 'probability_bps', type: 'int', default: 0 })
  probabilityBps!: number;

  @Column({
    type: 'enum',
    enum: DealStage,
    default: DealStage.QUALIFIED_LEAD
  })
  stage!: DealStage;

  @Column({ name: 'expected_close_date', type: 'date', nullable: true })
  expectedCloseDate!: Date | null;

  @Column({ name: 'assigned_to_user_id', nullable: true })
  assignedToUserId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}