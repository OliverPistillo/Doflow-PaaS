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
      model: 'gemini-2.5-pro',
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
                  type: { 
                    type: SchemaType.STRING, 
                    description: "Usa: hero-pas-dark, features-grid-3, hero-split, logo-ticker, zig-zag, step-process, pricing-table, cta-ribbon, stats-bar, founder-note, benefit-checklist, team-grid, contact-section, lead-magnet, video-explainer, case-studies-preview, category-grid, trust-badges, hero-centered, tabbed-content, gallery-masonry" 
                  },
                  content: { 
                    type: SchemaType.OBJECT, 
                    description: "I testi popolati per il blocco specifico",
                    properties: {
                      // Base
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
                      },

                      // Per social-proof
                      testimonials: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            quote: { type: SchemaType.STRING, description: "Recensione breve e realistica" },
                            author: { type: SchemaType.STRING, description: "Nome e Cognome" },
                            role: { type: SchemaType.STRING, description: "Ruolo o Azienda cliente" }
                          }
                        }
                      },

                      // Per faq-accordion
                      faqs: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            question: { type: SchemaType.STRING, description: "Domanda o obiezione comune" },
                            answer: { type: SchemaType.STRING, description: "Risposta persuasiva" }
                          }
                        }
                      },

                      // Per authority-about
                      about: {
                        type: SchemaType.OBJECT,
                        properties: {
                          heading: { type: SchemaType.STRING },
                          description: { type: SchemaType.STRING },
                          mission: { type: SchemaType.STRING }
                        }
                      },

                      // Per logo-ticker
                      logos: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING, description: "Nome di un'azienda partner verosimile" }
                      },

                      // Per zig-zag (alternato)
                      zigzagItems: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            title: { type: SchemaType.STRING },
                            description: { type: SchemaType.STRING }
                          }
                        }
                      },

                      // Per step-process
                      steps: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            stepNumber: { type: SchemaType.STRING, description: "Es: 01, 02, 03" },
                            title: { type: SchemaType.STRING },
                            description: { type: SchemaType.STRING }
                          }
                        }
                      },

                      // Per pricing-table
                      plans: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            name: { type: SchemaType.STRING, description: "Nome del piano, es. Base, Pro" },
                            price: { type: SchemaType.STRING, description: "Prezzo, es. €99/mese" },
                            features: { 
                              type: SchemaType.ARRAY, 
                              items: { type: SchemaType.STRING } 
                            },
                            isPopular: { type: SchemaType.BOOLEAN, description: "Se true, è il piano raccomandato" },
                            planCta: { type: SchemaType.STRING }
                          }
                        }
                      },

                      // Per cta-ribbon
                      ribbonHeadline: { type: SchemaType.STRING },
                      ribbonSub: { type: SchemaType.STRING },
                      
                      // Per stats-bar
                      stats: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            value: { type: SchemaType.STRING, description: "Il numero, es. 99%, 500+" },
                            label: { type: SchemaType.STRING, description: "Cosa rappresenta il numero" }
                          }
                        }
                      },

                      // Per founder-note
                      founderQuote: { type: SchemaType.STRING, description: "Il messaggio o la visione del fondatore" },
                      founderName: { type: SchemaType.STRING },
                      founderRole: { type: SchemaType.STRING },

                      // Per benefit-checklist
                      checklistItems: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING, description: "Singolo vantaggio persuasivo" }
                      },

                      // Per team-grid
                      teamMembers: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            name: { type: SchemaType.STRING },
                            role: { type: SchemaType.STRING },
                            bio: { type: SchemaType.STRING, description: "Breve descrizione delle competenze" }
                          }
                        }
                      },

                      // Per contact-section
                      contactInfo: {
                        type: SchemaType.OBJECT,
                        properties: {
                          address: { type: SchemaType.STRING },
                          phone: { type: SchemaType.STRING },
                          email: { type: SchemaType.STRING },
                          hours: { type: SchemaType.STRING }
                        }
                      },

                      // Per lead-magnet
                      leadMagnetTitle: { type: SchemaType.STRING },
                      leadMagnetDesc: { type: SchemaType.STRING, description: "Cosa otterrà l'utente scaricando la risorsa" },
                      leadMagnetCta: { type: SchemaType.STRING, description: "Es: Scarica il Report Gratuito" },

                      // Per video-explainer
                      videoTitle: { type: SchemaType.STRING },
                      videoDesc: { type: SchemaType.STRING },

                      // Per case-studies-preview
                      cases: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            clientName: { type: SchemaType.STRING },
                            problem: { type: SchemaType.STRING, description: "Il problema affrontato" },
                            solution: { type: SchemaType.STRING, description: "La soluzione implementata" },
                            results: { type: SchemaType.STRING, description: "Risultati quantitativi ottenuti" }
                          }
                        }
                      },

                      // Per category-grid (E-commerce)
                      categories: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            categoryName: { type: SchemaType.STRING },
                            categoryDesc: { type: SchemaType.STRING }
                          }
                        }
                      },

                      // Per trust-badges
                      badges: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            badgeName: { type: SchemaType.STRING, description: "Es: Certificazione ISO, Partner Ufficiale" },
                            badgeMeaning: { type: SchemaType.STRING, description: "Cosa significa per il cliente" }
                          }
                        }
                      },

                      // Per hero-centered
                      badgeText: { type: SchemaType.STRING, description: "Etichetta in alto, es: Nuova Release, Top Rated" },

                      // Per tabbed-content (Sticky Side-Nav)
                      tabs: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            tabName: { type: SchemaType.STRING, description: "Nome breve per il link laterale" },
                            tabTitle: { type: SchemaType.STRING, description: "Titolo completo della sezione" },
                            tabContent: { type: SchemaType.STRING, description: "Testo discorsivo del contenuto" }
                          }
                        }
                      },

                      // Per gallery-masonry
                      galleryItems: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            imageTheme: { type: SchemaType.STRING, description: "Cosa mostra l'immagine (es: Ufficio moderno, Team)" },
                            caption: { type: SchemaType.STRING, description: "Didascalia dell'immagine" }
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
      const result = await model.generateContent(systemPrompt);
      let rawText = result.response.text();

      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsedData = JSON.parse(rawText);
      
      return {
        themeId: briefData.themeId || parsedData.themeId || "neuro-agency-01",
        blocks: parsedData.blocks || parsedData
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error("❌ ERRORE GEMINI DETTAGLIATO:", errorMessage, error); 
      throw new InternalServerErrorException("Errore generazione testi via LLM");
    }
  }
}