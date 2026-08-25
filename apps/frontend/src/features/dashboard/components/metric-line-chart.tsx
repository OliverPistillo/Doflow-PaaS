"use client"

import { CartesianGrid, Dot, Line, LineChart, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatCompactCurrency, formatCurrency, formatInteger } from "@/features/dashboard/formatters"

export function MetricLineChart({ label, token, data, kind }: { label: string; token: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5"; data: { month: string; value: number }[]; kind: "currency" | "number" }) {
  const config = { value: { label, color: `var(--${token})` } } satisfies ChartConfig
  const tickFormatter = kind === "currency" ? formatCompactCurrency : formatInteger
  const valueFormatter = kind === "currency" ? formatCurrency : formatInteger
  return <ChartContainer config={config} className="h-48 w-full @md/main:h-52" aria-label={`Grafico lineare di ${label} da gennaio a luglio`}><LineChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 14 }}><CartesianGrid vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={18} tickMargin={12}/><YAxis tickLine={false} axisLine={false} width={kind === "currency" ? 48 : 28} tickMargin={8} tickFormatter={tickFormatter}/><ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(month) => `Mese: ${month}`} formatter={(value) => valueFormatter(Number(value))} />}/><Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={<Dot r={3} fill="var(--color-value)" strokeWidth={0}/>} activeDot={<Dot r={4} fill="var(--color-value)" strokeWidth={0}/>} /></LineChart></ChartContainer>
}
