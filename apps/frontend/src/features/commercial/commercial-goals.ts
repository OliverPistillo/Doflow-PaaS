export const goalMetricIds = [
  "revenue",
  "won_leads",
  "new_clients",
  "new_leads",
  "appointments",
  "conversion_rate",
  "sla_hours",
  "score",
  "sales_count",
  "sales_value",
  "completed_projects",
  "completed_activities",
  "on_time_deliveries",
  "resolved_bugs",
  "renewals",
] as const

export type GoalMetricId = (typeof goalMetricIds)[number]
export type GoalMetricType = "currency" | "count" | "percentage" | "hours" | "days" | "score" | "conversion_rate"
export type GoalDirection = "higher_is_better" | "lower_is_better"

export type GoalMetricDefinition = {
  id: GoalMetricId
  label: string
  metricType: GoalMetricType
  unit: GoalMetricType
  labelSingular: string
  labelPlural: string
  currency?: "EUR"
  direction: GoalDirection
}

export const goalMetricDefinitions: Record<GoalMetricId, GoalMetricDefinition> = {
  revenue: { id: "revenue", label: "Fatturato", metricType: "currency", unit: "currency", labelSingular: "euro", labelPlural: "euro", currency: "EUR", direction: "higher_is_better" },
  won_leads: { id: "won_leads", label: "Lead vinti", metricType: "count", unit: "count", labelSingular: "lead vinto", labelPlural: "lead vinti", direction: "higher_is_better" },
  new_clients: { id: "new_clients", label: "Nuovi clienti", metricType: "count", unit: "count", labelSingular: "cliente", labelPlural: "clienti", direction: "higher_is_better" },
  new_leads: { id: "new_leads", label: "Nuovi lead", metricType: "count", unit: "count", labelSingular: "lead", labelPlural: "lead", direction: "higher_is_better" },
  appointments: { id: "appointments", label: "Appuntamenti", metricType: "count", unit: "count", labelSingular: "appuntamento", labelPlural: "appuntamenti", direction: "higher_is_better" },
  conversion_rate: { id: "conversion_rate", label: "Tasso di conversione", metricType: "conversion_rate", unit: "conversion_rate", labelSingular: "percento", labelPlural: "percento", direction: "higher_is_better" },
  sla_hours: { id: "sla_hours", label: "SLA", metricType: "hours", unit: "hours", labelSingular: "ora", labelPlural: "ore", direction: "lower_is_better" },
  score: { id: "score", label: "Punteggio", metricType: "score", unit: "score", labelSingular: "punto", labelPlural: "punti", direction: "higher_is_better" },
  sales_count: { id: "sales_count", label: "Numero vendite", metricType: "count", unit: "count", labelSingular: "vendita", labelPlural: "vendite", direction: "higher_is_better" },
  sales_value: { id: "sales_value", label: "Valore vendite", metricType: "currency", unit: "currency", labelSingular: "euro", labelPlural: "euro", currency: "EUR", direction: "higher_is_better" },
  completed_projects: { id: "completed_projects", label: "Progetti completati", metricType: "count", unit: "count", labelSingular: "progetto", labelPlural: "progetti", direction: "higher_is_better" },
  completed_activities: { id: "completed_activities", label: "Attività completate", metricType: "count", unit: "count", labelSingular: "attività", labelPlural: "attività", direction: "higher_is_better" },
  on_time_deliveries: { id: "on_time_deliveries", label: "Consegne puntuali", metricType: "count", unit: "count", labelSingular: "consegna", labelPlural: "consegne", direction: "higher_is_better" },
  resolved_bugs: { id: "resolved_bugs", label: "Bug risolti", metricType: "count", unit: "count", labelSingular: "bug", labelPlural: "bug", direction: "higher_is_better" },
  renewals: { id: "renewals", label: "Rinnovi", metricType: "count", unit: "count", labelSingular: "rinnovo", labelPlural: "rinnovi", direction: "higher_is_better" },
}

const integer = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function getGoalMetricDefinition(metric: GoalMetricId) {
  return goalMetricDefinitions[metric]
}

export function calculateGoalProgress(current: number, target: number, direction: GoalDirection) {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0
  if (direction === "lower_is_better") return current <= target ? 100 : Math.max(0, target / current * 100)
  return Math.max(0, current / target * 100)
}

export function formatGoalValue(value: number, definition: GoalMetricDefinition, compact = false) {
  if (definition.metricType === "currency") return new Intl.NumberFormat("it-IT", { style: "currency", currency: definition.currency ?? "EUR", useGrouping: "always", minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value)
  if (definition.metricType === "percentage" || definition.metricType === "conversion_rate") return `${decimal.format(value)}%`
  if (definition.metricType === "score") return `${decimal.format(value)} ${compact ? "pt" : Math.abs(value) === 1 ? definition.labelSingular : definition.labelPlural}`
  const formatted = definition.metricType === "count" ? integer.format(value) : decimal.format(value)
  return `${formatted} ${Math.abs(value) === 1 ? definition.labelSingular : definition.labelPlural}`
}

export function formatGoalProgress(current: number, target: number, definition: GoalMetricDefinition, compact = false) {
  if (definition.metricType === "currency" || definition.metricType === "percentage" || definition.metricType === "conversion_rate" || definition.metricType === "hours" || definition.metricType === "days") {
    return `${formatGoalValue(current, definition, compact)} / ${formatGoalValue(target, definition, compact)}`
  }
  const label = Math.abs(target) === 1 ? definition.labelSingular : definition.labelPlural
  return `${definition.metricType === "count" ? integer.format(current) : decimal.format(current)} / ${definition.metricType === "count" ? integer.format(target) : decimal.format(target)} ${compact && definition.metricType === "score" ? "pt" : label}`
}
