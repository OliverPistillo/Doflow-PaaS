import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Request } from 'express';

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
