import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import {
  buildInviteEmail,
  buildPasswordResetEmail,
} from './email-templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const secure =
      (this.config.get<string>('SMTP_SECURE') ?? 'false').toLowerCase() ===
      'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const fromName = this.config.get<string>('MAIL_FROM_NAME') ?? 'Doflow';
    const fromAddr =
      this.config.get<string>('MAIL_FROM_ADDRESS') ?? 'no-reply@doflow.it';

    this.fromAddress = `"${fromName}" <${fromAddr}>`;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private async sendMail(params: {
    to: string;
    subject: string;
    html: string;
  }) {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
    } catch (e) {
      this.logger.error(`Errore invio email a ${params.to}`, e as any);
      // Non rilanciamo per non bloccare il flow business
    }
  }

  async sendInviteEmail(params: {
    to: string;
    tenantName: string;
    inviteLink: string;
  }) {
    const tpl = buildInviteEmail({
      tenantName: params.tenantName,
      inviteLink: params.inviteLink,
    });
    await this.sendMail({
      to: params.to,
      subject: tpl.subject,
      html: tpl.html,
    });
  }

  async sendPasswordResetEmail(params: {
    to: string;
    resetLink: string;
  }) {
    const tpl = buildPasswordResetEmail({
      resetLink: params.resetLink,
    });
    await this.sendMail({
      to: params.to,
      subject: tpl.subject,
      html: tpl.html,
    });
  }
}
