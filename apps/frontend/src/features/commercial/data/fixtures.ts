import type {
  CommercialLead,
  CommercialPeriod,
  PipelineAnalysisPoint,
  PipelineStage,
} from "@/features/commercial/types"

export const pipelineStages: Array<{
  id: PipelineStage
  label: string
  probability: number
}> = [
  { id: "new", label: "Nuovo lead", probability: 15 },
  { id: "qualified", label: "Qualificato", probability: 35 },
  { id: "proposal", label: "Proposta inviata", probability: 55 },
  { id: "negotiation", label: "In trattativa", probability: 75 },
  { id: "won", label: "Vinto", probability: 100 },
  { id: "unqualified", label: "Non idoneo", probability: 0 },
  { id: "not-interested", label: "Non interessato", probability: 0 },
  { id: "follow-up", label: "Follow-up", probability: 20 },
  { id: "lost", label: "Perso", probability: 0 },
]

export const commercialStatusDescriptions: Record<PipelineStage, string> = {
  new: "Contatti appena acquisiti, ancora da qualificare.",
  qualified: "Lead verificati con un interesse e un’esigenza compatibili.",
  proposal: "Lead che hanno ricevuto una proposta commerciale.",
  negotiation: "Trattative in cui si stanno definendo condizioni e accordi.",
  won: "Trattative concluse positivamente e convertite in clienti.",
  unqualified: "Lead non qualificati per la trattativa corrente.",
  "not-interested": "Lead che non hanno manifestato interesse.",
  "follow-up": "Lead da ricontattare per proseguire la trattativa.",
  lost: "Trattative chiuse senza esito positivo.",
}

export const activeCommercialStages: PipelineStage[] = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "follow-up",
]

type CommercialDateRange = { from?: Date; to?: Date }

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

function periodBounds(
  period: CommercialPeriod,
  range?: CommercialDateRange,
  now = new Date(),
): [string, string] | undefined {
  if (period === "custom" && range?.from && range.to) {
    return [isoDay(range.from), isoDay(range.to)]
  }
  if (period === "today") {
    const today = isoDay(now)
    return [today, today]
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  if (period === "previous-month") start.setUTCMonth(start.getUTCMonth() - 1)
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  return [isoDay(start), isoDay(end)]
}

export const filterCommercialLeadsByPeriod = (
  leads: CommercialLead[],
  period: CommercialPeriod,
  range?: CommercialDateRange,
) => {
  const bounds = periodBounds(period, range)
  if (!bounds) return leads
  return leads.filter((lead) => {
    const date = (lead.stage === "new" ? lead.createdAt : lead.lastContact).slice(0, 10)
    return date >= bounds[0] && date <= bounds[1]
  })
}

export const getCommercialSummary = (
  leads: CommercialLead[],
  period: CommercialPeriod,
  range?: CommercialDateRange,
) => {
  const periodLeads = filterCommercialLeadsByPeriod(leads, period, range)
  const openLeads = periodLeads.filter((lead) =>
    activeCommercialStages.includes(lead.stage),
  )
  return {
    newLeads: periodLeads.filter((lead) => lead.stage === "new").length,
    openDeals: openLeads.length,
    wonDeals: periodLeads.filter((lead) => lead.stage === "won").length,
    pipelineValue: openLeads.reduce((total, lead) => total + lead.value, 0),
  }
}

export const getPipelineDistribution = (leads: CommercialLead[]) => {
  const groups: Array<{
    id: PipelineStage
    label: string
    stages: PipelineStage[]
  }> = [
    { id: "new", label: "Nuovo lead", stages: ["new"] },
    { id: "qualified", label: "Qualificato", stages: ["qualified"] },
    { id: "proposal", label: "Proposta inviata", stages: ["proposal"] },
    { id: "negotiation", label: "Negoziazione", stages: ["negotiation"] },
    { id: "won", label: "Vinto", stages: ["won"] },
  ]
  return groups.map((group) => {
    const matchingLeads = leads.filter((lead) => group.stages.includes(lead.stage))
    return {
      id: `distribution-${group.id}`,
      status: group.id,
      label: group.label,
      leadCount: matchingLeads.length,
      economicValue: matchingLeads.reduce((total, lead) => total + lead.value, 0),
      colorKey: group.id,
      description: commercialStatusDescriptions[group.id],
      includedLabels: group.stages.map(
        (stage) => pipelineStages.find((item) => item.id === stage)?.label ?? stage,
      ),
    }
  })
}

function metrics(leads: CommercialLead[]) {
  const openLeads = leads.filter((lead) => activeCommercialStages.includes(lead.stage))
  const wonLeads = leads.filter((lead) => lead.stage === "won")
  const closeDays = wonLeads
    .map((lead) =>
      Math.max(
        0,
        Math.round(
          (Date.parse(lead.lastContact) - Date.parse(lead.createdAt)) / 86_400_000,
        ),
      ),
    )
    .filter(Number.isFinite)
  const horizon = Date.now() + 90 * 86_400_000
  return {
    conversionRate: (wonLeads.length / Math.max(leads.length, 1)) * 100,
    averageDealValue:
      leads.reduce((total, lead) => total + lead.value, 0) /
      Math.max(leads.length, 1),
    wonDeals: wonLeads.length,
    averageCloseDays:
      closeDays.reduce((total, days) => total + days, 0) /
      Math.max(closeDays.length, 1),
    pipelineValue: openLeads.reduce((total, lead) => total + lead.value, 0),
    weightedValue: openLeads.reduce(
      (total, lead) => total + (lead.value * lead.probability) / 100,
      0,
    ),
    forecast90Days: openLeads
      .filter((lead) => Date.parse(lead.nextActionAt) <= horizon)
      .reduce(
        (total, lead) => total + (lead.value * lead.probability) / 100,
        0,
      ),
  }
}

export const getCommercialAnalysis = (
  period: CommercialPeriod,
  leads: CommercialLead[],
) => {
  const currentLeads = filterCommercialLeadsByPeriod(leads, period)
  const previousLeads = filterCommercialLeadsByPeriod(leads, "previous-month")
  const trend: PipelineAnalysisPoint[] = Array.from({ length: 8 }, (_, index) => {
    const date = new Date()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - (7 - index))
    const key = date.toISOString().slice(0, 7)
    const monthLeads = leads.filter((lead) => lead.createdAt.slice(0, 7) === key)
    const monthMetrics = metrics(monthLeads)
    return {
      id: `analysis-${key}`,
      period: key,
      label: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date),
      pipelineValue: Math.round(monthMetrics.pipelineValue),
      weightedValue: Math.round(monthMetrics.weightedValue),
    }
  })
  return {
    current: metrics(currentLeads),
    previous: metrics(previousLeads),
    trend,
    target: 0,
  }
}
