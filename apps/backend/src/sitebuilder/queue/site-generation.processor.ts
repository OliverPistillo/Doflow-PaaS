// apps/backend/src/sitebuilder/queue/site-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AiGeneratorService } from '../ai-generator.service';
import { SiteStorageService } from '../site-storage.service';
import { THEMES_REGISTRY, PAGE_PATTERNS, PAGE_SLUGS } from '../themes.registry';

@Processor('site-generation')
export class SiteGenerationProcessor extends WorkerHost {
  constructor(
    private readonly aiGeneratorService: AiGeneratorService,
    private readonly siteStorageService: SiteStorageService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    console.log(`Inizio elaborazione job ${job.id} per azienda: ${job.data.companyName}`);

    try {
      // 1. Genera i testi con Gemini
      const generatedData = await this.aiGeneratorService.generateCopy(job.data);

      const themeId = generatedData.themeId;

      // 2. Costruisci la struttura pages[] dalle pagine scelte dall'utente nel wizard
      //    job.data.pages è un string[] es. ['Home', 'Chi Siamo', 'Contatti']
      const requestedPages: string[] = job.data.pages?.length > 0
        ? job.data.pages
        : ['Home'];

      const pages = requestedPages.map((pageName, index) => {
        const patternKey = pageName as keyof typeof PAGE_PATTERNS;
        return {
          title:        pageName,
          slug:         PAGE_SLUGS[patternKey] ?? pageName.toLowerCase().replace(/\s+/g, '-'),
          layout_files: PAGE_PATTERNS[patternKey] ?? PAGE_PATTERNS['Home'],
          set_as_front: index === 0, // La prima pagina (Home) diventa la frontpage
          texts:        {},          // Override testi per-pagina (futuro)
        };
      });

      // 3. Payload completo per il plugin DoFlow Studio
      const payload = {
        themeId:      themeId,
        companyName:  job.data.companyName,
        texts:        generatedData.texts,    // testi globali AI usati da tutte le pagine
        pages:        pages,                  // struttura multi-pagina per il plugin v8+
        // Legacy compat: layout_files per plugin più vecchi
        layout_files: THEMES_REGISTRY[themeId] ?? THEMES_REGISTRY['doflow-first'],
      };

      // 4. Salva e genera token
      const exportToken = await this.siteStorageService.saveAndGenerateToken(payload);

      console.log(`Job ${job.id} completato. Pagine: ${requestedPages.join(', ')}`);
      return { token: exportToken };

    } catch (error) {
      console.error(`Errore nel job ${job.id}:`, error);
      throw error;
    }
  }
}