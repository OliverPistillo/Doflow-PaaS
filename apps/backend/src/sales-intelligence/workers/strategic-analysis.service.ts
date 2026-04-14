// apps/backend/src/sales-intelligence/workers/strategic-analysis.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { EnrichedProspect } from './enrichment.service';
import { ResearchData } from '../entities/research-data.entity';
import { StrategicAnalysis } from '../entities/outreach-campaign.entity';

const DEFAULT_SOLUTIONS_CATALOG = `
- DoFlow PaaS: piattaforma no-code per generazione automatica di siti WordPress
- Sitebuilder AI: creazione siti con AI in 5 minuti a partire da un brief
- Multi-tenant SaaS: gestione clienti con dashboard dedicata, white-label
- Automazioni CRM: trigger su lead, deal stage, notifiche automatiche
`;

@Injectable()
export class StrategicAnalysisService {
  private readonly logger = new Logger(StrategicAnalysisService.name);
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async analyze(
    prospect: EnrichedProspect,
    research: ResearchData,
    solutionsCatalog?: string,
  ): Promise<StrategicAnalysis> {
    const prompt = this.buildPrompt(prospect, research, solutionsCatalog);
    this.logger.log(`Analisi strategica Gemini per: ${prospect.fullName} @ ${prospect.company.name}`);

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            painPoints: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id:          { type: SchemaType.STRING },
                  title:       { type: SchemaType.STRING },
                  evidence:    { type: SchemaType.STRING },
                  severity:    { type: SchemaType.STRING },
                  ourSolution: { type: SchemaType.STRING },
                },
                required: ['id', 'title', 'evidence', 'severity', 'ourSolution'],
              },
            },
            outreachHooks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  angle:       { type: SchemaType.STRING },
                  hook:        { type: SchemaType.STRING },
                  whyItWorks:  { type: SchemaType.STRING },
                },
                required: ['angle', 'hook', 'whyItWorks'],
              },
            },
            timingRecommendation: { type: SchemaType.STRING },
            confidenceScore:      { type: SchemaType.NUMBER },
          },
          required: ['painPoints', 'outreachHooks', 'timingRecommendation', 'confidenceScore'],
        },
      },
    });

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    try {
      return JSON.parse(raw) as StrategicAnalysis;
    } catch {
      this.logger.error('Errore parsing risposta Gemini analisi strategica', raw);
      throw new Error('Risposta Gemini non parsabile per analisi strategica');
    }
  }

  private buildPrompt(
    p: EnrichedProspect,
    r: ResearchData,
    catalog?: string,
  ): string {
    return `
Sei un Senior B2B Sales Strategist specializzato nell'identificare opportunità di vendita nascosta.
Analizza questo profilo prospect e produci una strategic intelligence card.

══ PROFILO PROSPECT ══
Nome: ${p.fullName}
Titolo: ${p.jobTitle || 'N/A'} (${p.seniority || 'N/A'})
Azienda: ${p.company.name}
Dominio: ${p.company.domain}
Settore: ${p.company.industry || 'N/A'}
Dimensione: ${p.company.employeeCount || 'N/A'} dipendenti
Fatturato: ${p.company.annualRevenue || 'N/A'}
Tech stack attuale: ${(p.company.techStack || []).join(', ') || 'N/A'}

══ CONTESTO AZIENDALE RECENTE ══
${r.synthesizedContext || 'Nessun contesto disponibile.'}

══ NOSTRE SOLUZIONI DISPONIBILI ══
${catalog || DEFAULT_SOLUTIONS_CATALOG}

══ REGOLE DI ANALISI ══
1. Identifica 3-5 Pain Points SPECIFICI — ogni pain point deve essere ancorato a un fatto
   concreto del contesto (notizia, dato tech, dimensione aziendale). Zero generalità.
2. Per ciascun pain point mappa la nostra soluzione più rilevante.
3. Identifica 3 "outreach hooks" con angolazioni diverse: curiosity, direct, value-first.
   Ogni hook deve essere adatto a un ${p.seniority || 'decision maker'} in ${p.company.industry || 'tech'}.
4. Suggerisci timing ottimale di contatto basato sul contesto.
5. confidenceScore da 0 a 1 — riflette quanto i dati disponibili sono ricchi e specifici.

Rispondi SOLO con JSON valido, nessun testo fuori dal JSON.
`.trim();
  }
}
