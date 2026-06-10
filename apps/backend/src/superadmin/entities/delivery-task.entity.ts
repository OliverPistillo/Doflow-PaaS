import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('delivery_tasks')
export class DeliveryTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'service_name' }) 
  serviceName!: string;

  @Column() 
  category!: string;

  // Accetta la data se c'è, altrimenti null
  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate!: string | null; // Usiamo string per evitare problemi di parsing TS

  // FIX: Usiamo stringa semplice invece di enum per evitare conflitti
  @Column({ type: 'varchar', default: 'Media' })
  priority!: string;

  // FIX: Usiamo stringa semplice
  @Column({ type: 'varchar', default: 'todo' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}