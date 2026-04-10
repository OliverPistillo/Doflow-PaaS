// apps/backend/src/sitebuilder/ai-generator.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { THEMES_REGISTRY } from './themes.registry'; // <-- Importiamo il registro dei temi

@Injectable()
export class AiGeneratorService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateCopy(briefData: any) {
    // 1. Seleziona il tema o usa il fallback prelevando i file dal registro esterno
    const selectedThemeId = briefData.themeId || 'doflow-starter';
    const layoutFiles = THEMES_REGISTRY[selectedThemeId] || THEMES_REGISTRY['doflow-starter'];

    // 2. Configurazione del Modello con Schema Rigido (JSON Flat)
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          description: "Dizionario piatto di testi per idratare i segnaposto del tema WordPress.",
          properties: {
            themeId: { type: SchemaType.STRING },
            
            // --- HERO ---
            hero_badge: { type: SchemaType.STRING },
            hero_title: { type: SchemaType.STRING },
            hero_description: { type: SchemaType.STRING },
            hero_cta: { type: SchemaType.STRING },
            
            // --- FEATURES ---
            feature_1_title: { type: SchemaType.STRING }, feature_1_desc: { type: SchemaType.STRING },
            feature_2_title: { type: SchemaType.STRING }, feature_2_desc: { type: SchemaType.STRING },
            feature_3_title: { type: SchemaType.STRING }, feature_3_desc: { type: SchemaType.STRING },

            // --- ZIG ZAG ---
            zigzag_1_title: { type: SchemaType.STRING }, zigzag_1_desc: { type: SchemaType.STRING },
            zigzag_2_title: { type: SchemaType.STRING }, zigzag_2_desc: { type: SchemaType.STRING },
            zigzag_3_title: { type: SchemaType.STRING }, zigzag_3_desc: { type: SchemaType.STRING },

            // --- STEP PROCESS ---
            step_1_num: { type: SchemaType.STRING }, step_1_title: { type: SchemaType.STRING }, step_1_desc: { type: SchemaType.STRING },
            step_2_num: { type: SchemaType.STRING }, step_2_title: { type: SchemaType.STRING }, step_2_desc: { type: SchemaType.STRING },
            step_3_num: { type: SchemaType.STRING }, step_3_title: { type: SchemaType.STRING }, step_3_desc: { type: SchemaType.STRING },

            // --- PRICING ---
            plan_1_name: { type: SchemaType.STRING }, plan_1_price: { type: SchemaType.STRING }, plan_1_feat_1: { type: SchemaType.STRING }, plan_1_feat_2: { type: SchemaType.STRING }, plan_1_feat_3: { type: SchemaType.STRING }, plan_1_cta: { type: SchemaType.STRING },
            plan_2_name: { type: SchemaType.STRING }, plan_2_price: { type: SchemaType.STRING }, plan_2_feat_1: { type: SchemaType.STRING }, plan_2_feat_2: { type: SchemaType.STRING }, plan_2_feat_3: { type: SchemaType.STRING }, plan_2_cta: { type: SchemaType.STRING },
            plan_3_name: { type: SchemaType.STRING }, plan_3_price: { type: SchemaType.STRING }, plan_3_feat_1: { type: SchemaType.STRING }, plan_3_feat_2: { type: SchemaType.STRING }, plan_3_feat_3: { type: SchemaType.STRING }, plan_3_cta: { type: SchemaType.STRING },

            // --- SOCIAL PROOF ---
            test_1_quote: { type: SchemaType.STRING }, test_1_author: { type: SchemaType.STRING }, test_1_role: { type: SchemaType.STRING },
            test_2_quote: { type: SchemaType.STRING }, test_2_author: { type: SchemaType.STRING }, test_2_role: { type: SchemaType.STRING },
            test_3_quote: { type: SchemaType.STRING }, test_3_author: { type: SchemaType.STRING }, test_3_role: { type: SchemaType.STRING },

            // --- FAQ ---
            faq_1_q: { type: SchemaType.STRING }, faq_1_a: { type: SchemaType.STRING },
            faq_2_q: { type: SchemaType.STRING }, faq_2_a: { type: SchemaType.STRING },
            faq_3_q: { type: SchemaType.STRING }, faq_3_a: { type: SchemaType.STRING },
            faq_4_q: { type: SchemaType.STRING }, faq_4_a: { type: SchemaType.STRING },

            // --- ABOUT & AUTHORITY ---
            about_heading: { type: SchemaType.STRING },
            about_description: { type: SchemaType.STRING },
            about_mission: { type: SchemaType.STRING },
            
            // --- CTA RIBBON ---
            ribbon_headline: { type: SchemaType.STRING },
            ribbon_sub: { type: SchemaType.STRING },
            ribbon_cta: { type: SchemaType.STRING },

            // --- STATS ---
            stat_1_val: { type: SchemaType.STRING }, stat_1_label: { type: SchemaType.STRING },
            stat_2_val: { type: SchemaType.STRING }, stat_2_label: { type: SchemaType.STRING },
            stat_3_val: { type: SchemaType.STRING }, stat_3_label: { type: SchemaType.STRING },

            // --- TEAM & FOUNDER ---
            founder_quote: { type: SchemaType.STRING }, founder_name: { type: SchemaType.STRING }, founder_role: { type: SchemaType.STRING },
            team_1_name: { type: SchemaType.STRING }, team_1_role: { type: SchemaType.STRING }, team_1_bio: { type: SchemaType.STRING },
            team_2_name: { type: SchemaType.STRING }, team_2_role: { type: SchemaType.STRING }, team_2_bio: { type: SchemaType.STRING },
            team_3_name: { type: SchemaType.STRING }, team_3_role: { type: SchemaType.STRING }, team_3_bio: { type: SchemaType.STRING },

            // --- CONTATTI ---
            contact_address: { type: SchemaType.STRING },
            contact_phone: { type: SchemaType.STRING },
            contact_email: { type: SchemaType.STRING },
            contact_hours: { type: SchemaType.STRING },

            // --- RISORSE & CASI STUDIO ---
            lead_title: { type: SchemaType.STRING }, lead_desc: { type: SchemaType.STRING }, lead_cta: { type: SchemaType.STRING },
            video_title: { type: SchemaType.STRING }, video_desc: { type: SchemaType.STRING },
            case_1_client: { type: SchemaType.STRING }, case_1_problem: { type: SchemaType.STRING }, case_1_solution: { type: SchemaType.STRING }, case_1_result: { type: SchemaType.STRING },
            case_2_client: { type: SchemaType.STRING }, case_2_problem: { type: SchemaType.STRING }, case_2_solution: { type: SchemaType.STRING }, case_2_result: { type: SchemaType.STRING },

            // --- CATEGORIE & TRUST ---
            cat_1_name: { type: SchemaType.STRING }, cat_1_desc: { type: SchemaType.STRING },
            cat_2_name: { type: SchemaType.STRING }, cat_2_desc: { type: SchemaType.STRING },
            cat_3_name: { type: SchemaType.STRING }, cat_3_desc: { type: SchemaType.STRING },
            cat_4_name: { type: SchemaType.STRING }, cat_4_desc: { type: SchemaType.STRING },
            badge_1_name: { type: SchemaType.STRING }, badge_1_desc: { type: SchemaType.STRING },
            badge_2_name: { type: SchemaType.STRING }, badge_2_desc: { type: SchemaType.STRING },
            badge_3_name: { type: SchemaType.STRING }, badge_3_desc: { type: SchemaType.STRING },
            logo_1_name: { type: SchemaType.STRING }, logo_2_name: { type: SchemaType.STRING }, logo_3_name: { type: SchemaType.STRING }, logo_4_name: { type: SchemaType.STRING },

            // --- TABBED & GALLERY ---
            tab_1_name: { type: SchemaType.STRING }, tab_1_title: { type: SchemaType.STRING }, tab_1_content: { type: SchemaType.STRING },
            tab_2_name: { type: SchemaType.STRING }, tab_2_title: { type: SchemaType.STRING }, tab_2_content: { type: SchemaType.STRING },
            tab_3_name: { type: SchemaType.STRING }, tab_3_title: { type: SchemaType.STRING }, tab_3_content: { type: SchemaType.STRING },
            gallery_1_caption: { type: SchemaType.STRING }, gallery_2_caption: { type: SchemaType.STRING }, gallery_3_caption: { type: SchemaType.STRING },
            gallery_4_caption: { type: SchemaType.STRING }, gallery_5_caption: { type: SchemaType.STRING }, gallery_6_caption: { type: SchemaType.STRING }
          },
          required: [
            "themeId", "hero_title", "hero_description", "hero_cta", 
            "feature_1_title", "feature_1_desc", "about_heading"
          ]
        }
      }
    });

    // 3. Costruzione del Prompt Architetturale
    const systemPrompt = `
      Sei un Senior Neuro-Copywriter specializzato in Conversion Rate Optimization (CRO).
      Il tuo obiettivo è generare un copy perfetto per le pagine di un sito web, riempiendo gli slot JSON richiesti.

      --- CONTESTO DEL CLIENTE ---
      Azienda: ${briefData.companyName}
      Target Audience: ${briefData.targetAudience || 'Potenziali clienti B2B e B2C'}
      Obiettivi del sito: ${briefData.goals?.join(', ') || 'Generare contatti e vendite'}
      Unique Selling Proposition (USP): ${briefData.usp || 'Massima qualità e professionalità'}
      Pagine richieste: ${briefData.pages?.join(', ') || 'Home'}
      
      --- TONO DI VOCE E STILE ---
      Tono richiesto: ${briefData.toneOfVoice || 'Professionale e persuasivo'}
      Keywords da includere organicamente (SEO): ${briefData.keywords?.join(', ') || 'Nessuna specifica'}
      
      --- MATERIALE AGGIUNTIVO DAL CLIENTE ---
      ${briefData.additionalInfo ? `"""\n${briefData.additionalInfo}\n"""` : 'Nessuna informazione aggiuntiva fornita.'}

      --- REGOLE DI SCRITTURA ---
      1. Usa il framework PAS (Problem-Agitation-Solution) specialmente nella sezione Hero e Zig-Zag.
      2. Sii specifico: evita frasi banali come "Siamo leader nel settore". Mostra i benefici.
      3. Scrivi titoli (H1, H2, H3) brevi e di impatto.
      4. Le descrizioni devono essere chiare, massimo 2 o 3 frasi.
      5. Le Call To Action (CTA) devono essere orientate all'azione (es. "Inizia Ora", "Scopri il Metodo", non "Clicca Qui").
      6. Sfrutta abilmente i vari slot del JSON per coprire tutti gli argomenti richiesti dal cliente.
      
      Rispondi ESCLUSIVAMENTE con il JSON compilato, senza markdown.
    `;

    // 4. Auto-Retry Pattern
    let retries = 3;
    let delay = 3000;

    while (retries > 0) {
      try {
        const result = await model.generateContent(systemPrompt);
        let rawText = result.response.text();

        // Pulizia sintassi se l'AI dovesse per sbaglio inserire blockticks
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const parsedData = JSON.parse(rawText);
        
        // Ritorna il payload completo. Il webhook passerà questo blocco intero al plugin WP!
        return {
          themeId: selectedThemeId,
          layout_files: layoutFiles, // I file estratti dal themes.registry.ts!
          texts: parsedData 
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if ((errorMessage.includes('503') || error instanceof SyntaxError) && retries > 1) {
          retries--;
          console.warn(`⏳ [Gemini Retry] Errore riscontrato. Attendo e riprovo... (Rimasti: ${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; 
          continue; 
        }
        console.error("❌ ERRORE GEMINI DETTAGLIATO:", errorMessage, error); 
        throw new InternalServerErrorException("Errore critico generazione testi via LLM: " + errorMessage);
      }
    }
  }
}