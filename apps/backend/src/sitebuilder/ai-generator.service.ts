// apps/backend/src/sitebuilder/ai-generator.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { THEMES_REGISTRY } from './themes.registry';

@Injectable()
export class AiGeneratorService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateCopy(briefData: any) {
    // FIX: il default era 'doflow-starter' ma il registro ha la chiave 'doflow-first'
    const selectedThemeId = briefData.themeId || 'doflow-first';
    const layoutFiles = THEMES_REGISTRY[selectedThemeId] ?? THEMES_REGISTRY['doflow-first'];

    if (!layoutFiles || layoutFiles.length === 0) {
      throw new InternalServerErrorException(
        `Tema "${selectedThemeId}" non trovato nel registro. Temi disponibili: ${Object.keys(THEMES_REGISTRY).join(', ')}`
      );
    }

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
            hero_badge:       { type: SchemaType.STRING },
            hero_title:       { type: SchemaType.STRING },
            hero_description: { type: SchemaType.STRING },
            hero_cta:         { type: SchemaType.STRING },
            hero_cta_2:       { type: SchemaType.STRING },

            // --- FEATURES ---
            features_heading:    { type: SchemaType.STRING },
            features_subheading: { type: SchemaType.STRING },
            feature_1_title: { type: SchemaType.STRING }, feature_1_desc: { type: SchemaType.STRING },
            feature_2_title: { type: SchemaType.STRING }, feature_2_desc: { type: SchemaType.STRING },
            feature_3_title: { type: SchemaType.STRING }, feature_3_desc: { type: SchemaType.STRING },
            feature_4_title: { type: SchemaType.STRING }, feature_4_desc: { type: SchemaType.STRING },
            feature_5_title: { type: SchemaType.STRING }, feature_5_desc: { type: SchemaType.STRING },

            // --- STEP PROCESS ---
            process_heading:    { type: SchemaType.STRING },
            process_subheading: { type: SchemaType.STRING },
            process_badge:      { type: SchemaType.STRING },
            step_1_num: { type: SchemaType.STRING }, step_1_title: { type: SchemaType.STRING }, step_1_desc: { type: SchemaType.STRING },
            step_2_num: { type: SchemaType.STRING }, step_2_title: { type: SchemaType.STRING }, step_2_desc: { type: SchemaType.STRING },
            step_3_num: { type: SchemaType.STRING }, step_3_title: { type: SchemaType.STRING }, step_3_desc: { type: SchemaType.STRING },
            step_4_num: { type: SchemaType.STRING }, step_4_title: { type: SchemaType.STRING }, step_4_desc: { type: SchemaType.STRING },

            // --- PRICING ---
            pricing_heading: { type: SchemaType.STRING },
            plan_1_name: { type: SchemaType.STRING }, plan_1_price: { type: SchemaType.STRING },
            plan_1_feat_1: { type: SchemaType.STRING }, plan_1_feat_2: { type: SchemaType.STRING }, plan_1_feat_3: { type: SchemaType.STRING },
            plan_1_cta: { type: SchemaType.STRING },
            plan_2_name: { type: SchemaType.STRING }, plan_2_price: { type: SchemaType.STRING },
            plan_2_feat_1: { type: SchemaType.STRING }, plan_2_feat_2: { type: SchemaType.STRING }, plan_2_feat_3: { type: SchemaType.STRING },
            plan_2_cta: { type: SchemaType.STRING },
            plan_3_name: { type: SchemaType.STRING }, plan_3_price: { type: SchemaType.STRING },
            plan_3_feat_1: { type: SchemaType.STRING }, plan_3_feat_2: { type: SchemaType.STRING }, plan_3_feat_3: { type: SchemaType.STRING },
            plan_3_cta: { type: SchemaType.STRING },

            // --- SOCIAL PROOF ---
            testimonials_heading: { type: SchemaType.STRING },
            test_1_quote: { type: SchemaType.STRING }, test_1_author: { type: SchemaType.STRING }, test_1_role: { type: SchemaType.STRING },
            test_2_quote: { type: SchemaType.STRING }, test_2_author: { type: SchemaType.STRING }, test_2_role: { type: SchemaType.STRING },
            test_3_quote: { type: SchemaType.STRING }, test_3_author: { type: SchemaType.STRING }, test_3_role: { type: SchemaType.STRING },

            // --- FAQ ---
            faq_heading: { type: SchemaType.STRING },
            faq_1_q: { type: SchemaType.STRING }, faq_1_a: { type: SchemaType.STRING },
            faq_2_q: { type: SchemaType.STRING }, faq_2_a: { type: SchemaType.STRING },
            faq_3_q: { type: SchemaType.STRING }, faq_3_a: { type: SchemaType.STRING },
            faq_4_q: { type: SchemaType.STRING }, faq_4_a: { type: SchemaType.STRING },

            // --- ABOUT & BENEFIT ---
            about_heading:     { type: SchemaType.STRING },
            about_description: { type: SchemaType.STRING },
            about_whowe_heading: { type: SchemaType.STRING },
            about_mission_1_title: { type: SchemaType.STRING }, about_mission_1_desc: { type: SchemaType.STRING },
            about_mission_2_title: { type: SchemaType.STRING }, about_mission_2_desc: { type: SchemaType.STRING },
            check_1_title: { type: SchemaType.STRING }, check_1_desc: { type: SchemaType.STRING },
            check_2_title: { type: SchemaType.STRING }, check_2_desc: { type: SchemaType.STRING },
            check_3_title: { type: SchemaType.STRING }, check_3_desc: { type: SchemaType.STRING },
            check_4_title: { type: SchemaType.STRING }, check_4_desc: { type: SchemaType.STRING },
            check_5_title: { type: SchemaType.STRING }, check_5_desc: { type: SchemaType.STRING },

            // --- CTA RIBBON ---
            ribbon_headline: { type: SchemaType.STRING },
            ribbon_sub:      { type: SchemaType.STRING },
            ribbon_cta:      { type: SchemaType.STRING },

            // --- STATS & LOGO ---
            stat_1_val: { type: SchemaType.STRING }, stat_1_label: { type: SchemaType.STRING },
            logo_1_name: { type: SchemaType.STRING }, logo_2_name: { type: SchemaType.STRING },
            logo_3_name: { type: SchemaType.STRING }, logo_4_name: { type: SchemaType.STRING },

            // --- TEAM ---
            team_heading: { type: SchemaType.STRING },
            team_1_name: { type: SchemaType.STRING }, team_1_role: { type: SchemaType.STRING },
            team_2_name: { type: SchemaType.STRING }, team_2_role: { type: SchemaType.STRING },
            team_3_name: { type: SchemaType.STRING }, team_3_role: { type: SchemaType.STRING },

            // --- CONTATTI ---
            contact_phone_label: { type: SchemaType.STRING }, contact_phone: { type: SchemaType.STRING },
            contact_email_label: { type: SchemaType.STRING }, contact_email: { type: SchemaType.STRING },
            contact_hours_label: { type: SchemaType.STRING }, contact_hours: { type: SchemaType.STRING },

            // --- TIMELINE ---
            founder_heading: { type: SchemaType.STRING }, founder_sub: { type: SchemaType.STRING },
            timeline_1_year: { type: SchemaType.STRING }, timeline_1_desc: { type: SchemaType.STRING },
            timeline_2_year: { type: SchemaType.STRING }, timeline_2_desc: { type: SchemaType.STRING },
            timeline_3_year: { type: SchemaType.STRING }, timeline_3_desc: { type: SchemaType.STRING },
            timeline_4_year: { type: SchemaType.STRING }, timeline_4_desc: { type: SchemaType.STRING },
            timeline_5_year: { type: SchemaType.STRING },
          },
          required: [
            "themeId",
            "hero_title", "hero_description", "hero_cta",
            "feature_1_title", "feature_1_desc",
            "feature_2_title", "feature_2_desc",
            "feature_3_title", "feature_3_desc",
            "plan_1_name", "plan_1_price", "plan_1_cta",
            "plan_2_name", "plan_2_price", "plan_2_cta",
            "plan_3_name", "plan_3_price", "plan_3_cta",
            "test_1_quote", "test_1_author", "test_1_role",
            "ribbon_headline", "ribbon_sub", "ribbon_cta",
            "about_heading",
          ]
        }
      }
    });

    const systemPrompt = `
      Sei un Senior Neuro-Copywriter specializzato in Conversion Rate Optimization (CRO).
      Il tuo obiettivo è generare un copy perfetto per le pagine di un sito web, riempiendo gli slot JSON richiesti.

      --- CONTESTO DEL CLIENTE ---
      Azienda: ${briefData.companyName}
      Target Audience: ${briefData.targetAudience || 'Potenziali clienti B2B e B2C'}
      Obiettivi del sito: ${briefData.goals?.join(', ') || 'Generare contatti e vendite'}
      Unique Selling Proposition (USP): ${briefData.usp || 'Massima qualità e professionalità'}
      Settore: ${briefData.industry || 'Non specificato'}
      Lingua: ${briefData.language || 'Italiano'}
      
      --- TONO DI VOCE E STILE ---
      Tono richiesto: ${briefData.toneOfVoice || 'Professionale e persuasivo'}
      Keywords SEO: ${briefData.keywords?.join(', ') || 'Nessuna specifica'}
      
      --- MATERIALE AGGIUNTIVO ---
      ${briefData.additionalInfo ? `"""\n${briefData.additionalInfo}\n"""` : 'Nessuna informazione aggiuntiva fornita.'}

      --- REGOLE CRITICHE ---
      1. Il campo "themeId" deve essere esattamente: "${selectedThemeId}"
      2. NON inserire tag HTML nei valori dei campi. Solo testo puro.
         ECCEZIONE: hero_title può contenere una parola chiave avvolta in <mark style="background-color:rgba(0,0,0,0);color:#7a44ff" class="has-inline-color">parola</mark>
      3. hero_title: breve, max 10 parole, impatto immediato.
      4. Le CTA (hero_cta, ribbon_cta, plan_*_cta): max 4 parole, verbo d'azione.
      5. I prezzi (plan_*_price): formato es. "€49/mese" oppure "Su richiesta".
      6. I numeri step (step_*_num): "01", "02", "03", "04".
      7. Le descrizioni: max 2-3 frasi, specifiche, orientate al beneficio.
      8. Usa il framework PAS nella Hero e nelle check_*_desc.
      9. Rispondi ESCLUSIVAMENTE con il JSON compilato, senza markdown, senza blockticks.
    `;

    let retries = 3;
    let delay = 3000;

    while (retries > 0) {
      try {
        const result = await model.generateContent(systemPrompt);
        let rawText = result.response.text();

        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

        const parsedData = JSON.parse(rawText);

        // Garantisce che themeId sia sempre corretto nel payload salvato
        parsedData.themeId = selectedThemeId;

        return {
          themeId:      selectedThemeId,
          layout_files: layoutFiles,
          texts:        parsedData,
          companyName:  briefData.companyName,
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if ((errorMessage.includes('503') || error instanceof SyntaxError) && retries > 1) {
          retries--;
          console.warn(`⏳ [Gemini Retry] Errore. Attendo ${delay}ms... (Rimasti: ${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        console.error("❌ ERRORE GEMINI:", errorMessage);
        throw new InternalServerErrorException("Errore critico generazione testi: " + errorMessage);
      }
    }

    throw new InternalServerErrorException("Tutti i tentativi Gemini esauriti.");
  }
}