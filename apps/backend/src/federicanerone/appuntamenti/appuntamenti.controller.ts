import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { assertAuthenticated, assertFedericaTenant, getTenantConn, respondError } from '../../tenant-helpers';
import { AppuntamentiService, CreateAppuntamentoDto, UpdateAppuntamentoDto } from './appuntamenti.service';

@Controller('appuntamenti')
export class AppuntamentiController {
  constructor(private readonly service: AppuntamentiService) {}

  // --- NUOVO ENDPOINT STATISTICHE ---
  // Importante: mettilo PRIMA di @Get(':id') se ce l'avessi, per evitare conflitti di routing
  @Get('stats')
  async getStats(@Req() req: Request, @Res() res: Response, @Query('year') year?: string) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      // Anno corrente di default se non specificato
      const targetYear = year ? Number(year) : new Date().getFullYear();
      
      const stats = await this.service.getStats(ds, targetYear);
      return res.json(stats);
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Get()
  async list(@Req() req: Request, @Res() res: Response, @Query() query: any) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      const filters = {
        status: query.status,
        from: query.from,
        to: query.to,
      };

      const appuntamenti = await this.service.list(ds, filters);
      return res.json({ appuntamenti });
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Post()
  async create(@Req() req: Request, @Res() res: Response, @Body() body: CreateAppuntamentoDto) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      const appuntamento = await this.service.create(ds, body);
      return res.json({ appuntamento });
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: UpdateAppuntamentoDto,
  ) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      const appuntamento = await this.service.update(ds, id, body);
      return res.json({ appuntamento });
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Res() res: Response, @Param('id') id: string) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      await this.service.remove(ds, id);
      return res.json({ ok: true });
    } catch (e) {
      return respondError(res, e);
    }
  }
}