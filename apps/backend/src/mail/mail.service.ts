import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

// Manteniamo gli import dei template se ti servono per altre parti del codice
// Se non li usi più, puoi rimuoverli.
import {
  buildInviteEmail,
  buildPasswordResetEmail,
} from './email-templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Metodo GENERICO pubblico per inviare email.
   * Usato da TenantsService e altri servizi.
   */
  async sendMail(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    purpose?: string;
  }): Promise<boolean> {
    const config = this.currentMailConfig();
    if (!config.ready) {
      this.logger.warn(`${params.purpose || 'Email'} skipped recipient=${params.to} reason=missing_smtp_config host=${config.host || 'unset'} port=${config.port || 'unset'} secure=${config.secure}`);
      return false;
    }
    try {
      await this.mailerService.sendMail({
        to: params.to,
        subject: params.subject,
        text: params.text, // Versione testo semplice (fallback)
        html: params.html || params.text, // Usa HTML se c'è, altrimenti testo
      });
      
      this.logger.log(`✅ Email inviata a ${params.to}`);
      return true;
    } catch (e) {
      this.logger.error(this.formatMailError(params.purpose || 'Email', params.to, e, config));
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

  private currentMailConfig() {
    const port = Number(process.env.MAIL_PORT);
    const secure = String(process.env.MAIL_SECURE || '').toLowerCase() === 'true';
    const host = String(process.env.MAIL_HOST || '').trim();
    const user = String(process.env.MAIL_USER || '').trim();
    const password = String(process.env.MAIL_PASSWORD || '').trim();
    return {
      host,
      port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null,
      secure,
      ready: Boolean(host && user && password && Number.isInteger(port) && port >= 1 && port <= 65535),
    };
  }

  private formatMailError(purpose: string, recipient: string, error: unknown, config: { host: string; port: number | null; secure: boolean }) {
    const err = error as { name?: unknown; code?: unknown; command?: unknown; responseCode?: unknown; message?: unknown };
    const message = this.redactMailMessage(String(err?.message || 'Errore invio email'));
    const parts = [
      `${purpose} email failed`,
      `recipient=${recipient}`,
      `name=${this.safeLogValue(err?.name)}`,
      `code=${this.safeLogValue(err?.code)}`,
      `command=${this.safeLogValue(err?.command)}`,
      `responseCode=${this.safeLogValue(err?.responseCode)}`,
      `host=${config.host || 'unset'}`,
      `port=${config.port || 'unset'}`,
      `secure=${config.secure}`,
      `message="${message}"`,
    ];
    return parts.join(' ');
  }

  private safeLogValue(value: unknown) {
    const text = String(value ?? 'n/a').replace(/\s+/g, '_');
    return text.slice(0, 80);
  }

  private redactMailMessage(message: string) {
    return message
      .replace(/https?:\/\/\S+/gi, '[redacted-url]')
      .replace(/\b(token|password|api[_-]?key|secret)[=:]\S+/gi, '$1=[redacted]')
      .replace(/\bbearer\s+\S+/gi, 'bearer [redacted]')
      .replace(/\s+/g, ' ')
      .slice(0, 180);
  }
}
