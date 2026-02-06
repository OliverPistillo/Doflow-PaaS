export class DashboardKpiDto {
  leadsCount!: number;
  totalValue!: number;
  winRate!: number;
  avgDealValue!: number;
}

export class PipelineStageDto {
  stage!: string;
  value!: number;
  count!: number;
}

export class TopDealDto {
  name!: string;
  client!: string;
  value!: number;
  stage!: string;
}

export class DashboardResponseDto {
  kpi!: DashboardKpiDto;
  pipeline!: PipelineStageDto[];
  topDeals!: TopDealDto[];
}