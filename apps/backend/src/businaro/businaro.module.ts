import { Module } from '@nestjs/common';
import { BusinaroWarehouseController } from './magazzino/warehouse.controller';
import { BusinaroWarehouseService } from './magazzino/warehouse.service';
import { BusinaroProductionController } from './produzione/production.controller';
import { BusinaroProductionService } from './produzione/production.service';

// 1. Importiamo il controller principale (assicurati di aver creato il file businaro.controller.ts)
import { BusinaroController } from './businaro.controller';

import { BusinaroRulesModule } from './rules/businaro-rules.module';
import { BusinaroDepartmentGuard } from './common/guards/department.guard';

@Module({
  imports: [
    BusinaroRulesModule,
  ],
  controllers: [
    // 2. Lo aggiungiamo alla lista dei controllers
    BusinaroController, 
    BusinaroWarehouseController, 
    BusinaroProductionController
  ],
  providers: [
    BusinaroWarehouseService, 
    BusinaroProductionService, 
    BusinaroDepartmentGuard
  ],
})
export class BusinaroModule {}