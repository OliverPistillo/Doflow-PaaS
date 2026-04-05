import { BusinaroWarehouseRules, BusinaroProductionRules } from './types';
import {
  BusinaroDepartment,
  ConditionGrade,
  JobOrderType,
  ProductType,
  StockStatus,
} from '../common/enums';

export const businaroWarehouseRules: BusinaroWarehouseRules = {
  requireJobOrderOnPick: true,
  quarantineRestockAllowed: false,
  pickableStatuses: [StockStatus.AVAILABLE],
  
  // Tipi espliciti per evitare errore "implicitly has an 'any' type"
  isLotAllowedForJob: (jobType: JobOrderType, lotCondition: ConditionGrade): boolean => {
    // Macchine nuove vogliono SOLO pezzi nuovi
    if (jobType === JobOrderType.PRODUCTION_NEW) return lotCondition === ConditionGrade.NEW;
    
    // Revisioni/Interni accettano tutto tranne il rotto
    if (jobType === JobOrderType.SERVICE) return lotCondition !== ConditionGrade.DAMAGED;
    if (jobType === JobOrderType.INTERNAL) return lotCondition !== ConditionGrade.DAMAGED;
    
    return false;
  },
};

export const businaroProductionRules: BusinaroProductionRules = {
  transformAllowedDepartments: [BusinaroDepartment.MACHINE_TOOLS],
  
  isTransformationAllowed: (sourceType: ProductType, targetType: ProductType): boolean => {
    // RAW -> SEMI (es. Barra -> Perno)
    if (sourceType === ProductType.RAW_MATERIAL && targetType === ProductType.SEMI_FINISHED) return true;
    
    // SEMI -> SEMI (es. Perno -> Perno Rettificato)
    if (sourceType === ProductType.SEMI_FINISHED && targetType === ProductType.SEMI_FINISHED) return true;
    
    // Non puoi trasformare un prodotto finito o un componente commerciale
    return false;
  },
};