import { Body, Controller, Post, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { AuthMfaService } from './auth-mfa.service';

@Controller('auth')
export class AuthMfaController {
  constructor(private readonly mfa: AuthMfaService) {}

  /**
   * POST /auth/mfa/start
   * - Se user NON ha MFA: genera secret e ritorna QR + otpauth_url (setup)
   * - Se user ha MFA: ritorna challenge info (challenge)
   * Richiede Bearer token (pending o full).
   */
  @Post('mfa/start')
  async start(@Req() req: Request) {
    const user = (req as any).authUser ?? (req as any).user;
    if (!user?.id) throw new UnauthorizedException('Not authenticated');

    return this.mfa.start(req, String(user.id));
  }

  /**
   * POST /auth/mfa/verify
   * - verifica code TOTP
   * - se ok -> token FULL (upgrade) + aggiorna contatori
   */
  @Post('mfa/verify')
  async verify(
    @Req() req: Request,
    @Body() body: { code?: string },
  ) {
    const code = String(body.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw new BadRequestException('Invalid code (6 digits)');

    const user = (req as any).authUser ?? (req as any).user;
    if (!user?.id) throw new UnauthorizedException('Not authenticated');

    return this.mfa.verify(req, String(user.id), code);
  }
}
