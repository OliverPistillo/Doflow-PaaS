import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument = require('pdfkit');
import { Invoice, TaxRegime } from './entities/invoice.entity';

// ── Palette ──────────────────────────────────────────────────────────────────
const NAVY        = '#0d1b2e';   // Header background — come screenshot
const ACCENT      = '#4f46e5';   // Indigo per etichette e accenti
const LIGHT_GRAY  = '#f8f8f8';
const MID_GRAY    = '#e2e8f0';
const TEXT_GRAY   = '#6b7280';
const STAMP_DUTY_AMOUNT    = 2.00;
const STAMP_DUTY_THRESHOLD = 77.47;

// Dati emittente
const EMITTENTE = {
  nome:      'Oliver Pistillo',
  indirizzo: 'Via Alberto De Falco, 17',
  cap_citta: '71016 San Severo FG',
  piva:      'IT04558810711',
  cf:        'PSTLVR92R21I158I',
  email:     'fatture@doflow.it',
  iban:      'IT63E0338501601100080304679',
};

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  private getLogoPath(): string | null {
    const candidates = [
      path.resolve(process.cwd(), '..', 'frontend', 'public', 'logo_doflow_bianco.png'),
      path.resolve(process.cwd(), '..', '..', 'apps', 'frontend', 'public', 'logo_doflow_bianco.png'),
      path.resolve(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'logo_doflow_bianco.png'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
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

  // ── Disegna header con onda ─────────────────────────────────────────────
  private drawHeader(doc: PDFKit.PDFDocument, W: number, invoice: Invoice) {
    const HEADER_H = 148; // altezza totale banda header

    // 1. Sfondo navy sagomato con onda in basso (taglio bianco)
    doc.save();
    doc.moveTo(0, 0)                          // Partenza: angolo in alto a sinistra
       .lineTo(0, HEADER_H * 0.74)            // Scende lungo il bordo sinistro
       .bezierCurveTo(                        // Disegna la curva
         W * 0.10, HEADER_H * 0.44,
         W * 0.28, HEADER_H * 0.40,
         W * 0.48, HEADER_H * 0.54,
       )
       .bezierCurveTo(
         W * 0.66, HEADER_H * 0.67,
         W * 0.84, HEADER_H * 0.76,
         W,        HEADER_H * 0.72,
       )
       .lineTo(W, 0)                          // Risale lungo il bordo destro
       .closePath()                           // Chiude il tracciato in alto
       .fill(NAVY);                           // Riempie tutto di NAVY
    doc.restore();

    // 2. Logo "doflow~" — testo bianco (oppure immagine se disponibile)
    const MARGIN = 45;
    const logoPath = this.getLogoPath();
    if (logoPath) {
      try {
        doc.image(logoPath, MARGIN, 22, { height: 32, fit: [140, 32] });
      } catch {
        this.drawLogoText(doc, MARGIN, 24);
      }
    } else {
      this.drawLogoText(doc, MARGIN, 24);
    }

    // 3. "FATTURA" + dettagli — in alto a destra
    doc.font('Helvetica-Bold').fontSize(26).fillColor('#ffffff')
       .text('FATTURA', 0, 20, { align: 'right', width: W - MARGIN });

    doc.font('Helvetica').fontSize(9.5).fillColor('rgba(255,255,255,0.80)');
    doc.text(`N. ${invoice.invoiceNumber}`,          0, 55, { align: 'right', width: W - MARGIN });
    doc.text(`Data: ${this.fmtDate(invoice.issueDate)}`,     0, 69, { align: 'right', width: W - MARGIN });
    doc.text(`Scadenza: ${this.fmtDate(invoice.dueDate)}`,   0, 83, { align: 'right', width: W - MARGIN });

    return HEADER_H;
  }

  // Fallback testo "doflow~" se il logo PNG non è disponibile
  private drawLogoText(doc: PDFKit.PDFDocument, x: number, y: number) {
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text('doflow', x, y, { continued: true });
    doc.font('Helvetica').fontSize(22).fillColor('rgba(255,255,255,0.7)').text('~');
  }

  // ── Generatore principale ─────────────────────────────────────────────────
  async generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end',  () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const W      = 595.28;
        const H      = 841.89;
        const MARGIN = 45;
        const CONTENT_W = W - MARGIN * 2;

        // ── CALCOLI FISCALI ───────────────────────────────────────────────
        const isForfettario  = invoice.taxRegime === TaxRegime.FORFETTARIO;
        const imponibile     = Number(invoice.amount) || 0;
        const taxRate        = isForfettario ? 0 : (Number(invoice.taxRate) || 22);
        const inpsRate       = Number(invoice.inpsRate)    || 0;
        const ritenutaRate   = Number(invoice.ritenutaRate) || 0;

        const inpsAmount     = imponibile * inpsRate / 100;
        const baseConInps    = imponibile + inpsAmount;
        const ivaAmount      = isForfettario ? 0 : baseConInps * taxRate / 100;
        const ritenutaAmount = imponibile * ritenutaRate / 100;
        const stampAmount    = (invoice.stampDuty || (isForfettario && imponibile > STAMP_DUTY_THRESHOLD)) ? STAMP_DUTY_AMOUNT : 0;
        const totaleLordo    = baseConInps + ivaAmount + stampAmount;
        const totaleNetto    = totaleLordo - ritenutaAmount;

        // ── HEADER con onda ───────────────────────────────────────────────
        const headerH = this.drawHeader(doc, W, invoice);
        let curY = headerH + 22;

        // ── SEZIONE EMITTENTE / COMMITTENTE ──────────────────────────────
        const colW = (CONTENT_W - 20) / 2;
        const col1X = MARGIN;
        const col2X = MARGIN + colW + 20;

        const drawPartyBlock = (x: number, y: number, label: string, lines: string[]): number => {
          doc.font('Helvetica-Bold').fontSize(7).fillColor(ACCENT)
             .text(label.toUpperCase(), x, y, { characterSpacing: 1.5 });
          y += 14;
          this.rect(doc, x, y, colW, 1, ACCENT);
          y += 8;
          lines.filter(Boolean).forEach(line => {
            const isBold = line.startsWith('**');
            const text   = isBold ? line.slice(2) : line;
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(isBold ? 11 : 9)
               .fillColor(isBold ? NAVY : TEXT_GRAY)
               .text(text, x, y, { width: colW });
            y += isBold ? 16 : 13;
          });
          return y;
        };

        const emittenteLines = [
          `**${EMITTENTE.nome}`,
          EMITTENTE.indirizzo,
          EMITTENTE.cap_citta,
          `P.IVA: ${EMITTENTE.piva}`,
          `C.F.: ${EMITTENTE.cf}`,
          EMITTENTE.email,
          EMITTENTE.iban ? `IBAN: ${EMITTENTE.iban}` : '',
        ];

        const clienteLines = [
          `**${invoice.clientName}`,
          invoice.clientAddress,
          [invoice.clientZip, invoice.clientCity].filter(Boolean).join(' '),
          invoice.clientVat        ? `P.IVA: ${invoice.clientVat}`        : '',
          invoice.clientFiscalCode ? `C.F.: ${invoice.clientFiscalCode}`  : '',
          invoice.clientSdi        ? `Cod. SDI: ${invoice.clientSdi}`     : '',
          invoice.clientPec        ? `PEC: ${invoice.clientPec}`          : '',
        ];

        const endY1 = drawPartyBlock(col1X, curY, 'Emittente',    emittenteLines);
        const endY2 = drawPartyBlock(col2X, curY, 'Committente',  clienteLines);
        curY = Math.max(endY1, endY2) + 24;

        // ── REGIME FISCALE (badge) ────────────────────────────────────────
        // Per il forfettario: "REGIME IVA NON APPLICABILE" (non la citazione di legge)
        const regimeBadge = isForfettario
          ? 'Regime IVA non applicabile'
          : `Regime Ordinario — IVA ${taxRate}%`;
        const badgeColor = isForfettario ? '#f59e0b' : ACCENT;

        doc.save().roundedRect(MARGIN, curY, CONTENT_W, 22, 4).fill(badgeColor + '22').restore();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(badgeColor)
           .text(regimeBadge.toUpperCase(), MARGIN + 8, curY + 7, { characterSpacing: 0.8 });
        curY += 36;

        // ── TABELLA VOCI ─────────────────────────────────────────────────
        const COL = {
          desc:  { x: MARGIN,         w: 200 },
          qty:   { x: MARGIN + 205,   w: 55  },
          price: { x: MARGIN + 265,   w: 80  },
          iva:   { x: MARGIN + 350,   w: 50  },
          total: { x: MARGIN + 405,   w: CONTENT_W - 405 },
        };

        // Header tabella
        this.rect(doc, MARGIN, curY, CONTENT_W, 22, NAVY);
        const dh = (label: string, x: number, w: number, align: 'left'|'right' = 'left') =>
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
             .text(label, x + 4, curY + 7, { width: w - 8, align });
        dh('Descrizione',  COL.desc.x,  COL.desc.w);
        dh('Q.tà',         COL.qty.x,   COL.qty.w,   'right');
        dh('Prezzo Un.',   COL.price.x, COL.price.w, 'right');
        dh('IVA %',        COL.iva.x,   COL.iva.w,   'right');
        dh('Importo',      COL.total.x, COL.total.w, 'right');
        curY += 22;

        const items = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
          ? invoice.lineItems
          : [{ description: 'Servizi DoFlow', quantity: 1, unitPrice: imponibile, total: imponibile }];

        items.forEach((item, idx) => {
          const rowH    = 22;
          const rowTotal = Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0;
          if (idx % 2 === 0) this.rect(doc, MARGIN, curY, CONTENT_W, rowH, LIGHT_GRAY);
          doc.font('Helvetica').fontSize(9).fillColor(NAVY)
             .text(item.description || '', COL.desc.x + 4,  curY + 7, { width: COL.desc.w - 8,  ellipsis: true });
          doc.text(String(item.quantity ?? 1),               COL.qty.x + 4,   curY + 7, { width: COL.qty.w - 8,   align: 'right' });
          doc.text(this.fmtCurrency(Number(item.unitPrice)), COL.price.x + 4, curY + 7, { width: COL.price.w - 8, align: 'right' });
          doc.text(isForfettario ? 'Esente' : `${taxRate}%`, COL.iva.x + 4,   curY + 7, { width: COL.iva.w - 8,   align: 'right' });
          doc.text(this.fmtCurrency(rowTotal),               COL.total.x + 4, curY + 7, { width: COL.total.w - 8, align: 'right' });
          curY += rowH;
        });

        this.rect(doc, MARGIN, curY, CONTENT_W, 1, MID_GRAY);
        curY += 20;

        // ── BOX TOTALI ───────────────────────────────────────────────────
        const totalsX = W / 2 + 10;
        const totalsW = W - MARGIN - totalsX;

        const drawRow = (label: string, value: string, bold = false, highlight = false) => {
          if (highlight) this.rect(doc, totalsX - 8, curY - 2, totalsW + 8, 22, NAVY);
          const color = highlight ? '#ffffff' : (bold ? NAVY : TEXT_GRAY);
          const size  = bold ? 10 : 9;
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
             .text(label, totalsX, curY, { width: totalsW * 0.55, align: 'left' });
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
             .text(value, totalsX + totalsW * 0.55, curY, { width: totalsW * 0.45, align: 'right' });
          curY += bold ? 24 : 18;
        };

        drawRow('Imponibile:', this.fmtCurrency(imponibile));
        if (inpsAmount   > 0) drawRow(`Rivalsa INPS (${inpsRate}%):`, this.fmtCurrency(inpsAmount));
        if (!isForfettario)   drawRow(`IVA (${taxRate}%):`,            this.fmtCurrency(ivaAmount));
        if (stampAmount  > 0) drawRow('Marca da Bollo:',               this.fmtCurrency(stampAmount));
        if (ritenutaAmount > 0) {
          this.rect(doc, totalsX - 8, curY - 2, totalsW + 8, 18, '#fff7ed');
          drawRow(`Ritenuta d'Acconto (${ritenutaRate}%):`, `-${this.fmtCurrency(ritenutaAmount)}`);
        }

        this.rect(doc, totalsX - 8, curY - 2, totalsW + 8, 1, MID_GRAY);
        curY += 6;
        drawRow('TOTALE DA PAGARE:', this.fmtCurrency(totaleNetto), true, true);

        // ── NOTE ─────────────────────────────────────────────────────────
        curY += 20;
        if (invoice.notes) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_GRAY)
             .text('NOTE / CONDIZIONI DI PAGAMENTO', MARGIN, curY, { characterSpacing: 0.8 });
          curY += 14;
          doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_GRAY)
             .text(invoice.notes, MARGIN, curY, { width: W / 2 - 20 });
        }

        // ── FOOTER ───────────────────────────────────────────────────────
        const footerY = H - 72;
        this.rect(doc, 0, footerY, W, 1, MID_GRAY);

        let legalText = '';
        if (isForfettario) {
          // Dicitura corretta: non cita la Legge ma descrive il regime
          legalText =
            'Operazione effettuata da soggetto in regime fiscale di vantaggio — IVA non applicabile. ' +
            (stampAmount > 0
              ? 'Imposta di bollo assolta sull\'originale (D.P.R. 642/1972).'
              : 'Documento non soggetto a marca da bollo (importo ≤ €77,47).');
        } else {
          legalText = `Documento soggetto ad IVA al ${taxRate}% ai sensi del D.P.R. 633/1972.`;
          if (ritenutaAmount > 0)
            legalText += ` Ritenuta d'acconto del ${ritenutaRate}% a carico del committente.`;
        }

        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text(legalText, MARGIN, footerY + 10, { width: CONTENT_W * 0.75, lineGap: 2 });
        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text(`${EMITTENTE.nome} — P.IVA ${EMITTENTE.piva}`, MARGIN, footerY + 38, { align: 'center', width: CONTENT_W });
        doc.text('Documento generato da DoFlow', MARGIN, footerY + 50, { align: 'center', width: CONTENT_W });

        doc.end();
      } catch (err) {
        this.logger.error('Errore generazione PDF', err);
        reject(err);
      }
    });
  }
}
