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

import { TenancyMiddleware } from './tenancy/tenancy.middleware';
import { AuthMiddleware } from './auth.middleware';

import { TenantModule } from './tenant/tenant.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';

// ✅ Federica-only module (nuovo)
import { FedericaNeroneModule } from './federicanerone/federicanerone.module';

// ✅ Businaro-only module (nuovo)
import { BusinaroModule } from './businaro/businaro.module';

@Module({
  imports: [
    HealthModule,

    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),

    // ✅ Connessione "default" (non tenant) - utile per DI / health / eventuali repository futuri
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const url = cfg.get<string>('DATABASE_URL');
        if (!url) {
          // se manca, meglio crashare subito invece di debug infinito
          throw new Error('Missing DATABASE_URL');
        }

        return {
          type: 'postgres' as const,
          url,
          autoLoadEntities: false,
          synchronize: false,
          // Se sei su provider con SSL obbligatorio (Neon/Supabase ecc) abilita:
          // ssl: { rejectUnauthorized: false },
        };
      },
    }),

    MailModule,
    TenantModule,

    // ✅ Feature isolate per tenant Federica (gated a runtime)
    FedericaNeroneModule,
    // ✅ Feature isolate per tenant Businaro (gated a runtime)
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
    // Tenancy prima (per schema), Auth dopo (per JWT)
    consumer.apply(TenancyMiddleware, AuthMiddleware).forRoutes('*');
  }
}
