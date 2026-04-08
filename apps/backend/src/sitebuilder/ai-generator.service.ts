// apps\backend\src\sitebuilder\ai-generator.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

@Injectable()
export class AiGeneratorService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateCopy(briefData: any) {
    // 1. Configura il modello FORZANDO l'output in JSON e definendo lo schema
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json', // <-- LA MAGIA È QUI
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            themeId: { type: SchemaType.STRING },
            blocks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  type: { type: SchemaType.STRING, description: "Es: hero-pas-dark, features-grid-3" },
                  content: { 
                    type: SchemaType.OBJECT, 
                    description: "I testi popolati per il blocco specifico",
                    properties: {
                      h1: { type: SchemaType.STRING },
                      h2: { type: SchemaType.STRING },
                      paragraph: { type: SchemaType.STRING },
                      ctaText: { type: SchemaType.STRING },
                      items: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            title: { type: SchemaType.STRING },
                            description: { type: SchemaType.STRING }
                          }
                        }
                      }
                    }
                  }
                },
                required: ["type", "content"]
              }
            }
          },
          required: ["themeId", "blocks"]
        }
      }
    });

    const systemPrompt = `
      Sei un Neuro-Copywriter Esperto. Genera testi in JSON.
      Dati Cliente: ${JSON.stringify(briefData)}
      Usa framework PAS e regole E-E-A-T. Compila i contenuti necessari per una landing page moderna.
      Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza usare blocchi di codice o markdown.
    `;

    try {
      // 2. Esegui la generazione
      const result = await model.generateContent(systemPrompt);
      let rawText = result.response.text();

      // 3. Pulizia di sicurezza nel caso l'AI faccia comunque di testa sua
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      // 4. Parliamo il JSON in sicurezza
      const parsedData = JSON.parse(rawText);
      
      return {
        themeId: briefData.themeId || parsedData.themeId || "neuro-agency-01",
        blocks: parsedData.blocks || parsedData // Adatta questo in base a come l'AI struttura la tua risposta
      };

    } catch (error) {
      // Diciamo a TypeScript come gestire in sicurezza il tipo "unknown"
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error("❌ ERRORE PARSING JSON. Dettagli:", errorMessage);
      throw new InternalServerErrorException("Errore generazione testi via LLM");
    }
  }
}