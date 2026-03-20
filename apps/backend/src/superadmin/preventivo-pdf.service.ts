// Percorso: apps/backend/src/superadmin/finance/preventivo-pdf.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument = require('pdfkit');
import { Invoice } from './entities/invoice.entity';

// --- NUOVA PALETTE COLORI ---
const NAVY        = '#1a2332'; // Blu notte scuro ed elegante
const GOLD        = '#cfa86b'; // Oro/Senape per accenti e bordi
const LIGHT_BEIGE = '#f6f4f0'; // Sfondo per i riquadri (card)
const BORDER_GRAY = '#e5e7eb'; // Grigio chiaro per i bordi neutri
const MID_GRAY    = '#cbd5e1';
const TEXT_GRAY   = '#6b7280';

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
      path.resolve(process.cwd(), '..', 'frontend', 'public', 'logo_pdf.png'),
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
    const HEADER_H = 175; // Altezza maggiorata per abbassare l'onda
    const MARGIN   = 45;

    // 1. Sfondo Blu Notte
    doc.save();
    doc.moveTo(0, 0).lineTo(0, HEADER_H * 0.74)
       .bezierCurveTo(W * 0.10, HEADER_H * 0.44, W * 0.28, HEADER_H * 0.40, W * 0.48, HEADER_H * 0.54)
       .bezierCurveTo(W * 0.66, HEADER_H * 0.67, W * 0.84, HEADER_H * 0.76, W, HEADER_H * 0.72)
       .lineTo(W, 0).closePath().fill(NAVY);
    
    // 2. Linea dorata sul bordo curvo
    doc.moveTo(0, HEADER_H * 0.74)
       .bezierCurveTo(W * 0.10, HEADER_H * 0.44, W * 0.28, HEADER_H * 0.40, W * 0.48, HEADER_H * 0.54)
       .bezierCurveTo(W * 0.66, HEADER_H * 0.67, W * 0.84, HEADER_H * 0.76, W, HEADER_H * 0.72)
       .lineWidth(3).stroke(GOLD);
    doc.restore();

    const logoPath = this.getLogoPath();
    if (logoPath) {
      // Logo ingrandito
      try { doc.image(logoPath, MARGIN, 25, { height: 42, fit: [180, 42] }); }
      catch { this.drawLogoText(doc, MARGIN, 28); }
    } else { 
      this.drawLogoText(doc, MARGIN, 28); 
    }

    // Titolo in Oro
    doc.font('Helvetica-Bold').fontSize(22).fillColor(GOLD)
       .text('QUOTAZIONE', 0, 25, { align: 'right', width: W - MARGIN });

    let lineY = 60;
    doc.font('Helvetica').fontSize(9.5).fillColor('rgba(255,255,255,0.85)');
    doc.text(`Data: ${this.fmtDate(invoice.issueDate)}`,   0, lineY,      { align: 'right', width: W - MARGIN });
    doc.text(`Valido fino al: ${this.fmtDate(invoice.dueDate)}`, 0, lineY + 14, { align: 'right', width: W - MARGIN });

    return HEADER_H;
  }

  private drawLogoText(doc: PDFKit.PDFDocument, x: number, y: number) {
    doc.font('Helvetica-Bold').fontSize(26).fillColor('#ffffff').text('doflow', x, y, { continued: true });
    doc.font('Helvetica').fontSize(26).fillColor('rgba(255,255,255,0.7)').text('~');
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

        // ── DISEGNO BOX ANAGRAFICHE ────────────────────────────────────────
        const colW  = (CONTENT_W - 20) / 2;
        const col1X = MARGIN;
        const col2X = MARGIN + colW + 20;

        const drawPartyBlock = (x: number, y: number, label: string, lines: string[]): number => {
          const padding = 12;
          const boxH = 95;
          
          doc.save()
             .roundedRect(x, y, colW, boxH, 8)
             .lineWidth(1)
             .fillAndStroke(LIGHT_BEIGE, BORDER_GRAY)
             .restore();

          let textY = y + padding;
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GOLD)
             .text(label.toUpperCase(), x + padding, textY, { characterSpacing: 1.2 });
          
          textY += 14;
          this.rect(doc, x + padding, textY, colW - (padding * 2), 1, BORDER_GRAY);
          textY += 8;

          lines.filter(Boolean).forEach(line => {
            const isBold = line.startsWith('**');
            const text   = isBold ? line.slice(2) : line;
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(isBold ? 10 : 9).fillColor(NAVY)
               .text(text, x + padding, textY, { width: colW - (padding * 2) });
            textY += isBold ? 16 : 13;
          });
          return y + boxH;
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
        curY = Math.max(endY1, endY2) + 20;

        // ── TABELLA VOCI ───────────────────────────────────────────────────
        const COL = {
          desc:  { x: MARGIN,       w: 250 },
          qty:   { x: MARGIN + 255, w: 55  },
          price: { x: MARGIN + 315, w: 90  },
          total: { x: MARGIN + 410, w: CONTENT_W - 410 },
        };

        // Header Tabella
        doc.save().roundedRect(MARGIN, curY, CONTENT_W, 22, 6).fill(NAVY).restore();
        const dh = (label: string, x: number, w: number, align: 'left' | 'right' = 'left') =>
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
             .text(label, x + 8, curY + 7, { width: w - 16, align });
        
        dh('Descrizione', COL.desc.x,  COL.desc.w);
        dh('Q.tà',        COL.qty.x,   COL.qty.w,   'right');
        dh('Prezzo Un.',  COL.price.x, COL.price.w, 'right');
        dh('Importo',     COL.total.x, COL.total.w, 'right');
        curY += 26;

        const items = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
          ? invoice.lineItems
          : [{ description: 'Servizi', quantity: 1, unitPrice: imponibile, total: imponibile }];

        items.forEach((item, idx) => {
          const rowH     = 24;
          const rowTotal = Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0;
          
          doc.font('Helvetica').fontSize(9).fillColor(NAVY)
             .text(item.description || '',            COL.desc.x + 8,  curY + 7, { width: COL.desc.w - 16, ellipsis: true });
          doc.text(String(item.quantity ?? 1),        COL.qty.x + 8,   curY + 7, { width: COL.qty.w - 16,   align: 'right' });
          doc.text(this.fmt(Number(item.unitPrice)),  COL.price.x + 8, curY + 7, { width: COL.price.w - 16, align: 'right' });
          doc.text(this.fmt(rowTotal),                COL.total.x + 8, curY + 7, { width: COL.total.w - 16, align: 'right' });
          curY += rowH;
          
          // Linea separatrice punteggiata per ogni riga
          doc.save().moveTo(MARGIN, curY).lineTo(MARGIN + CONTENT_W, curY).dash(2, { space: 2 }).lineWidth(0.5).stroke(MID_GRAY).restore();
          curY += 8;
        });

        curY += 12;

        // ── BOX TOTALI (Allineato a destra) ────────────────────────────────────────
        const boxW = 250;
        const boxX = MARGIN + CONTENT_W - boxW; 
        const boxPadding = 12;
        const totalsBoxH = 18 + 8 + 24 + (boxPadding * 2) - 10; // Altezza calcolata per 2 righe

        doc.save()
           .roundedRect(boxX, curY, boxW, totalsBoxH, 6)
           .lineWidth(1)
           .fillAndStroke(LIGHT_BEIGE, GOLD)
           .restore();

        let ty = curY + boxPadding;

        const drawRow = (label: string, value: string, bold = false) => {
          const color = NAVY;
          const size  = bold ? 11 : 9;
          const innerW = boxW - (boxPadding * 2);
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
             .text(label, boxX + boxPadding, ty, { width: innerW * 0.55, align: 'left' });
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
             .text(value, boxX + boxPadding + innerW * 0.55, ty, { width: innerW * 0.45, align: 'right' });
          ty += bold ? 24 : 18;
        };

        drawRow('Imponibile:', this.fmt(imponibile));
        
        // Linea separatrice pre-totale dentro il box
        this.rect(doc, boxX + boxPadding, ty, boxW - (boxPadding * 2), 1, BORDER_GRAY);
        ty += 8;

        drawRow('TOTALE PREVENTIVO:', this.fmt(imponibile), true);
        
        curY += totalsBoxH + 20;

        // ── NOTE E CONDIZIONI ──────────────────────────────────────────
        if (invoice.notes) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GOLD)
             .text('NOTE E CONDIZIONI', MARGIN, curY, { characterSpacing: 1.2 });
          curY += 14;
          doc.font('Helvetica').fontSize(9).fillColor(NAVY)
             .text(invoice.notes, MARGIN, curY, { width: CONTENT_W, lineGap: 2 });
        }

        // ── FOOTER ────────────────────────────────────────────────────────
        const footerY = H - 90;

        // Inserimento del logo immagine sopra il footer
        const footerLogoCandidates = [
          'C:\\Doflow\\apps\\frontend\\public\\logo_footer.png',
          path.resolve(process.cwd(), '..', 'frontend', 'public', 'logo_footer.png'),
          path.resolve(process.cwd(), '..', '..', 'apps', 'frontend', 'public', 'logo_footer.png'),
          path.resolve(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'logo_footer.png')
        ];

        let footerLogoPath = null;
        for (const p of footerLogoCandidates) {
          if (fs.existsSync(p)) {
            footerLogoPath = p;
            break;
          }
        }

        if (footerLogoPath) {
            const logoW = 80;
            doc.image(footerLogoPath, (W - logoW) / 2, footerY - 35, { width: logoW });
        } else {
            this.logger.warn('Logo footer non trovato. Ricontrolla la posizione del file logo_footer.png');
            doc.font('Helvetica-Bold').fontSize(16).fillColor(MID_GRAY)
               .text('doflow~', 0, footerY - 30, { align: 'center', width: W });
        }

        this.rect(doc, MARGIN, footerY, CONTENT_W, 1, BORDER_GRAY);

        const legalText =
          "Documento non fiscale emesso a titolo di preventivo/proforma. Non costituisce fattura ai sensi del D.P.R. 633/1972. " +
          "IVA non applicabile ai sensi dell'art. 1, commi 54-89, Legge 190/2014. Valido fino alla data indicata salvo disponibilità.";

        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text(legalText, MARGIN, footerY + 12, { width: CONTENT_W, lineGap: 2 });
        
        doc.font('Helvetica-Bold').fontSize(7).fillColor(NAVY)
           .text(`${EMITTENTE.nome} — P.IVA ${EMITTENTE.piva}`, MARGIN, footerY + 38, { align: 'center', width: CONTENT_W });

        doc.end();
      } catch (err) {
        this.logger.error('Errore generazione PDF preventivo', err);
        reject(err);
      }
    });
  }
}