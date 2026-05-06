// apps/backend/src/auth/auth.module.ts
// Raggruppa tutto ciò che riguarda autenticazione, signup e OAuth.
// Esporta AuthService, AuthMfaService, LoginGuardService, AuditService
// così che altri moduli (es. TenantModule) possano iniettarli senza dipendere da AppModule.

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TenancyModule } from '../tenancy/tenancy.module';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';

// Controllers
import { AuthController } from '../auth.controller';
import { AuthPasswordController } from '../auth-password.controller';
import { AuthMfaController } from '../auth-mfa.controller';
import { SignupController } from './signup.controller';
import { GoogleAuthController } from './google.controller';

// Services & Strategies
import { AuthService } from '../auth.service';
import { AuthMfaService } from '../auth-mfa.service';
import { LoginGuardService } from '../login-guard.service';
import { AuditService } from '../audit.service';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { SignupService } from './signup.service';
import { PlatformModulesSeedService } from '../superadmin/platform-modules.seed';

// Entities needed by SignupService
import { Tenant } from '../superadmin/entities/tenant.entity';
import { PlatformModule } from '../superadmin/entities/platform-module.entity';
import { TenantSubscription } from '../superadmin/entities/tenant-subscription.entity';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {
        const secret = cfg.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            '[AuthModule] FATAL: JWT_SECRET is not set. ' +
            'Impostarlo nel file .env prima di avviare il server.',
          );
        }
        return { secret, signOptions: { expiresIn: '1d' } };
      },
    }),
    TypeOrmModule.forFeature([Tenant, PlatformModule, TenantSubscription]),
    TenancyModule,
    MailModule,
    RedisModule,
  ],

  controllers: [
    AuthController,
    AuthPasswordController,
    AuthMfaController,
    SignupController,
    GoogleAuthController,
  ],

  providers: [
    AuthService,
    AuthMfaService,
    LoginGuardService,
    AuditService,
    JwtStrategy,
    GoogleStrategy,
    SignupService,
    PlatformModulesSeedService,
  ],

  exports: [
    AuthService,
    AuthMfaService,
    LoginGuardService,
    AuditService,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
