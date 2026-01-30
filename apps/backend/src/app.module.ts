// apps/backend/src/app.module.ts
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

import { RedisService } from './redis/redis.service';
import { TelemetryService } from './telemetry/telemetry.service';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { LoginGuardService } from './login-guard.service';
import { FileStorageService } from './file-storage.service';
import { NotificationsService } from './realtime/notifications.service';
import { ProjectsEventsService } from './realtime/projects-events.service';
import { TenantBootstrapService } from './tenancy/tenant-bootstrap.service';

import { AuthMiddleware } from './auth.middleware';

import { TenantModule } from './tenant/tenant.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';

// ✅ tenant-specific feature modules
import { FedericaNeroneModule } from './federicanerone/federicanerone.module';
import { BusinaroModule } from './businaro/businaro.module';

// ✅ NEW: tenancy module (exports TenancyMiddleware)
import { TenancyModule } from './tenancy/tenancy.module';
import { TenancyMiddleware } from './tenancy/tenancy.middleware';

@Module({
  imports: [
    // health endpoints (k8s/traefik probe ecc)
    HealthModule,

    // global config
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),

    // default DB connection (public / bootstrap / health / future DI)
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
          // Se sei su provider con SSL obbligatorio:
          // ssl: { rejectUnauthorized: false },
        };
      },
    }),

    // infra modules
    MailModule,
    TenantModule,

    // ✅ tenancy middleware provider/export
    TenancyModule,

    // tenant verticals (gated a runtime via rules/guards/tenant)
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
  ],

  providers: [
    /**
     * ⚠️ RedisService
     * Non hai RedisModule, quindi lo dichiariamo qui UNA volta.
     * TenancyModule lo userà via DI perché è nello stesso application context.
     */
    RedisService,

    TelemetryService,
    AuthService,
    AuditService,
    LoginGuardService,
    FileStorageService,
    NotificationsService,
    ProjectsEventsService,
    TenantBootstrapService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    /**
     * Ordine CRITICO:
     * 1) TenancyMiddleware → attacca tenantConnection + tenantId
     * 2) AuthMiddleware → valida JWT e attacca req.user
     */
    consumer.apply(TenancyMiddleware, AuthMiddleware).forRoutes('*');
  }
}
