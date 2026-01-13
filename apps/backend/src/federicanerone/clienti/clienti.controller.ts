import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { assertAuthenticated, assertFedericaTenant, getTenantConn, respondError } from '../../tenant-helpers';
import { ClientiService, CreateClienteDto, UpdateClienteDto } from './clienti.service';

@Controller('clienti')
export class ClientiController {
  constructor(private readonly service: ClientiService) {}

  @Get()
  async list(@Req() req: Request, @Res() res: Response) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      const clienti = await this.service.list(ds);
      return res.json({ clienti });
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Post()
  async create(@Req() req: Request, @Res() res: Response, @Body() body: CreateClienteDto) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      const cliente = await this.service.create(ds, body);
      return res.json({ cliente });
    } catch (e) {
      return respondError(res, e);
    }
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
    @Body() body: UpdateClienteDto,
  ) {
    try {
      assertFedericaTenant(req);
      assertAuthenticated(req);

      const ds = getTenantConn(req);
      const cliente = await this.service.update(ds, id, body);
      return res.json({ cliente });
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
