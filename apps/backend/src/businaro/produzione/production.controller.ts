import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { BusinaroRoles } from '../common/guards/roles.decorator';
import { BusinaroDepartmentGuard } from '../common/guards/department.guard';
import { BusinaroDepartment } from '../common/enums';

// Il DTO si trova nel modulo magazzino, quindi saliamo di un livello e entriamo in magazzino
import { TransformDto } from '../magazzino/dto/transform.dto';
import { BusinaroProductionService } from './production.service';

// CORREZIONE QUI: ../../ per tornare alla root di src
import { getTenantConn } from '../../tenant-helpers';

@Controller('businaro/production')
@UseGuards(BusinaroDepartmentGuard)
export class BusinaroProductionController {
  constructor(private readonly service: BusinaroProductionService) {}

  @Post('transform')
  @BusinaroRoles(BusinaroDepartment.MACHINE_TOOLS)
  async transform(@Req() req: Request, @Body() dto: TransformDto) {
    // Recupera la connessione specifica del tenant dalla request (middleware)
    const ds = getTenantConn(req as any);
    
    // Recupera ID e Ruolo utente dal JWT decodificato
    const operatorId = (req as any).user?.id ?? null;
    const role = (req as any).user?.role ?? null;
    
    return this.service.transform(ds, operatorId, role, dto);
  }
}