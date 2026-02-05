import { Injectable, Logger } from '@nestjs/common';
import * as si from 'systeminformation';
import { DataSource } from 'typeorm';

@Injectable()
export class SystemStatsService {
  private readonly logger = new Logger(SystemStatsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getSystemStats() {
    // Valori di default in caso di crash delle librerie OS
    let hardware = {
      cpu: { cores: 0, brand: 'Unknown', load: 0 },
      memory: { totalGb: '0', usedGb: '0', percent: 0 },
      disk: { totalGb: '0', usedGb: '0', percent: 0 },
      uptime: 0,
    };

    const services = {
      database: 'down',
      redis: 'unknown',
      api: 'up',
    };

    // 1) HARDWARE STATS
    try {
      const [cpu, mem, currentLoad] = await Promise.all([
        si.cpu().catch(() => ({ cores: 0, brand: 'N/A' } as any)),
        si.mem().catch(() => ({ total: 0, active: 0 } as any)),
        si.currentLoad().catch(() => ({ currentLoad: 0 } as any)),
      ]);

      // Disco (spesso problematico su container)
      let fs: any[] = [];
      try {
        fs = await si.fsSize();
      } catch (e) {
        this.logger.warn('Failed to read fsSize (Docker limitation?)');
      }

      const totalDisk = fs.reduce((acc, drive) => acc + (drive.size || 0), 0);
      const usedDisk = fs.reduce((acc, drive) => acc + (drive.used || 0), 0);

      // ✅ Uptime corretto (si.time() è async in molte versioni)
      const t = await Promise.resolve(si.time()).catch(() => ({ uptime: 0 } as any));
      const uptime = (t as any)?.uptime || process.uptime();

      hardware = {
        cpu: {
          cores: cpu.cores || 0,
          brand: cpu.brand || 'Docker/Virtual',
          load: Math.round((currentLoad as any).currentLoad || 0),
        },
        memory: {
          totalGb: ((mem as any).total / 1024 / 1024 / 1024).toFixed(2),
          usedGb: ((mem as any).active / 1024 / 1024 / 1024).toFixed(2),
          percent:
            (mem as any).total > 0
              ? Math.round(((mem as any).active / (mem as any).total) * 100)
              : 0,
        },
        disk: {
          totalGb: (totalDisk / 1024 / 1024 / 1024).toFixed(2),
          usedGb: (usedDisk / 1024 / 1024 / 1024).toFixed(2),
          percent: totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 100) : 0,
        },
        uptime,
      };
    } catch (e) {
      this.logger.error('Critical Error reading Hardware Stats', e as any);
      // Non rilanciamo: lasciamo i default
    }

    // 2) DB CHECK
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        services.database = 'up';
      }
    } catch (e) {
      this.logger.error('Database Check Failed', e as any);
      services.database = 'down';
    }

    return { hardware, services };
  }
}
