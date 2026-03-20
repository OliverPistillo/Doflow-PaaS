import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class InvoiceMailService {
  private readonly logger = new Logger(InvoiceMailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendInvoiceEmail(
    toEmail: string,
    clientName: string,
    invoiceNumber: string,
    pdfBuffer: Buffer,
  ) {
    if (!toEmail?.trim()) {
      throw new BadRequestException('Email destinatario obbligatoria');
    }

    const isPreventivo = !invoiceNumber.startsWith('INV-');
    const docLabel = isPreventivo ? `Preventivo ${invoiceNumber}` : `Fattura N. ${invoiceNumber}`;
    const filename = isPreventivo
      ? `Preventivo_${invoiceNumber}.pdf`
      : `Fattura_${invoiceNumber}.pdf`;

    try {
      await this.mailerService.sendMail({
        to: toEmail,
        subject: `${docLabel} – DoFlow`,
        text: `Gentile ${clientName},\n\nIn allegato trovi il documento: ${docLabel}.\n\nCordiali saluti,\nIl team di DoFlow`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
            <h2 style="color: #1a1a2e;">DoFlow – ${docLabel}</h2>
            <p>Gentile <strong>${clientName}</strong>,</p>
            <p>In allegato trovi il documento <strong>${docLabel}</strong>.</p>
            <p>Per qualsiasi dubbio o domanda, rispondi pure a questa email.</p>
            <br>
            <p style="color: #666;">Cordiali saluti,<br><em>Il team di DoFlow</em></p>
          </div>
        `,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      this.logger.log(`✅ Email "${docLabel}" inviata a ${toEmail}`);
      return { success: true };
    } catch (err) {
      this.logger.error(`❌ Errore invio email a ${toEmail}:`, err);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error("Impossibile inviare l'email: " + message);
    }
  }
}