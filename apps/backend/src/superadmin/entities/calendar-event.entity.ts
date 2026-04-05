import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'date' })
  date!: string; // YYYY-MM-DD

  @Column({ default: 'meeting' })
  type!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}