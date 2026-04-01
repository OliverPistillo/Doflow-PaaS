// apps/backend/src/superadmin/quote-request.service.ts
// MODIFICATO: aggiunto metodo getStats() per la Control Room.
// Tutto il resto è invariato rispetto all'originale.

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import archiver, { Archiver } from 'archiver';
import { QuoteRequest, QuoteRequestStatus } from './entities/quote-request.entity';

interface UploadedFile {
  fieldname:    string;
  originalname: string;
  encoding:     string;
  mimetype:     string;
  buffer:       Buffer;
  size:         number;
}

export interface QuoteFormData {
  clientName:   string;
  clientEmail:  string;
  clientPhone?: string;
  companyName?: string;
  subject?:     string;
  message?:     string;
}

@Injectable()
export class QuoteRequestService {
  private readonly logger = new Logger(QuoteRequestService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(QuoteRequest)
    private readonly quoteRepo: Repository<QuoteRequest>,
  ) {
    this.bucket = process.env.S3_BUCKET_QUOTES ?? 'doflow-quotes';

    this.s3 = new S3Client({
      region:         process.env.S3_REGION ?? 'us-east-1',
      endpoint:       process.env.S3_ENDPOINT,
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true',
      credentials: {
        accessKeyId:     process.env.S3_ACCESS_KEY_ID     ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
    });

    this.ensureBucket().catch((err) =>
      this.logger.error('Errore creazione bucket quote:', err.message),
    );
  }

  // ── UPLOAD (Pubblica) ───────────────────────────────────────────────────────

  async createQuoteRequest(
    formData:      QuoteFormData,
    files:         UploadedFile[],
    sourceIp?:     string,
    sourceOrigin?: string,
  ): Promise<QuoteRequest> {
    if (!formData.clientName?.trim()) {
      throw new BadRequestException('Il campo "nome" è obbligatorio');
    }
    if (!formData.clientEmail?.trim()) {
      throw new BadRequestException('Il campo "email" è obbligatorio');
    }

    const safeEmail    = this.sanitizeForPrefix(formData.clientEmail.trim().toLowerCase());
    const timestamp    = Date.now();
    const minioPrefix  = `${safeEmail}/${timestamp}/`;

    let filesCount = 0;
    if (files && files.length > 0) {
      const results = await Promise.allSettled(
        files.map((file) => this.uploadSingleFile(minioPrefix, file)),
      );
      filesCount = results.filter((r) => r.status === 'fulfilled').length;

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        this.logger.warn(
          `${failed.length} file su ${files.length} non caricati per ${safeEmail}`,
        );
      }
    }

    const quoteRequest = this.quoteRepo.create({
      clientName:   formData.clientName.trim(),
      clientEmail:  formData.clientEmail.trim().toLowerCase(),
      clientPhone:  formData.clientPhone?.trim()  || null,
      companyName:  formData.companyName?.trim()  || null,
      subject:      formData.subject?.trim()      || null,
      message:      formData.message?.trim()      || null,
      minioPrefix:  filesCount > 0 ? minioPrefix  : null,
      filesCount,
      status:       QuoteRequestStatus.NUOVA,
      sourceIp:     sourceIp     || null,
      sourceOrigin: sourceOrigin || null,
    });

    const saved = await this.quoteRepo.save(quoteRequest);
    this.logger.log(
      `✅ Nuova richiesta preventivo: ${saved.id} da ${saved.clientEmail} (${filesCount} file)`,
    );
    return saved;
  }

  // ── DOWNLOAD (Protetta) ────────────────────────────────────────────────────

  async downloadFilesAsZip(requestId: string): Promise<{
    stream:   Archiver;
    filename: string;
  }> {
    const request = await this.quoteRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Richiesta preventivo non trovata');
    }
    if (!request.minioPrefix) {
      throw new NotFoundException('Nessun file allegato a questa richiesta');
    }

    const objects = await this.listObjectsByPrefix(request.minioPrefix);
    if (objects.length === 0) {
      throw new NotFoundException('Nessun file trovato su MinIO per questa richiesta');
    }

    const archive = archiver('zip', { zlib: { level: 6 } });

    for (const obj of objects) {
      if (!obj.Key) continue;
      try {
        const response = await this.s3.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: obj.Key }),
        );
        if (response.Body) {
          const fileName = obj.Key.split('/').pop() || obj.Key;
          archive.append(response.Body as Readable, { name: fileName });
        }
      } catch (err) {
        this.logger.warn(
          `Impossibile recuperare file ${obj.Key}: ${(err as Error).message}`,
        );
      }
    }

    archive.finalize();

    const safeEmail   = this.sanitizeForPrefix(request.clientEmail);
    const zipFilename = `preventivo_${safeEmail}_${Date.now()}.zip`;

    return { stream: archive, filename: zipFilename };
  }

  // ── DELETE FILE (Protetta) ─────────────────────────────────────────────────

  async deleteRequestFiles(requestId: string): Promise<{ deleted: number }> {
    const request = await this.quoteRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Richiesta preventivo non trovata');
    }
    if (!request.minioPrefix) {
      return { deleted: 0 };
    }

    const objects = await this.listObjectsByPrefix(request.minioPrefix);
    if (objects.length === 0) {
      await this.quoteRepo.update(requestId, { minioPrefix: null, filesCount: 0 });
      return { deleted: 0 };
    }

    const deleteKeys = objects
      .filter((o) => o.Key)
      .map((o) => ({ Key: o.Key! }));

    try {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: deleteKeys, Quiet: true },
        }),
      );
    } catch (err) {
      this.logger.error('Errore eliminazione file MinIO:', (err as Error).message);
      throw new InternalServerErrorException('Errore durante l\'eliminazione dei file');
    }

    await this.quoteRepo.update(requestId, { minioPrefix: null, filesCount: 0 });
    this.logger.log(`🗑️ Eliminati ${deleteKeys.length} file per richiesta ${requestId}`);

    return { deleted: deleteKeys.length };
  }

  // ── CRUD Admin ─────────────────────────────────────────────────────────────

  async findAll(filters?: {
    status?: QuoteRequestStatus;
    search?: string;
  }): Promise<QuoteRequest[]> {
    const qb = this.quoteRepo
      .createQueryBuilder('qr')
      .orderBy('qr.created_at', 'DESC');

    if (filters?.status) {
      qb.andWhere('qr.status = :status', { status: filters.status });
    }
    if (filters?.search) {
      qb.andWhere(
        '(qr.client_name ILIKE :s OR qr.client_email ILIKE :s OR qr.company_name ILIKE :s OR qr.subject ILIKE :s)',
        { s: `%${filters.search}%` },
      );
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<QuoteRequest> {
    const request = await this.quoteRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Richiesta preventivo non trovata');
    }
    return request;
  }

  async updateRequest(
    id:   string,
    data: { status?: QuoteRequestStatus; adminNotes?: string },
  ): Promise<QuoteRequest> {
    const request = await this.findOne(id);
    if (data.status     !== undefined) request.status     = data.status;
    if (data.adminNotes !== undefined) request.adminNotes = data.adminNotes;
    return this.quoteRepo.save(request);
  }

  async deleteRequest(id: string): Promise<void> {
    await this.deleteRequestFiles(id);
    await this.quoteRepo.delete(id);
    this.logger.log(`🗑️ Richiesta ${id} eliminata completamente`);
  }

  // ── STATS (Nuova) ──────────────────────────────────────────────────────────
  // Usato da GET /superadmin/quote-requests/stats → Control Room dashboard.
  // Conta le richieste per stato senza caricare i record completi.

  async getStats(): Promise<{
    total:          number;
    pendingCount:   number;
    assignedCount:  number;
    sentCount:      number;
    archivedCount:  number;
  }> {
    // Query GROUP BY status per un singolo round-trip al DB
    const raw: { status: string; count: string }[] = await this.quoteRepo
      .createQueryBuilder('qr')
      .select('qr.status', 'status')
      .addSelect('COUNT(qr.id)', 'count')
      .groupBy('qr.status')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of raw) {
      const n = parseInt(row.count, 10) || 0;
      byStatus[row.status] = n;
      total += n;
    }

    return {
      total,
      // NUOVA     = arrivata, non ancora vista
      pendingCount:  byStatus[QuoteRequestStatus.NUOVA]               ?? 0,
      // IN_LAVORAZIONE = presa in carico da un admin
      assignedCount: byStatus[QuoteRequestStatus.IN_LAVORAZIONE]      ?? 0,
      // PREVENTIVO_INVIATO = offerta inviata al cliente
      sentCount:     byStatus[QuoteRequestStatus.PREVENTIVO_INVIATO]  ?? 0,
      // ARCHIVIATA = chiusa o scartata
      archivedCount: byStatus[QuoteRequestStatus.ARCHIVIATA]          ?? 0,
    };
  }

  // ── Privati ────────────────────────────────────────────────────────────────

  private async uploadSingleFile(prefix: string, file: UploadedFile): Promise<string> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key      = `${prefix}${safeName}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        file.buffer,
        ContentType: file.mimetype,
      }),
    );

    this.logger.debug(`File caricato su MinIO: ${key} (${file.size} bytes)`);
    return key;
  }

  private async listObjectsByPrefix(prefix: string) {
    const objects: { Key?: string; Size?: number }[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket:            this.bucket,
          Prefix:            prefix,
          ContinuationToken: continuationToken,
        }),
      );

      if (response.Contents) {
        objects.push(...response.Contents);
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return objects;
  }

  private sanitizeForPrefix(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .replace(/\/{2,}/g, '/')
      .substring(0, 100);
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`✅ Bucket "${this.bucket}" verificato`);
    } catch (err: any) {
      if (err['$metadata']?.httpStatusCode === 404 || err.name === 'NotFound') {
        this.logger.warn(`Bucket "${this.bucket}" non trovato, lo creo...`);
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`✅ Bucket "${this.bucket}" creato`);
      } else {
        throw err;
      }
    }
  }
}
