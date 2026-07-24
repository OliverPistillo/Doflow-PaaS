export type PlanTier = 'STARTER' | 'PRO' | 'ENTERPRISE';

const PLAN_ORDER: Record<PlanTier, number> = {
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

export const DASHBOARD_WIDGET_MIN_PLAN: Record<string, PlanTier> = {
  // STARTER
  kpi_new_leads: 'STARTER',
  kpi_open_orders: 'STARTER',
  kpi_quote_value: 'STARTER',
  list_recent_quotes: 'STARTER',
  chart_orders_trend: 'STARTER',
  kpi_lead_conversion: 'STARTER',
  chart_lead_funnel: 'STARTER',

  // PRO
  kpi_revenue_month: 'PRO',
  kpi_cashflow_overdue: 'PRO',
  kpi_low_stock: 'PRO',
  list_unpaid_invoices: 'PRO',
  chart_income_vs_expenses: 'PRO',
  list_top_deals: 'PRO',

  // ENTERPRISE
  chart_market_share: 'ENTERPRISE',
  chart_sales_heatmap: 'ENTERPRISE',
  leaderboard_sellers: 'ENTERPRISE',
};

export function normalizePlan(input: unknown): PlanTier {
  const value = String(input || 'STARTER').toUpperCase();
  if (value === 'ENTERPRISE') return 'ENTERPRISE';
  if (value === 'PRO') return 'PRO';
  return 'STARTER';
}

export function planIncludes(current: PlanTier, required: PlanTier): boolean {
  return PLAN_ORDER[current] >= PLAN_ORDER[required];
}
