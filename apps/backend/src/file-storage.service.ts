import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { Readable } from 'stream';

type StorageProbeStatus = 'ok' | 'warn' | 'down';

export class ThemePackageUploadError extends Error {
  constructor(
    public readonly storagePrefix: string,
    public readonly cleanupRequired: boolean,
    public readonly originalError: unknown,
  ) {
    super('Theme package upload failed');
  }
}

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
    const authUser = (req as any).authUser || (req as any).user;
    if (authUser?.tenantId && authUser.tenantId !== 'public') return authUser.tenantId;
    if (authUser?.tenant_id && authUser.tenant_id !== 'public') return authUser.tenant_id;
    if (authUser?.tenantSlug && authUser.tenantSlug !== 'public') return authUser.tenantSlug;

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
      } catch (e: unknown) {
         const message = e instanceof Error ? e.message : String(e);
         return { status: 'down', latency_ms: Date.now() - t0, message };
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

  getBucketName(): string {
    return this.bucket;
  }

  async uploadBuffer(key: string, file: Express.Multer.File) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    this.logger.log(`Object uploaded: ${key} (${file.size} bytes)`);
    return {
      bucket: this.bucket,
      key,
      contentType: file.mimetype,
      size: file.size,
    };
  }

  async uploadGeneratedBuffer(key: string, buffer: Buffer, contentType: string) {
    if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\') || key.includes('\0')) {
      throw new ForbiddenException('Invalid generated object key');
    }
    if (!buffer?.length) throw new ForbiddenException('Generated buffer is empty');
    if (buffer.length > 25 * 1024 * 1024) throw new ForbiddenException('Generated buffer is too large');
    if (!contentType || /[\r\n]/.test(contentType)) throw new ForbiddenException('Invalid content type');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    this.logger.log(`Generated object uploaded: ${key} (${buffer.length} bytes)`);
    return { bucket: this.bucket, key, contentType, size: buffer.length };
  }

  proposalThemePrefix(slug: string, version: string): string {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
      throw new ForbiddenException('Invalid proposal theme identity');
    }
    return `doflow/site-proposal-themes/${slug}/${version}/`;
  }

  async uploadThemePackage(slug: string, version: string, input: { zip: Buffer; template: Buffer; manifest: Buffer; documentation?: Record<string, Buffer> }) {
    const prefix = this.proposalThemePrefix(slug, version);
    const docs = input.documentation || {};
    for (const name of Object.keys(docs)) if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:md|txt)$/i.test(name) || name.startsWith('.')) throw new ForbiddenException('Invalid theme documentation name');
    const uploads: Array<{ key: string; buffer: Buffer; contentType: string }> = [
      { key: `${prefix}source.zip`, buffer: input.zip, contentType: 'application/zip' },
      { key: `${prefix}template.html`, buffer: input.template, contentType: 'text/html; charset=utf-8' },
      { key: `${prefix}theme.json`, buffer: input.manifest, contentType: 'application/json' },
      ...Object.entries(docs).sort(([left], [right]) => left.localeCompare(right)).map(([name, buffer]) => ({ key: `${prefix}${name}`, buffer, contentType: name.toLowerCase().endsWith('.md') ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8' })),
    ];
    const uploadedKeys: string[] = [];
    try {
      for (const upload of uploads) {
        await this.uploadGeneratedBuffer(upload.key, upload.buffer, upload.contentType);
        uploadedKeys.push(upload.key);
      }
    } catch (error) {
      const cleanup = await Promise.allSettled(uploadedKeys.map((key) => this.deleteThemeObjects(prefix, [key])));
      throw new ThemePackageUploadError(prefix, cleanup.some((result) => result.status === 'rejected'), error);
    }
    return { prefix, zipKey: `${prefix}source.zip`, templateKey: `${prefix}template.html` };
  }

  async readThemeTemplate(slug: string, version: string): Promise<Buffer> {
    const key = `${this.proposalThemePrefix(slug, version)}template.html`;
    const item = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return this.readBody(item.Body);
  }

  async downloadThemePackage(slug: string, version: string) {
    const key = `${this.proposalThemePrefix(slug, version)}source.zip`;
    return this.downloadObjectStream(key);
  }

  async deleteThemePrefix(slug: string, version: string): Promise<number> {
    const prefix = this.proposalThemePrefix(slug, version);
    return this.deleteThemeStoragePrefix(prefix);
  }

  async deleteThemeStoragePrefix(prefix: string): Promise<number> {
    if (!/^doflow\/site-proposal-themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\/$/.test(prefix)) throw new ForbiddenException('Invalid proposal theme storage prefix');
    let continuationToken: string | undefined;
    let deleted = 0;
    do {
      const page = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken }));
      const keys = (page.Contents || []).map((object) => object.Key).filter((key): key is string => Boolean(key) && key!.startsWith(prefix));
      if (keys.length) {
        await this.deleteThemeObjects(prefix, keys);
        deleted += keys.length;
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return deleted;
  }

  private async deleteThemeObjects(prefix: string, keys: string[]): Promise<void> {
    if (!keys.length || keys.some((key) => !key.startsWith(prefix) || key.includes('..') || key.includes('\\') || key.includes('\0'))) throw new ForbiddenException('Invalid theme object key');
    const result = await this.s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
    if (result.Errors?.length) throw new Error('Theme object deletion failed');
  }

  private async readBody(body: unknown): Promise<Buffer> {
    if (!body) throw new NotFoundException('File not found in storage');
    const transformable = body as { transformToByteArray?: () => Promise<Uint8Array> };
    if (typeof transformable.transformToByteArray === 'function') return Buffer.from(await transformable.transformToByteArray());
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async deleteGeneratedPrefix(prefix: string): Promise<number> {
    const match = /^doflow\/site-proposals\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/$/i.exec(
      prefix,
    );
    if (
      !match ||
      !prefix ||
      prefix.startsWith('/') ||
      prefix.includes('..') ||
      prefix.includes('\\') ||
      prefix.includes('\0')
    ) {
      throw new ForbiddenException('Invalid generated object prefix');
    }

    let continuationToken: string | undefined;
    let deleted = 0;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      const keys = (page.Contents || [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key));

      for (let index = 0; index < keys.length; index += 1000) {
        const chunk = keys.slice(index, index + 1000);
        const result = await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
          }),
        );
        if (result.Errors?.length) {
          throw new Error('Generated object deletion failed');
        }
        deleted += chunk.length;
      }

      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);

    this.logger.log(`Generated proposal objects deleted: ${match[1].slice(0, 8)} (${deleted})`);
    return deleted;
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
    } catch (e: unknown) {
        type AwsErrorLike = Error & {
            $metadata?: {
                httpStatusCode?: number;
            };
        };
        const err = e as AwsErrorLike;

        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
            throw new NotFoundException('File not found in storage');
        }
        this.logger.error('S3 Download Error', err);
        throw err;
    }
  }

  async downloadObjectStream(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const item = await this.s3.send(command);
      return {
        stream: item.Body as Readable,
        contentType: item.ContentType,
        contentLength: item.ContentLength,
      };
    } catch (e: unknown) {
      type AwsErrorLike = Error & {
        $metadata?: {
          httpStatusCode?: number;
        };
      };
      const err = e as AwsErrorLike;

      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException('File not found in storage');
      }
      this.logger.error('S3 Download Error', err);
      throw err;
    }
  }
}
