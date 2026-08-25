import type { LucideIcon } from "lucide-react"

export type DashboardRange = "7d" | "30d" | "90d"
export type StatusTone = "neutral" | "warning" | "destructive" | "success"

export type Kpi = {
  title: string
  value: string
  change: string
  comparison: string
  icon: LucideIcon
  tone: StatusTone
}

export type PipelineStage = {
  name: string
  value: string
  percentage: number
}

export type PriorityItem = {
  title: string
  detail: string
  priority: string
  tone: StatusTone
}

export type Project = {
  name: string
  client: string
  owner: string
  progress: number
  deadline: string
  tone: StatusTone
}

export type DashboardFixture = {
  periodDescription: string
  kpis: Kpi[]
  leadTrend: { month: string; lead: number; qualified: number }[]
  pipeline: PipelineStage[]
  urgentTasks: PriorityItem[]
  projects: Project[]
  payments: PriorityItem[]
  awaitingClient: PriorityItem[]
  campaigns: { month: string; googleAds: number; metaAds: number; totalRoas: number }[]
  recentActivity: { title: string; detail: string; time: string; tone: StatusTone }[]
}

export type DashboardFixtures = Record<DashboardRange, DashboardFixture>

export type KpiSparkline = {
  chartToken: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5"
  data: { period: string; value: number }[]
}

export type KpiSparklines = Record<DashboardRange, Record<string, KpiSparkline>>

export type OverviewMetric = {
  title: string
  value: string
  change: string
  comparison: string
  token: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5"
  series: { month: string; value: number }[]
}

export type OverviewRangeData = {
  metrics: OverviewMetric[]
  leadMonth: OverviewMetric
  campaignPerformance: { roas: string; ctr: string; conversions: string; budget: string; change: string; series: { month: string; roas: number; ctr: number }[] }
  topCampaigns: { campaign: string; platform: string; roas: string; ctr: string; conversions: string; budget: string }[]
}

export type OverviewRangeFixtures = Record<DashboardRange, OverviewRangeData>
