// apps/backend/src/app.module.ts
// Root module — orchestratore leggero.
// La logica di auth è in AuthModule, quella superadmin in SuperadminModule.

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import * as path from 'path';

// ── Infra modules ─────────────────────────────────────────────────────────────
import { RedisModule } from './redis/redis.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { TrafficControlModule } from './traffic-control/traffic-control.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './realtime/notifications.module';

// ── Feature modules ───────────────────────────────────────────────────────────
import { AuthModule } from './auth/auth.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { TenantModule } from './tenant/tenant.module';
import { FedericaNeroneModule } from './federicanerone/federicanerone.module';
import { BusinaroModule } from './businaro/businaro.module';
import { SalesIntelligenceModule } from './sales-intelligence/sales-intelligence.module';

// ── Root-level controllers (non appartengono a nessun sotto-modulo) ───────────
import { AppController } from './app.controller';
import { BloomController } from './bloom.controller';
import { TenantUsersController } from './tenant-users.controller';
import { TenantAdminController } from './tenant-admin.controller';
import { ProjectsController } from './projects.controller';
import { FilesController } from './files.controller';
import { NotificationsTestController } from './realtime/notifications-test.controller';
import { SuperadminAuditController } from './audit.controller';

// ── Root-level providers ──────────────────────────────────────────────────────
import { FileStorageService } from './file-storage.service';
import { ProjectsEventsService } from './realtime/projects-events.service';
import { TrafficGuard } from './traffic-control/traffic.guard';
import { FeatureAccessGuard } from './feature-access/feature-access.guard';

// ── Middleware ────────────────────────────────────────────────────────────────
import { TenancyMiddleware } from './tenancy/tenancy.middleware';
import { AuthMiddleware } from './auth.middleware';

// ── Sales Intelligence entities (per autoLoadEntities fallback) ──────────────
import { CompanyIntel }     from './sales-intelligence/entities/company-intel.entity';
import { Prospect }         from './sales-intelligence/entities/prospect.entity';
import { ResearchData }     from './sales-intelligence/entities/research-data.entity';
import { OutreachCampaign } from './sales-intelligence/entities/outreach-campaign.entity';

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: false,
      envFilePath: path.join(__dirname, '..', '.env'),
    }),

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'apps', 'backend', 'public'),
      serveRoot: '/public',
    }),

    // ── Database ──────────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        url: cfg.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: process.env.DB_SYNC === 'true',
      }),
    }),

    // ── Cache / Queues ────────────────────────────────────────────────────────
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host:     cfg.get<string>('REDIS_HOST', 'localhost'),
          port:     cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    // ── Cross-cutting infra ───────────────────────────────────────────────────
    TelemetryModule,
    TrafficControlModule,
    TenancyModule,
    MailModule,
    NotificationsModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // ── Feature modules ───────────────────────────────────────────────────────
    AuthModule,
    SuperadminModule,
    TenantModule,
    FedericaNeroneModule,
    BusinaroModule,
    SalesIntelligenceModule,
  ],

  controllers: [
    AppController,
    BloomController,
    TenantUsersController,
    TenantAdminController,
    ProjectsController,
    FilesController,
    NotificationsTestController,
    SuperadminAuditController,
  ],

  providers: [
    FileStorageService,
    ProjectsEventsService,
    { provide: APP_GUARD, useClass: TrafficGuard },
    { provide: APP_GUARD, useClass: FeatureAccessGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenancyMiddleware, AuthMiddleware)
      .exclude(
        'superadmin/(.*)',
        'public/(.*)',
        'tenant/self-service/(.*)',
        'auth/signup-tenant',
        'auth/check-slug',
        'auth/google',
        'auth/google/(.*)',
        'api/superadmin/(.*)',
        'api/public/(.*)',
        'api/tenant/self-service/(.*)',
        'api/auth/signup-tenant',
        'api/auth/check-slug',
        'api/auth/google',
        'api/auth/google/(.*)',
      )
      .forRoutes('*');
  }
}
