// apps/backend/src/sitebuilder/ai-generator.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiGeneratorService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  // --- FUNZIONE HELPER PER UNSPLASH ---
  private async fetchUnsplashImage(query: string, orientation: string = 'landscape'): Promise<string> {
    const fallback = `https://placehold.co/800x600/eeeeee/999999?text=${encodeURIComponent(query)}`;
    if (!process.env.UNSPLASH_ACCESS_KEY) return fallback;

    try {
      // Chiamata all'API ufficiale di Unsplash
      const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=1&client_id=${process.env.UNSPLASH_ACCESS_KEY}`);
      if (!res.ok) return fallback; // Se abbiamo finito le quote (50/ora gratis), usa il placeholder
      
      const data = await res.json();
      return data.results?.[0]?.urls?.regular || fallback;
    } catch (e) {
      console.error("Errore Unsplash:", e);
      return fallback;
    }
  }

  // --- POPOLAZIONE DINAMICA IMMAGINI ---
  private async populateImages(blocks: any[]) {
    const promises = [];

    for (const block of blocks) {
      const type = block.type;
      const c = block.content;
      if (!c) continue;

      if (type === 'hero-split' && c.imageQuery) {
        promises.push(this.fetchUnsplashImage(c.imageQuery, 'landscape').then(url => c.imageUrl = url));
      } else if (type === 'authority-about' && c.imageQuery) {
        promises.push(this.fetchUnsplashImage(c.imageQuery, 'portrait').then(url => c.imageUrl = url));
      } else if (type === 'lead-magnet' && c.imageQuery) {
        promises.push(this.fetchUnsplashImage(c.imageQuery, 'portrait').then(url => c.imageUrl = url));
      } else if (type === 'team-grid' && c.teamMembers) {
        for (const member of c.teamMembers) {
          promises.push(this.fetchUnsplashImage(`professional portrait ${member.role || 'person'}`, 'squarish').then(url => member.imageUrl = url));
        }
      } else if (type === 'category-grid' && c.categories) {
        for (const cat of c.categories) {
          promises.push(this.fetchUnsplashImage(cat.categoryName || 'object', 'squarish').then(url => cat.imageUrl = url));
        }
      } else if (type === 'gallery-masonry' && c.galleryItems) {
        for (const item of c.galleryItems) {
          promises.push(this.fetchUnsplashImage(item.imageTheme || 'office', 'landscape').then(url => item.imageUrl = url));
        }
      }
    }

    // Eseguiamo tutte le chiamate in parallelo per non rallentare l'utente!
    await Promise.all(promises);
    return blocks;
  }

  async generateCopy(briefData: any) {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const systemPrompt = `
      Sei un Neuro-Copywriter Esperto. Genera testi in JSON per una landing page moderna e persuasiva.
      
      DATI CLIENTE:
      ${JSON.stringify(briefData)}

      REGOLE DI SCRITTURA E FORMATTAZIONE:
      Rispondi ESCLUSIVAMENTE con un oggetto JSON valido. 
      Dove vedi "imageQuery", devi inserire 1 o 2 keyword IN INGLESE che descrivano l'immagine perfetta per quel blocco (es: "modern office desk", "happy clients", "professional architect").
      
      Struttura obbligatoria radice:
      {
        "themeId": "${briefData.themeId || 'neuro-agency-01'}",
        "blocks": [
          { "type": "NOME-DEL-PATTERN", "content": { ... campi specifici ... } }
        ]
      }

      LISTA DEI PATTERN ("type") E LORO "content":
      - "hero-pas" : { "h1":"", "paragraph":"", "ctaText":"" }
      - "hero-split" : { "badgeText": "", "h1": "", "paragraph": "", "ctaText": "", "imageQuery": "" }
      - "features-grid-3" : { "items": [ {"title":"", "description":""} ] }
      - "social-proof" : { "testimonials": [ {"quote":"", "author":"", "role":""} ] }
      - "faq-accordion" : { "faqs": [ {"question":"", "answer":""} ] }
      - "authority-about" : { "about": { "heading":"", "description":"", "mission":"" }, "imageQuery": "" }
      - "logo-ticker" : { "logos": ["Logo1", "Logo2"] }
      - "zig-zag" : { "zigzagItems": [ {"title":"", "description":""} ] }
      - "step-process" : { "steps": [ {"stepNumber":"", "title":"", "description":""} ] }
      - "pricing-table" : { "plans": [ {"name":"", "price":"", "features":[""], "isPopular": true, "planCta":""} ] }
      - "cta-ribbon" : { "ribbonHeadline":"", "ribbonSub":"", "ctaText":"" }
      - "stats-bar" : { "stats": [ {"value":"", "label":""} ] }
      - "founder-note" : { "founderQuote":"", "founderName":"", "founderRole":"" }
      - "benefit-checklist" : { "checklistItems": [""] }
      - "team-grid" : { "teamMembers": [ {"name":"", "role":"", "bio":""} ] }
      - "contact-section" : { "contactInfo": { "address":"", "phone":"", "email":"", "hours":"" } }
      - "lead-magnet" : { "leadMagnetTitle":"", "leadMagnetDesc":"", "leadMagnetCta":"", "imageQuery": "" }
      - "video-explainer" : { "videoTitle":"", "videoDesc":"" }
      - "case-studies-preview" : { "cases": [ {"clientName":"", "problem":"", "solution":"", "results":""} ] }
      - "category-grid" : { "categories": [ {"categoryName":"", "categoryDesc":""} ] }
      - "trust-badges" : { "badges": [ {"badgeName":"", "badgeMeaning":""} ] }
      - "tabbed-content" : { "tabs": [ {"tabName":"", "tabTitle":"", "tabContent":""} ] }
      - "gallery-masonry" : { "galleryItems": [ {"imageTheme":"", "caption":""} ] }
    `;

    let retries = 3;
    let delay = 5000;

    while (retries > 0) {
      try {
        const result = await model.generateContent(systemPrompt);
        let rawText = result.response.text();

        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(rawText);
        
        // Normalizzazione fallback
        if (parsedData.blocks && Array.isArray(parsedData.blocks)) {
          parsedData.blocks = parsedData.blocks.map((block: any) => {
            if (block.patternId && !block.type) { block.type = block.patternId; delete block.patternId; }
            return block;
          });
        }

        // Chiamata parallela ad Unsplash!
        const blocksWithImages = await this.populateImages(parsedData.blocks || parsedData);
        
        return {
          themeId: briefData.themeId || parsedData.themeId || "neuro-agency-01",
          blocks: blocksWithImages
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if ((errorMessage.includes('503') || error instanceof SyntaxError) && retries > 1) {
          retries--;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; 
          continue; 
        }
        console.error("❌ ERRORE GEMINI DETTAGLIATO:", errorMessage, error); 
        throw new InternalServerErrorException("Errore generazione testi via LLM");
      }
    }
  }
}