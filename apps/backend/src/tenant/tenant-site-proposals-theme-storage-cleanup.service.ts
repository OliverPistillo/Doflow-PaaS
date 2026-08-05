import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { FileStorageService } from '../file-storage.service';
import { SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { cleanString, UUID_RE } from './tenant-site-proposals-validation';

type CleanupDatabase = { query: (sql: string, parameters?: unknown[]) => Promise<any[]> };

@Injectable()
export class TenantSiteProposalsThemeStorageCleanupService implements OnModuleInit {
  private readonly logger = new Logger(TenantSiteProposalsThemeStorageCleanupService.name);
  private recovering = false;

  constructor(private readonly dataSource: DataSource, private readonly storage: FileStorageService) {}

  onModuleInit() { void this.recover().catch((error) => this.logger.warn(`Theme cleanup recovery deferred: ${this.error(error)}`)); }

  @Interval(60_000)
  scheduledRecovery() { void this.recover().catch((error) => this.logger.warn(`Theme cleanup recovery deferred: ${this.error(error)}`)); }

  async record(storagePrefix: string, db: CleanupDatabase = this.dataSource): Promise<string> {
    this.assertPrefix(storagePrefix);
    const rows = await db.query(`
      INSERT INTO "${SITE_PROPOSALS_TENANT}".site_proposal_theme_storage_cleanup (storage_prefix,status)
      VALUES ($1,'pending') RETURNING id
    `, [storagePrefix]);
    return String(rows[0].id);
  }

  async process(id: string): Promise<'completed' | 'failed'> {
    if (!UUID_RE.test(id)) throw new Error('Invalid theme cleanup id');
    const claimed = (await this.dataSource.query(`
      UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_theme_storage_cleanup
      SET status='running',attempts=attempts+1,last_error=NULL,updated_at=now()
      WHERE id=$1 AND (status IN ('pending','failed') OR (status='running' AND updated_at <= now() - interval '10 minutes')) RETURNING storage_prefix
    `, [id]))[0];
    if (!claimed) return 'completed';
    const prefix = String(claimed.storage_prefix); this.assertPrefix(prefix);
    try {
      await this.storage.deleteThemeStoragePrefix(prefix);
      await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_theme_storage_cleanup SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1`, [id]);
      return 'completed';
    } catch (error) {
      await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_theme_storage_cleanup SET status='failed',last_error=$2,updated_at=now() WHERE id=$1`, [id, this.error(error)]);
      return 'failed';
    }
  }

  async recover(): Promise<number> {
    if (this.recovering) return 0;
    this.recovering = true;
    try {
      await ensureDoflowSiteProposalTables(this.dataSource, SITE_PROPOSALS_TENANT);
      const rows = await this.dataSource.query(`
        SELECT id FROM "${SITE_PROPOSALS_TENANT}".site_proposal_theme_storage_cleanup
        WHERE (status IN ('pending','failed') OR (status='running' AND updated_at <= now() - interval '10 minutes')) AND attempts < 8
          AND updated_at <= now() - make_interval(secs => LEAST(3600, 5 * power(2, attempts)::int))
        ORDER BY created_at ASC LIMIT 20
      `);
      for (const row of rows) await this.process(String(row.id));
      return rows.length;
    } finally { this.recovering = false; }
  }

  private assertPrefix(value: string) {
    if (!/^doflow\/site-proposal-themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\/$/.test(value)) throw new Error('Invalid theme cleanup prefix');
  }
  private error(error: unknown) { const message = cleanString(error instanceof Error ? error.message : String(error), 500) || 'Storage cleanup failed'; return /token|secret|password|api.?key|cookie|authorization|\bs3\b/i.test(message) ? 'Storage cleanup failed' : message; }
}
