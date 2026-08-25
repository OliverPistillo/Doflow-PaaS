import type { StatusTone } from "@/features/dashboard/types"

export type MetricKind = "revenue" | "expenses" | "profit"

export function getMetricTrend({ metric, currentValue, previousValue }: { metric: MetricKind; currentValue: number; previousValue: number }) {
  const percentage = previousValue === 0 ? 0 : ((currentValue - previousValue) / previousValue) * 100
  const direction = percentage > 0 ? "up" : percentage < 0 ? "down" : "flat"
  const positive = metric === "expenses" ? percentage < 0 : percentage > 0
  const variant: StatusTone = direction === "flat" ? "neutral" : positive ? "success" : "destructive"
  const metricLabel = metric === "expenses" ? "Spese" : metric === "profit" ? "Utile" : "Fatturato"
  const action = direction === "flat" ? "invariato" : direction === "up" ? "aumentato" : "diminuito"
  return { percentage, direction, variant, label: `${percentage > 0 ? "+" : ""}${percentage.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`, accessibleText: `${metricLabel} ${action}: ${Math.abs(percentage).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%` }
}
