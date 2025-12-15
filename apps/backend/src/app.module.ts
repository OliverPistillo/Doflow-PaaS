import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Aggiungi ConfigService
import { TypeOrmModule } from '@nestjs/typeorm'; // <--- Aggiungi questo import
import { AppController } from './app.controller';
import { RedisService } from './redis/redis.service';
import { TenancyMiddleware } from './tenancy/tenancy.middleware';
import { TenantModule } from './tenant/tenant.module';
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
import { TenantBootstrapService } from './tenancy/tenant-bootstrap.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),
    // AGGIUNGI QUESTA PARTE PER CONNETTERE IL DB PRINCIPALE
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'), // Assicurati di avere questa var nell'env
        autoLoadEntities: false, // O true se usi le Entity
        synchronize: false, // Meglio false in produzione
        // Opzionale: se hai problemi con SSL su Supabase/Neon/Cloud
        // ssl: { rejectUnauthorized: false }, 
      }),
    }),
    MailModule,
    TenantModule,
  ],
  controllers: [
    AppController,
    BloomController,
    TelemetryController,
    TenantUsersController, // È registrato correttamente qui
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