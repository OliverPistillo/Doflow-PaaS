import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { assertAuthenticated, assertFedericaTenant, getTenantConn, respondError } from '../../tenant-helpers';
import { TrattamentiService, CreateTrattamentoDto, UpdateTrattamentoDto } from './trattamenti.service';

@Controller('trattamenti')
export class TrattamentiController {
  constructor(private readonly service: TrattamentiService) {}

  @Get('stats')
  async getStats(@Req() req: Request, @Res() res: Response) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);
      const ds = getTenantConn(req);
      const stats = await this.service.getStats(ds);
      return res.json(stats);
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Get()
  async list(@Req() req: Request, @Res() res: Response, @Query('q') q?: string) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);
      const ds = getTenantConn(req);
      const trattamenti = await this.service.list(ds, q);
      return res.json({ trattamenti });
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Post()
  async create(@Req() req: Request, @Res() res: Response, @Body() body: CreateTrattamentoDto) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);
      const ds = getTenantConn(req);
      const trattamento = await this.service.create(ds, body);
      return res.json({ trattamento });
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: UpdateTrattamentoDto,
  ) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);
      const ds = getTenantConn(req);
      const trattamento = await this.service.update(ds, id, body);
      return res.json({ trattamento });
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