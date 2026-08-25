import type { CommercialLead, CommercialPeriod, PipelineAnalysisPoint, PipelineStage } from "@/features/commercial/types"
import { pipelineStages } from "@/features/commercial/pipeline-stages"

export const activeCommercialStages: PipelineStage[] = ["new", "qualified", "proposal", "negotiation", "follow-up"]
type CommercialDateRange = { from?: Date; to?: Date }

function bounds(period: CommercialPeriod, range?: CommercialDateRange) {
  const now = new Date()
  const local = (date: Date) => date.toISOString().slice(0, 10)
  if (period === "today") return [local(now), local(now)] as const
  if (period === "previous-month") return [local(new Date(now.getFullYear(), now.getMonth() - 1, 1)), local(new Date(now.getFullYear(), now.getMonth(), 0))] as const
  if (period === "month") return [local(new Date(now.getFullYear(), now.getMonth(), 1)), local(new Date(now.getFullYear(), now.getMonth() + 1, 0))] as const
  if (period === "custom" && range?.from && range.to) return [local(range.from), local(range.to)] as const
  return null
}

export function filterCommercialLeadsByPeriod(leads: CommercialLead[], period: CommercialPeriod, range?: CommercialDateRange) {
  const periodBounds = bounds(period, range)
  if (!periodBounds) return leads
  return leads.filter((lead) => {
    const date = (lead.stage === "new" ? lead.createdAt : lead.lastContact).slice(0, 10)
    return date >= periodBounds[0] && date <= periodBounds[1]
  })
}

export function getCommercialSummary(leads: CommercialLead[], period: CommercialPeriod, range?: CommercialDateRange) {
  const items = filterCommercialLeadsByPeriod(leads, period, range)
  const open = items.filter((lead) => activeCommercialStages.includes(lead.stage))
  return { newLeads: items.filter((lead) => lead.stage === "new").length, openDeals: open.length, wonDeals: items.filter((lead) => lead.stage === "won").length, pipelineValue: open.reduce((sum, lead) => sum + lead.value, 0) }
}

function metrics(leads: CommercialLead[]) {
  const open = leads.filter((lead) => activeCommercialStages.includes(lead.stage))
  const won = leads.filter((lead) => lead.stage === "won")
  const pipelineValue = open.reduce((sum, lead) => sum + lead.value, 0)
  const weightedValue = open.reduce((sum, lead) => sum + lead.value * lead.probability / 100, 0)
  return {
    conversionRate: leads.length ? won.length / leads.length * 100 : 0,
    averageDealValue: leads.length ? leads.reduce((sum, lead) => sum + lead.value, 0) / leads.length : 0,
    wonDeals: won.length,
    averageCloseDays: won.length ? won.reduce((sum, lead) => sum + Math.max(0, lead.daysInStage), 0) / won.length : 0,
    pipelineValue,
    weightedValue,
    forecast90Days: weightedValue,
  }
}

export function getCommercialAnalysis(period: CommercialPeriod, leads: CommercialLead[]) {
  const currentItems = filterCommercialLeadsByPeriod(leads, period)
  const trendByMonth = new Map<string, CommercialLead[]>()
  leads.forEach((lead) => { const month = lead.createdAt.slice(0, 7); if (month) trendByMonth.set(month, [...(trendByMonth.get(month) || []), lead]) })
  const trend: PipelineAnalysisPoint[] = Array.from(trendByMonth.entries()).sort(([left], [right]) => left.localeCompare(right)).slice(-6).map(([month, items]) => {
    const value = metrics(items)
    return { id: `analysis-${month}`, period: month, label: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(new Date(`${month}-01T12:00:00`)), pipelineValue: value.pipelineValue, weightedValue: value.weightedValue }
  })
  return { current: metrics(currentItems), previous: metrics([]), trend, target: 0 }
}

export function getPipelineDistribution(leads: CommercialLead[]) {
  return pipelineStages.filter((stage) => ["new", "qualified", "proposal", "negotiation", "won"].includes(stage.id)).map((stage) => {
    const items = leads.filter((lead) => lead.stage === stage.id)
    return { id: `distribution-${stage.id}`, status: stage.id, label: stage.label, leadCount: items.length, economicValue: items.reduce((sum, lead) => sum + lead.value, 0), colorKey: stage.id, description: `${items.length} opportunità`, includedLabels: [stage.label] }
  })
}
