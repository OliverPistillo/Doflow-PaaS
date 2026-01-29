import { Module } from '@nestjs/common';
import { BusinaroWarehouseController } from './magazzino/warehouse.controller';
import { BusinaroWarehouseService } from './magazzino/warehouse.service';
import { BusinaroProductionController } from './produzione/production.controller';
import { BusinaroProductionService } from './produzione/production.service';

import { BusinaroRulesModule } from './rules/businaro-rules.module';
import { BusinaroDepartmentGuard } from './common/guards/department.guard';

@Module({
  imports: [
    // Qui dentro iniettiamo le regole business (DI)
    BusinaroRulesModule,
  ],
  controllers: [BusinaroWarehouseController, BusinaroProductionController],
  providers: [BusinaroWarehouseService, BusinaroProductionService, BusinaroDepartmentGuard],
})
export class BusinaroModule {}
