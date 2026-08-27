"use client"

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatCompactCurrency, formatCurrencySuffix } from "@/features/dashboard/formatters"
import type { OverviewMetric } from "@/features/dashboard/types"

type FinancialMetric = "revenue" | "expenses" | "profit"
const config = {
  revenue: { label: "Fatturato", color: "#10b981" }, expenses: { label: "Spese", color: "#ef4444" }, profit: { label: "Utile", color: "#8b5cf6" },
  revenuePrevious: { label: "Fatturato anno precedente", color: "#6ee7b7" }, expensesPrevious: { label: "Spese anno precedente", color: "#fca5a5" }, profitPrevious: { label: "Utile anno precedente", color: "#c4b5fd" },
} satisfies ChartConfig

export function FinancialSummaryChart({ metrics, activeMetric }: { metrics: OverviewMetric[]; activeMetric: FinancialMetric }) {
  const [revenue, expenses, profit] = metrics
  const data = revenue.series.map((point, index) => { const currentRevenue = point.value; const currentExpenses = expenses.series[index]?.value ?? 0; const currentProfit = profit.series[index]?.value ?? currentRevenue - currentExpenses; return { month: point.month, revenue: currentRevenue, expenses: currentExpenses, profit: currentProfit, revenuePrevious: revenue.previousSeries?.[index]?.value ?? 0, expensesPrevious: expenses.previousSeries?.[index]?.value ?? 0, profitPrevious: profit.previousSeries?.[index]?.value ?? 0 } })
  const hasNegativeProfit = data.some((point) => point.profit < 0); const currentSeries: FinancialMetric[] = ["revenue", "expenses", "profit"]; const previousSeries = ["revenuePrevious", "expensesPrevious", "profitPrevious"] as const
  return <div className="min-w-0 overflow-x-auto"><ChartContainer config={config} className="h-[235px] w-full min-w-[520px] sm:min-w-0 @md/main:h-[255px]" aria-label={`Andamento economico, metrica evidenziata ${config[activeMetric].label}`}><AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 12 }}><defs>{currentSeries.map((metric) => <linearGradient key={metric} id={`fill-economic-${metric}`} x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor={`var(--color-${metric})`} stopOpacity={metric === activeMetric ? .18 : .05}/><stop offset="95%" stopColor={`var(--color-${metric})`} stopOpacity={0}/></linearGradient>)}</defs><CartesianGrid vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd"/><YAxis tickLine={false} axisLine={false} tickMargin={6} width={52} tickFormatter={formatCompactCurrency}/>{activeMetric === "profit" && hasNegativeProfit && <ReferenceLine y={0} stroke="var(--border)"/>}<ChartTooltip content={<ChartTooltipContent indicator="dot" labelFormatter={(value) => `Mese: ${value}`} formatter={(value, name) => String(name).endsWith("Previous") ? null : <div className="flex w-full justify-between gap-4"><span>{config[name as keyof typeof config].label}</span><span className="tabular-nums">{formatCurrencySuffix(Number(value))}</span></div>}/>}/>{previousSeries.map((metric) => <Area key={metric} dataKey={metric} type="monotone" stroke={`var(--color-${metric})`} fill="transparent" strokeDasharray="5 5" strokeWidth={1.2} dot={false} activeDot={false}/>) }{currentSeries.map((metric) => <Area key={metric} dataKey={metric} type="monotone" stroke={`var(--color-${metric})`} fill={`url(#fill-economic-${metric})`} strokeWidth={metric === activeMetric ? 3 : 1.6} strokeOpacity={metric === activeMetric ? 1 : .55} dot={{ r: metric === activeMetric ? 2.5 : 1.5 }} activeDot={{ r: 4 }}/>) }</AreaChart></ChartContainer></div>
}
