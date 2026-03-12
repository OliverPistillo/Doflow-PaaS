import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument = require('pdfkit');
import { Invoice, TaxRegime } from './entities/invoice.entity';

// ── Costanti fiscali italiane ────────────────────────────────────────────────
const STAMP_DUTY_AMOUNT = 2.00;
const STAMP_DUTY_THRESHOLD = 77.47;
const PRIMARY_COLOR = '#1a1a2e';      // Molto scuro (quasi nero)
const ACCENT_COLOR  = '#4f46e5';      // Indigo
const LIGHT_GRAY    = '#f8f8f8';
const MID_GRAY      = '#e5e5e5';
const TEXT_GRAY     = '#6b7280';

// Dati emittente — in futuro leggere da tabella settings
const EMITTENTE = {
  nome:        'Oliver Pistillo',
  indirizzo:   'Via Alberto De Falco, 17',
  cap_citta:   '71016 San Severo FG',
  piva:        'IT04558810711',
  cf:          'PSTLVR92R21I158I',
  email:       'fatture@doflow.it',
  iban:        'IT63E0338501601100080304679',
};

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  // ── Resolve logo ────────────────────────────────────────────────────────────
  private getLogoPath(): string | null {
    // Il logo si trova in apps/frontend/public/ mentre il backend è in apps/backend/
    const candidates = [
      path.resolve(process.cwd(), '..', 'frontend', 'public', 'logo_doflow_bianco.png'),
      path.resolve(process.cwd(), '..', '..', 'apps', 'frontend', 'public', 'logo_doflow_bianco.png'),
      path.resolve(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'logo_doflow_bianco.png'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    this.logger.warn('Logo non trovato, generazione senza logo.');
    return null;
  }

  // ── Utilità disegno ──────────────────────────────────────────────────────────
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

  // ── Generatore principale ─────────────────────────────────────────────────────
  async generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end',  () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const W = 595.28; // larghezza A4 pt
        const H = 841.89; // altezza A4 pt
        const MARGIN = 45;
        const CONTENT_W = W - MARGIN * 2;

        // ── CALCOLI FISCALI ──────────────────────────────────────────────────
        const isForfettario = invoice.taxRegime === TaxRegime.FORFETTARIO;
        const imponibile    = Number(invoice.amount) || 0;
        const taxRate       = isForfettario ? 0 : (Number(invoice.taxRate) || 22);
        const inpsRate      = Number(invoice.inpsRate) || 0;
        const ritenutaRate  = Number(invoice.ritenutaRate) || 0;

        const inpsAmount    = imponibile * inpsRate / 100;
        const baseConInps   = imponibile + inpsAmount;
        const ivaAmount     = isForfettario ? 0 : baseConInps * taxRate / 100;
        const ritenutaAmount= imponibile * ritenutaRate / 100;
        const stampAmount   = (invoice.stampDuty || (isForfettario && imponibile > STAMP_DUTY_THRESHOLD)) ? STAMP_DUTY_AMOUNT : 0;
        const totaleLordo   = baseConInps + ivaAmount + stampAmount;
        const totaleNetto   = totaleLordo - ritenutaAmount;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // HEADER BAND
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.rect(doc, 0, 0, W, 110, PRIMARY_COLOR);

        // Logo (in alto a sinistra nell'header)
        const logoPath = this.getLogoPath();
        if (logoPath) {
          try {
            doc.image(logoPath, MARGIN, 20, { height: 40, fit: [160, 40] });
          } catch (e) {
            this.logger.warn('Logo non caricabile nel PDF:', e);
          }
        } else {
          doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff')
             .text('DoFlow', MARGIN, 28);
        }

        // Titolo fattura (in alto a destra nell'header)
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff')
           .text('FATTURA', 0, 22, { align: 'right', width: W - MARGIN });
        doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.75)')
           .text(`N. ${invoice.invoiceNumber}`, 0, 50, { align: 'right', width: W - MARGIN })
           .text(`Data: ${this.fmtDate(invoice.issueDate)}`, 0, 64, { align: 'right', width: W - MARGIN })
           .text(`Scadenza: ${this.fmtDate(invoice.dueDate)}`, 0, 78, { align: 'right', width: W - MARGIN });

        let curY = 130;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SEZIONE EMITTENTE / CLIENTE
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const colW = (CONTENT_W - 20) / 2;
        const col1X = MARGIN;
        const col2X = MARGIN + colW + 20;

        const drawPartyBlock = (x: number, y: number, label: string, lines: string[]): number => {
          doc.font('Helvetica-Bold').fontSize(7).fillColor(ACCENT_COLOR)
             .text(label.toUpperCase(), x, y, { characterSpacing: 1.5 });
          y += 14;
          this.rect(doc, x, y, colW, 1, ACCENT_COLOR);
          y += 8;

          lines.filter(Boolean).forEach(line => {
            const isBold = line.startsWith('**');
            const text   = isBold ? line.slice(2) : line;
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(isBold ? 11 : 9)
               .fillColor(isBold ? PRIMARY_COLOR : TEXT_GRAY)
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
          invoice.clientVat        ? `P.IVA: ${invoice.clientVat}` : '',
          invoice.clientFiscalCode ? `C.F.: ${invoice.clientFiscalCode}` : '',
          invoice.clientSdi        ? `Cod. SDI: ${invoice.clientSdi}` : '',
          invoice.clientPec        ? `PEC: ${invoice.clientPec}` : '',
        ];

        const endY1 = drawPartyBlock(col1X, curY, 'Emittente', emittenteLines);
        const endY2 = drawPartyBlock(col2X, curY, 'Committente', clienteLines);
        curY = Math.max(endY1, endY2) + 24;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // REGIME FISCALE (badge)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const regimeBadge = isForfettario ? 'Regime Forfettario (Legge 190/2014)' : `Regime Ordinario — IVA ${taxRate}%`;
        const badgeColor  = isForfettario ? '#f59e0b' : ACCENT_COLOR;
        doc.roundedRect(MARGIN, curY, CONTENT_W, 22, 4).fill(badgeColor + '22');
        doc.font('Helvetica-Bold').fontSize(8).fillColor(badgeColor)
           .text(regimeBadge.toUpperCase(), MARGIN + 8, curY + 7, { characterSpacing: 0.8 });
        curY += 36;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TABELLA VOCI
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const COL = {
          desc:   { x: MARGIN,          w: 200 },
          qty:    { x: MARGIN + 205,    w: 55  },
          price:  { x: MARGIN + 265,    w: 80  },
          iva:    { x: MARGIN + 350,    w: 50  },
          total:  { x: MARGIN + 405,    w: CONTENT_W - 405 },
        };

        // Header row
        this.rect(doc, MARGIN, curY, CONTENT_W, 22, PRIMARY_COLOR);
        const headerStyle = { fillColor: '#ffffff', fontSize: 8, font: 'Helvetica-Bold' };
        const drawHeader = (label: string, x: number, w: number, align: 'left'|'right' = 'left') => {
          doc.font(headerStyle.font).fontSize(headerStyle.fontSize).fillColor(headerStyle.fillColor)
             .text(label, x + 4, curY + 7, { width: w - 8, align });
        };
        drawHeader('Descrizione',       COL.desc.x,  COL.desc.w);
        drawHeader('Q.tà',              COL.qty.x,   COL.qty.w,   'right');
        drawHeader('Prezzo Un.',        COL.price.x, COL.price.w, 'right');
        drawHeader('IVA %',             COL.iva.x,   COL.iva.w,   'right');
        drawHeader('Importo',           COL.total.x, COL.total.w, 'right');
        curY += 22;

        // Righe
        const items = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
          ? invoice.lineItems
          : [{ description: 'Servizi DoFlow', quantity: 1, unitPrice: imponibile, total: imponibile }];

        items.forEach((item, idx) => {
          const rowH = 22;
          if (idx % 2 === 0) this.rect(doc, MARGIN, curY, CONTENT_W, rowH, LIGHT_GRAY);
          const rowTotal = Number(item.total) || (Number(item.quantity) * Number(item.unitPrice)) || 0;

          doc.font('Helvetica').fontSize(9).fillColor(PRIMARY_COLOR)
             .text(item.description || '', COL.desc.x + 4, curY + 7, { width: COL.desc.w - 8, ellipsis: true });
          doc.text(String(item.quantity ?? 1),             COL.qty.x + 4,   curY + 7, { width: COL.qty.w - 8,   align: 'right' });
          doc.text(this.fmtCurrency(Number(item.unitPrice)), COL.price.x + 4, curY + 7, { width: COL.price.w - 8, align: 'right' });
          doc.text(isForfettario ? 'Esente' : `${taxRate}%`, COL.iva.x + 4,   curY + 7, { width: COL.iva.w - 8,   align: 'right' });
          doc.text(this.fmtCurrency(rowTotal),             COL.total.x + 4, curY + 7, { width: COL.total.w - 8, align: 'right' });
          curY += rowH;
        });

        // Separatore sotto tabella
        this.rect(doc, MARGIN, curY, CONTENT_W, 1, MID_GRAY);
        curY += 20;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // BOX TOTALI (in basso a destra)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const totalsX = W / 2 + 10;
        const totalsW = W - MARGIN - totalsX;

        const drawTotalsRow = (label: string, value: string, bold = false, highlight = false) => {
          if (highlight) this.rect(doc, totalsX - 8, curY - 2, totalsW + 8, 22, PRIMARY_COLOR);
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
             .fontSize(bold ? 10 : 9)
             .fillColor(highlight ? '#ffffff' : (bold ? PRIMARY_COLOR : TEXT_GRAY))
             .text(label, totalsX, curY, { width: totalsW * 0.55, align: 'left' });
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
             .fontSize(bold ? 10 : 9)
             .fillColor(highlight ? '#ffffff' : (bold ? PRIMARY_COLOR : TEXT_GRAY))
             .text(value, totalsX + totalsW * 0.55, curY, { width: totalsW * 0.45, align: 'right' });
          curY += bold ? 24 : 18;
        };

        drawTotalsRow('Imponibile:',             this.fmtCurrency(imponibile));
        if (inpsAmount  > 0) drawTotalsRow(`Rivalsa INPS (${inpsRate}%):`,      this.fmtCurrency(inpsAmount));
        if (!isForfettario)  drawTotalsRow(`IVA (${taxRate}%):`,                this.fmtCurrency(ivaAmount));
        if (stampAmount > 0) drawTotalsRow('Marca da Bollo:',                   this.fmtCurrency(stampAmount));
        if (ritenutaAmount > 0) {
          this.rect(doc, totalsX - 8, curY - 2, totalsW + 8, 18, '#fff7ed');
          drawTotalsRow(`Ritenuta d'Acconto (${ritenutaRate}%):`, `-${this.fmtCurrency(ritenutaAmount)}`, false, false);
        }

        this.rect(doc, totalsX - 8, curY - 2, totalsW + 8, 1, MID_GRAY);
        curY += 6;
        drawTotalsRow('TOTALE DA PAGARE:', this.fmtCurrency(totaleNetto), true, true);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // NOTE / CONDIZIONI
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        curY += 20;
        if (invoice.notes) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT_GRAY)
             .text('NOTE / CONDIZIONI DI PAGAMENTO', MARGIN, curY, { characterSpacing: 0.8 });
          curY += 14;
          doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_GRAY)
             .text(invoice.notes, MARGIN, curY, { width: W / 2 - 20 });
          curY += 30;
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // FOOTER con diciture legali
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const footerY = H - 72;
        this.rect(doc, 0, footerY, W, 1, MID_GRAY);

        let legalText = '';

        if (isForfettario) {
          legalText =
            'Operazione in franchigia da IVA ai sensi della Legge 190/2014 e successive modifiche. ' +
            (stampAmount > 0
              ? 'Imposta di bollo assolta sull\'originale ai sensi del D.P.R. 642/1972.'
              : 'Importo non soggetto a marca da bollo (imponibile ≤ €77,47).');
        } else {
          legalText = `Documento soggetto ad IVA al ${taxRate}% ai sensi del D.P.R. 633/1972.`;
          if (ritenutaAmount > 0)
            legalText += ` Ritenuta d'acconto del ${ritenutaRate}% a carico del committente.`;
        }

        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text(legalText, MARGIN, footerY + 10, { width: CONTENT_W * 0.75, lineGap: 2 });

        doc.font('Helvetica').fontSize(7).fillColor(TEXT_GRAY)
           .text(`${EMITTENTE.nome} — ${EMITTENTE.piva}`, MARGIN, footerY + 38, { align: 'center', width: CONTENT_W });
        doc.text('Documento generato da DoFlow PaaS', MARGIN, footerY + 50, { align: 'center', width: CONTENT_W });

        doc.end();
      } catch (err) {
        this.logger.error('Errore generazione PDF', err);
        reject(err);
      }
    });
  }
}
