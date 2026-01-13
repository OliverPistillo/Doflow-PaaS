// apps/backend/src/auth.controller.ts
import {
  Body,
  Controller,
  Post,
  Req,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { LoginGuardService } from './login-guard.service';
import { DataSource } from 'typeorm';

type AuthBody = {
  email: string;
  password: string;
};

type AcceptInviteBody = {
  token: string;
  password: string;
};

type ResolveTenantResponse = { tenantId: string };

function normEmail(v: string) {
  return (v ?? '').trim().toLowerCase();
}

function safeSchema(input: string): string {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return 'public';
  if (!/^[a-z0-9_]+$/.test(s)) return 'public';
  return s;
}

async function getPublicDs(req: Request): Promise<DataSource> {
  const currentTenant = String((req as any).tenantId ?? 'public');
  const currentConn = (req as any).tenantConnection as DataSource | undefined;

  if (currentTenant === 'public' && currentConn) return currentConn;

  // fallback: crea conn pubblica (evita dipendenze incrociate)
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    schema: 'public',
    synchronize: false,
  });
  await ds.initialize();
  return ds;
}

async function resolveTenantForEmail(req: Request, email: string): Promise<string> {
  const e = normEmail(email);
  if (!e) return 'public';

  const publicDs = await getPublicDs(req);

  // 1) se esiste in public.users → public
  try {
    const inPublic = await publicDs.query(
      `select 1 from public.users where lower(email) = $1 limit 1`,
      [e],
    );
    if (inPublic?.length) return 'public';
  } catch {
    // se public.users non c'è/non usata, ignora
  }

  // 2) scorri tenants attivi e cerca in {schema}.users
  const tenants = await publicDs.query(
    `
    select slug, schema_name
    from public.tenants
    where is_active = true
    order by created_at desc
    `,
  );

  for (const t of tenants as Array<{ slug: string; schema_name: string }>) {
    const schema = safeSchema(t.schema_name || t.slug);
    if (!schema || schema === 'public') continue;

    try {
      const ds = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        schema,
        synchronize: false,
      });
      await ds.initialize();

      const rows = await ds.query(
        `select 1 from "${schema}".users where lower(email) = $1 limit 1`,
        [e],
      );

      await ds.destroy();

      if (rows?.length) return schema;
    } catch {
      // schema non pronto → skip
    }
  }

  return 'public';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly loginGuard: LoginGuardService,
  ) {}

  // ✅ NEW: resolve tenant by email
  @Post('resolve-tenant')
  async resolveTenant(@Body() body: { email?: string }, @Req() req: Request): Promise<ResolveTenantResponse> {
    const email = normEmail(body.email ?? '');
    const tenantId = await resolveTenantForEmail(req, email);
    return { tenantId };
  }

  @Post('accept-invite')
  async acceptInvite(@Body() body: AcceptInviteBody, @Req() req: Request) {
    if (!body.token || !body.password) {
      return { error: 'token and password required' };
    }
    try {
      const result = await this.authService.acceptInvite(req, body.token, body.password);

      await this.auditService.log(req, {
        action: 'auth_accept_invite_success',
        targetEmail: result.user?.email,
      });

      return result;
    } catch (e) {
      await this.auditService.log(req, {
        action: 'auth_accept_invite_failed',
        metadata: { token: body.token },
      });

      if (e instanceof Error) return { error: e.message };
      return { error: 'Unknown error' };
    }
  }

  @Post('register')
  async register(@Body() body: AuthBody, @Req() req: Request) {
    if (!body.email || !body.password) {
      return { error: 'email and password required' };
    }
    try {
      const result = await this.authService.register(req, body.email, body.password);

      await this.auditService.log(req, {
        action: 'auth_register_success',
        targetEmail: body.email,
      });

      return result;
    } catch (e) {
      if (e instanceof Error) return { error: e.message };
      return { error: 'Unknown error' };
    }
  }

  @Post('login')
  async login(@Body() body: AuthBody, @Req() req: Request) {
    if (!body.email || !body.password) {
      return { error: 'email and password required' };
    }

    const email = normEmail(body.email);

    try {
      await this.loginGuard.checkBeforeLogin(req, email);

      // 1) prova login "normale" sul tenant attaccato dal middleware
      const result = await this.authService.login(req, email, body.password);

      await this.auditService.log(req, { action: 'auth_login_success', targetEmail: email });
      await this.loginGuard.resetFailures(req, email);

      return result;
    } catch (e) {
      // 🔁 AUTO-RESOLVE: solo se sto su public (tipico app.doflow.it)
      const currentTenant = String((req as any).tenantId ?? 'public');

      const msg = e instanceof Error ? e.message : 'unknown';
      const looksLikeUserNotFound =
        /not found|user not found|invalid credentials|invalid password|unauthorized/i.test(msg);

      if (currentTenant === 'public' && looksLikeUserNotFound) {
        try {
          const resolvedTenant = await resolveTenantForEmail(req, email);

          // se trova un tenant diverso, riprova login lì
          if (resolvedTenant !== 'public') {
            const tenantDs = new DataSource({
              type: 'postgres',
              url: process.env.DATABASE_URL,
              schema: resolvedTenant,
              synchronize: false,
            });
            await tenantDs.initialize();

            (req as any).tenantId = resolvedTenant;
            (req as any).tenantConnection = tenantDs;

            const retry = await this.authService.login(req, email, body.password);

            await this.auditService.log(req, { action: 'auth_login_success', targetEmail: email });
            await this.loginGuard.resetFailures(req, email);

            // close: evita leak conn per chiamata singola
            await tenantDs.destroy();

            return retry;
          }
        } catch {
          // se fallisce auto-resolve, torna al flusso sotto
        }
      }

      await this.auditService.log(req, {
        action: 'auth_login_failed',
        targetEmail: email,
        metadata: { reason: msg },
      });

      await this.loginGuard.registerFailure(req, email);

      if (e instanceof Error) return { error: e.message };
      return { error: 'Unknown error' };
    } finally {
      // niente
    }
  }

  @Get('me')
  getMe(@Req() req: Request) {
    const user = (req as any).authUser ?? (req as any).user;

    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? user.tenant_id ?? 'public',
      created_at: user.created_at,
    };

    return { user: safeUser };
  }
}
