import {
  BusinaroDepartment,
  ConditionGrade,
  JobOrderType,
  ProductType,
  StockStatus,
} from '../common/enums';

// --- Tipi di contesto (Utili per espansioni future o check RBAC generici) ---
export type BusinaroRuleContext = {
  tenantId: string;
  department: BusinaroDepartment;
  userId?: string;
};

export type RuleResult = {
  ok: boolean;
  code?: string;
  message?: string;
};

// --- INTERFACCE DI CONFIGURAZIONE (Richieste dai Service) ---

export interface BusinaroWarehouseRules {
  // Se true, blocca prelievi senza commessa
  requireJobOrderOnPick: boolean; 
  // Se true, permette di rimettere in stock un reso (Businaro: false)
  quarantineRestockAllowed: boolean; 
  // Lista stati prelevabili (es. solo AVAILABLE)
  pickableStatuses: StockStatus[]; 
  // Funzione logica: posso usare questo lotto per questa commessa?
  isLotAllowedForJob: (jobType: JobOrderType, lotCondition: ConditionGrade) => boolean;
}

export interface BusinaroProductionRules {
  // Chi può chiamare l'endpoint transform (es. MACHINE_TOOLS)
  transformAllowedDepartments: BusinaroDepartment[];
  // Matrice di trasformazione (es. RAW -> SEMI = OK)
  isTransformationAllowed: (sourceType: ProductType, targetType: ProductType) => boolean;
}