import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'federicanerone', name: 'clienti' })
export class ClienteEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'text' })
  full_name!: string;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamptz' })
  created_at!: Date;

  @Column({ type: 'timestamptz' })
  updated_at!: Date;
}
