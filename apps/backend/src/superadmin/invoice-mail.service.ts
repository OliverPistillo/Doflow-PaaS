import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InvoiceMailService {
  private logger = new Logger(InvoiceMailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') || 'smtp.example.com',
      port: this.configService.get<number>('SMTP_PORT') || 587,
      secure: this.configService.get<boolean>('SMTP_SECURE') || false,
      auth: {
        user: this.configService.get<string>('SMTP_USER') || 'user',
        pass: this.configService.get<string>('SMTP_PASS') || 'pass',
      },
    });
  }

  async sendInvoiceEmail(
    toEmail: string,
    clientName: string,
    invoiceNumber: string,
    pdfBuffer: Buffer
  ) {
    try {
      const mailOptions = {
        from: `"DoFlow Billing" <${this.configService.get<string>('SMTP_FROM') || 'billing@doflow.it'}>`,
        to: toEmail,
        subject: `La tua Fattura DoFlow (N. ${invoiceNumber})`,
        text: `Gentile ${clientName},\n\nIn allegato trovi la fattura N. ${invoiceNumber}.\n\nCordiali saluti,\nIl team di DoFlow`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Fattura DoFlow</h2>
            <p>Gentile <strong>${clientName}</strong>,</p>
            <p>In allegato trovi la fattura <strong>N. ${invoiceNumber}</strong>.</p>
            <p>Se hai dubbi o domande, non esitare a rispondere a questa email.</p>
            <br>
            <p>Cordiali saluti,<br><em>Il team di DoFlow</em></p>
          </div>
        `,
        attachments: [
          {
            filename: `Fattura_${invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email fattura inviata a ${toEmail}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      this.logger.error(`Errore invio email fattura a ${toEmail}`, err);
      throw new Error("Impossibile inviare l'email");
    }
  }
}
