// apps/backend/src/sales-intelligence/workers/outreach-generator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { EnrichedProspect } from './enrichment.service';
import { StrategicAnalysis, EmailVariant } from '../entities/outreach-campaign.entity';

@Injectable()
export class OutreachGeneratorService {
  private readonly logger = new Logger(OutreachGeneratorService.name);
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generate(
    prospect: EnrichedProspect,
    analysis: StrategicAnalysis,
  ): Promise<EmailVariant[]> {
    this.logger.log(`Generazione outreach email per: ${prospect.fullName}`);

    const prompt = this.buildPrompt(prospect, analysis);

    // Usa gemini-2.5-flash per la generazione testi — più veloce e economico
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            emails: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  variant: { type: SchemaType.STRING },
                  subject: { type: SchemaType.STRING },
                  body:    { type: SchemaType.STRING },
                },
                required: ['variant', 'subject', 'body'],
              },
            },
          },
          required: ['emails'],
        },
      },
    });

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    try {
      const parsed = JSON.parse(raw);
      return parsed.emails as EmailVariant[];
    } catch {
      this.logger.error('Errore parsing risposta Gemini outreach', raw);
      throw new Error('Risposta Gemini non parsabile per generazione email');
    }
  }

  private buildPrompt(p: EnrichedProspect, a: StrategicAnalysis): string {
    const topPainPoints = a.painPoints.slice(0, 3)
      .map(pp => `- ${pp.title}: ${pp.evidence} → Nostra soluzione: ${pp.ourSolution}`)
      .join('\n');

    const hooks = a.outreachHooks
      .map(h => `[${h.angle}] ${h.hook}`)
      .join('\n');

    return `
Sei un Senior Copywriter B2B specializzato in cold email ad alto tasso di risposta.
Scrivi 3 varianti di cold email per il seguente prospect.

══ DESTINATARIO ══
Nome: ${p.fullName}
Titolo: ${p.jobTitle || 'N/A'} @ ${p.company.name}
Seniority: ${p.seniority || 'N/A'}

══ PAIN POINTS IDENTIFICATI ══
${topPainPoints}

══ OUTREACH HOOKS SUGGERITI ══
${hooks}

══ TIMING CONSIGLIATO ══
${a.timingRecommendation}

══ REGOLE OBBLIGATORIE ══
- Ogni email deve avere variante: "direct", "curiosity", o "value-first"
- Oggetto: max 8 parole, NO clickbait, NO punti interrogativi
- Corpo: max 120 parole, tono conversazionale, NO jargon aziendale
- Prima riga: aggancia immediatamente — usa uno degli hooks suggeriti
- CTA finale: UNA sola domanda aperta, non un link
- NON menzionare caratteristiche del prodotto — parla di risultati
- Firma sempre come: [Il tuo nome] | DoFlow

Rispondi SOLO con JSON. Nessun testo fuori dal JSON.
`.trim();
  }
}
