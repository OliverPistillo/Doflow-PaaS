import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRecordOperationsService } from './tenant-record-operations.service';

@Controller('tenant/record-operations')
@UseGuards(JwtAuthGuard)
export class TenantRecordOperationsController {
  constructor(private readonly service: TenantRecordOperationsService) {}

  @Get('materials')
  listMaterials(@Query() query: Record<string, any>) {
    return this.service.listMaterials(query || {});
  }

  @Post('materials')
  createMaterial(@Body() body: Record<string, any>) {
    return this.service.createMaterial(body || {});
  }

  @Patch('materials/:id/received')
  receiveMaterial(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.receiveMaterial(id, body || {});
  }

  @Patch('materials/:id/waive')
  waiveMaterial(@Param('id') id: string) {
    return this.service.waiveMaterial(id);
  }

  @Get('administration')
  administration(@Query() query: Record<string, any>) {
    return this.service.administration(query || {});
  }
}
