import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { Readable } from 'stream';

type StorageProbeStatus = 'ok' | 'warn' | 'down';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private s3: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? 'doflow-files';

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
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    return tenantId ?? 'public';
  }

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) {
      throw new Error('No tenant connection on request');
    }
    return conn;
  }

  // ... (Tieni il tuo metodo probe() esistente, è perfetto) ...
  async probe(): Promise<{ status: StorageProbeStatus; latency_ms: number; message?: string }> {
      // ... (copia incolla il tuo codice probe qui) ...
      // Per brevità non lo ripeto, ma mantienilo uguale al tuo file originale
      const t0 = Date.now();
      try {
        await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
        return { status: 'ok', latency_ms: Date.now() - t0 };
      } catch (e: any) {
         return { status: 'down', latency_ms: Date.now() - t0, message: e.message };
      }
  }

  async uploadFile(req: Request, file: Express.Multer.File) {
    const tenantId = this.getTenantId(req);
    const conn = this.getConn(req);

    const authUser = (req as any).authUser as
      | { email?: string | null }
      | undefined;

    const originalName = file.originalname;
    const ext = originalName.includes('.')
      ? originalName.substring(originalName.lastIndexOf('.'))
      : '';
    
    // Generazione Key: TENANT ISOLATION
    const key = `${tenantId}/${randomUUID()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    // Salvataggio Metadati su DB
    // NOTA: Assicurati che la tabella "files" esista nel tenant!
    const rows = await conn.query(
      `
      insert into ${tenantId}.files (key, original_name, content_type, size, created_by)
      values ($1, $2, $3, $4, $5)
      returning id, key, original_name, content_type, size, created_by, created_at
      `,
      [
        key,
        originalName,
        file.mimetype,
        file.size,
        authUser?.email ?? null,
      ],
    );

    this.logger.log(`File uploaded: ${key} (${file.size} bytes)`);
    return rows[0];
  }

  async listFiles(req: Request) {
    const tenantId = this.getTenantId(req);
    const conn = this.getConn(req);

    const rows = await conn.query(
      `
      select id, key, original_name, content_type, size, created_by, created_at
      from ${tenantId}.files
      order by id desc
      limit 100
      `,
    );

    return rows;
  }

  /**
   * --- NUOVO METODO v3.5: Download Sicuro ---
   * Recupera lo stream di un file da S3 verificando la tenancy.
   */
  async downloadFileStream(tenantId: string, key: string) {
    // SECURITY CHECK 1: Path Traversal & Isolation
    // Verifichiamo che la chiave richiesta inizi con l'ID del tenant corrente.
    // Nessuno può scaricare "tenantB/segreto.pdf" se è loggato come "tenantA".
    if (!key.startsWith(`${tenantId}/`)) {
        this.logger.warn(`Security Alert: Tenant ${tenantId} tried to access ${key}`);
        throw new ForbiddenException('Access Denied: File belongs to another tenant');
    }

    try {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const item = await this.s3.send(command);
        
        return {
            stream: item.Body as Readable, // Stream Node.js standard
            contentType: item.ContentType,
            contentLength: item.ContentLength,
        };
    } catch (e: any) {
        if (e.name === 'NoSuchKey' || e['$metadata']?.httpStatusCode === 404) {
            throw new NotFoundException('File not found in storage');
        }
        this.logger.error('S3 Download Error', e);
        throw e;
    }
  }
}