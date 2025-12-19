import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Request } from 'express';

type StorageProbeStatus = 'ok' | 'warn' | 'down';

@Injectable()
export class FileStorageService {
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

  /**
   * ✅ Probe reale Storage (S3/MinIO):
   * - tenta HeadBucket (cheap)
   * - fallback a ListBuckets (alcuni setup MinIO/S3 policy)
   */
  async probe(): Promise<{ status: StorageProbeStatus; latency_ms: number; message?: string }> {
    const t0 = Date.now();

    // Guardrail: se mancano credenziali spesso significa che storage non è configurato
    const accessKey = process.env.S3_ACCESS_KEY_ID ?? '';
    const secretKey = process.env.S3_SECRET_ACCESS_KEY ?? '';
    if (!accessKey || !secretKey) {
      return {
        status: 'warn',
        latency_ms: Date.now() - t0,
        message: 'missing S3 credentials (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)',
      };
    }

    try {
      // 1) prova HeadBucket sul bucket configurato
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      const ms = Date.now() - t0;
      return {
        status: ms > 350 ? 'warn' : 'ok',
        latency_ms: ms,
      };
    } catch (e: any) {
      // Alcuni errori comuni
      const name = e?.name as string | undefined;
      const code = e?.Code as string | undefined;
      const httpCode = e?.$metadata?.httpStatusCode as number | undefined;

      // 404 / NoSuchBucket → down (bucket non esiste o endpoint errato)
      if (httpCode === 404 || code === 'NoSuchBucket' || name === 'NoSuchBucket') {
        const ms = Date.now() - t0;
        return {
          status: 'down',
          latency_ms: ms,
          message: `bucket not found: ${this.bucket}`,
        };
      }

      // Access denied → warn (storage raggiungibile ma permessi non sufficienti)
      if (httpCode === 403 || name === 'AccessDenied' || code === 'AccessDenied') {
        const ms = Date.now() - t0;
        return {
          status: 'warn',
          latency_ms: ms,
          message: `access denied on bucket: ${this.bucket}`,
        };
      }

      // 2) fallback: ListBuckets (utile su MinIO/policy strane)
      try {
        await this.s3.send(new ListBucketsCommand({}));
        const ms = Date.now() - t0;
        return {
          status: ms > 350 ? 'warn' : 'ok',
          latency_ms: ms,
          message: 'headBucket failed, listBuckets ok',
        };
      } catch (e2: any) {
        const ms = Date.now() - t0;
        const msg =
          e2?.message ||
          e?.message ||
          'storage probe failed';
        return {
          status: 'down',
          latency_ms: ms,
          message: msg,
        };
      }
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
    const key = `${tenantId}/${randomUUID()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

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
}
