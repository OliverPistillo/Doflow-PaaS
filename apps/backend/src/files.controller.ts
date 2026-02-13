import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileStorageService } from './file-storage.service';

@Controller('files')
export class FilesController {
  constructor(private readonly fileStorage: FileStorageService) {}

  @Get()
  async list(@Req() req: Request, @Res() res: Response) {
    const authUser = (req as any).authUser;
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const files = await this.fileStorage.listFiles(req);
    return res.json({ files });
  }

  /**
   * --- NUOVO ENDPOINT v3.5: Secure Download ---
   * Esempio: GET /api/files/download?key=tenant_x/file.pdf
   */
  @Get('download')
  async download(
    @Req() req: Request,
    @Query('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Auth Check
    const authUser = (req as any).authUser;
    if (!authUser) {
       // O lascia gestire al AuthMiddleware se applicato globalmente
       // qui per sicurezza esplicita:
       res.status(401);
       return; 
    }

    // 2. Tenant Context (dal middleware)
    const tenantId = (req as any).tenantId;
    if (!tenantId) throw new BadRequestException('No tenant context');
    if (!key) throw new BadRequestException('Missing file key');

    // 3. Recupera Stream da S3 (Secure Proxy)
    const { stream, contentType, contentLength } = await this.fileStorage.downloadFileStream(tenantId, key);

    // 4. Imposta Headers
    res.set({
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': contentLength,
      // Se vuoi forzare il download invece della visualizzazione browser:
      // 'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
    });

    // 5. Pipe diretto (efficienza massima, poca RAM usata)
    return new StreamableFile(stream);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async upload(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const authUser = (req as any).authUser;
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!file) {
      return res.status(400).json({ error: 'file required' });
    }

    try {
      const stored = await this.fileStorage.uploadFile(req, file);
      return res.json({ file: stored });
    } catch (e) {
      if (e instanceof Error) {
        return res.status(500).json({ error: e.message });
      }
      return res.status(500).json({ error: 'Unknown error' });
    }
  }
}