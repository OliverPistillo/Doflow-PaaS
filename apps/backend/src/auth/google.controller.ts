// apps/backend/src/auth/google.controller.ts
// Google OAuth flow:
//   GET  /auth/google           → redirect to Google consent
//   GET  /auth/google/callback  → verify, find or create user, issue JWT, redirect to frontend
//
// Behavior:
//   - If user exists in public.users → issue JWT for their tenant
//   - If user doesn't exist → redirect to frontend /signup?google_email=... so they can create a tenant
//   - Public endpoint (no auth required), excluded from tenancy middleware

import { Controller, Get, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth.service';
import { Role } from '../roles';

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
    const googleUser = (req as any).user as {
      googleId: string;
      email: string;
      fullName?: string;
      picture?: string;
    };

    const appBase = process.env.APP_BASE_URL || 'http://localhost:3000';

    if (!googleUser?.email) {
      return res.redirect(`${appBase}/login?error=google_no_email`);
    }

    try {
      // Look up the email in the directory
      const rows = await this.dataSource.query(
        `SELECT u.id, u.email, u.role, u.tenant_id, t.schema_name, t.slug
         FROM public.users u
         LEFT JOIN public.tenants t ON t.id::text = u.tenant_id
         WHERE lower(u.email) = lower($1)
         LIMIT 1`,
        [googleUser.email],
      );

      if (rows.length === 0) {
        // User doesn't exist: redirect to signup with email pre-filled
        const params = new URLSearchParams({
          google_email: googleUser.email,
          google_name: googleUser.fullName || '',
        });
        return res.redirect(`${appBase}/signup?${params.toString()}`);
      }

      const u = rows[0];
      const schema = (u.schema_name || 'public').toLowerCase();
      const slug = u.slug || schema;

      const token = this.authService.signTokenPublic(
        u.id,
        u.email,
        schema,
        slug,
        (u.role || 'user') as Role,
        { authStage: 'FULL', mfaRequired: false },
      );

      // Redirect to frontend with token in URL — login page picks it up
      return res.redirect(`${appBase}/login?accessToken=${encodeURIComponent(token)}`);
    } catch (err: any) {
      this.logger.error('Google OAuth callback error:', err);
      return res.redirect(`${appBase}/login?error=google_callback_failed`);
    }
  }
}
