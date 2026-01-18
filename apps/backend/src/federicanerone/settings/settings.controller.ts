import { Controller, Get, Body, Put, UseGuards, Request } from '@nestjs/common';
import { DataSource } from 'typeorm';
// import { AuthGuard } from ... (importa il tuo AuthGuard se ne usi uno)

@Controller('federicanerone/settings')
export class SettingsController {
  constructor(private ds: DataSource) {}

  @Get()
  async getSettings() {
    const res = await this.ds.query(
      `SELECT value FROM federicanerone.settings WHERE key = 'vip_config'`
    );
    // Se non esiste, ritorna default
    return res[0]?.value || { thresholdEur: 500, period: 'annual' };
  }

  @Put()
  async updateSettings(@Body() body: { thresholdEur: number; period: string }) {
    // Validazione base
    const threshold = Number(body.thresholdEur);
    const period = body.period;
    
    if (isNaN(threshold) || threshold <= 0) throw new Error("Invalid threshold");

    const jsonValue = JSON.stringify({ thresholdEur: threshold, period });

    await this.ds.query(
      `INSERT INTO federicanerone.settings (key, value, updated_at)
       VALUES ('vip_config', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [jsonValue]
    );

    return { success: true };
  }
}