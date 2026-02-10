import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum EventType {
  MILESTONE = 'milestone',
  DEADLINE = 'deadline',
  MEETING = 'meeting',
}

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'date' })
  date!: string; // YYYY-MM-DD

  @Column({
    type: 'enum',
    enum: EventType,
    default: EventType.MEETING
  })
  type!: EventType;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}