import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { BloomController } from './bloom.controller';
import { TelemetryController } from './telemetry/telemetry.controller';
import { TenantUsersController } from './tenant-users.controller';
import { AuthController } from './auth.controller';
import { TenantAdminController } from './tenant-admin.controller';
import { ProjectsController } from './projects.controller';
import { FilesController } from './files.controller';
import { NotificationsTestController } from './realtime/notifications-test.controller';
import { AuthPasswordController } from './auth-password.controller';
import { SuperadminTenantsController } from './superadmin/superadmin-tenants.controller';
import { SuperadminUsersController } from './superadmin/superadmin-users.controller';
import { SecurityPolicyController } from './superadmin/security-policy.controller';
import { AuthMfaController } from './auth-mfa.controller';
import { AuthMfaService } from './auth-mfa.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/jwt.strategy';

// --- SERVIZI ---
import { SystemStatsService } from './superadmin/telemetry.service';
import { TelemetryService } from './telemetry/telemetry.service';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { LoginGuardService } from './login-guard.service';
import { FileStorageService } from './file-storage.service';
import { NotificationsService } from './realtime/notifications.service';
import { ProjectsEventsService } from './realtime/projects-events.service';
import { TenantBootstrapService } from './tenancy/tenant-bootstrap.service';
import { SuperadminAuditController } from './audit.controller';

// ✅ NUOVI IMPORT PER DASHBOARD KPI
import { SuperadminDashboardController } from './superadmin/superadmin-dashboard.controller';
import { SuperadminDashboardService } from './superadmin/superadmin-dashboard.service';
import { PlatformDeal } from './superadmin/entities/platform-deal.entity';

// --- MIDDLEWARE & GUARD ---
import { TenancyMiddleware } from './tenancy/tenancy.middleware';
import { AuthMiddleware } from './auth.middleware';

// --- MODULI ---
import { TenantModule } from './tenant/tenant.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';
import { FedericaNeroneModule } from './federicanerone/federicanerone.module';
import { BusinaroModule } from './businaro/businaro.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    HealthModule,
    TypeOrmModule.forFeature([PlatformDeal]),

    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),

    RedisModule,
    TenancyModule,

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const url = cfg.get<string>('DATABASE_URL');
        if (!url) throw new Error('Missing DATABASE_URL');

        return {
          type: 'postgres' as const,
          url,
          autoLoadEntities: false,
          synchronize: false,
        };
      },
    }),

    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'SECRET_DA_CONFIGURARE',
        signOptions: { expiresIn: '1d' },
      }),
    }),

    MailModule,
    TenantModule,
    FedericaNeroneModule,
    BusinaroModule,
  ],

  controllers: [
    AppController,
    BloomController,
    TelemetryController,
    TenantUsersController,
    AuthController,
    TenantAdminController,
    ProjectsController,
    FilesController,
    NotificationsTestController,
    AuthPasswordController,
    SuperadminTenantsController,
    SuperadminAuditController,
    SuperadminUsersController,
    SecurityPolicyController,
    AuthMfaController,
    // ✅ REGISTRAZIONE CONTROLLER DASHBOARD
    SuperadminDashboardController, 
  ],

  providers: [
    TelemetryService,
    SystemStatsService,
    AuthService,
    AuditService,
    LoginGuardService,
    FileStorageService,
    NotificationsService,
    ProjectsEventsService,
    TenantBootstrapService,
    AuthMfaService,
    JwtStrategy,
    // ✅ REGISTRAZIONE SERVICE DASHBOARD
    SuperadminDashboardService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware, AuthMiddleware).forRoutes('*');
  }
}