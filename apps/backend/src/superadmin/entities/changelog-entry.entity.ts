import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum ReleaseType {
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  PATCH = 'PATCH',
  HOTFIX = 'HOTFIX',
}

@Entity({ schema: 'public', name: 'changelog_entries' })
export class ChangelogEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  version!: string;

  @Column()
  title!: string;

  /** Markdown o testo ricco della release */
  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'enum', enum: ReleaseType, default: ReleaseType.MINOR })
  type!: ReleaseType;

  /** Se true, visibile ai tenant nel portale */
  @Column({ name: 'is_published', default: false })
  isPublished!: boolean;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt!: Date;

  /** Tag opzionali (es. ["CRM","Fatturazione"]) */
  @Column({ type: 'jsonb', default: '[]' })
  tags!: string[];

  /** Autore della release note */
  @Column({ nullable: true })
  author!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
