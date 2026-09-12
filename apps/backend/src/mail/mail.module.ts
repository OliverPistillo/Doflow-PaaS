import { Module, Global } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { DOFLOW_MAIL_TRANSPORT, MailService } from './mail.service';
import { DOFLOW_MAIL_CONFIG, resolveMailConfig, type MailConfig } from './mail.config';
export { mailTimeout } from './mail.config';

@Global() // 👈 Importante: lo rende disponibile ovunque (anche in TenantsService) senza doverlo re-importare sempre
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DOFLOW_MAIL_CONFIG,
      inject: [ConfigService],
      useFactory: resolveMailConfig,
    },
    {
      provide: DOFLOW_MAIL_TRANSPORT,
      inject: [DOFLOW_MAIL_CONFIG],
      useFactory: (config: MailConfig) => createTransport(config.options),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
