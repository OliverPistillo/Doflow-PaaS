// apps/backend/src/sitebuilder/ai-generator.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { THEMES_REGISTRY, THEME_TOKENS } from './themes.registry';

@Injectable()
export class AiGeneratorService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async generateCopy(briefData: any) {
    const selectedThemeId = briefData.themeId || 'doflow-first';

    // Temi gutenverse-pages: usano layout dal tema, non da THEMES_REGISTRY
    const isGutenverseTheme = ['doflow-konsulty', 'doflow-skintiva', 'doflow-artifice', 'doflow-zyno'].includes(selectedThemeId);

    if (!isGutenverseTheme && !(selectedThemeId in THEMES_REGISTRY)) {
      throw new InternalServerErrorException(
        `Tema "${selectedThemeId}" non trovato. Disponibili: ${Object.keys(THEMES_REGISTRY).join(', ')}`
      );
    }

    const layoutFiles = isGutenverseTheme ? [] : (THEMES_REGISTRY[selectedThemeId] ?? []);

    // Schema e prompt differenziati per tipo di tema
    if (isGutenverseTheme) {
      return this.generateGutenverseCopy(briefData, selectedThemeId, layoutFiles);
    }
    return this.generateDoflowFirstCopy(briefData, selectedThemeId, layoutFiles);
  }

  // ── Generazione per temi gutenverse-pages (konsulty, skintiva, artifice) ───

  private async generateGutenverseCopy(briefData: any, themeId: string, layoutFiles: string[]) {
    const tokens = THEME_TOKENS[themeId] ?? [];

    const properties: Record<string, any> = { themeId: { type: SchemaType.STRING } };
    for (const token of tokens) {
      properties[token] = { type: SchemaType.STRING };
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties,
          required: ['themeId', 'company_name', 'contact_email'],
        },
      },
    });

    const themeContext: Record<string, string> = {
      'doflow-konsulty': 'Business Consulting — stile professionale, fiducia, risultati misurabili. Font Montserrat, colori viola/blu scuro.',
      'doflow-skintiva':  'Dermatologia & Beauty Clinic — stile elegante, cura personale, benessere. Font Cormorant Garamond, colori beige/terracotta.',
      'doflow-artifice':  'AI & Robotics Company — stile tech futuristico, innovazione, precision. Font Orbitron, colori dark con cyan #2edaf1.',
      'doflow-zyno':      'Digital Marketing Agency — stile moderno light, blu elettrico #0047ff su sfondo bianco/azzurro. Font Plus Jakarta Sans. Focus su risultati, crescita, ROI.',
    };

    const systemPrompt = `
      Sei un Senior Copywriter CRO. Genera testi per un sito web ${themeContext[themeId] || ''}.

      --- CLIENTE ---
      Azienda: ${briefData.companyName}
      Target: ${briefData.targetAudience || 'Clienti qualificati'}
      Obiettivi: ${briefData.goals?.join(', ') || 'Generare contatti'}
      USP: ${briefData.usp || 'Qualità e professionalità'}
      Tono: ${briefData.toneOfVoice || 'Professionale'}
      Keywords: ${briefData.keywords?.join(', ') || '—'}
      ${briefData.additionalInfo ? `Info aggiuntive: """${briefData.additionalInfo}"""` : ''}

      --- REGOLE ---
      1. "themeId" = esattamente "${themeId}"
      2. "company_name" = nome azienda
      3. "contact_email" = email plausibile basata sul nome azienda (es. info@nomeazienda.it)
      4. I campi *_number (stat): formato "120+", "98%", "15+" — numeri credibili per il settore
      5. I campi *_label: max 4 parole, descrizione del numero
      6. I campi *_heading/*_focus: heading principale + parola chiave evidenziata
      7. Tutti i testi in italiano, no HTML
      8. Rispondi SOLO con JSON valido, senza markdown
    `;

    return this.callGemini(model, systemPrompt, themeId, layoutFiles, briefData.companyName);
  }

  // ── Generazione per doflow-first (schema originale) ──────────────────────

  private async generateDoflowFirstCopy(briefData: any, themeId: string, layoutFiles: string[]) {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          description: 'Dizionario piatto di testi per idratare i segnaposto del tema WordPress.',
          properties: {
            themeId: { type: SchemaType.STRING },
            hero_badge: { type: SchemaType.STRING },
            hero_title: { type: SchemaType.STRING },
            hero_description: { type: SchemaType.STRING },
            hero_cta: { type: SchemaType.STRING },
            hero_cta_2: { type: SchemaType.STRING },
            features_heading: { type: SchemaType.STRING },
            features_subheading: { type: SchemaType.STRING },
            feature_1_title: { type: SchemaType.STRING }, feature_1_desc: { type: SchemaType.STRING },
            feature_2_title: { type: SchemaType.STRING }, feature_2_desc: { type: SchemaType.STRING },
            feature_3_title: { type: SchemaType.STRING }, feature_3_desc: { type: SchemaType.STRING },
            feature_4_title: { type: SchemaType.STRING }, feature_4_desc: { type: SchemaType.STRING },
            feature_5_title: { type: SchemaType.STRING }, feature_5_desc: { type: SchemaType.STRING },
            process_heading: { type: SchemaType.STRING },
            process_subheading: { type: SchemaType.STRING },
            process_badge: { type: SchemaType.STRING },
            step_1_num: { type: SchemaType.STRING }, step_1_title: { type: SchemaType.STRING }, step_1_desc: { type: SchemaType.STRING },
            step_2_num: { type: SchemaType.STRING }, step_2_title: { type: SchemaType.STRING }, step_2_desc: { type: SchemaType.STRING },
            step_3_num: { type: SchemaType.STRING }, step_3_title: { type: SchemaType.STRING }, step_3_desc: { type: SchemaType.STRING },
            step_4_num: { type: SchemaType.STRING }, step_4_title: { type: SchemaType.STRING }, step_4_desc: { type: SchemaType.STRING },
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
            testimonials_heading: { type: SchemaType.STRING },
            test_1_quote: { type: SchemaType.STRING }, test_1_author: { type: SchemaType.STRING }, test_1_role: { type: SchemaType.STRING },
            test_2_quote: { type: SchemaType.STRING }, test_2_author: { type: SchemaType.STRING }, test_2_role: { type: SchemaType.STRING },
            test_3_quote: { type: SchemaType.STRING }, test_3_author: { type: SchemaType.STRING }, test_3_role: { type: SchemaType.STRING },
            faq_heading: { type: SchemaType.STRING },
            faq_1_q: { type: SchemaType.STRING }, faq_1_a: { type: SchemaType.STRING },
            faq_2_q: { type: SchemaType.STRING }, faq_2_a: { type: SchemaType.STRING },
            faq_3_q: { type: SchemaType.STRING }, faq_3_a: { type: SchemaType.STRING },
            faq_4_q: { type: SchemaType.STRING }, faq_4_a: { type: SchemaType.STRING },
            faq_5_q: { type: SchemaType.STRING }, faq_5_a: { type: SchemaType.STRING },
            ribbon_headline: { type: SchemaType.STRING },
            ribbon_sub: { type: SchemaType.STRING },
            ribbon_cta: { type: SchemaType.STRING },
            about_heading: { type: SchemaType.STRING },
            about_sub: { type: SchemaType.STRING },
            about_description: { type: SchemaType.STRING },
            check_1_title: { type: SchemaType.STRING }, check_1_desc: { type: SchemaType.STRING },
            check_2_title: { type: SchemaType.STRING }, check_2_desc: { type: SchemaType.STRING },
            check_3_title: { type: SchemaType.STRING }, check_3_desc: { type: SchemaType.STRING },
            contact_name_label: { type: SchemaType.STRING },
            contact_email_label: { type: SchemaType.STRING },
            contact_message_label: { type: SchemaType.STRING },
            contact_submit_label: { type: SchemaType.STRING },
            contact_address: { type: SchemaType.STRING },
            contact_email: { type: SchemaType.STRING },
            contact_phone: { type: SchemaType.STRING },
            contact_hours_label: { type: SchemaType.STRING },
            contact_hours: { type: SchemaType.STRING },
            founder_heading: { type: SchemaType.STRING },
            founder_sub: { type: SchemaType.STRING },
            timeline_1_year: { type: SchemaType.STRING }, timeline_1_desc: { type: SchemaType.STRING },
            timeline_2_year: { type: SchemaType.STRING }, timeline_2_desc: { type: SchemaType.STRING },
            timeline_3_year: { type: SchemaType.STRING }, timeline_3_desc: { type: SchemaType.STRING },
            timeline_4_year: { type: SchemaType.STRING }, timeline_4_desc: { type: SchemaType.STRING },
            timeline_5_year: { type: SchemaType.STRING },
          },
          required: [
            'themeId', 'hero_title', 'hero_description', 'hero_cta',
            'feature_1_title', 'feature_1_desc', 'feature_2_title', 'feature_2_desc', 'feature_3_title', 'feature_3_desc',
            'plan_1_name', 'plan_1_price', 'plan_1_cta', 'plan_2_name', 'plan_2_price', 'plan_2_cta',
            'plan_3_name', 'plan_3_price', 'plan_3_cta',
            'test_1_quote', 'test_1_author', 'test_1_role',
            'ribbon_headline', 'ribbon_sub', 'ribbon_cta', 'about_heading',
          ],
        },
      },
    });

    const systemPrompt = `
      Sei un Senior Neuro-Copywriter specializzato in CRO.
      Genera copy per un sito web professionale.

      --- CLIENTE ---
      Azienda: ${briefData.companyName}
      Target: ${briefData.targetAudience || 'Potenziali clienti B2B e B2C'}
      Obiettivi: ${briefData.goals?.join(', ') || 'Generare contatti e vendite'}
      USP: ${briefData.usp || 'Massima qualità e professionalità'}
      Settore: ${briefData.industry || 'Non specificato'}
      Lingua: ${briefData.language || 'Italiano'}
      Tono: ${briefData.toneOfVoice || 'Professionale e persuasivo'}
      Keywords: ${briefData.keywords?.join(', ') || 'Nessuna specifica'}
      ${briefData.additionalInfo ? `Info aggiuntive: """\n${briefData.additionalInfo}\n"""` : ''}

      --- REGOLE ---
      1. "themeId" = esattamente "${themeId}"
      2. No HTML nei valori. ECCEZIONE: hero_title può contenere <mark style="background-color:rgba(0,0,0,0);color:#7a44ff" class="has-inline-color">parola</mark>
      3. hero_title: max 10 parole, impatto immediato
      4. CTA: max 4 parole, verbo d'azione
      5. Prezzi: formato "€49/mese" o "Su richiesta"
      6. step_*_num: "01", "02", "03", "04"
      7. Descrizioni: max 2-3 frasi, orientate al beneficio
      8. Rispondi SOLO con JSON valido, senza markdown
    `;

    return this.callGemini(model, systemPrompt, themeId, layoutFiles, briefData.companyName);
  }

  // ── Shared Gemini caller con retry ────────────────────────────────────────

  private async callGemini(model: any, prompt: string, themeId: string, layoutFiles: string[], companyName: string) {
    let retries = 5;
    let delay = 5000;

    while (retries > 0) {
      try {
        console.log(`🤖 [Gemini] Tentativo... (rimasti: ${retries})`);
        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(rawText);
        parsedData.themeId = themeId;
        return { themeId, layout_files: layoutFiles, texts: parsedData, companyName };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if ((msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand') || error instanceof SyntaxError) && retries > 1) {
          retries--;
          console.warn(`⏳ [Gemini] Sovraccarico. Attendo ${delay}ms... (rimasti: ${retries})`);
          await new Promise(r => setTimeout(r, delay));
          delay = Math.min(delay * 2, 30000); // max 30s tra tentativi
          continue;
        }
        console.error('❌ ERRORE GEMINI:', msg);
        throw new InternalServerErrorException('Errore generazione testi: ' + msg);
      }
    }
    throw new InternalServerErrorException('Gemini non disponibile. Riprova tra qualche minuto.');
  }
}