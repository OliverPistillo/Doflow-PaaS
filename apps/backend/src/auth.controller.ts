import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Get,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { LoginGuardService } from './login-guard.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard'; // Assicurati che il percorso sia corretto
import { AuthHandoffService } from './auth/auth-handoff.service';
import { WebSessionService, WebSessionUser } from './auth/web-session.service';

// --- DTOs ---
type AuthBody = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

type AcceptInviteBody = {
  token: string;
  password: string;
  tenant?: string;
  tenantSlug?: string;
};

type MfaConfirmBody = {
  code: string;   // Codice OTP inserito dall'utente
  secret: string; // Segreto generato nel setup
};

type MfaVerifyBody = {
  code: string;   // Solo codice per il login normale
};

type AuthStage = 'FULL' | 'MFA_PENDING' | 'MFA_SETUP_NEEDED';
const INVALID_CREDENTIALS_CODE = 'AUTH_INVALID_CREDENTIALS';

function isValidEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly loginGuard: LoginGuardService,
    private readonly authHandoff: AuthHandoffService,
    private readonly webSessions: WebSessionService,
  ) {}

  private isOpaqueWebSessionRequest(req: Request, result?: any) {
    void result;
    return this.webSessions.isBrowserRequest(req);
  }

  private browserOriginHost(req: Request) {
    try {
      return new URL(String(req.headers.origin || '')).hostname;
    } catch {
      return req.hostname;
    }
  }

  private sessionUser(source: any, stage?: AuthStage): WebSessionUser {
    const user = source?.user || source || {};
    const id = String(user.id || user.sub || '');
    return {
      sub: id,
      id,
      email: String(user.email || ''),
      role: String(user.role || ''),
      tenantId: String(user.tenantId || user.tenant_id || 'public'),
      tenantSlug: String(user.tenantSlug || user.tenant_id || 'public'),
      authStage: stage || String(user.authStage || 'FULL').toUpperCase() as AuthStage,
      mfa_required: user.mfa_required === true,
    };
  }

  private assertAuthStage(req: Request, allowed: AuthStage[]) {
    const user = (req as any).user;
    const stage = String(user?.authStage || 'FULL').toUpperCase() as AuthStage;
    if (!user?.sub) throw new UnauthorizedException('Sessione non valida');
    if (!allowed.includes(stage)) {
      throw new ForbiddenException('Stage autenticazione non consentito');
    }
    return user;
  }

  // ==========================================
  //  MFA FLOW (NUOVI ENDPOINT)
  // ==========================================

  /**
   * 1. SETUP: Genera Segreto e QR Code
   * Richiede un token valido (anche temporaneo con stage MFA_SETUP_NEEDED)
   */
  @UseGuards(JwtAuthGuard)
  @Get('mfa/setup')
  async mfaSetup(@Req() req: Request) {
    this.assertAuthStage(req, ['FULL', 'MFA_SETUP_NEEDED']);
    return this.authService.generateMfaSetup(req);
  }

  /**
   * 2. CONFIRM: L'utente scansiona e invia il primo codice
   * Salva il segreto nel DB e attiva l'MFA.
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/confirm')
  async mfaConfirm(@Body() body: MfaConfirmBody, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAuthStage(req, ['FULL', 'MFA_SETUP_NEEDED']);
    if (!/^\d{6}$/.test(String(body.code || '')) || !body.secret) {
      throw new BadRequestException('Codice e segreto MFA obbligatori');
    }

    try {
      const result = await this.authService.confirmMfaAndEnable(req, body.code, body.secret);

      if (this.isOpaqueWebSessionRequest(req)) {
        await this.webSessions.rotate(req, res, this.sessionUser((req as any).user, 'FULL'));
      }

      const user = (req as any).user;
      await this.auditService.log(req, {
        action: 'auth_mfa_enabled_success',
        targetEmail: user?.email,
      });

      return this.isOpaqueWebSessionRequest(req) ? { status: 'ok' } : result;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new UnauthorizedException('Codice MFA non valido');
    }
  }

  /**
   * 3. VERIFY: Login successivo (MFA già attivo)
   * L'utente invia solo il codice. Il backend verifica contro il segreto nel DB.
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/verify')
  async mfaVerify(@Body() body: MfaVerifyBody, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = this.assertAuthStage(req, ['MFA_PENDING']);
    if (!/^\d{6}$/.test(String(body.code || ''))) {
      throw new BadRequestException('Codice MFA non valido');
    }

    try {
      const result = await this.authService.verifyMfaLogin(user, body.code, req);

      if (this.isOpaqueWebSessionRequest(req)) {
        await this.webSessions.rotate(req, res, this.sessionUser(user, 'FULL'));
      }

      await this.auditService.log(req, {
        action: 'auth_mfa_login_success',
        targetEmail: user.email,
      });

      return this.isOpaqueWebSessionRequest(req) ? { status: 'ok' } : result;
    } catch (e) {
      // Audit fallimento MFA (opzionale, per sicurezza)
      const user = (req as any).user;
      await this.auditService.log(req, {
        action: 'auth_mfa_login_failed',
        targetEmail: user?.email,
      });

      if (e instanceof HttpException) throw e;
      throw new UnauthorizedException('Codice MFA non valido');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('handoff')
  async createHandoff(
    @Body() body: { tenantTarget?: string; rememberMe?: boolean; next?: 'dashboard' | 'mfa' | 'onboarding' | 'superadmin' },
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const webSession = (req as any).webSession;
    if (!user?.sub || (!webSession && this.webSessions.isBrowserRequest(req)) || !body.tenantTarget) {
      throw new BadRequestException('Handoff incompleto');
    }
    return this.authHandoff.createLogin({
      user,
      tenantTarget: body.tenantTarget,
      rememberMe: body.rememberMe,
      next: body.next,
      sourceHost: this.browserOriginHost(req),
      correlationId: String(req.headers['x-correlation-id'] || ''),
    });
  }

  @Post('handoff/exchange')
  async exchangeHandoff(
    @Body() body: { handoff?: string; tenantTarget?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authHandoff.exchange(
      body.handoff,
      body.tenantTarget,
      this.browserOriginHost(req),
    );
    if (result.kind !== 'login') return result;

    const { webUser, ...publicResult } = result;
    if (this.webSessions.isBrowserRequest(req)) {
      if (!webUser?.id) throw new UnauthorizedException('Handoff non valido');
      await this.webSessions.create(req, res, webUser, result.rememberMe);
      return publicResult;
    }
    return publicResult;
  }

  // ==========================================
  //  STANDARD FLOW (ESISTENTI)
  // ==========================================

  @Post('accept-invite')
  async acceptInvite(
    @Body() body: AcceptInviteBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.token || typeof body.password !== 'string' || body.password.length < 8) {
      throw new BadRequestException('Token e password obbligatori');
    }

    try {
      const result = await this.authService.acceptInvite(
        req,
        body.token,
        body.password,
        body.tenant || body.tenantSlug,
      );

      await this.auditService.log(req, {
        action: 'auth_accept_invite_success',
        targetEmail: result.user?.email,
      });

      if (this.isOpaqueWebSessionRequest(req, result)) {
        await this.webSessions.create(req, res, this.sessionUser(result, 'FULL'), false);
        const { token: _token, ...safeResult } = result;
        return safeResult;
      }
      return result;
    } catch (e) {
      await this.auditService.log(req, {
        action: 'auth_accept_invite_failed',
        metadata: { token_present: Boolean(body.token), tenant: body.tenant || body.tenantSlug || null },
      });

      if (e instanceof HttpException) throw e;
      throw new BadRequestException('Invito non valido o scaduto');
    }
  }

  @Post('login')
  async login(@Body() body: AuthBody, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!isValidEmail(body.email) || typeof body.password !== 'string' || !body.password) {
      throw new BadRequestException('Email e password obbligatorie');
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    try {
      // 1) controlla se l'identità è già bloccata (Bloom + Redis)
      await this.loginGuard.checkBeforeLogin(req, email);

      // 2) login tenant-aware
      const result = await this.authService.loginAuto(req, email, password);

      if (this.isOpaqueWebSessionRequest(req, result)) {
        await this.webSessions.create(
          req,
          res,
          this.sessionUser(result, result.mfa?.stage || 'FULL'),
          body.rememberMe === true,
        );
      }

      // 3) audit successo
      await this.auditService.log(req, {
        action: 'auth_login_success',
        targetEmail: email,
        // Logghiamo se è richiesto MFA o se è FULL
        metadata: { authStage: result.mfa?.stage || 'FULL' },
      });

      // 4) reset dei fallimenti in caso di successo
      await this.loginGuard.resetFailures(req, email);

      if (this.isOpaqueWebSessionRequest(req, result)) {
        const { token: _token, ...safeResult } = result;
        return safeResult;
      }
      return result;
    } catch (e) {
      const invalidCredentials = e instanceof UnauthorizedException;
      // audit fallimento
      await this.auditService.log(req, {
        action: 'auth_login_failed',
        targetEmail: email,
        metadata: {
          reason:
            e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS
              ? 'rate_limited'
              : e instanceof UnauthorizedException
                ? 'invalid_credentials'
                : 'login_failed',
        },
      });

      if (!(e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS)) {
        await this.loginGuard.registerFailure(req, email);
      }

      if (e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw e;
      }
      if (invalidCredentials) {
        throw new UnauthorizedException({
          message: 'Credenziali non valide',
          code: INVALID_CREDENTIALS_CODE,
        });
      }
      throw new UnauthorizedException('Credenziali non valide');
    }
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.webSessions.revoke(req);
    this.webSessions.clear(res);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: Request) {
    // ✅ compatibilità: alcune parti usano req.authUser, altre req.user
    const user = (req as any).authUser ?? (req as any).user;

    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }
    this.assertAuthStage(req, ['FULL']);

    const safeUser = {
      id: user.id ?? user.sub,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? user.tenant_id ?? 'public',
      tenantSlug: user.tenantSlug ?? user.tenant_slug ?? user.tenantId ?? 'public',
      authStage: user.authStage, // ✅ utile per il frontend
      created_at: user.created_at,
    };

    return { user: safeUser };
  }

  @UseGuards(JwtAuthGuard)
  @Get('session-stage')
  getSessionStage(@Req() req: Request) {
    const user = (req as any).authUser ?? (req as any).user;
    if (!user?.sub) throw new UnauthorizedException('Not authenticated');
    return {
      authStage: String(user.authStage || 'FULL').toUpperCase(),
      tenantSlug: String(user.tenantSlug || user.tenantId || ''),
      role: String(user.role || ''),
    };
  }
}
