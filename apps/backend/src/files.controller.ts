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
import { AuditService } from './audit.service'; // <--- Import AuditService

@Controller('files')
export class FilesController {
  // Iniettiamo AuditService
  constructor(
    private readonly fileStorage: FileStorageService,
    private readonly auditService: AuditService 
  ) {}

  @Get()
  async list(@Req() req: Request, @Res() res: Response) {
    const authUser = (req as any).authUser;
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const files = await this.fileStorage.listFiles(req);
    return res.json({ files });
  }

  @Get('download')
  async download(
    @Req() req: Request,
    @Query('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authUser = (req as any).authUser;
    if (!authUser) {
       res.status(401);
       return; 
    }

    const tenantId = (req as any).tenantId;
    if (!tenantId) throw new BadRequestException('No tenant context');
    if (!key) throw new BadRequestException('Missing file key');

    const { stream, contentType, contentLength } = await this.fileStorage.downloadFileStream(tenantId, key);

    // Opzionale: Logghiamo anche il download? Spesso genera troppo rumore, 
    // ma per file sensibili si potrebbe fare. Per ora lo lascio commentato.
    /*
    await this.auditService.log(req, {
        action: 'FILE_DOWNLOAD',
        metadata: { key }
    });
    */

    res.set({
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': contentLength,
    });

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

      // --- AUDIT LOGGING ---
      await this.auditService.log(req, {
        action: 'FILE_UPLOAD',
        metadata: {
            fileId: stored.id,
            fileName: stored.original_name,
            size: stored.size,
            key: stored.key
        }
      });
      // ---------------------

      return res.json({ file: stored });
    } catch (e) {
      if (e instanceof Error) {
        return res.status(500).json({ error: e.message });
      }
      return res.status(500).json({ error: 'Unknown error' });
    }
  }
}