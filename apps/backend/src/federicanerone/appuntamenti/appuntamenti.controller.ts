import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { assertAuthenticated, assertFedericaTenant, getTenantConn, respondError } from '../../tenant-helpers';
import { AppuntamentiService, CreateAppuntamentoDto, UpdateAppuntamentoDto } from './appuntamenti.service';

@Controller('appuntamenti')
export class AppuntamentiController {
  constructor(private readonly service: AppuntamentiService) {}

  @Get()
  async list(@Req() req: Request, @Res() res: Response) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      const appuntamenti = await this.service.list(ds);
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
