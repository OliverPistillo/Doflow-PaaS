import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Logger,
  Patch,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { MfaRolesPolicy } from '../security-policy.service';

function assertSuperAdmin(req: Request) {
  const user = (req as any).authUser ?? (req as any).user;
  const role = String(user?.role ?? '').toLowerCase().trim();
  if (role !== 'superadmin' && role !== 'owner') throw new ForbiddenException('SuperAdmin only');
}

@Controller('superadmin')
export class SecurityPolicyController {
  private readonly logger = new Logger(SecurityPolicyController.name);
  constructor(private readonly dataSource: DataSource) {}

  private logAndThrow500(where: string, e: any): never {
    const msg = e?.message || String(e);
    this.logger.error(`[${where}] ${msg}`, e?.stack || undefined);
    throw new InternalServerErrorException({
      error: 'INTERNAL_ERROR',
      where,
      message: msg,
      code: e?.code,
    });
  }

  @Get('security/mfa-roles')
  async get(@Req() req: Request) {
    assertSuperAdmin(req);
    try {
      const rows = await this.dataSource.query(
        `select value, updated_at from public.security_policy where key='mfa_roles' limit 1`,
      );
      return { policy: rows?.[0]?.value ?? {}, updated_at: rows?.[0]?.updated_at ?? null };
    } catch (e) {
      this.logAndThrow500('GET /superadmin/security/mfa-roles', e);
    }
  }

  @Patch('security/mfa-roles')
  async patch(@Req() req: Request, @Body() body: { policy: MfaRolesPolicy }) {
    assertSuperAdmin(req);
    try {
      const incoming = body?.policy ?? {};
      const clean: MfaRolesPolicy = {};
      for (const [k, v] of Object.entries(incoming)) {
        const key = String(k || '').toLowerCase().trim();
        if (!key) continue;
        clean[key] = Boolean(v);
      }

      await this.dataSource.query(
        `
        insert into public.security_policy (key, value, updated_at)
        values ('mfa_roles', $1::jsonb, now())
        on conflict (key) do update
          set value = excluded.value,
              updated_at = now()
        `,
        [JSON.stringify(clean)],
      );

      return { status: 'ok', policy: clean };
    } catch (e) {
      this.logAndThrow500('PATCH /superadmin/security/mfa-roles', e);
    }
  }
}
