import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_deals')
export class PlatformDeal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'client_name' })
  clientName!: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  value!: number;

  @Column()
  stage!: string; 

  @Column({ name: 'win_probability', type: 'int', default: 0 })
  winProbability!: number;

  @Column({ name: 'expected_close_date', type: 'date', nullable: true })
  expectedCloseDate!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}