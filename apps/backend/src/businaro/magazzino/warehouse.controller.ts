import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { BusinaroWarehouseService } from './warehouse.service';
import { PickItemDto } from './dto/pick-item.dto';
import { QuarantineDecisionDto, QuarantineInDto } from './dto/quarantine.dto';

import { BusinaroDepartmentGuard } from '../common/guards/department.guard';
import { BusinaroRoles } from '../common/guards/roles.decorator';
import { BusinaroDepartment } from '../common/enums';

// IMPORTANTE: questi helper esistono già nel tuo progetto
// Adattali al nome reale: in struttura vedo "tenant-helpers.ts"
import { getTenantConn } from '../../tenant-helpers';

@Controller('businaro/warehouse')
@UseGuards(BusinaroDepartmentGuard)
export class BusinaroWarehouseController {
  constructor(private readonly service: BusinaroWarehouseService) {}

  @Post('pick')
  @BusinaroRoles(BusinaroDepartment.WAREHOUSE)
  async pick(@Req() req: Request, @Body() dto: PickItemDto) {
    const ds = getTenantConn(req as any);
    const operatorId = (req as any).user?.id ?? null;
    return this.service.pick(ds, operatorId, dto);
  }

  @Post('quarantine/in')
  @BusinaroRoles(BusinaroDepartment.WAREHOUSE)
  async quarantineIn(@Req() req: Request, @Body() dto: QuarantineInDto) {
    const ds = getTenantConn(req as any);
    const operatorId = (req as any).user?.id ?? null;
    return this.service.quarantineIn(ds, operatorId, dto);
  }

  @Post('quarantine/decision')
  @BusinaroRoles(BusinaroDepartment.TECH_OFFICE, BusinaroDepartment.ADMIN)
  async quarantineDecision(@Req() req: Request, @Body() dto: QuarantineDecisionDto) {
    const ds = getTenantConn(req as any);
    const operatorId = (req as any).user?.id ?? null;
    return this.service.quarantineDecision(ds, operatorId, dto);
  }
}
