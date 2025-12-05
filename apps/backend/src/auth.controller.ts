import { Body, Controller, Post, Req } from '@nestjs/common';
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

      if (e instanceof Error) {
        return { error: e.message };
      }
      return { error: 'Unknown error' };
    }
  }

  @Post('register')
  async register(@Body() body: AuthBody, @Req() req: Request) {
    if (!body.email || !body.password) {
      return { error: 'email and password required' };
    }
    try {
      const result = await this.authService.register(
        req,
        body.email,
        body.password,
      );

      await this.auditService.log(req, {
        action: 'auth_register_success',
        targetEmail: body.email,
      });

      return result;
    } catch (e) {
      if (e instanceof Error) {
        return { error: e.message };
      }
      return { error: 'Unknown error' };
    }
  }

  @Post('login')
  async login(@Body() body: AuthBody, @Req() req: Request) {
    if (!body.email || !body.password) {
      return { error: 'email and password required' };
    }
    try {
      // 1) controlla se l'identità è già bloccata (Bloom + Redis)
      await this.loginGuard.checkBeforeLogin(req, body.email);

      // 2) tenta il login normale
      const result = await this.authService.login(
        req,
        body.email,
        body.password,
      );

      // 3) audit successo
      await this.auditService.log(req, {
        action: 'auth_login_success',
        targetEmail: body.email,
      });

      // 4) reset dei fallimenti in caso di successo
      await this.loginGuard.resetFailures(req, body.email);

      return result;
    } catch (e) {
      // audit fallimento
      await this.auditService.log(req, {
        action: 'auth_login_failed',
        targetEmail: body.email,
        metadata: {
          reason: e instanceof Error ? e.message : 'unknown',
        },
      });

      // registra il fallimento per il rate limiting
      await this.loginGuard.registerFailure(req, body.email);

      if (e instanceof Error) {
        return { error: e.message };
      }
      return { error: 'Unknown error' };
    }
  }
}
