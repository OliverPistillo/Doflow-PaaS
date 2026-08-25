import { Module, Global } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { DOFLOW_MAIL_TRANSPORT, MailService } from './mail.service';

export function mailTimeout(config: Pick<ConfigService, 'get'>, key: string, fallback: number) {
  const value = Number(config.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1000, Math.min(60000, Math.trunc(value)));
}

@Global() // 👈 Importante: lo rende disponibile ovunque (anche in TenantsService) senza doverlo re-importare sempre
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DOFLOW_MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createTransport({
          host: config.get('MAIL_HOST'),
          port: Number(config.get('MAIL_PORT')),
          secure: config.get('MAIL_SECURE') === 'true', // Converte la stringa in booleano
          connectionTimeout: mailTimeout(config, 'MAIL_CONNECTION_TIMEOUT_MS', 10000),
          greetingTimeout: mailTimeout(config, 'MAIL_GREETING_TIMEOUT_MS', 10000),
          socketTimeout: mailTimeout(config, 'MAIL_SOCKET_TIMEOUT_MS', 15000),
          auth: {
            user: config.get('MAIL_USER'),
            pass: config.get('MAIL_PASSWORD'),
          },
      }),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
