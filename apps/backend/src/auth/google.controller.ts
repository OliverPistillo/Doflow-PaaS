// apps/backend/src/auth/google.controller.ts
// Google OAuth flow:
//   GET  /auth/google           → redirect to Google consent
//   GET  /auth/google/callback  → verify and create a short-lived opaque handoff
//
// Behavior:
//   - Existing user: resolves the real tenant-schema user and redirects with a single-use handoff
//   - New user: redirects to /signup with a single-use opaque handoff
//   - Public endpoint (no auth required), excluded from tenancy middleware

import { Controller, Get, Req, Res, UseGuards, Logger, Optional, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { AuthHandoffService } from './auth-handoff.service';
import {
  DesktopGoogleFlow,
  DesktopGoogleOAuthService,
} from './desktop-google-oauth.service';
import { GoogleDesktopAuthGuard } from './google-desktop.guard';

type GooglePassportUser = {
  googleId: string;
  email: string;
  fullName?: string;
  picture?: string;
  emailVerified?: boolean;
};

@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly authHandoff: AuthHandoffService,
    @Optional() private readonly desktopOAuth?: DesktopGoogleOAuthService,
  ) {}

  /** Step 1: redirect user to Google consent screen */
  @Get('')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport handles the redirect automatically via AuthGuard
  }

  /** Desktop entrypoint: validates a loopback port and stores native state server-side. */
  @Get('desktop/start')
  async desktopStart(
    @Query('callbackPort') callbackPort: string,
    @Query('state') nativeState: string,
    @Res() res: Response,
  ) {
    if (!this.desktopOAuth) return res.status(503).send('Desktop OAuth non disponibile');
    const flow = await this.desktopOAuth.create({ callbackPort, nativeState });
    return res.redirect(`/api/auth/google/desktop/authorize?flow=${encodeURIComponent(flow.flow)}`);
  }

  /** Adds the opaque server flow as the Google OAuth state. */
  @Get('desktop/authorize')
  @UseGuards(GoogleDesktopAuthGuard)
  async desktopAuthorize() {
    // Passport handles the redirect. The callback consumes state atomically.
  }

  /** Step 2: callback after Google consent */
  @Get('callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const googleUser = (req as any).user as GooglePassportUser | undefined;
    const appBase = process.env.APP_BASE_URL || 'http://localhost:3000';
    const state = String(req.query?.state || '');
    let desktopFlow: DesktopGoogleFlow | undefined;

    if (this.desktopOAuth?.isDesktopState(state)) {
      try {
        desktopFlow = await this.desktopOAuth.consumeGoogleState(state);
      } catch {
        return res.status(400).send('Desktop OAuth state non valido o scaduto');
      }
    }

    if (!googleUser?.email) {
      return this.redirectFailure(res, appBase, desktopFlow, 'google_no_email');
    }

    if (googleUser.emailVerified === false) {
      return this.redirectFailure(res, appBase, desktopFlow, 'google_email_not_verified');
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
        const handoff = await this.authHandoff.createGoogleSignup({
          googleId: googleUser.googleId,
          email: googleUser.email,
          fullName: googleUser.fullName,
          picture: googleUser.picture,
          sourceHost: req.hostname,
          correlationId: String(req.headers['x-correlation-id'] || ''),
        });
        if (desktopFlow && this.desktopOAuth) {
          return res.redirect(this.desktopOAuth.callbackUrl(desktopFlow, {
            handoff: handoff.handoff,
            tenant: 'public',
            kind: 'signup',
          }));
        }
        return res.redirect(`${appBase}/register?handoff=${encodeURIComponent(handoff.handoff)}`);
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

      const handoff = await this.authHandoff.createLogin({
        user: {
          sub: loginUser.id,
          email: loginUser.email,
          tenantId: schema,
          tenantSlug: slug,
          role: loginUser.role,
          authStage,
        },
        tenantTarget: slug,
        rememberMe: true,
        sourceHost: req.hostname,
        correlationId: String(req.headers['x-correlation-id'] || ''),
      });
      if (desktopFlow && this.desktopOAuth) {
        return res.redirect(this.desktopOAuth.callbackUrl(desktopFlow, {
          handoff: handoff.handoff,
          tenant: slug,
          kind: 'login',
        }));
      }
      const targetBase = this.getTenantFrontendBase(appBase, slug);
      const params = new URLSearchParams({ handoff: handoff.handoff, tenant: slug });
      return res.redirect(`${targetBase}/login?${params.toString()}`);
    } catch (err: any) {
      this.logger.error('Google OAuth callback non riuscito');
      return this.redirectFailure(res, appBase, desktopFlow, 'google_callback_failed');
    }
  }

  private redirectFailure(
    res: Response,
    appBase: string,
    desktopFlow: DesktopGoogleFlow | undefined,
    error: 'google_no_email' | 'google_email_not_verified' | 'google_callback_failed',
  ) {
    if (desktopFlow && this.desktopOAuth) {
      return res.redirect(this.desktopOAuth.callbackUrl(desktopFlow, { error }));
    }
    return res.redirect(`${appBase}/login?error=${error}`);
  }

  private getTenantFrontendBase(appBase: string, tenantSlug: string) {
    if (!tenantSlug || tenantSlug === 'public' || tenantSlug === 'doflow') return appBase;
    const parsed = new URL(appBase);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return appBase;
    const domain = String(process.env.TENANT_BASE_DOMAIN || 'doflow.it')
      .replace(/^https?:\/\//, '')
      .replace(/^app\./, '')
      .replace(/\/.*$/, '');
    return `${parsed.protocol}//${tenantSlug}.${domain}`;
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
