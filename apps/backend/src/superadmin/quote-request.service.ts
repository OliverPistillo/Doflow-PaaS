// apps/backend/src/superadmin/quote-request.service.ts
// Servizio per la gestione delle richieste di preventivo.
// Gestisce: salvataggio dati su DB, upload file su MinIO,
// download compresso (zip on-the-fly), eliminazione file.

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

/**
 * Struttura del file ricevuto dal form multipart.
 * Multer popola questi campi automaticamente.
 */
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

/**
 * Dati testuali estratti dal form di richiesta preventivo.
 */
export interface QuoteFormData {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  companyName?: string;
  subject?: string;
  message?: string;
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
    // Configurazione client S3/MinIO tramite variabili d'ambiente
    this.bucket = process.env.S3_BUCKET_QUOTES ?? 'doflow-quotes';

    this.s3 = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle:
        (process.env.S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
    });

    // Verifica/crea il bucket all'avvio (asincrono, non bloccante)
    this.ensureBucket().catch((err) =>
      this.logger.error('Errore creazione bucket quote:', err.message),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // UPLOAD API (Pubblica) — Riceve form + file dal sito web
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Processa una nuova richiesta di preventivo:
   * 1. Sanitizza l'email per creare un prefisso sicuro su MinIO
   * 2. Carica ogni file allegato su MinIO sotto il prefisso email/timestamp/
   * 3. Salva i dati testuali nel database con il riferimento al prefisso
   */
  async createQuoteRequest(
    formData: QuoteFormData,
    files: UploadedFile[],
    sourceIp?: string,
    sourceOrigin?: string,
  ): Promise<QuoteRequest> {
    // Validazione base
    if (!formData.clientName?.trim()) {
      throw new BadRequestException('Il campo "nome" è obbligatorio');
    }
    if (!formData.clientEmail?.trim()) {
      throw new BadRequestException('Il campo "email" è obbligatorio');
    }

    // Sanitizzazione email per uso come prefisso MinIO
    // Rimuoviamo caratteri pericolosi (path traversal, spazi, ecc.)
    const safeEmail = this.sanitizeForPrefix(formData.clientEmail.trim().toLowerCase());
    const timestamp = Date.now();
    const minioPrefix = `${safeEmail}/${timestamp}/`;

    // Upload parallelo dei file su MinIO (se presenti)
    let filesCount = 0;
    if (files && files.length > 0) {
      const uploadPromises = files.map((file) =>
        this.uploadSingleFile(minioPrefix, file),
      );

      const results = await Promise.allSettled(uploadPromises);

      // Conteggio file caricati con successo
      filesCount = results.filter((r) => r.status === 'fulfilled').length;

      // Log degli eventuali errori (non blocchiamo il salvataggio dei dati)
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        this.logger.warn(
          `${failed.length} file su ${files.length} non caricati per ${safeEmail}`,
        );
      }
    }

    // Salvataggio nel database
    const quoteRequest = this.quoteRepo.create({
      clientName: formData.clientName.trim(),
      clientEmail: formData.clientEmail.trim().toLowerCase(),
      clientPhone: formData.clientPhone?.trim() || null,
      companyName: formData.companyName?.trim() || null,
      subject: formData.subject?.trim() || null,
      message: formData.message?.trim() || null,
      minioPrefix: filesCount > 0 ? minioPrefix : null,
      filesCount,
      status: QuoteRequestStatus.NUOVA,
      sourceIp: sourceIp || null,
      sourceOrigin: sourceOrigin || null,
    });

    const saved = await this.quoteRepo.save(quoteRequest);
    this.logger.log(
      `✅ Nuova richiesta preventivo: ${saved.id} da ${saved.clientEmail} (${filesCount} file)`,
    );

    return saved;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // DOWNLOAD API (Protetta) — Genera uno zip al volo per l'admin
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Dato l'ID di una richiesta, recupera tutti i file da MinIO
   * e li restituisce come stream zip (archiver).
   * Non salva nulla su disco: tutto in memoria/stream.
   */
  async downloadFilesAsZip(requestId: string): Promise<{
    stream: Archiver;
    filename: string;
  }> {
    // Recupera la richiesta dal DB
    const request = await this.quoteRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Richiesta preventivo non trovata');
    }
    if (!request.minioPrefix) {
      throw new NotFoundException('Nessun file allegato a questa richiesta');
    }

    // Lista tutti gli oggetti sotto il prefisso MinIO
    const objects = await this.listObjectsByPrefix(request.minioPrefix);
    if (objects.length === 0) {
      throw new NotFoundException('Nessun file trovato su MinIO per questa richiesta');
    }

    // Creazione archivio zip in streaming
    const archive = archiver('zip', { zlib: { level: 6 } });

    // Per ogni file su MinIO, aggiungiamo lo stream all'archivio
    for (const obj of objects) {
      if (!obj.Key) continue;

      try {
        const getCmd = new GetObjectCommand({
          Bucket: this.bucket,
          Key: obj.Key,
        });
        const response = await this.s3.send(getCmd);

        if (response.Body) {
          // Estraiamo solo il nome file dal path completo
          const fileName = obj.Key.split('/').pop() || obj.Key;
          archive.append(response.Body as Readable, { name: fileName });
        }
      } catch (err) {
        this.logger.warn(`Impossibile recuperare file ${obj.Key}: ${(err as Error).message}`);
      }
    }

    // Finalizziamo l'archivio (avvierà lo stream)
    archive.finalize();

    // Nome del file zip: "preventivo_email_timestamp.zip"
    const safeEmail = this.sanitizeForPrefix(request.clientEmail);
    const zipFilename = `preventivo_${safeEmail}_${Date.now()}.zip`;

    return { stream: archive, filename: zipFilename };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // DELETE API (Protetta) — Elimina tutti i file di una richiesta da MinIO
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Elimina definitivamente tutti i file di una richiesta da MinIO
   * e aggiorna il record nel database.
   */
  async deleteRequestFiles(requestId: string): Promise<{ deleted: number }> {
    const request = await this.quoteRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Richiesta preventivo non trovata');
    }
    if (!request.minioPrefix) {
      return { deleted: 0 };
    }

    // Lista tutti gli oggetti sotto il prefisso
    const objects = await this.listObjectsByPrefix(request.minioPrefix);
    if (objects.length === 0) {
      // Aggiorna il DB comunque (pulizia dati orfani)
      await this.quoteRepo.update(requestId, { minioPrefix: null, filesCount: 0 });
      return { deleted: 0 };
    }

    // Eliminazione batch su MinIO (max 1000 oggetti per chiamata)
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

    // Aggiorna il record nel DB
    await this.quoteRepo.update(requestId, { minioPrefix: null, filesCount: 0 });

    this.logger.log(
      `🗑️ Eliminati ${deleteKeys.length} file per richiesta ${requestId}`,
    );

    return { deleted: deleteKeys.length };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CRUD Admin — Lista, dettaglio, aggiornamento stato
  // ──────────────────────────────────────────────────────────────────────────────

  /** Lista tutte le richieste, ordinate per data (più recenti prima) */
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

  /** Dettaglio singola richiesta */
  async findOne(id: string): Promise<QuoteRequest> {
    const request = await this.quoteRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Richiesta preventivo non trovata');
    }
    return request;
  }

  /** Aggiorna stato e/o note admin */
  async updateRequest(
    id: string,
    data: { status?: QuoteRequestStatus; adminNotes?: string },
  ): Promise<QuoteRequest> {
    const request = await this.findOne(id);

    if (data.status !== undefined) {
      request.status = data.status;
    }
    if (data.adminNotes !== undefined) {
      request.adminNotes = data.adminNotes;
    }

    return this.quoteRepo.save(request);
  }

  /** Elimina completamente la richiesta (DB + MinIO) */
  async deleteRequest(id: string): Promise<void> {
    // Prima elimina i file da MinIO
    await this.deleteRequestFiles(id);
    // Poi elimina il record dal DB
    await this.quoteRepo.delete(id);
    this.logger.log(`🗑️ Richiesta ${id} eliminata completamente`);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Metodi privati di utilità
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Carica un singolo file su MinIO sotto il prefisso specificato.
   * Non salva nulla su disco: usa direttamente il buffer di Multer.
   */
  private async uploadSingleFile(prefix: string, file: UploadedFile): Promise<string> {
    // Sanitizzazione del nome file originale
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${prefix}${safeName}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    this.logger.debug(`File caricato su MinIO: ${key} (${file.size} bytes)`);
    return key;
  }

  /**
   * Lista tutti gli oggetti sotto un dato prefisso su MinIO.
   * Gestisce la paginazione automaticamente.
   */
  private async listObjectsByPrefix(prefix: string) {
    const objects: { Key?: string; Size?: number }[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
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

  /**
   * Sanitizza una stringa per l'uso come segmento di path su MinIO.
   * Rimuove caratteri pericolosi mantenendo leggibilità.
   */
  private sanitizeForPrefix(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, '_') // Solo caratteri sicuri
      .replace(/\.{2,}/g, '.') // No ".." (path traversal)
      .replace(/\/{2,}/g, '/') // No "//" 
      .substring(0, 100); // Lunghezza massima ragionevole
  }

  /**
   * Verifica che il bucket esista, altrimenti lo crea.
   * Chiamato una sola volta all'avvio del servizio.
   */
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