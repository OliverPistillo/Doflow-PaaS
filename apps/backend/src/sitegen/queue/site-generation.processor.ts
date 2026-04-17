import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ManifestGeneratorService } from '../manifest-generator.service';
import { ExportStoreService } from '../storage/export-store.service';
import { GenerateSiteBriefDto } from '../dto/generate-site-brief.dto';

@Processor('site-generation')
export class SiteGenerationProcessor extends WorkerHost {
  constructor(
    private readonly manifestGeneratorService: ManifestGeneratorService,
    private readonly exportStoreService: ExportStoreService,
  ) {
    super();
  }

  async process(job: Job<GenerateSiteBriefDto, unknown, string>): Promise<any> {
    const result = await this.manifestGeneratorService.generate(job.data);
    const token = await this.exportStoreService.saveAndGenerateToken(result.manifest);

    return {
      token,
      exportId: result.manifest.exportId,
      manifest: result.manifest,
      copy: result.copy,
    };
  }
}
