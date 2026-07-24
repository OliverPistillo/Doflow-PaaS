// apps/backend/src/auth/google.controller.ts
// Google OAuth flow:
//   GET  /auth/google           → redirect to Google consent
//   GET  /auth/google/callback  → verify, login existing users or mint signed signup token
//
// Behavior:
//   - Existing user: resolves the real tenant-schema user, issues JWT, redirects to frontend /login
//   - New user: redirects to /signup with a short-lived signed googleSignupToken
//   - Public endpoint (no auth required), excluded from tenancy middleware

import { Controller, Get, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';
import { Role } from '../roles';
import { safeSchema } from '../common/schema.utils';

type GooglePassportUser = {
  googleId: string;
  email: string;
  fullName?: string;
  picture?: string;
  emailVerified?: boolean;
};

type GoogleSignupPayload = {
  purpose: 'google_signup';
  googleId: string;
  email: string;
  fullName?: string;
  picture?: string;
};

@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
  ) {}

  /** Step 1: redirect user to Google consent screen */
  @Get('')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport handles the redirect automatically via AuthGuard
  }

  /** Step 2: callback after Google consent */
  @Get('callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const googleUser = (req as any).user as GooglePassportUser | undefined;
    const appBase = process.env.APP_BASE_URL || 'http://localhost:3000';

    if (!googleUser?.email) {
      return res.redirect(`${appBase}/login?error=google_no_email`);
    }

    if (googleUser.emailVerified === false) {
      return res.redirect(`${appBase}/login?error=google_email_not_verified`);
    }

    try {
      const rows = await this.dataSource.query(
        `SELECT u.id,
                u.email,
                u.role,
                u.tenant_id,
                u.mfa_enabled,
                u.mfa_secret,
                u.is_active,
                t.schema_name,
                t.slug,
                t.is_active AS tenant_active
           FROM public.users u
           LEFT JOIN public.tenants t ON t.id::text = u.tenant_id
          WHERE lower(u.email) = lower($1)
          LIMIT 1`,
        [googleUser.email],
      );

      if (rows.length === 0) {
        const token = this.signGoogleSignupToken({
          purpose: 'google_signup',
          googleId: googleUser.googleId,
          email: googleUser.email,
          fullName: googleUser.fullName,
          picture: googleUser.picture,
        });

        const params = new URLSearchParams({
          google_token: token,
          google_email: googleUser.email,
          google_name: googleUser.fullName || '',
        });
        return res.redirect(`${appBase}/signup?${params.toString()}`);
      }

      const directoryUser = rows[0];
      if (directoryUser.is_active === false) {
        return res.redirect(`${appBase}/login?error=account_disabled`);
      }
      if (directoryUser.tenant_id && !directoryUser.schema_name) {
        return res.redirect(`${appBase}/login?error=tenant_not_found`);
      }
      if (directoryUser.tenant_id && directoryUser.tenant_active === false) {
        return res.redirect(`${appBase}/login?error=tenant_disabled`);
      }

      const schema = safeSchema(directoryUser.schema_name || 'public', 'GoogleAuthController.googleCallback');
      const slug = (directoryUser.slug || schema).toLowerCase();

      await this.rememberGoogleIdentity(directoryUser.id, googleUser);

      const loginUser = await this.resolveLoginUser(schema, googleUser.email, directoryUser);
      const authStage = loginUser.mfa_enabled
        ? (loginUser.mfa_secret ? 'MFA_PENDING' : 'MFA_SETUP_NEEDED')
        : 'FULL';

      const token = this.authService.signTokenPublic(
        loginUser.id,
        loginUser.email,
        schema,
        slug,
        loginUser.role as Role,
        { authStage, mfaRequired: !!loginUser.mfa_enabled },
      );

      const params = new URLSearchParams({ accessToken: token });
      if (authStage !== 'FULL') params.set('next', 'mfa');

      return res.redirect(`${appBase}/login?${params.toString()}`);
    } catch (err: any) {
      this.logger.error('Google OAuth callback error:', err?.stack || err?.message || err);
      return res.redirect(`${appBase}/login?error=google_callback_failed`);
    }
  }

  private signGoogleSignupToken(payload: GoogleSignupPayload): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    return jwt.sign(payload, secret, { expiresIn: '15m' });
  }

  private async rememberGoogleIdentity(publicUserId: string, googleUser: GooglePassportUser) {
    await this.dataSource.query(
      `UPDATE public.users
          SET google_id = COALESCE(google_id, $1),
              auth_provider = CASE
                WHEN password_hash IS NULL THEN 'google'
                ELSE COALESCE(auth_provider, 'password')
              END,
              full_name = COALESCE(full_name, $2),
              avatar_url = COALESCE(avatar_url, $3),
              email_verified_at = COALESCE(email_verified_at, now()),
              updated_at = now()
        WHERE id = $4`,
      [googleUser.googleId, googleUser.fullName || null, googleUser.picture || null, publicUserId],
    );
  }

  private async resolveLoginUser(
    schema: string,
    email: string,
    directoryUser: any,
  ): Promise<{ id: string; email: string; role: string; mfa_enabled: boolean; mfa_secret: string | null }> {
    if (schema === 'public') {
      return {
        id: directoryUser.id,
        email: directoryUser.email,
        role: directoryUser.role || 'user',
        mfa_enabled: !!directoryUser.mfa_enabled,
        mfa_secret: directoryUser.mfa_secret || null,
      };
    }

    const tenantRows = await this.dataSource.query(
      `SELECT id, email, role, mfa_enabled, mfa_secret, is_active
         FROM "${schema}"."users"
        WHERE lower(email) = lower($1)
        LIMIT 1`,
      [email],
    );

    const tenantUser = tenantRows[0];
    if (!tenantUser || tenantUser.is_active === false) {
      throw new Error('Tenant user not found or disabled');
    }

    return {
      id: tenantUser.id,
      email: tenantUser.email,
      role: tenantUser.role || directoryUser.role || 'user',
      mfa_enabled: !!tenantUser.mfa_enabled,
      mfa_secret: tenantUser.mfa_secret || null,
    };
  }
}
