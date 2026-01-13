import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'federicanerone', name: 'trattamenti' })
export class TrattamentoEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'int', default: 60 })
  duration_minutes!: number;

  @Column({ type: 'int', default: 0 })
  price_cents!: number;

  @Column({ type: 'text', nullable: true })
  category!: string | null;

  @Column({ type: 'text', nullable: true })
  badge_color!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'timestamptz' })
  created_at!: Date;

  @Column({ type: 'timestamptz' })
  updated_at!: Date;
}
