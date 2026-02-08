import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TaskPriority {
  HIGH = 'Alta',
  MEDIUM = 'Media',
  LOW = 'Bassa',
  URGENT = 'Urgente',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'inprogress',
  REVIEW = 'review',
  DONE = 'done',
}

@Entity('delivery_tasks')
export class DeliveryTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'service_name' }) 
  serviceName!: string;

  @Column({ name: 'category' }) 
  category!: string;

  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate!: Date; // TypeORM gestisce Date, ma nel DTO passeremo stringa

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM
  })
  priority!: TaskPriority;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.TODO
  })
  status!: TaskStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}