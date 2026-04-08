// apps/backend/src/sitebuilder/ai-generator.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiGeneratorService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateCopy(briefData: any) {
    // Configurazione ultra-leggera: bypassiamo il limite di complessità del validatore di Google
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    // Insegniamo all'AI la struttura JSON esatta direttamente nel prompt
    const systemPrompt = `
      Sei un Neuro-Copywriter Esperto. Genera testi in JSON per una landing page moderna e persuasiva.
      
      DATI CLIENTE:
      ${JSON.stringify(briefData)}

      REGOLE DI SCRITTURA:
      Usa framework PAS e regole E-E-A-T.
      
      REGOLE DI FORMATTAZIONE:
      Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza blocchi markdown.
      La tua risposta deve avere esattamente questa struttura radice:
      {
        "themeId": "${briefData.themeId || 'neuro-agency-01'}",
        "blocks": [ ... array di oggetti blocco scelti dalla lista qui sotto ... ]
      }

      LISTA DEI PATTERN DISPONIBILI E LORO STRUTTURA 'content' (Scegli i più adatti per la landing page):
      - hero-pas | hero-pas-dark: { "h1":"", "paragraph":"", "ctaText":"" }
      - hero-split | hero-centered: { "badgeText": "", "h1": "", "paragraph": "", "ctaText": "" }
      - features-grid-3: { "items": [ {"title":"", "description":""} ] }
      - social-proof: { "testimonials": [ {"quote":"", "author":"", "role":""} ] }
      - faq-accordion: { "faqs": [ {"question":"", "answer":""} ] }
      - authority-about: { "about": { "heading":"", "description":"", "mission":"" } }
      - logo-ticker: { "logos": ["Logo1", "Logo2"] }
      - zig-zag: { "zigzagItems": [ {"title":"", "description":""} ] }
      - step-process: { "steps": [ {"stepNumber":"", "title":"", "description":""} ] }
      - pricing-table: { "plans": [ {"name":"", "price":"", "features":[""], "isPopular": true, "planCta":""} ] }
      - cta-ribbon: { "ribbonHeadline":"", "ribbonSub":"", "ctaText":"" }
      - stats-bar: { "stats": [ {"value":"", "label":""} ] }
      - founder-note: { "founderQuote":"", "founderName":"", "founderRole":"" }
      - benefit-checklist: { "checklistItems": [""] }
      - team-grid: { "teamMembers": [ {"name":"", "role":"", "bio":""} ] }
      - contact-section: { "contactInfo": { "address":"", "phone":"", "email":"", "hours":"" } }
      - lead-magnet: { "leadMagnetTitle":"", "leadMagnetDesc":"", "leadMagnetCta":"" }
      - video-explainer: { "videoTitle":"", "videoDesc":"" }
      - case-studies-preview: { "cases": [ {"clientName":"", "problem":"", "solution":"", "results":""} ] }
      - category-grid: { "categories": [ {"categoryName":"", "categoryDesc":""} ] }
      - trust-badges: { "badges": [ {"badgeName":"", "badgeMeaning":""} ] }
      - tabbed-content: { "tabs": [ {"tabName":"", "tabTitle":"", "tabContent":""} ] }
      - gallery-masonry: { "galleryItems": [ {"imageTheme":"", "caption":""} ] }
    `;

    // Sistema di Auto-Retry (Riprova fino a 3 volte se c'è un 503 o un JSON rotto)
    let retries = 3;
    let delay = 5000;

    while (retries > 0) {
        try {
            const result = await model.generateContent(systemPrompt);
            let rawText = result.response.text();

            // Pulizia Markdown
            rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsedData = JSON.parse(rawText);
            
            // --- INIZIO NORMALIZZAZIONE DATI ---
            // Se l'AI usa "patternId" o "blockType" invece di "type", lo correggiamo noi d'ufficio
            if (parsedData.blocks && Array.isArray(parsedData.blocks)) {
            parsedData.blocks = parsedData.blocks.map((block: any) => {
                if (block.patternId && !block.type) {
                block.type = block.patternId;
                delete block.patternId;
                }
                return block;
            });
            }
            // --- FINE NORMALIZZAZIONE ---
            
            return {
            themeId: briefData.themeId || parsedData.themeId || "neuro-agency-01",
            blocks: parsedData.blocks || parsedData
            };

        } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Gestione Retry per il 503 (Server Saturo) o SyntaxError (JSON malformato dall'AI)
        if ((errorMessage.includes('503') || error instanceof SyntaxError) && retries > 1) {
          retries--;
          const reason = errorMessage.includes('503') ? 'Server saturo (503)' : 'JSON malformato';
          console.warn(`⏳ [Gemini] ${reason}. Attendo ${delay/1000}s e riprovo... (Tentativi rimasti: ${retries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff (aspetta 5s, poi 10s)
          continue; 
        }

        console.error("❌ ERRORE GEMINI DETTAGLIATO:", errorMessage, error); 
        throw new InternalServerErrorException("Errore generazione testi via LLM: " + errorMessage);
      }
    }
  }
}