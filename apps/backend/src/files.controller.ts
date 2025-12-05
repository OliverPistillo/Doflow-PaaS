import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
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
