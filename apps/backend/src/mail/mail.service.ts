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
    // --- DEBUG: STAMPIAMO LE VARIABILI (Password oscurata) ---
    const host = this.config.get<string>('MAIL_HOST');
    const port = this.config.get<string>('MAIL_PORT');
    const user = this.config.get<string>('MAIL_USER');
    const secure = this.config.get<string>('MAIL_SECURE');
    
    // Solo in dev/debug, utile per verificare che Coolify passi i dati
    console.log('============= MAIL DEBUG START =============');
    console.log(`MAIL_HOST: ${host}`);
    console.log(`MAIL_PORT: ${port}`);
    console.log(`MAIL_USER: ${user}`);
    console.log(`MAIL_SECURE: ${secure}`);
    console.log('============================================');

    const portNumber = Number(port ?? '587');
    
    // Logica SiteGround: se porta 465, secure DEVE essere true
    const isSecure = secure === 'true' || portNumber === 465;

    const pass = this.config.get<string>('MAIL_PASSWORD');
    const mailFrom = this.config.get<string>('MAIL_FROM');
    const fromName = this.config.get<string>('MAIL_FROM_NAME') ?? 'Doflow';
    const fromAddr = this.config.get<string>('MAIL_FROM_ADDRESS') ?? 'noreply@doflow.it';

    this.fromAddress = mailFrom || `"${fromName}" <${fromAddr}>`;

    this.transporter = nodemailer.createTransport({
      host: host, // Se undefined, Nodemailer potrebbe fallire o usare localhost
      port: portNumber,
      secure: isSecure,
      auth: user && pass ? { user, pass } : undefined,
      // Timeout aggressivi per evitare il freeze del frontend
      connectionTimeout: 5000, // 5 secondi
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  }

  private async sendMail(params: {
    to: string;
    subject: string;
    html: string;
  }) {
    try {
      // CORREZIONE TS: castiamo options ad any per leggere .host senza errore
      const options = this.transporter.options as any;
      this.logger.log(`Tentativo invio a: ${params.to} tramite ${options.host || 'unknown host'}`);
      
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      
      this.logger.log(`✅ Email inviata a ${params.to}`);
    } catch (e) {
      this.logger.error(`❌ ERRORE INVIO EMAIL a ${params.to}`);
      console.error(e); 
      // Rilanciamo l'errore per farlo gestire al controller
      throw e;
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