import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { tenantActor, tenantUuid } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';

@Injectable()
export class TenantReleasesService {
  constructor(private readonly dataSource: DataSource, @Inject(REQUEST) private readonly request: any) {}
  private actor() { return tenantActor(this.request, 'TenantReleasesService'); }
  async list() {
    const actor = this.actor();
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    const rows = await this.dataSource.query(
      `SELECT c.id,c.version,c.title,c.content,c.type AS category,c.tags,c.published_at,
        (r.read_at IS NOT NULL) AS read,r.read_at
       FROM public.changelog_entries c
       LEFT JOIN "${actor.schema}".app_release_reads r ON r.release_id=c.id AND r.user_id=$1
       WHERE c.is_published=true ORDER BY c.published_at DESC,c.created_at DESC LIMIT 100`, [actor.id],
    );
    return { releases: rows, unreadCount: rows.filter((row: any) => !row.read).length };
  }
  async markRead(idValue: string) {
    const actor = this.actor();
    const releaseId = tenantUuid(idValue, 'releaseId');
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    const releases = await this.dataSource.query(`SELECT 1 FROM public.changelog_entries WHERE id=$1 AND is_published=true`, [releaseId]);
    if (!releases[0]) throw new NotFoundException('Release non disponibile');
    await this.dataSource.query(
      `INSERT INTO "${actor.schema}".app_release_reads (release_id,user_id,read_at) VALUES ($1,$2,now())
       ON CONFLICT (release_id,user_id) DO UPDATE SET read_at=now()`, [releaseId, actor.id],
    );
    return { releaseId, read: true };
  }
}
