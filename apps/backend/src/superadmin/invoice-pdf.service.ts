import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument = require('pdfkit');
import { Invoice, TaxRegime } from './entities/invoice.entity';

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
  iban:  'IT63E0338501601100080304679',
};

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  private getLogoPath(): string | null {
    const candidates = [
      path.resolve(process.cwd(), '..', 'frontend', 'public', 'logo_pdf.png'),
      path.resolve(process.cwd(), '..', '..', 'apps', 'frontend', 'public', 'logo_pdf.png'),
      path.resolve(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'logo_pdf.png'),
    ];
    for (const p of candidates) { if (fs.existsSync(p)) return p; }
    return null;
  }

  private rect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color: string) {
    doc.save().rect(x, y, w, h).fill(color).restore();
  }

  private fmtCurrency(val: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val ?? 0);
  }

  private fmtDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateStr));
    } catch { return dateStr; }
  }

  private drawHeader(doc: PDFKit.PDFDocument, W: number, invoice: Invoice, docLabel: string) {
    const HEADER_H = 148;
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
      try { doc.image(logoPath, MARGIN, 22, { height: 32, fit: [140, 32] }); }
      catch { this.drawLogoText(doc, MARGIN, 24); }
    } else {
      this.drawLogoText(doc, MARGIN, 24);
    }

    // Titolo in Oro
    doc.font('Helvetica-Bold').fontSize(22).fillColor(GOLD)
       .text(docLabel, 0, 20, { align: 'right', width: W - MARGIN });

    let lineY = 55;
    doc.font('Helvetica').fontSize(9.5).fillColor('rgba(255,255,255,0.85)');
    if (invoice.invoiceNumber) {
      doc.text(`N. ${invoice.invoiceNumber}`, 0, lineY, { align: 'right', width: W - MARGIN });
      lineY += 14;
    }
    doc.text(`Data: ${this.fmtDate(invoice.issueDate)}`,   0, lineY,      { align: 'right', width: W - MARGIN });
    doc.text(`Scadenza: ${this.fmtDate(invoice.dueDate)}`, 0, lineY + 14, { align: 'right', width: W - MARGIN });

    return HEADER_H;
  }

  private drawLogoText(doc: PDFKit.PDFDocument, x: number, y: number) {
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text('doflow', x, y, { continued: true });
    doc.font('Helvetica').fontSize(22).fillColor('rgba(255,255,255,0.7)').text('~');
  }

  async generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const buffers: Buffer[] = [];
        doc.on('data',  (chunk) => buffers.push(chunk));
        doc.on('end',   () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const W         = 595.28;
        const H         = 841.89;
        const MARGIN    = 45;
        const CONTENT_W = W - MARGIN * 2;

        const docLabel = 'PREVENTIVO'; // o PROFORMA

        const isForfettario  = invoice.taxRegime === TaxRegime.FORFETTARIO;
        const imponibile     = Number(invoice.amount)       || 0;
        const taxRate        = isForfettario ? 0 : (Number(invoice.taxRate) || 22);
        const inpsRate       = Number(invoice.inpsRate)     || 0;
        const ritenutaRate   = Number(invoice.ritenutaRate) || 0;

        const inpsAmount     = imponibile * inpsRate / 100;
        const baseConInps    = imponibile + inpsAmount;
        const ivaAmount      = isForfettario ? 0 : baseConInps * taxRate / 100;
        const ritenutaAmount = imponibile * ritenutaRate / 100;
        const totaleLordo    = baseConInps + ivaAmount;
        const totaleNetto    = totaleLordo - ritenutaAmount;


        const headerH = this.drawHeader(doc, W, invoice, docLabel);
        let curY = headerH + 22;

        const colW  = (CONTENT_W - 20) / 2;
        const col1X = MARGIN;
        const col2X = MARGIN + colW + 20;

        // --- DISEGNO BOX ANAGRAFICHE ---
        const drawPartyBlock = (x: number, y: number, label: string, lines: string[]): number => {
          const padding = 12;
          const boxH = 95; // Altezza fissa per simmetria o calcolabile dinamicamente
          
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
               .fontSize(isBold ? 10 : 9).fillColor(isBold ? NAVY : NAVY) // Tutto blu notte nei box
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
        const endY2 = drawPartyBlock(col2X, curY, 'Committente', clienteLines);
        curY = Math.max(endY1, endY2) + 20;

        // --- BADGE (Banner Dorato) ---
        const regimeBadge = 'DOCUMENTO PROFORMA NON FISCALE';
        doc.save().roundedRect(MARGIN, curY, CONTENT_W, 24, 6).fill(GOLD).restore();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY)
           .text(regimeBadge, MARGIN + 12, curY + 8, { characterSpacing: 0.8 });
        curY += 38;

        // --- TABELLA VOCI ---
        const COL = {
          desc:  { x: MARGIN,       w: 200 },
          qty:   { x: MARGIN + 205, w: 55  },
          price: { x: MARGIN + 265, w: 80  },
          iva:   { x: MARGIN + 350, w: 50  },
          total: { x: MARGIN + 405, w: CONTENT_W - 405 },
        };

        // Header Tabella
        doc.save().roundedRect(MARGIN, curY, CONTENT_W, 22, 6).fill(NAVY).restore();
        const dh = (label: string, x: number, w: number, align: 'left' | 'right' = 'left') =>
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
             .text(label, x + 8, curY + 7, { width: w - 16, align });
        
        dh('Descrizione', COL.desc.x, COL.desc.w);
        dh('Q.tà',        COL.qty.x,   COL.qty.w,   'right');
        dh('Prezzo Un.',  COL.price.x, COL.price.w, 'right');
        dh('IVA %',       COL.iva.x,   COL.iva.w,   'right');
        dh('Importo',     COL.total.x, COL.total.w, 'right');
        curY += 26;

        const items = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
          ? invoice.lineItems
          : [{ description: 'Servizio piattaforma DoFlow', quantity: 1, unitPrice: imponibile, total: imponibile }];

        items.forEach((item, idx) => {
          const rowH     = 24;
          const rowTotal = Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0;
          
          doc.font('Helvetica').fontSize(9).fillColor(NAVY)
             .text(item.description || '',                  COL.desc.x + 8,  curY + 7, { width: COL.desc.w - 16,  ellipsis: true });
          doc.text(String(item.quantity ?? 1),              COL.qty.x + 8,   curY + 7, { width: COL.qty.w - 16,   align: 'right' });
          doc.text(this.fmtCurrency(Number(item.unitPrice)),COL.price.x + 8, curY + 7, { width: COL.price.w - 16, align: 'right' });
          doc.text(isForfettario ? 'Esente' : `${taxRate}%`,COL.iva.x + 8,   curY + 7, { width: COL.iva.w - 16,   align: 'right' });
          doc.text(this.fmtCurrency(rowTotal),              COL.total.x + 8, curY + 7, { width: COL.total.w - 16, align: 'right' });
          curY += rowH;
          
          // Linea separatrice punteggiata per ogni riga
          doc.save().moveTo(MARGIN, curY).lineTo(MARGIN + CONTENT_W, curY).dash(2, { space: 2 }).lineWidth(0.5).stroke(MID_GRAY).restore();
          curY += 8;
        });

        curY += 12;

        // --- BOX TOTALI ---
        const boxW = 250; // Larghezza fissa per il box dei totali
        const boxX = MARGIN + CONTENT_W - boxW; // Bordo destro perfettamente allineato
        const boxPadding = 12;

        // Calcolo dinamico altezza box totali
        let totalsRowsCount = 1; 
        if (inpsAmount > 0) totalsRowsCount++;
        if (!isForfettario) totalsRowsCount++;
        if (ritenutaAmount > 0) totalsRowsCount++;
        const totalsBoxH = (totalsRowsCount * 18) + 6 + 24 + (boxPadding * 2) - 10;

        // Sfondo Box Totali
        doc.save()
           .roundedRect(boxX, curY - boxPadding, boxW, totalsBoxH, 6)
           .lineWidth(1)
           .fillAndStroke(LIGHT_BEIGE, GOLD)
           .restore();

        const drawRow = (label: string, value: string, bold = false) => {
          const color = NAVY;
          const size  = bold ? 11 : 9;
          const innerW = boxW - (boxPadding * 2);
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
             .text(label, boxX + boxPadding, curY, { width: innerW * 0.55, align: 'left' });
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
             .text(value, boxX + boxPadding + innerW * 0.55, curY, { width: innerW * 0.45, align: 'right' });
          curY += bold ? 24 : 18;
        };

        drawRow('Imponibile:', this.fmtCurrency(imponibile));
        if (inpsAmount > 0)     drawRow(`Rivalsa INPS (${inpsRate}%):`,           this.fmtCurrency(inpsAmount));
        if (!isForfettario)     drawRow(`IVA (${taxRate}%):`,                     this.fmtCurrency(ivaAmount));
        if (ritenutaAmount > 0) drawRow(`Ritenuta (${ritenutaRate}%):`, `-${this.fmtCurrency(ritenutaAmount)}`);

        // Linea separatrice pre-totale dentro il box
        this.rect(doc, boxX + boxPadding, curY, boxW - (boxPadding * 2), 1, BORDER_GRAY);
        curY += 8;

        const totalLabel = 'TOTALE PREVENTIVO:';
        drawRow(totalLabel, this.fmtCurrency(totaleNetto), true);
        
        curY += boxPadding; // Esci dal box

        // --- IBAN ---
        curY += 16;
        const ibanBoxH = 44;
        doc.save().roundedRect(MARGIN, curY, CONTENT_W * 0.55, ibanBoxH, 6).fill(LIGHT_BEIGE).restore();
        doc.font('Helvetica-Bold').fontSize(7).fillColor(GOLD)
           .text('DATI PER IL PAGAMENTO', MARGIN + 10, curY + 8, { characterSpacing: 1.2 });
        doc.font('Helvetica').fontSize(9).fillColor(NAVY)
           .text(`IBAN: ${EMITTENTE.iban}`, MARGIN + 10, curY + 22, { width: CONTENT_W * 0.55 - 20 });
        curY += ibanBoxH + 8;

        // --- FOOTER ---
        const footerY = H - 90;

        // Risoluzione dinamica del path (come per l'header)
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
            const logoW = 80; // Larghezza del logo
            // L'immagine viene posizionata al centro, appena sopra la linea grigia
            doc.image(footerLogoPath, (W - logoW) / 2, footerY - 35, { width: logoW });
        } else {
            // Se non lo trova, lascia un log per farti capire il problema
            this.logger.warn('Logo footer non trovato. Ricontrolla la posizione del file logo_footer.png');
            
            // Fallback testuale opzionale (puoi anche rimuovere questo else se non vuoi scritte)
            doc.font('Helvetica-Bold').fontSize(16).fillColor(MID_GRAY)
               .text('doflow~', 0, footerY - 30, { align: 'center', width: W });
        }

        this.rect(doc, MARGIN, footerY, CONTENT_W, 1, BORDER_GRAY);

        let legalText = '';
        if (isForfettario) {
          legalText = "Operazione effettuata da soggetto in regime fiscale di vantaggio — IVA non applicabile ai sensi dell'art. 1, commi 54-89, Legge 190/2014.";
        } else {
          legalText = `Documento soggetto ad IVA al ${taxRate}% ai sensi del D.P.R. 633/1972.`;
          if (ritenutaAmount > 0) legalText += ` Ritenuta d'acconto del ${ritenutaRate}% a carico del committente.`;
        }
        legalText += ' Valido 30 giorni dalla data di emissione salvo disponibilità.';

        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text(legalText, MARGIN, footerY + 12, { width: CONTENT_W, lineGap: 2 });
        
        doc.font('Helvetica-Bold').fontSize(7).fillColor(NAVY)
           .text(`${EMITTENTE.nome} — P.IVA ${EMITTENTE.piva}`, MARGIN, footerY + 38, { align: 'center', width: CONTENT_W });
        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text('Documento generato da DoFlow', MARGIN, footerY + 48, { align: 'center', width: CONTENT_W });

        doc.end();
      } catch (err) {
        this.logger.error('Errore generazione PDF', err);
        reject(err);
      }
    });
  }
}