// apps/backend/src/sales-intelligence/entities/research-data.entity.ts
import {
  Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Prospect } from './prospect.entity';

export interface NewsItem {
  title: string;
  url: string;
  date: string;
  summary: string;
  source: string;
}

@Entity({ schema: 'public', name: 'si_research_data' })
export class ResearchData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Prospect)
  @JoinColumn({ name: 'prospect_id' })
  prospect!: Prospect;

  @Column({ name: 'prospect_id' })
  prospectId!: string;

  @Column({ type: 'jsonb', default: [] })
  newsItems!: NewsItem[];

  @Column({ type: 'jsonb', default: [] })
  pressReleases!: NewsItem[];

  /** Testo sintetizzato — questo è ciò che viene passato a Gemini nel prompt */
  @Column({ type: 'text', nullable: true })
  synthesizedContext?: string;

  /** Query usate per il web search */
  @Column({ type: 'jsonb', default: [] })
  searchQueries!: string[];

  @CreateDateColumn()
  fetchedAt!: Date;
}
