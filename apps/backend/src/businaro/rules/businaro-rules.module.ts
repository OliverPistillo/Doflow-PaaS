import { Module } from '@nestjs/common';
import { BUSINARO_PRODUCTION_RULES, BUSINARO_WAREHOUSE_RULES } from './tokens';
import { businaroProductionRules, businaroWarehouseRules } from './businaro.rules';

@Module({
  providers: [
    { provide: BUSINARO_WAREHOUSE_RULES, useValue: businaroWarehouseRules },
    { provide: BUSINARO_PRODUCTION_RULES, useValue: businaroProductionRules },
  ],
  exports: [BUSINARO_WAREHOUSE_RULES, BUSINARO_PRODUCTION_RULES],
})
export class BusinaroRulesModule {}
