"use client"

import { PolarGrid, RadialBar, RadialBarChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

type RadialGridDatum = {
  id: string
  status: string
  leadCount: number
  colorKey: string
}

type ChartRadialGridProps = {
  data: RadialGridDatum[]
  config: ChartConfig
  activeStatus: string | null
  onSelect: (status: string) => void
  onHover: (status: string) => void
  onLeave: () => void
}

/** Based on the official shadcn/ui Radial Chart - Grid block. */
export function ChartRadialGrid({ data, config, activeStatus, onSelect, onHover, onLeave }: ChartRadialGridProps) {
  const totalLeadCount = data.reduce((total, item) => total + item.leadCount, 0)
  const chartData = [Object.fromEntries(data.map((item) => [item.status, totalLeadCount ? item.leadCount / totalLeadCount * 100 : 0]))]
  const fillFor = (item: RadialGridDatum) => activeStatus && activeStatus !== item.status ? "var(--chart-inactive)" : `var(--color-${item.colorKey})`

  return <ChartContainer config={config} onClick={(event) => event.stopPropagation()} className="mx-auto h-60 w-full max-w-60 shrink-0 aspect-auto">
    <RadialBarChart data={chartData} startAngle={90} endAngle={-270} innerRadius={24} outerRadius={112} barSize={11}>
      <PolarGrid gridType="circle" stroke="var(--border)" />
      {data.map((item) => <RadialBar key={item.id} dataKey={item.status} fill={fillFor(item)} background={{ fill: "var(--muted)" }} cornerRadius={5} onClick={() => onSelect(item.status)} onMouseEnter={() => onHover(item.status)} onMouseLeave={onLeave} />)}
    </RadialBarChart>
  </ChartContainer>
}
