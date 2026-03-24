import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SystemBackup, BackupStatus, BackupType } from './entities/system-backup.entity';
import { Tenant } from './entities/tenant.entity';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly tmpDir = path.join(os.tmpdir(), 'doflow-backups');
  private readonly s3Endpoint: string;
  private readonly s3AccessKey: string;
  private readonly s3SecretKey: string;
  private readonly s3Bucket: string;
  private readonly dbUrl: string;

  constructor(
    @InjectRepository(SystemBackup) private backupRepo: Repository<SystemBackup>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.s3Endpoint = this.configService.get('MINIO_ENDPOINT') || 'http://localhost:9000';
    this.s3AccessKey = this.configService.get('MINIO_ACCESS_KEY') || 'minioadmin';
    this.s3SecretKey = this.configService.get('MINIO_SECRET_KEY') || 'minioadmin';
    this.s3Bucket = this.configService.get('MINIO_BACKUP_BUCKET') || 'doflow-backups';
    this.dbUrl = this.configService.get('DATABASE_URL') || '';
    if (!fs.existsSync(this.tmpDir)) fs.mkdirSync(this.tmpDir, { recursive: true });
  }

  // ─── Cron: backup giornaliero alle 02:00 ───────────────────
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledFullBackup() {
    this.logger.log('🕐 Backup schedulato giornaliero avviato...');
    try {
      await this.triggerBackup(BackupType.FULL);
    } catch (err: any) {
      this.logger.error(`❌ Backup schedulato fallito: ${err.message}`);
    }
  }

  async findAll() { return this.backupRepo.find({ order: { createdAt: 'DESC' } }); }

  async findOne(id: string) {
    const b = await this.backupRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException(`Backup ${id} non trovato.`);
    return b;
  }

  async triggerBackup(type: BackupType, tenantId?: string) {
    let tenantSlug: string | undefined;
    let schemaName: string | undefined;
    if (tenantId) {
      const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException(`Tenant ${tenantId} non trovato.`);
      tenantSlug = tenant.slug;
      schemaName = tenant.schemaName;
    }
    const backup = this.backupRepo.create({ type, tenantId, tenantSlug, status: BackupStatus.PENDING });
    const saved = await this.backupRepo.save(backup);
    this.executeBackup(saved.id, schemaName).catch(e => this.logger.error(`Backup ${saved.id} fallito:`, e));
    return saved;
  }

  private async executeBackup(backupId: string, schemaName?: string) {
    const backup = await this.backupRepo.findOne({ where: { id: backupId } });
    if (!backup) return;
    const startTime = Date.now();
    await this.backupRepo.update(backupId, { status: BackupStatus.RUNNING });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = schemaName ? `backup_${schemaName}_${ts}.sql.gz` : `backup_full_${ts}.sql.gz`;
    const localPath = path.join(this.tmpDir, fileName);
    const storagePath = `backups/${fileName}`;

    try {
      // 1. pg_dump reale
      const dumpCmd = schemaName
        ? `pg_dump "${this.dbUrl}" --schema="${schemaName}" --no-owner --no-privileges | gzip > "${localPath}"`
        : `pg_dump "${this.dbUrl}" --no-owner --no-privileges | gzip > "${localPath}"`;

      this.logger.log(`📦 pg_dump: ${schemaName || 'full database'}`);
      await execAsync(dumpCmd, { timeout: 300000 });

      const stats = fs.statSync(localPath);
      if (stats.size === 0) throw new Error('Dump file vuoto.');
      const sizeMb = stats.size / (1024 * 1024);

      // 2. Upload MinIO S3
      await this.uploadToS3(localPath, storagePath);

      // 3. Cleanup
      fs.unlinkSync(localPath);

      const dur = Math.round((Date.now() - startTime) / 1000);
      await this.backupRepo.update(backupId, {
        status: BackupStatus.COMPLETED, storagePath,
        sizeMb: Math.round(sizeMb * 100) / 100, durationSeconds: dur, completedAt: new Date(),
      });
      this.logger.log(`✅ Backup completato: ${storagePath} (${sizeMb.toFixed(1)} MB, ${dur}s)`);
    } catch (err: any) {
      try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch {}
      await this.backupRepo.update(backupId, {
        status: BackupStatus.FAILED, error: err.message,
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
      });
      throw err;
    }
  }

  private async uploadToS3(localPath: string, remotePath: string) {
    const url = `${this.s3Endpoint}/${this.s3Bucket}/${remotePath}`;
    try {
      await execAsync(
        `curl -s -f -X PUT -H "Content-Type: application/gzip" --data-binary "@${localPath}" --user "${this.s3AccessKey}:${this.s3SecretKey}" "${url}"`,
        { timeout: 120000 },
      );
      this.logger.log(`📤 Upload S3: ${remotePath}`);
    } catch {
      const fallback = path.join(this.tmpDir, 'fallback');
      if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
      fs.copyFileSync(localPath, path.join(fallback, path.basename(localPath)));
      this.logger.warn(`⚠️ MinIO non raggiungibile. Backup in fallback locale.`);
    }
  }

  async deleteBackup(id: string) {
    const backup = await this.findOne(id);
    if (backup.storagePath) {
      try {
        await execAsync(`curl -s -f -X DELETE --user "${this.s3AccessKey}:${this.s3SecretKey}" "${this.s3Endpoint}/${this.s3Bucket}/${backup.storagePath}"`, { timeout: 10000 });
      } catch { this.logger.warn(`⚠️ S3 delete fallito: ${backup.storagePath}`); }
    }
    await this.backupRepo.delete(id);
    return { message: `Backup eliminato.` };
  }

  async getStorageOverview() {
    const tenants = await this.tenantRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
    const backups = await this.backupRepo.find({ order: { createdAt: 'DESC' } });
    const completed = backups.filter(b => b.status === BackupStatus.COMPLETED);
    return {
      tenants: tenants.map(t => ({
        id: t.id, name: t.name, slug: t.slug,
        storageUsedMb: Number(t.storageUsedMb) || 0,
        storageLimitGb: Number(t.storageLimitGb) || 0,
        usagePercent: (Number(t.storageLimitGb) || 0) > 0
          ? Math.round(((Number(t.storageUsedMb) || 0) / ((Number(t.storageLimitGb) || 0) * 1024)) * 100) : 0,
      })),
      summary: {
        totalStorageUsedMb: Math.round(tenants.reduce((a, t) => a + (Number(t.storageUsedMb) || 0), 0)),
        totalStorageLimitMb: Math.round(tenants.reduce((a, t) => a + (Number(t.storageLimitGb) || 0) * 1024, 0)),
        totalBackupSizeMb: Math.round(completed.reduce((a, b) => a + (Number(b.sizeMb) || 0), 0) * 100) / 100,
        totalBackups: backups.length,
        completedBackups: completed.length,
        failedBackups: backups.filter(b => b.status === BackupStatus.FAILED).length,
        lastBackupAt: completed[0]?.completedAt || null,
        nextScheduled: 'Ogni giorno alle 02:00',
      },
      recentBackups: backups.slice(0, 20),
    };
  }
}
