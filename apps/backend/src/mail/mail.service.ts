import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { DOFLOW_MAIL_CONFIG, resolveMailConfig, type MailConfig } from './mail.config';

// Keep the injection token beside the consumer so MailService does not import
// MailModule while MailModule is importing MailService during bootstrap.
export const DOFLOW_MAIL_TRANSPORT = Symbol('DOFLOW_MAIL_TRANSPORT');

// Manteniamo gli import dei template se ti servono per altre parti del codice
// Se non li usi più, puoi rimuoverli.
import {
  buildInviteEmail,
  buildPasswordResetEmail,
} from './email-templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(DOFLOW_MAIL_TRANSPORT) private readonly mailerService: Pick<Transporter, 'sendMail'>,
    @Optional() @Inject(DOFLOW_MAIL_CONFIG) private readonly config: MailConfig = resolveMailConfig(new ConfigService()),
  ) {}

  isConfigured(): boolean {
    return this.config.ready;
  }

  async sendMailRequired(params: {
    to: string;
    subject: string;
    text: string;
    purpose?: string;
  }): Promise<void> {
    if (!this.config.ready) throw new Error('SMTP_NOT_CONFIGURED');
    const started = Date.now();
    try {
      const result = await this.mailerService.sendMail({
        to: params.to,
        subject: params.subject,
        text: params.text,
        from: this.config.from,
      });
      this.assertSmtpAcceptance(result);
    } catch (error) {
      this.logger.error(this.formatMailError(params.purpose, error, Date.now() - started));
      throw new Error('SMTP_SEND_FAILED');
    }
  }

  /**
   * Metodo GENERICO pubblico per inviare email.
   * Usato da TenantsService e altri servizi.
   */
  async sendMail(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: SendMailOptions['attachments'];
    purpose?: string;
    operationId?: string;
  }): Promise<boolean> {
    const operation = this.operationMetadata(params.operationId);
    if (!this.config.ready) {
      this.logger.warn(`${this.safePurpose(params.purpose)} skipped recipient=[redacted] phase=config reason=missing_smtp_config${operation}`);
      return false;
    }
    const started = Date.now();
    try {
      const result = await this.mailerService.sendMail({
        to: params.to,
        subject: params.subject,
        text: params.text, // Versione testo semplice (fallback)
        html: params.html || params.text, // Usa HTML se c'è, altrimenti testo
        attachments: params.attachments,
        from: this.config.from,
      });
      this.assertSmtpAcceptance(result);
      this.logger.log(`${this.safePurpose(params.purpose)} email accepted recipient=[redacted] phase=smtp duration_ms=${Date.now() - started}${operation}`);
      return true;
    } catch (e) {
      this.logger.error(`${this.formatMailError(params.purpose, e, Date.now() - started)}${operation}`);
      // Non lanciamo l'errore per non bloccare i flussi principali (es. creazione tenant)
      return false;
    }
  }

  /**
   * Metodo specifico per inviti (Retro-compatibilità)
   */
  async sendInviteEmail(params: {
    to: string;
    tenantName: string;
    inviteLink: string;
    operationId?: string;
  }) {
    const tpl = buildInviteEmail({
      tenantName: params.tenantName,
      inviteLink: params.inviteLink,
    });
    
    return this.sendMail({
      to: params.to,
      subject: tpl.subject,
      html: tpl.html,
      purpose: 'Invite',
      operationId: params.operationId,
    });
  }

  /**
   * Metodo specifico per reset password (Retro-compatibilità)
   */
  async sendPasswordResetEmail(params: {
    to: string;
    resetLink: string;
  }) {
    const tpl = buildPasswordResetEmail({
      resetLink: params.resetLink,
    });

    return this.sendMail({
      to: params.to,
      subject: tpl.subject,
      html: tpl.html,
      purpose: 'Password reset',
    });
  }

  private assertSmtpAcceptance(result: { accepted?: unknown[]; rejected?: unknown[] } | undefined) {
    // Nodemailer 9 SMTP can resolve with only some recipients accepted.
    // Acceptance is evidence of SMTP handoff, never of inbox delivery.
    if (!Array.isArray(result?.accepted) || !result.accepted.length || !Array.isArray(result.rejected) || result.rejected.length > 0) {
      throw Object.assign(new Error('SMTP recipients not fully accepted'), { code: 'ESMTPRECIPIENTS' });
    }
  }

  private formatMailError(purpose: string | undefined, error: unknown, duration: number) {
    const err = error as { code?: unknown; command?: unknown; responseCode?: unknown };
    const codes = ['EAUTH', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'EDNS', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ESOCKET', 'ETLS', 'EENVELOPE', 'EMESSAGE', 'ESTREAM', 'ESMTPRECIPIENTS'];
    const commands = ['CONN', 'EHLO', 'HELO', 'STARTTLS', 'AUTH', 'AUTH PLAIN', 'AUTH LOGIN', 'AUTH XOAUTH2', 'MAIL FROM', 'RCPT TO', 'DATA'];
    const code = codes.includes(String(err?.code)) ? String(err.code) : 'UNKNOWN';
    const command = commands.includes(String(err?.command)) ? String(err.command).replace(/ /g, '_') : 'UNKNOWN';
    const responseCode = typeof err?.responseCode === 'number' && Number.isInteger(err.responseCode) && err.responseCode >= 100 && err.responseCode <= 599 ? err.responseCode : 'n/a';
    return `${this.safePurpose(purpose)} email failed recipient=[redacted] phase=smtp code=${code} command=${command} responseCode=${responseCode} duration_ms=${duration}`;
  }

  private safePurpose(value: string | undefined) {
    return value && ['Invite', 'Password reset', 'Customer Inbox'].includes(value) ? value : 'Email';
  }

  private operationMetadata(value: string | undefined) {
    return value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? ` operation_id=${value}` : '';
  }
}
