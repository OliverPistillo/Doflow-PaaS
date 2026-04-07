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
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
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
                      // Elenchiamo tutte le possibili chiavi che i nostri pattern potrebbero richiedere
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
    `;

    try {
      const result = await model.generateContent(systemPrompt);
      return JSON.parse(result.response.text());
    } catch (error) {
      console.error("Errore AI:", error);
      throw new InternalServerErrorException("Errore generazione testi via LLM");
    }
  }
}