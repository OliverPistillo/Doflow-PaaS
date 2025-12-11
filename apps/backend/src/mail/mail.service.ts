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
    // --- MODIFICA: Ora leggiamo le variabili MAIL_... che hai su Coolify ---
    const host = this.config.get<string>('MAIL_HOST');
    const port = Number(this.config.get<string>('MAIL_PORT') ?? '587');
    
    // Gestione robusta del secure: true se 'true' o porta 465
    const secureRaw = this.config.get<string>('MAIL_SECURE');
    const secure = secureRaw 
      ? secureRaw.toLowerCase() === 'true' 
      : port === 465;

    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASSWORD');

    // Gestione Mittente: supportiamo sia MAIL_FROM completo che spezzato
    const mailFrom = this.config.get<string>('MAIL_FROM');
    const fromName = this.config.get<string>('MAIL_FROM_NAME') ?? 'Doflow';
    const fromAddr = this.config.get<string>('MAIL_FROM_ADDRESS') ?? 'noreply@doflow.it';

    // Se c'è MAIL_FROM completo (es. "Doflow <no-reply@...>") usiamo quello, altrimenti costruiamo
    this.fromAddress = mailFrom || `"${fromName}" <${fromAddr}>`;

    this.logger.log(`Configuring MailService with host: ${host}, port: ${port}, user: ${user}, secure: ${secure}`);

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
      this.logger.log(`Email inviata correttamente a ${params.to}`);
    } catch (e) {
      this.logger.error(`Errore invio email a ${params.to}`, e as any);
      // Non rilanciamo l'errore per evitare che il crash della mail blocchi la creazione utente
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