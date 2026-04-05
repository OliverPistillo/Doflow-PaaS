import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ModuleTier {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum ModuleCategory {
  COMMERCIAL = 'COMMERCIAL',
  FINANCE = 'FINANCE',
  OPERATIONS = 'OPERATIONS',
  HR = 'HR',
  MARKETING = 'MARKETING',
  SERVICES = 'SERVICES',
  HEALTH = 'HEALTH',
  CONSTRUCTION = 'CONSTRUCTION',
}

@Entity({ schema: 'public', name: 'platform_modules' })
export class PlatformModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string; // <--- AGGIUNTO '!'

  @Column({ unique: true })
  key!: string; // <--- AGGIUNTO '!'

  @Column()
  name!: string; // <--- AGGIUNTO '!'

  @Column({ type: 'text', nullable: true })
  description!: string; // <--- AGGIUNTO '!'

  @Column({
    type: 'enum',
    enum: ModuleCategory,
    default: ModuleCategory.COMMERCIAL
  })
  category!: ModuleCategory; // <--- AGGIUNTO '!'

  @Column({
    type: 'enum',
    enum: ModuleTier,
    default: ModuleTier.STARTER
  })
  minTier!: ModuleTier; // <--- AGGIUNTO '!'

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceMonthly!: number; // <--- AGGIUNTO '!'

  @Column({ default: true })
  isBeta!: boolean; // <--- AGGIUNTO '!'

  @CreateDateColumn()
  createdAt!: Date; // <--- AGGIUNTO '!'

  @UpdateDateColumn()
  updatedAt!: Date; // <--- AGGIUNTO '!'
}