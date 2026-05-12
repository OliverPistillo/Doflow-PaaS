// apps/backend/src/auth/google.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

function getDefaultGoogleCallbackUrl(): string {
  const publicApiUrl = (
    process.env.PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/api'
  ).replace(/\/+$/, '');

  return `${publicApiUrl}/auth/google/callback`;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor() {
    super({
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID || 'missing-client-id',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'missing-secret',
      callbackURL:
        process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        getDefaultGoogleCallbackUrl(),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const primaryEmail = profile.emails?.[0];
    const email = primaryEmail?.value;
    if (!email) {
      return done(new Error('Google account has no email'), undefined);
    }
    const user = {
      googleId: profile.id,
      email: email.toLowerCase(),
      fullName: profile.displayName,
      picture: profile.photos?.[0]?.value,
      emailVerified: (primaryEmail as { verified?: boolean } | undefined)?.verified !== false,
    };
    return done(null, user);
  }
}
