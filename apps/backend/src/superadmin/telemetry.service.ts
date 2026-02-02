// apps/backend/src/superadmin/telemetry.service.ts
import { Injectable } from '@nestjs/common';
import * as si from 'systeminformation';

@Injectable()
export class SystemStatsService { // <--- DEVE CHIAMARSI SystemStatsService
  async getSystemStats() {
    const [cpu, mem, currentLoad, fs] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.currentLoad(),
      si.fsSize(),
    ]);

    const totalDisk = fs.reduce((acc, drive) => acc + drive.size, 0);
    const usedDisk = fs.reduce((acc, drive) => acc + drive.used, 0);

    return {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        loadPercent: Math.round(currentLoad.currentLoad),
      },
      memory: {
        totalGb: (mem.total / 1024 / 1024 / 1024).toFixed(2),
        usedGb: (mem.active / 1024 / 1024 / 1024).toFixed(2),
        usedPercent: Math.round((mem.active / mem.total) * 100),
      },
      disk: {
        totalGb: (totalDisk / 1024 / 1024 / 1024).toFixed(2),
        usedGb: (usedDisk / 1024 / 1024 / 1024).toFixed(2),
        usedPercent: Math.round((usedDisk / totalDisk) * 100),
      },
      uptime: si.time().uptime,
      platform: `${process.platform} (${process.arch})`
    };
  }
}