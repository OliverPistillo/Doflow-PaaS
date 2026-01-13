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

type AuthBody = {
  email: string;
  password: string;
};

type AcceptInviteBody = {
  token: string;
  password: string;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly loginGuard: LoginGuardService,
  ) {}

  @Post('accept-invite')
  async acceptInvite(@Body() body: AcceptInviteBody, @Req() req: Request) {
    if (!body.token || !body.password) {
      return { error: 'token and password required' };
    }

    try {
      const result = await this.authService.acceptInvite(
        req,
        body.token,
        body.password,
      );

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
      const email = body.email.trim().toLowerCase();
      const password = body.password;

      const result = await this.authService.register(req, email, password);

      await this.auditService.log(req, {
        action: 'auth_register_success',
        targetEmail: email,
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

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    try {
      // 1) controlla se l'identità è già bloccata (Bloom + Redis)
      await this.loginGuard.checkBeforeLogin(req, email);

      // 2) login tenant-aware:
      // - se il tenant corrente è "public": prova in public, se fallisce risolve tenant da public.tenants e riprova
      // - se il tenant corrente NON è public: si comporta come login normale
      const result = await this.authService.loginAuto(req, email, password);

      // 3) audit successo
      await this.auditService.log(req, {
        action: 'auth_login_success',
        targetEmail: email,
      });

      // 4) reset dei fallimenti in caso di successo
      await this.loginGuard.resetFailures(req, email);

      return result;
    } catch (e) {
      // audit fallimento
      await this.auditService.log(req, {
        action: 'auth_login_failed',
        targetEmail: email,
        metadata: {
          reason: e instanceof Error ? e.message : 'unknown',
        },
      });

      // registra il fallimento per il rate limiting
      await this.loginGuard.registerFailure(req, email);

      if (e instanceof Error) return { error: e.message };
      return { error: 'Unknown error' };
    }
  }

  @Get('me')
  getMe(@Req() req: Request) {
    // ✅ compatibilità: alcune parti usano req.authUser, altre req.user
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
