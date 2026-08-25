"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
const formatInteger = (value: number) => new Intl.NumberFormat("it-IT").format(value)
const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value)

export function MetricAreaChart({
  label,
  token,
  data,
  kind,
  compact = false,
}: {
  label: string
  token: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5"
  data: { month: string; value: number }[]
  kind: "currency" | "number"
  compact?: boolean
}) {
  const config = { value: { label, color: `var(--${token})` } } satisfies ChartConfig
  const formatter = kind === "currency" ? formatCurrency : formatInteger
  const tick = kind === "currency" ? formatCompactCurrency : formatInteger
  const chartId = token.replace("chart-", "")

  return (
    <ChartContainer
      config={config}
      className={compact ? "h-40 w-full @md/main:h-44" : "h-52 w-full @md/main:h-60"}
      aria-label={`Andamento reale ${label}`}
    >
      <AreaChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 16 }}>
        <defs>
          <linearGradient id={`fill-value-${chartId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={12} minTickGap={18} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={kind === "currency" ? 48 : 28} tickFormatter={tick} />
        <ChartTooltip
          content={<ChartTooltipContent indicator="dot" formatter={(value) => formatter(Number(value))} />}
        />
        <Area
          dataKey="value"
          type="natural"
          fill={`url(#fill-value-${chartId})`}
          stroke="var(--color-value)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
