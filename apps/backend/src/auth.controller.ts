import {
  Body,
  Controller,
  Post,
  Req,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { LoginGuardService } from './login-guard.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard'; // Assicurati che il percorso sia corretto

// --- DTOs ---
type AuthBody = {
  email: string;
  password: string;
};

type AcceptInviteBody = {
  token: string;
  password: string;
};

type MfaConfirmBody = {
  code: string;   // Codice OTP inserito dall'utente
  secret: string; // Segreto generato nel setup
};

type MfaVerifyBody = {
  code: string;   // Solo codice per il login normale
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly loginGuard: LoginGuardService,
  ) {}

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
    return this.authService.generateMfaSetup(req);
  }

  /**
   * 2. CONFIRM: L'utente scansiona e invia il primo codice
   * Salva il segreto nel DB e attiva l'MFA.
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/confirm')
  async mfaConfirm(@Body() body: MfaConfirmBody, @Req() req: Request) {
    if (!body.code || !body.secret) {
      return { error: 'Code and secret required' };
    }

    try {
      const result = await this.authService.confirmMfaAndEnable(req, body.code, body.secret);

      const user = (req as any).user;
      await this.auditService.log(req, {
        action: 'auth_mfa_enabled_success',
        targetEmail: user?.email,
      });

      return result;
    } catch (e) {
      if (e instanceof Error) return { error: e.message };
      return { error: 'MFA Confirmation failed' };
    }
  }

  /**
   * 3. VERIFY: Login successivo (MFA già attivo)
   * L'utente invia solo il codice. Il backend verifica contro il segreto nel DB.
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/verify')
  async mfaVerify(@Body() body: MfaVerifyBody, @Req() req: Request) {
    if (!body.code) {
      return { error: 'Code required' };
    }

    try {
      const user = (req as any).user; // Qui abbiamo il token MFA_PENDING
      const result = await this.authService.verifyMfaLogin(user.sub, body.code, req);

      await this.auditService.log(req, {
        action: 'auth_mfa_login_success',
        targetEmail: user.email,
      });

      return result;
    } catch (e) {
      // Audit fallimento MFA (opzionale, per sicurezza)
      const user = (req as any).user;
      await this.auditService.log(req, {
        action: 'auth_mfa_login_failed',
        targetEmail: user?.email,
      });

      if (e instanceof Error) return { error: e.message };
      return { error: 'Invalid Code' };
    }
  }

  // ==========================================
  //  STANDARD FLOW (ESISTENTI)
  // ==========================================

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

      // 2) login tenant-aware
      const result = await this.authService.loginAuto(req, email, password);

      // 3) audit successo
      await this.auditService.log(req, {
        action: 'auth_login_success',
        targetEmail: email,
        // Logghiamo se è richiesto MFA o se è FULL
        metadata: { authStage: result.mfa?.stage || 'FULL' },
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
      authStage: user.authStage, // ✅ utile per il frontend
      created_at: user.created_at,
    };

    return { user: safeUser };
  }
}