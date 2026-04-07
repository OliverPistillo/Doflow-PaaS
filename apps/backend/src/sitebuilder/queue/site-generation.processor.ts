// apps/backend/src/sitebuilder/queue/site-generation.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AiGeneratorService } from '../ai-generator.service';
import { SiteStorageService } from '../site-storage.service';

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
      
      // 2. Salva in Redis/Memoria e genera il token JWT
      const exportToken = await this.siteStorageService.saveAndGenerateToken(generatedData);
      
      console.log(`Job ${job.id} completato con successo. Token generato.`);
      
      // Il risultato del job conterrà il token
      return { token: exportToken };
    } catch (error) {
      console.error(`Errore nel job ${job.id}:`, error);
      throw error;
    }
  }
}