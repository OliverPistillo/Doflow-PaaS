import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import {
  S3Client, PutObjectCommand, DeleteObjectCommand,
  GetObjectCommand, ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { SystemBackup, BackupStatus, BackupType } from './entities/system-backup.entity';
import { BackupSchedule, ScheduleFrequency, ScheduleBackupType } from './entities/backup-schedule.entity';
import { Tenant } from './entities/tenant.entity';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateScheduleDto {
  tenantId?: string | null;
  frequency: ScheduleFrequency;
  backupType: ScheduleBackupType;
  hour: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  retentionDays: number;
  isActive: boolean;
}

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly tmpDir = path.join(os.tmpdir(), 'doflow-backups');
  private readonly s3Endpoint: string;
  private readonly s3AccessKey: string;
  private readonly s3SecretKey: string;
  private readonly s3Bucket: string;
  private readonly dbUrl: string;
  private readonly s3Client: S3Client;

  constructor(
    @InjectRepository(SystemBackup) private backupRepo: Repository<SystemBackup>,
    @InjectRepository(BackupSchedule) private scheduleRepo: Repository<BackupSchedule>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    private dataSource: DataSource,
    private configService: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
  ) {
    this.s3Endpoint = this.configService.get('MINIO_ENDPOINT') || 'http://localhost:9000';
    this.s3AccessKey = this.configService.get('MINIO_ACCESS_KEY') || 'minioadmin';
    this.s3SecretKey = this.configService.get('MINIO_SECRET_KEY') || 'minioadmin';
    this.s3Bucket = this.configService.get('MINIO_BACKUP_BUCKET') || 'doflow-backups';
    this.dbUrl = this.configService.get('DATABASE_URL') || '';

    this.s3Client = new S3Client({
      endpoint: this.s3Endpoint,
      region: 'us-east-1',
      credentials: { accessKeyId: this.s3AccessKey, secretAccessKey: this.s3SecretKey },
      forcePathStyle: true,
    });

    if (!fs.existsSync(this.tmpDir)) fs.mkdirSync(this.tmpDir, { recursive: true });
  }

  // ─── Init: carica tutti gli schedule dal DB e li registra come CronJob ──────

  async onModuleInit() {
    const schedules = await this.scheduleRepo.find({ where: { isActive: true } });
    for (const s of schedules) {
      this.registerCronJob(s);
    }
    this.logger.log(`📅 ${schedules.length} schedule backup caricati.`);
  }

  // ─── Helpers CronJob ────────────────────────────────────────────────────────

  private buildCronExpression(s: BackupSchedule): string {
    switch (s.frequency) {
      case ScheduleFrequency.HOURLY:  return `0 * * * *`;
      case ScheduleFrequency.DAILY:   return `0 ${s.hour} * * *`;
      case ScheduleFrequency.WEEKLY:  return `0 ${s.hour} * * ${s.dayOfWeek ?? 1}`;
      case ScheduleFrequency.MONTHLY: return `0 ${s.hour} ${s.dayOfMonth ?? 1} * *`;
      default: return `0 2 * * *`;
    }
  }

  private registerCronJob(s: BackupSchedule) {
    const name = `backup_schedule_${s.id}`;
    // Rimuovi job precedente se esiste
    try { this.schedulerRegistry.deleteCronJob(name); } catch {}

    const cronExpr = this.buildCronExpression(s);
    const job = new CronJob(cronExpr, async () => {
      this.logger.log(`⏰ Schedule ${s.id} — avvio backup automatico`);
      try {
        await this.triggerBackup(s.backupType as unknown as BackupType, s.tenantId ?? undefined);
        await this.scheduleRepo.update(s.id, {
          lastRunAt: new Date(),
          nextRunAt: job.nextDate().toJSDate(),
        });
        // Applica retention
        await this.applyRetention(s);
      } catch (err: any) {
        this.logger.error(`❌ Schedule ${s.id} fallito: ${err.message}`);
      }
    });

    this.schedulerRegistry.addCronJob(name, job);
    job.start();

    // Calcola nextRunAt
    const nextRun = job.nextDate().toJSDate();
    this.scheduleRepo.update(s.id, { nextRunAt: nextRun }).catch(() => {});
    this.logger.log(`📅 CronJob registrato: ${name} (${cronExpr}) → prossimo: ${nextRun.toISOString()}`);
  }

  private async applyRetention(s: BackupSchedule) {
    if (!s.retentionDays || s.retentionDays <= 0) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - s.retentionDays);

    const old = await this.backupRepo.find({
      where: {
        tenantId: s.tenantId ?? undefined,
        status: BackupStatus.COMPLETED,
        createdAt: LessThan(cutoff),
      },
    });

    for (const b of old) {
      try { await this.deleteBackup(b.id); } catch {}
    }

    if (old.length > 0) {
      this.logger.log(`🗑️ Retention: eliminati ${old.length} backup più vecchi di ${s.retentionDays} giorni.`);
    }
  }

  // ─── Cron fallback: ogni giorno alle 02:00 (solo se non ci sono schedule DB) ─

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledFullBackupFallback() {
    const count = await this.scheduleRepo.count({ where: { isActive: true, tenantId: undefined } });
    if (count > 0) return; // ci sono schedule custom, non fare il fallback
    this.logger.log('🕐 Backup schedulato fallback giornaliero avviato...');
    try { await this.triggerBackup(BackupType.FULL); } catch (err: any) {
      this.logger.error(`❌ Backup fallback fallito: ${err.message}`);
    }
  }

  // ─── CRUD Schedules ─────────────────────────────────────────────────────────

  async findAllSchedules() {
    return this.scheduleRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createSchedule(dto: CreateScheduleDto) {
    let tenantSlug: string | undefined;
    let tenantName: string | undefined;

    if (dto.tenantId) {
      const tenant = await this.tenantRepo.findOne({ where: { id: dto.tenantId } });
      if (!tenant) throw new NotFoundException(`Tenant ${dto.tenantId} non trovato.`);
      tenantSlug = tenant.slug;
      tenantName = tenant.name;
    }

    const schedule = this.scheduleRepo.create({
      ...dto,
      tenantSlug: tenantSlug ?? null,
      tenantName: tenantName ?? null,
    });
    const saved = await this.scheduleRepo.save(schedule);
    if (saved.isActive) this.registerCronJob(saved);
    return saved;
  }

  async updateSchedule(id: string, dto: Partial<CreateScheduleDto>) {
    const existing = await this.scheduleRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Schedule ${id} non trovato.`);

    if (dto.tenantId !== undefined) {
      if (dto.tenantId) {
        const tenant = await this.tenantRepo.findOne({ where: { id: dto.tenantId } });
        if (tenant) {
          (dto as any).tenantSlug = tenant.slug;
          (dto as any).tenantName = tenant.name;
        }
      } else {
        (dto as any).tenantSlug = null;
        (dto as any).tenantName = null;
      }
    }

    await this.scheduleRepo.update(id, dto);
    const updated = await this.scheduleRepo.findOne({ where: { id } });

    // Re-registra il cron
    const name = `backup_schedule_${id}`;
    try { this.schedulerRegistry.deleteCronJob(name); } catch {}
    if (updated!.isActive) this.registerCronJob(updated!);

    return updated;
  }

  async deleteSchedule(id: string) {
    const name = `backup_schedule_${id}`;
    try { this.schedulerRegistry.deleteCronJob(name); } catch {}
    await this.scheduleRepo.delete(id);
    return { message: 'Schedule eliminato.' };
  }

  // ─── Backups ─────────────────────────────────────────────────────────────────

  async findAll() {
    return this.backupRepo.find({ order: { createdAt: 'DESC' } });
  }

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
    this.executeBackup(saved.id, schemaName).catch(e =>
      this.logger.error(`Backup ${saved.id} fallito: ${e.message}`, e.stack),
    );
    return saved;
  }

  // ─── Restore ─────────────────────────────────────────────────────────────────

  async restoreBackup(id: string): Promise<{ message: string; backupId: string; startedAt: string }> {
    const backup = await this.findOne(id);
    if (backup.status !== BackupStatus.COMPLETED) {
      throw new Error('Puoi ripristinare solo backup con status COMPLETED.');
    }
    if (!backup.storagePath) throw new NotFoundException('File backup non disponibile.');

    const startedAt = new Date().toISOString();
    this.logger.log(`🔄 Avvio ripristino backup ${id} da ${backup.storagePath}`);

    // Esegui il restore in background
    this.executeRestore(backup).catch(e =>
      this.logger.error(`❌ Restore ${id} fallito: ${e.message}`, e.stack),
    );

    return { message: 'Ripristino avviato in background.', backupId: id, startedAt };
  }

  private async executeRestore(backup: SystemBackup) {
    const fileName = path.basename(backup.storagePath!);
    const localPath = path.join(this.tmpDir, `restore_${Date.now()}_${fileName}`);

    try {
      // 1. Scarica il file da MinIO
      this.logger.log(`⬇️ Download backup da MinIO: ${backup.storagePath}`);
      const command = new GetObjectCommand({ Bucket: this.s3Bucket, Key: backup.storagePath! });
      const response = await this.s3Client.send(command);
      const stream = response.Body as NodeJS.ReadableStream;

      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(localPath);
        stream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        stream.on('error', reject);
      });

      this.logger.log(`✅ Download completato: ${localPath}`);

      // 2. Ripristina con psql (decomprimi inline)
      this.logger.log(`🔄 Esecuzione psql restore...`);
      const restoreCmd = `gunzip -c "${localPath}" | psql "${this.dbUrl}"`;
      const { stderr } = await execAsync(restoreCmd, { timeout: 600000 });
      if (stderr) this.logger.warn(`psql stderr: ${stderr}`);

      // 3. Cleanup
      fs.unlinkSync(localPath);
      this.logger.log(`✅ Ripristino completato con successo.`);
    } catch (err: any) {
      try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch {}
      this.logger.error(`❌ Ripristino fallito: ${err.message}`, err.stack);
      throw err;
    }
  }

  // ─── Download stream (proxy through backend) ────────────────────────────────
  // MinIO non è esposto pubblicamente: il backend scarica da MinIO internamente
  // e fa il pipe diretto al browser, senza presigned URL.

  async streamDownload(id: string): Promise<{ stream: NodeJS.ReadableStream; filename: string; size?: number }> {
    const backup = await this.findOne(id);
    if (!backup.storagePath) throw new NotFoundException('File backup non disponibile.');

    const command = new GetObjectCommand({
      Bucket: this.s3Bucket,
      Key: backup.storagePath,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as NodeJS.ReadableStream;
    const filename = path.basename(backup.storagePath);
    const size = response.ContentLength;

    this.logger.log(`⬇️ Stream download avviato per: ${backup.storagePath}`);
    return { stream, filename, size };
  }

  // ─── Execute backup ──────────────────────────────────────────────────────────

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
      const dumpCmd = schemaName
        ? `pg_dump "${this.dbUrl}" --schema="${schemaName}" --no-owner --no-privileges | gzip > "${localPath}"`
        : `pg_dump "${this.dbUrl}" --no-owner --no-privileges | gzip > "${localPath}"`;

      this.logger.log(`📦 Avvio pg_dump: ${schemaName || 'full database'}`);
      const { stderr } = await execAsync(dumpCmd, { timeout: 300000 });
      if (stderr) this.logger.warn(`pg_dump stderr: ${stderr}`);

      const stats = fs.statSync(localPath);
      if (stats.size === 0) throw new Error('Dump file vuoto.');
      const sizeMb = stats.size / (1024 * 1024);

      await this.uploadToS3(localPath, storagePath);
      fs.unlinkSync(localPath);

      const dur = Math.round((Date.now() - startTime) / 1000);
      await this.backupRepo.update(backupId, {
        status: BackupStatus.COMPLETED, storagePath,
        sizeMb: Math.round(sizeMb * 100) / 100,
        durationSeconds: dur, completedAt: new Date(),
      });
      this.logger.log(`✅ Backup completato: ${storagePath} (${sizeMb.toFixed(1)} MB, ${dur}s)`);
    } catch (err: any) {
      try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch {}
      this.logger.error(`❌ Backup ${backupId} fallito: ${err.message}`, err.stack);
      await this.backupRepo.update(backupId, {
        status: BackupStatus.FAILED, error: err.message,
        durationSeconds: Math.round((Date.now() - startTime) / 1000),
      });
      throw err;
    }
  }

  private async uploadToS3(localPath: string, remotePath: string) {
    const fileStream = fs.createReadStream(localPath);
    const fileSize = fs.statSync(localPath).size;
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.s3Bucket, Key: remotePath, Body: fileStream,
      ContentLength: fileSize, ContentType: 'application/gzip',
    }));
    this.logger.log(`✅ Upload completato: ${remotePath}`);
  }

  async deleteBackup(id: string) {
    const backup = await this.findOne(id);
    if (backup.storagePath) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: backup.storagePath }));
      } catch (err: any) {
        this.logger.warn(`⚠️ S3 delete fallito: ${err.message}`);
      }
    }
    await this.backupRepo.delete(id);
    return { message: 'Backup eliminato.' };
  }

  async getStorageOverview() {
    const tenants = await this.tenantRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
    const backups = await this.backupRepo.find({ order: { createdAt: 'DESC' } });
    const schedules = await this.scheduleRepo.find({ where: { isActive: true } });
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
        activeSchedules: schedules.length,
        lastBackupAt: completed[0]?.completedAt || null,
        nextScheduled: schedules.length > 0
          ? schedules.sort((a, b) => (a.nextRunAt?.getTime() ?? 0) - (b.nextRunAt?.getTime() ?? 0))[0]?.nextRunAt?.toISOString() ?? null
          : null,
      },
      recentBackups: backups.slice(0, 30),
      schedules,
    };
  }
}