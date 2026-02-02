import { Injectable } from '@nestjs/common';
import * as si from 'systeminformation';
import { DataSource } from 'typeorm';

@Injectable()
export class SystemStatsService {
  // Iniettiamo la connessione DB per testarla
  constructor(private readonly dataSource: DataSource) {}

  async getSystemStats() {
    // 1. Hardware Stats
    const [cpu, mem, currentLoad, fs] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.currentLoad(),
      si.fsSize(),
    ]);

    const totalDisk = fs.reduce((acc, drive) => acc + drive.size, 0);
    const usedDisk = fs.reduce((acc, drive) => acc + drive.used, 0);

    // 2. Services Health Check (I "pallini")
    const services = {
      database: 'down',
      redis: 'unknown', // Se hai un RedisService, iniettalo e controllalo qui
      api: 'up' // Se siamo qui, l'API risponde
    };

    // Check DB reale
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        services.database = 'up';
      }
    } catch (e) {
      services.database = 'down';
    }

    return {
      hardware: {
        cpu: {
          cores: cpu.cores,
          brand: cpu.brand,
          load: Math.round(currentLoad.currentLoad),
        },
        memory: {
          totalGb: (mem.total / 1024 / 1024 / 1024).toFixed(2),
          usedGb: (mem.active / 1024 / 1024 / 1024).toFixed(2),
          percent: Math.round((mem.active / mem.total) * 100),
        },
        disk: {
          totalGb: (totalDisk / 1024 / 1024 / 1024).toFixed(2),
          usedGb: (usedDisk / 1024 / 1024 / 1024).toFixed(2),
          percent: Math.round((usedDisk / totalDisk) * 100),
        },
        uptime: si.time().uptime,
      },
      services: services // Restituiamo lo stato dei servizi
    };
  }
}