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
  }): Promise<boolean> {
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
      this.logger.error(`❌ ERRORE INVIO EMAIL a ${params.to}`, e);
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
    });
  }
}