import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { RedisService } from './redis/redis.service';
import { TenancyMiddleware } from './tenancy/tenancy.middleware';
import { TenantController } from './tenant.controller';
import { BloomController } from './bloom.controller';
import { TelemetryController } from './telemetry/telemetry.controller';
import { TelemetryService } from './telemetry/telemetry.service';
import { TenantUsersController } from './tenant-users.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthMiddleware } from './auth.middleware';
import { TenantAdminController } from './tenant-admin.controller';
import { AuditService } from './audit.service';
import { LoginGuardService } from './login-guard.service';
import { ProjectsController } from './projects.controller';
import { FilesController } from './files.controller';
import { FileStorageService } from './file-storage.service';
import { NotificationsService } from './realtime/notifications.service';
import { NotificationsTestController } from './realtime/notifications-test.controller';
import { MailModule } from './mail/mail.module';
import { AuthPasswordController } from './auth-password.controller';
import { SuperadminTenantsController } from './superadmin/superadmin-tenants.controller';
import { ProjectsEventsService } from './realtime/projects-events.service';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailModule,
  ],
  controllers: [
    AppController,
    TenantController,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware, AuthMiddleware).forRoutes('*');
  }
}
