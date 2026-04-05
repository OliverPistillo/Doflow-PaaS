import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';

@Global() // 👈 Importante: lo rende disponibile ovunque (anche in TenantsService) senza doverlo re-importare sempre
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('MAIL_HOST'),
          port: Number(config.get('MAIL_PORT')),
          secure: config.get('MAIL_SECURE') === 'true', // Converte la stringa in booleano
          auth: {
            user: config.get('MAIL_USER'),
            pass: config.get('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: `"${config.get('MAIL_FROM_NAME')}" <${config.get('MAIL_USER')}>`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}