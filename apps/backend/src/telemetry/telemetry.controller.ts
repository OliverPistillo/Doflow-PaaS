import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { TelemetryService } from './telemetry.service';
import { DataSource } from 'typeorm';

type TelemetryBody = {
  type: string;
  ip?: string | null;
  path?: string;
};

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('log')
  async log(@Body() body: TelemetryBody, @Req() req: Request) {
    let tenantId = 'unknown';
    let conn: DataSource | null = null;

    try {
      conn = (req as any).tenantConnection as DataSource;
      if (conn) {
        const rows = await conn.query('select current_schema() as schema');
        tenantId = rows[0]?.schema ?? 'unknown';
      }
    } catch {
      tenantId = 'unknown';
    }

    // 1) invio all'OTEL wrapper (stdout per ora)
    await this.telemetryService.log({
      type: body.type,
      ip: body.ip ?? (req.ip as string | undefined),
      path: body.path ?? req.path,
      tenantId,
    });

    // 2) scrittura nel DB tenant-specific se la connessione esiste
    if (conn) {
      await conn.query(
        `
        insert into telemetry_events (type, path, ip, tenant_id)
        values ($1, $2, $3, $4)
        `,
        [
          body.type,
          body.path ?? req.path,
          body.ip ?? (req.ip as string | null),
          tenantId,
        ],
      );
    }

    return { status: 'ok', tenantId };
  }
}
