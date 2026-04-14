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

  @Column({ type: 'jsonb', default: [], name: 'news_items' })
  newsItems!: NewsItem[];

  @Column({ type: 'jsonb', default: [], name: 'press_releases' })
  pressReleases!: NewsItem[];

  @Column({ type: 'text', nullable: true, name: 'synthesized_context' })
  synthesizedContext?: string;

  @Column({ type: 'jsonb', default: [], name: 'search_queries' })
  searchQueries!: string[];

  @CreateDateColumn({ name: 'fetched_at' })
  fetchedAt!: Date;
}