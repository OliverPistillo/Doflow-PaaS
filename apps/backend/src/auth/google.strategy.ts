// apps/backend/src/auth/google.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor() {
    super({
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID || 'missing-client-id',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'missing-secret',
      callbackURL:
        process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        `${process.env.APP_BASE_URL || 'http://localhost:3000'}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('Google account has no email'), undefined);
    }
    const user = {
      googleId: profile.id,
      email: email.toLowerCase(),
      fullName: profile.displayName,
      picture: profile.photos?.[0]?.value,
    };
    return done(null, user);
  }
}
