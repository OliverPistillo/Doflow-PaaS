import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

interface ExportRecord<T = unknown> {
  exportId: string;
  data: T;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class ExportStoreService {
  private readonly logger = new Logger(ExportStoreService.name);
  private readonly storage = new Map<string, ExportRecord>();
  private readonly tokenToExportId = new Map<string, string>();
  private readonly ttlMs = this.resolveTtl();
  private cleanupHandle?: NodeJS.Timeout;

  constructor(private readonly jwtService: JwtService) {
    this.startCleanupLoop();
  }

  async saveAndGenerateToken<T>(data: T): Promise<string> {
    const { token } = await this.save(data);
    return token;
  }

  async save<T>(data: T): Promise<{ token: string; exportId: string; expiresAt: string }> {
    const exportId = randomUUID();
    const token = this.jwtService.sign({ exportId });

    const record: ExportRecord<T> = {
      exportId,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    };

    this.storage.set(exportId, record);
    this.tokenToExportId.set(token, exportId);

    return {
      token,
      exportId,
      expiresAt: new Date(record.expiresAt).toISOString(),
    };
  }

  async getSiteDataByToken<T = unknown>(token: string): Promise<T> {
    try {
      const payload = this.jwtService.verify<{ exportId: string }>(token);
      return this.getSiteDataByExportId<T>(payload.exportId);
    } catch {
      const exportId = this.tokenToExportId.get(token);
      if (!exportId) {
        throw new NotFoundException('Token non valido o scaduto');
      }

      return this.getSiteDataByExportId<T>(exportId);
    }
  }

  async getSiteDataByExportId<T = unknown>(exportId: string): Promise<T> {
    const record = this.storage.get(exportId);

    if (!record) {
      throw new NotFoundException('Dati non trovati o scaduti');
    }

    if (record.expiresAt < Date.now()) {
      this.storage.delete(exportId);
      throw new NotFoundException('Dati non trovati o scaduti');
    }

    return record.data as T;
  }

  async deleteByExportId(exportId: string): Promise<void> {
    this.storage.delete(exportId);
    for (const [token, storedExportId] of this.tokenToExportId.entries()) {
      if (storedExportId === exportId) {
        this.tokenToExportId.delete(token);
      }
    }
  }

  private resolveTtl(): number {
    const rawHours = Number(process.env.SITE_EXPORT_TTL_HOURS);
    if (!Number.isNaN(rawHours) && rawHours > 0) {
      return rawHours * 60 * 60 * 1000;
    }

    const rawMs = Number(process.env.SITE_EXPORT_TTL_MS);
    if (!Number.isNaN(rawMs) && rawMs > 0) {
      return rawMs;
    }

    return 24 * 60 * 60 * 1000;
  }

  private startCleanupLoop(): void {
    if (this.cleanupHandle) {
      return;
    }

    this.cleanupHandle = setInterval(() => {
      const now = Date.now();
      for (const [exportId, record] of this.storage.entries()) {
        if (record.expiresAt < now) {
          this.storage.delete(exportId);
          for (const [token, storedExportId] of this.tokenToExportId.entries()) {
            if (storedExportId === exportId) {
              this.tokenToExportId.delete(token);
            }
          }
        }
      }
    }, 60_000);

    this.cleanupHandle.unref?.();
  }
}
