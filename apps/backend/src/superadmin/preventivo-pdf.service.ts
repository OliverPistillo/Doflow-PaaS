// Percorso: apps/backend/src/superadmin/finance/preventivo-pdf.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument = require('pdfkit');
import { Invoice } from './entities/invoice.entity';

const INDIGO     = '#4f46e5';
const NAVY       = '#0d1b2e';
const LIGHT_GRAY = '#f8f8f8';
const MID_GRAY   = '#e2e8f0';
const TEXT_GRAY  = '#6b7280';

const EMITTENTE = {
  nome:  'DoFlow',
  piva:  'IT04558810711',
  email: 'fatture@doflow.it',
};

@Injectable()
export class PreventivoPdfService {
  private readonly logger = new Logger(PreventivoPdfService.name);

  private getLogoPath(): string | null {
    const candidates = [
      path.resolve(process.cwd(), '..', 'frontend', 'public', 'logo_doflow_bianco.png'),
      path.resolve(process.cwd(), '..', '..', 'apps', 'frontend', 'public', 'logo_doflow_bianco.png'),
      path.resolve(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'logo_doflow_bianco.png'),
    ];
    for (const p of candidates) { if (fs.existsSync(p)) return p; }
    return null;
  }

  private rect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color: string) {
    doc.save().rect(x, y, w, h).fill(color).restore();
  }

  private fmt(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val ?? 0);
  }

  private fmtDate(dateStr: string): string {
    if (!dateStr) return '';
    try { return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateStr)); }
    catch { return dateStr; }
  }

  private drawHeader(doc: PDFKit.PDFDocument, W: number, invoice: Invoice) {
    const HEADER_H = 148;
    const MARGIN   = 45;

    // Sfondo indigo con onda
    doc.save();
    doc.moveTo(0, 0).lineTo(0, HEADER_H * 0.74)
       .bezierCurveTo(W * 0.10, HEADER_H * 0.44, W * 0.28, HEADER_H * 0.40, W * 0.48, HEADER_H * 0.54)
       .bezierCurveTo(W * 0.66, HEADER_H * 0.67, W * 0.84, HEADER_H * 0.76, W, HEADER_H * 0.72)
       .lineTo(W, 0).closePath().fill(INDIGO);
    doc.restore();

    const logoPath = this.getLogoPath();
    if (logoPath) {
      try { doc.image(logoPath, MARGIN, 22, { height: 32, fit: [140, 32] }); }
      catch { this.drawLogoText(doc, MARGIN, 24); }
    } else { this.drawLogoText(doc, MARGIN, 24); }

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff')
       .text('QUOTAZIONE', 0, 20, { align: 'right', width: W - MARGIN });

    let lineY = 55;
    doc.font('Helvetica').fontSize(9.5).fillColor('rgba(255,255,255,0.85)');
    doc.text(`Data: ${this.fmtDate(invoice.issueDate)}`,   0, lineY,      { align: 'right', width: W - MARGIN });
    doc.text(`Valido fino al: ${this.fmtDate(invoice.dueDate)}`, 0, lineY + 14, { align: 'right', width: W - MARGIN });

    return HEADER_H;
  }

  private drawLogoText(doc: PDFKit.PDFDocument, x: number, y: number) {
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text('doflow', x, y, { continued: true });
    doc.font('Helvetica').fontSize(22).fillColor('rgba(255,255,255,0.7)').text('~');
  }

  async generatePdf(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const buffers: Buffer[] = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end',  () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const W         = 595.28;
        const H         = 841.89;
        const MARGIN    = 45;
        const CONTENT_W = W - MARGIN * 2;

        const imponibile = Number(invoice.amount) || 0;

        const headerH = this.drawHeader(doc, W, invoice);
        let curY = headerH + 22;

        // ── Emittente / Committente ────────────────────────────────────────
        const colW  = (CONTENT_W - 20) / 2;
        const col1X = MARGIN;
        const col2X = MARGIN + colW + 20;

        const drawPartyBlock = (x: number, y: number, label: string, lines: string[]): number => {
          doc.font('Helvetica-Bold').fontSize(7).fillColor(INDIGO)
             .text(label.toUpperCase(), x, y, { characterSpacing: 1.5 });
          y += 14;
          this.rect(doc, x, y, colW, 1, INDIGO);
          y += 8;
          lines.filter(Boolean).forEach(line => {
            const isBold = line.startsWith('**');
            const text   = isBold ? line.slice(2) : line;
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(isBold ? 11 : 9).fillColor(isBold ? NAVY : TEXT_GRAY)
               .text(text, x, y, { width: colW });
            y += isBold ? 16 : 13;
          });
          return y;
        };

        const emittenteLines = [`**${EMITTENTE.nome}`, `P.IVA: ${EMITTENTE.piva}`, EMITTENTE.email];
        const clienteLines   = [
          `**${invoice.clientName}`,
          invoice.clientAddress,
          [invoice.clientZip, invoice.clientCity].filter(Boolean).join(' '),
          invoice.clientVat        ? `P.IVA: ${invoice.clientVat}`       : '',
          invoice.clientFiscalCode ? `C.F.: ${invoice.clientFiscalCode}` : '',
          invoice.clientSdi        ? `Cod. SDI: ${invoice.clientSdi}`    : '',
          invoice.clientPec        ? `PEC: ${invoice.clientPec}`         : '',
        ];

        const endY1 = drawPartyBlock(col1X, curY, 'Emittente',   emittenteLines);
        const endY2 = drawPartyBlock(col2X, curY, 'Destinatario', clienteLines);
        curY = Math.max(endY1, endY2) + 24;

        // Badge proforma
        doc.save().roundedRect(MARGIN, curY, CONTENT_W, 22, 4).fill(INDIGO + '18').restore();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(INDIGO)
           .text('DOCUMENTO PROFORMA NON FISCALE', MARGIN + 8, curY + 7, { characterSpacing: 0.8 });
        curY += 36;

        // ── Tabella voci ───────────────────────────────────────────────────
        const COL = {
          desc:  { x: MARGIN,       w: 250 },
          qty:   { x: MARGIN + 255, w: 55  },
          price: { x: MARGIN + 315, w: 90  },
          total: { x: MARGIN + 410, w: CONTENT_W - 410 },
        };

        this.rect(doc, MARGIN, curY, CONTENT_W, 22, INDIGO);
        const dh = (label: string, x: number, w: number, align: 'left' | 'right' = 'left') =>
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
             .text(label, x + 4, curY + 7, { width: w - 8, align });
        dh('Descrizione', COL.desc.x,  COL.desc.w);
        dh('Q.tà',        COL.qty.x,   COL.qty.w,   'right');
        dh('Prezzo Un.',  COL.price.x, COL.price.w, 'right');
        dh('Importo',     COL.total.x, COL.total.w, 'right');
        curY += 22;

        const items = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
          ? invoice.lineItems
          : [{ description: 'Servizi', quantity: 1, unitPrice: imponibile, total: imponibile }];

        items.forEach((item, idx) => {
          const rowH     = 22;
          const rowTotal = Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0;
          if (idx % 2 === 0) this.rect(doc, MARGIN, curY, CONTENT_W, rowH, LIGHT_GRAY);
          doc.font('Helvetica').fontSize(9).fillColor(NAVY)
             .text(item.description || '',                COL.desc.x + 4,  curY + 7, { width: COL.desc.w - 8, ellipsis: true });
          doc.text(String(item.quantity ?? 1),            COL.qty.x + 4,   curY + 7, { width: COL.qty.w - 8,   align: 'right' });
          doc.text(this.fmt(Number(item.unitPrice)),      COL.price.x + 4, curY + 7, { width: COL.price.w - 8, align: 'right' });
          doc.text(this.fmt(rowTotal),                    COL.total.x + 4, curY + 7, { width: COL.total.w - 8, align: 'right' });
          curY += rowH;
        });

        this.rect(doc, MARGIN, curY, CONTENT_W, 1, MID_GRAY);
        curY += 20;

        // ── Totale ────────────────────────────────────────────────────────
        const totalsX = W / 2 + 10;
        const totalsW = W - MARGIN - totalsX;

        this.rect(doc, totalsX - 8, curY - 2, totalsW + 8, 22, INDIGO);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
           .text('TOTALE PREVENTIVO:', totalsX, curY, { width: totalsW * 0.55, align: 'left' });
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
           .text(this.fmt(imponibile), totalsX + totalsW * 0.55, curY, { width: totalsW * 0.45, align: 'right' });
        curY += 28;

        // ── Note ──────────────────────────────────────────────────────────
        if (invoice.notes) {
          curY += 12;
          doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_GRAY)
             .text('NOTE E CONDIZIONI', MARGIN, curY, { characterSpacing: 0.8 });
          curY += 14;
          doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_GRAY)
             .text(invoice.notes, MARGIN, curY, { width: CONTENT_W });
        }

        // ── Footer ────────────────────────────────────────────────────────
        const footerY = H - 72;
        this.rect(doc, 0, footerY, W, 1, MID_GRAY);

        const legalText =
          'Documento non fiscale emesso a titolo di preventivo/proforma. Non costituisce fattura ai sensi del D.P.R. 633/1972. ' +
          'Prezzi IVA esclusa (regime forfettario). Valido fino alla data indicata salvo disponibilità.';

        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text(legalText, MARGIN, footerY + 10, { width: CONTENT_W * 0.8, lineGap: 2 });
        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text(`${EMITTENTE.nome} — P.IVA ${EMITTENTE.piva}`, MARGIN, footerY + 38, { align: 'center', width: CONTENT_W });
        doc.text('Documento generato da DoFlow', MARGIN, footerY + 50, { align: 'center', width: CONTENT_W });

        doc.end();
      } catch (err) {
        this.logger.error('Errore generazione PDF preventivo', err);
        reject(err);
      }
    });
  }
}