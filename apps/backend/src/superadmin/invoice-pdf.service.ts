import { Injectable, Logger } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { Invoice } from './entities/invoice.entity';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  async generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('FATTURA', { align: 'right' });
        doc.fontSize(10).text(`Numero: ${invoice.invoiceNumber}`, { align: 'right' });
        doc.text(`Data di emissione: ${invoice.issueDate}`, { align: 'right' });
        doc.text(`Scadenza: ${invoice.dueDate}`, { align: 'right' });
        doc.moveDown();

        // From / To
        doc.fontSize(12).text('Da:');
        doc.font('Helvetica-Bold').text('DoFlow PaaS');
        doc.font('Helvetica').text('Via Roma 1, 20100 Milano');
        doc.moveDown();

        doc.fontSize(12).text('Fatturato a:');
        doc.font('Helvetica-Bold').text(invoice.clientName);
        doc.font('Helvetica').text('Cliente DoFlow');
        doc.moveDown(2);

        // Line Items Table Header
        const startY = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Descrizione', 50, startY);
        doc.text('Q.tà', 350, startY, { width: 50, align: 'right' });
        doc.text('Prezzo', 400, startY, { width: 70, align: 'right' });
        doc.text('Totale', 470, startY, { width: 70, align: 'right' });
        
        doc.moveTo(50, startY + 15).lineTo(540, startY + 15).stroke();
        
        let py = startY + 20;
        doc.font('Helvetica');

        if (invoice.lineItems && invoice.lineItems.length > 0) {
          invoice.lineItems.forEach(item => {
            doc.text(item.description, 50, py);
            doc.text(String(item.quantity), 350, py, { width: 50, align: 'right' });
            doc.text(`€ ${Number(item.unitPrice).toFixed(2)}`, 400, py, { width: 70, align: 'right' });
            doc.text(`€ ${Number(item.total).toFixed(2)}`, 470, py, { width: 70, align: 'right' });
            py += 20;
          });
        } else {
          doc.text('Servizi DoFlow', 50, py);
          doc.text('1', 350, py, { width: 50, align: 'right' });
          doc.text(`€ ${Number(invoice.amount).toFixed(2)}`, 400, py, { width: 70, align: 'right' });
          doc.text(`€ ${Number(invoice.amount).toFixed(2)}`, 470, py, { width: 70, align: 'right' });
          py += 20;
        }

        doc.moveTo(50, py + 10).lineTo(540, py + 10).stroke();

        // Totals
        py += 20;
        const taxRate = invoice.taxRate || 22.00;
        const subtotal = Number(invoice.amount);
        const taxAmount = (subtotal * Number(taxRate)) / 100;
        const grandTotal = subtotal + taxAmount;

        doc.font('Helvetica');
        doc.text('Imponibile:', 350, py, { width: 120, align: 'right' });
        doc.text(`€ ${subtotal.toFixed(2)}`, 470, py, { width: 70, align: 'right' });
        py += 20;
        doc.text(`IVA (${taxRate}%):`, 350, py, { width: 120, align: 'right' });
        doc.text(`€ ${taxAmount.toFixed(2)}`, 470, py, { width: 70, align: 'right' });
        py += 20;
        doc.font('Helvetica-Bold');
        doc.text('Totale da pagare:', 350, py, { width: 120, align: 'right' });
        doc.text(`€ ${grandTotal.toFixed(2)}`, 470, py, { width: 70, align: 'right' });

        // Notes
        if (invoice.notes) {
          doc.moveDown(3);
          doc.font('Helvetica').fontSize(10);
          doc.text('Note:', 50);
          doc.text(invoice.notes, 50);
        }

        // Footer
        doc.fontSize(8).text('Grazie per aver scelto DoFlow.', 50, 700, { align: 'center', width: 490 });

        doc.end();
      } catch (err) {
        this.logger.error('Failed to generate PDF', err);
        reject(err);
      }
    });
  }
}
