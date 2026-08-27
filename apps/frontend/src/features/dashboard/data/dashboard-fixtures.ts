import {
  BadgeEuro,
  CircleDollarSign,
  ContactRound,
  Funnel,
  Target,
  UsersRound,
} from "lucide-react"

import type { DashboardFixture, DashboardFixtures, KpiSparklines, OverviewRangeFixtures } from "@/features/dashboard/types"

// Fixture frontend: dati dimostrativi, nessuna API o database è coinvolto.
const dashboardFixture30d: DashboardFixture = {
  periodDescription: "Dettaglio giornaliero degli ultimi 30 giorni",
  kpis: [
    { title: "Nuovi lead", value: "48", change: "+12%", comparison: "rispetto ai 30 giorni precedenti", icon: ContactRound, tone: "success" },
    { title: "Lead da lavorare", value: "17", change: "5 urgenti", comparison: "in attesa di primo contatto", icon: Funnel, tone: "warning" },
    { title: "Tasso di conversione", value: "24,8%", change: "+3,2 pt", comparison: "rispetto al mese scorso", icon: Target, tone: "success" },
    { title: "Valore pipeline", value: "€ 184.500", change: "+8,4%", comparison: "opportunità aperte", icon: CircleDollarSign, tone: "neutral" },
    { title: "Clienti acquisiti", value: "12", change: "+2", comparison: "nuovi clienti questo mese", icon: UsersRound, tone: "success" },
    { title: "Fatturato del mese", value: "€ 42.860", change: "+15,6%", comparison: "rispetto a luglio", icon: BadgeEuro, tone: "success" },
  ],
  leadTrend: [
    { month: "1 ago", lead: 5, qualified: 2 }, { month: "6 ago", lead: 7, qualified: 3 },
    { month: "11 ago", lead: 6, qualified: 2 }, { month: "16 ago", lead: 9, qualified: 4 },
    { month: "21 ago", lead: 10, qualified: 5 }, { month: "30 ago", lead: 11, qualified: 6 },
  ],
  pipeline: [
    { name: "Nuovi lead", value: "€ 48.000", percentage: 26 }, { name: "Qualifica", value: "€ 36.500", percentage: 20 },
    { name: "Proposta", value: "€ 62.000", percentage: 34 }, { name: "Negoziazione", value: "€ 38.000", percentage: 21 },
  ],
  urgentTasks: [
    { title: "Richiamare Studio Moretti", detail: "Oggi · 10:30", priority: "Urgente", tone: "destructive" },
    { title: "Inviare proposta a Luma Srl", detail: "Oggi · entro le 17:00", priority: "Alta", tone: "warning" },
    { title: "Brief campagna settembre", detail: "Domani · 09:00", priority: "Normale", tone: "neutral" },
  ],
  projects: [
    { name: "Rebranding Nativa", client: "Nativa Srl", owner: "M. Rossi", progress: 78, deadline: "22 ago", tone: "warning" },
    { name: "Portale customer care", client: "Horizon Spa", owner: "L. Bianchi", progress: 54, deadline: "30 ago", tone: "neutral" },
    { name: "Campagna Q3", client: "Aster Group", owner: "F. Verdi", progress: 91, deadline: "16 ago", tone: "destructive" },
  ],
  payments: [
    { title: "Fattura #2026-084 · Nativa Srl", detail: "Scade il 20 ago · € 4.800", priority: "Vicino", tone: "warning" },
    { title: "Fattura #2026-079 · Borea Spa", detail: "Scaduta il 14 ago · € 2.350", priority: "Scaduta", tone: "destructive" },
    { title: "Fattura #2026-088 · Aster Group", detail: "Scade il 5 set · € 6.900", priority: "Regolare", tone: "neutral" },
  ],
  awaitingClient: [
    { title: "Approvazione preventivo · Horizon Spa", detail: "Inviato 3 giorni fa", priority: "In attesa", tone: "warning" },
    { title: "Materiali campagna · Aster Group", detail: "Inviata richiesta ieri", priority: "In attesa", tone: "neutral" },
  ],
  campaigns: [
    { month: "1 ago", googleAds: 1.7, metaAds: 1.1, totalRoas: 2.8 }, { month: "6 ago", googleAds: 1.8, metaAds: 1.3, totalRoas: 3.1 },
    { month: "11 ago", googleAds: 1.7, metaAds: 1.2, totalRoas: 2.9 }, { month: "16 ago", googleAds: 2, metaAds: 1.5, totalRoas: 3.5 },
    { month: "21 ago", googleAds: 2.2, metaAds: 1.6, totalRoas: 3.8 }, { month: "30 ago", googleAds: 2.4, metaAds: 1.8, totalRoas: 4.2 },
  ],
  recentActivity: [
    { title: "Proposta inviata a Luma Srl", detail: "Commerciale · € 18.500", time: "12 min fa", tone: "success" },
    { title: "Pagamento ricevuto da Nativa Srl", detail: "Fattura #2026-071 · € 3.200", time: "48 min fa", tone: "success" },
    { title: "Scadenza aggiornata per Campagna Q3", detail: "Nuova data: 16 agosto", time: "2 h fa", tone: "warning" },
  ],
}

const kpis7d = [
  { title: "Nuovi lead", value: "12", change: "+20%", comparison: "rispetto ai 7 giorni precedenti", icon: ContactRound, tone: "success" as const },
  { title: "Lead da lavorare", value: "6", change: "2 urgenti", comparison: "in attesa di primo contatto", icon: Funnel, tone: "warning" as const },
  { title: "Tasso di conversione", value: "26,1%", change: "+1,4 pt", comparison: "rispetto ai 7 giorni precedenti", icon: Target, tone: "success" as const },
  { title: "Valore pipeline", value: "€ 52.700", change: "+5,1%", comparison: "opportunità aggiornate questa settimana", icon: CircleDollarSign, tone: "neutral" as const },
  { title: "Clienti acquisiti", value: "3", change: "+1", comparison: "nuovi clienti questa settimana", icon: UsersRound, tone: "success" as const },
  { title: "Fatturato del mese", value: "€ 11.240", change: "+8,2%", comparison: "rispetto alla settimana precedente", icon: BadgeEuro, tone: "success" as const },
]

const kpis90d = [
  { title: "Nuovi lead", value: "132", change: "+18%", comparison: "rispetto ai 90 giorni precedenti", icon: ContactRound, tone: "success" as const },
  { title: "Lead da lavorare", value: "28", change: "8 urgenti", comparison: "in attesa di primo contatto", icon: Funnel, tone: "warning" as const },
  { title: "Tasso di conversione", value: "22,9%", change: "+2,6 pt", comparison: "rispetto al trimestre precedente", icon: Target, tone: "success" as const },
  { title: "Valore pipeline", value: "€ 421.300", change: "+11,8%", comparison: "opportunità aperte nel trimestre", icon: CircleDollarSign, tone: "neutral" as const },
  { title: "Clienti acquisiti", value: "31", change: "+7", comparison: "nuovi clienti nel trimestre", icon: UsersRound, tone: "success" as const },
  { title: "Fatturato del mese", value: "€ 128.640", change: "+22,4%", comparison: "rispetto al trimestre precedente", icon: BadgeEuro, tone: "success" as const },
]

// Fixture frontend per intervallo: dati dimostrativi, nessuna API o database è coinvolto.
export const dashboardFixtures: DashboardFixtures = {
  "7d": {
    ...dashboardFixture30d,
    periodDescription: "Dettaglio giornaliero degli ultimi 7 giorni",
    kpis: kpis7d,
    leadTrend: [
      { month: "Lun", lead: 4, qualified: 1 }, { month: "Mar", lead: 7, qualified: 3 },
      { month: "Mer", lead: 5, qualified: 2 }, { month: "Gio", lead: 9, qualified: 4 },
      { month: "Ven", lead: 8, qualified: 3 }, { month: "Sab", lead: 6, qualified: 3 }, { month: "Dom", lead: 10, qualified: 5 },
    ],
    campaigns: [
      { month: "Lun", googleAds: 2, metaAds: 1.4, totalRoas: 3.4 }, { month: "Mar", googleAds: 2.2, metaAds: 1.6, totalRoas: 3.8 },
      { month: "Mer", googleAds: 2.1, metaAds: 1.4, totalRoas: 3.5 }, { month: "Gio", googleAds: 2.4, metaAds: 1.7, totalRoas: 4.1 },
      { month: "Ven", googleAds: 2.3, metaAds: 1.7, totalRoas: 4 }, { month: "Sab", googleAds: 2.1, metaAds: 1.6, totalRoas: 3.7 }, { month: "Dom", googleAds: 2.5, metaAds: 1.7, totalRoas: 4.2 },
    ],
  },
  "30d": dashboardFixture30d,
  "90d": {
    ...dashboardFixture30d,
    periodDescription: "Aggregazione settimanale degli ultimi 90 giorni",
    kpis: kpis90d,
    leadTrend: [
      { month: "Sett. 1", lead: 28, qualified: 10 }, { month: "Sett. 3", lead: 35, qualified: 14 },
      { month: "Sett. 5", lead: 41, qualified: 18 }, { month: "Sett. 7", lead: 44, qualified: 20 },
      { month: "Sett. 9", lead: 47, qualified: 22 }, { month: "Sett. 11", lead: 52, qualified: 25 },
    ],
    campaigns: [
      { month: "Sett. 1", googleAds: 1.7, metaAds: 1.2, totalRoas: 2.9 }, { month: "Sett. 3", googleAds: 1.9, metaAds: 1.3, totalRoas: 3.2 },
      { month: "Sett. 5", googleAds: 2, metaAds: 1.5, totalRoas: 3.5 }, { month: "Sett. 7", googleAds: 2.1, metaAds: 1.6, totalRoas: 3.7 },
      { month: "Sett. 9", googleAds: 2.3, metaAds: 1.7, totalRoas: 4 }, { month: "Sett. 11", googleAds: 2.4, metaAds: 1.8, totalRoas: 4.2 },
    ],
  },
}

// Serie dedicate ai KPI, separate per intervallo e solo per la visualizzazione frontend.
export const kpiSparklines: KpiSparklines = {
  "7d": {
    "Nuovi lead": { chartToken: "chart-1", data: [{ period: "Lun", value: 1 }, { period: "Mar", value: 2 }, { period: "Mer", value: 1 }, { period: "Gio", value: 3 }, { period: "Ven", value: 2 }, { period: "Sab", value: 1 }, { period: "Dom", value: 2 }] },
    "Lead da lavorare": { chartToken: "chart-4", data: [{ period: "Lun", value: 9 }, { period: "Mar", value: 8 }, { period: "Mer", value: 8 }, { period: "Gio", value: 7 }, { period: "Ven", value: 7 }, { period: "Sab", value: 6 }, { period: "Dom", value: 6 }] },
    "Tasso di conversione": { chartToken: "chart-2", data: [{ period: "Lun", value: 23.2 }, { period: "Mar", value: 24.1 }, { period: "Mer", value: 24.6 }, { period: "Gio", value: 25.2 }, { period: "Ven", value: 25.5 }, { period: "Sab", value: 25.8 }, { period: "Dom", value: 26.1 }] },
    "Valore pipeline": { chartToken: "chart-2", data: [{ period: "Lun", value: 44600 }, { period: "Mar", value: 45900 }, { period: "Mer", value: 47000 }, { period: "Gio", value: 48100 }, { period: "Ven", value: 49500 }, { period: "Sab", value: 50800 }, { period: "Dom", value: 52700 }] },
    "Clienti acquisiti": { chartToken: "chart-3", data: [{ period: "Lun", value: 0 }, { period: "Mar", value: 1 }, { period: "Mer", value: 1 }, { period: "Gio", value: 1 }, { period: "Ven", value: 2 }, { period: "Sab", value: 2 }, { period: "Dom", value: 3 }] },
    "Fatturato del mese": { chartToken: "chart-3", data: [{ period: "Lun", value: 1100 }, { period: "Mar", value: 2500 }, { period: "Mer", value: 3800 }, { period: "Gio", value: 5700 }, { period: "Ven", value: 7600 }, { period: "Sab", value: 9100 }, { period: "Dom", value: 11240 }] },
  },
  "30d": {
    "Nuovi lead": { chartToken: "chart-1", data: [{ period: "1 ago", value: 5 }, { period: "6 ago", value: 7 }, { period: "11 ago", value: 6 }, { period: "16 ago", value: 9 }, { period: "21 ago", value: 10 }, { period: "30 ago", value: 11 }] },
    "Lead da lavorare": { chartToken: "chart-4", data: [{ period: "1 ago", value: 22 }, { period: "6 ago", value: 20 }, { period: "11 ago", value: 21 }, { period: "16 ago", value: 18 }, { period: "21 ago", value: 19 }, { period: "30 ago", value: 17 }] },
    "Tasso di conversione": { chartToken: "chart-2", data: [{ period: "1 ago", value: 20.1 }, { period: "6 ago", value: 21.8 }, { period: "11 ago", value: 21.2 }, { period: "16 ago", value: 23.4 }, { period: "21 ago", value: 24.1 }, { period: "30 ago", value: 24.8 }] },
    "Valore pipeline": { chartToken: "chart-2", data: [{ period: "1 ago", value: 158000 }, { period: "6 ago", value: 164000 }, { period: "11 ago", value: 161000 }, { period: "16 ago", value: 173000 }, { period: "21 ago", value: 178000 }, { period: "30 ago", value: 184500 }] },
    "Clienti acquisiti": { chartToken: "chart-3", data: [{ period: "1 ago", value: 2 }, { period: "6 ago", value: 4 }, { period: "11 ago", value: 5 }, { period: "16 ago", value: 7 }, { period: "21 ago", value: 9 }, { period: "30 ago", value: 12 }] },
    "Fatturato del mese": { chartToken: "chart-3", data: [{ period: "1 ago", value: 6300 }, { period: "6 ago", value: 12100 }, { period: "11 ago", value: 18600 }, { period: "16 ago", value: 24300 }, { period: "21 ago", value: 33900 }, { period: "30 ago", value: 42860 }] },
  },
  "90d": {
    "Nuovi lead": { chartToken: "chart-1", data: [{ period: "Giu", value: 18 }, { period: "Lug", value: 21 }, { period: "Ago", value: 20 }, { period: "Set", value: 23 }, { period: "Ott", value: 24 }, { period: "Nov", value: 26 }] },
    "Lead da lavorare": { chartToken: "chart-4", data: [{ period: "Giu", value: 36 }, { period: "Lug", value: 34 }, { period: "Ago", value: 33 }, { period: "Set", value: 31 }, { period: "Ott", value: 30 }, { period: "Nov", value: 28 }] },
    "Tasso di conversione": { chartToken: "chart-2", data: [{ period: "Giu", value: 18.4 }, { period: "Lug", value: 19.2 }, { period: "Ago", value: 20.1 }, { period: "Set", value: 21.2 }, { period: "Ott", value: 22.1 }, { period: "Nov", value: 22.9 }] },
    "Valore pipeline": { chartToken: "chart-2", data: [{ period: "Giu", value: 334000 }, { period: "Lug", value: 351000 }, { period: "Ago", value: 367000 }, { period: "Set", value: 382000 }, { period: "Ott", value: 401000 }, { period: "Nov", value: 421300 }] },
    "Clienti acquisiti": { chartToken: "chart-3", data: [{ period: "Giu", value: 4 }, { period: "Lug", value: 9 }, { period: "Ago", value: 14 }, { period: "Set", value: 19 }, { period: "Ott", value: 25 }, { period: "Nov", value: 31 }] },
    "Fatturato del mese": { chartToken: "chart-3", data: [{ period: "Giu", value: 18200 }, { period: "Lug", value: 41600 }, { period: "Ago", value: 65700 }, { period: "Set", value: 87400 }, { period: "Ott", value: 108200 }, { period: "Nov", value: 128640 }] },
  },
}

const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago"]

function metric(title: string, value: string, change: string, comparison: string, token: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5", values: number[]) {
  return { title, value, change, comparison, token, series: months.map((month, index) => ({ month, value: values[index] ?? values.at(-1) ?? 0 })) }
}

export const overviewRangeFixtures: OverviewRangeFixtures = {
  "7d": {
    metrics: [
      metric("Fatturato del mese", "€ 11.240", "+8,2%", "rispetto ai 7 giorni precedenti", "chart-3", [4200, 5100, 4800, 6900, 7400, 9200, 11240]),
      metric("Spese del mese", "€ 3.680", "-4,1%", "rispetto allo stesso periodo dell'anno precedente", "chart-5", [610, 590, 540, 580, 510, 470, 380]),
      metric("Utile del mese", "€ 7.560", "+15,2%", "rispetto al mese precedente", "chart-1", [4200 - 610, 5100 - 590, 4800 - 540, 6900 - 580, 7400 - 510, 9200 - 470, 11240 - 3680]),
    ],
    leadMonth: metric("Lead del mese", "12", "+20%", "rispetto ai 7 giorni precedenti", "chart-4", [1, 2, 1, 3, 2, 1, 2]),
    campaignPerformance: { roas: "3,84", ctr: "2,18%", conversions: "86", budget: "€ 3.680", change: "+8,2%", series: months.map((month, index) => ({ month, roas: [2.8, 3.1, 3, 3.4, 3.6, 3.5, 3.84][index], ctr: [1.5, 1.7, 1.8, 1.9, 2, 2.1, 2.18][index] })) },
    topCampaigns: [{ campaign: "Aurora - Search", platform: "G", roas: "4,82", ctr: "3,4%", conversions: "28", budget: "€ 1.240" }, { campaign: "Mios - Meta Ads", platform: "M", roas: "3,77", ctr: "2,3%", conversions: "22", budget: "€ 980" }, { campaign: "Nerone - PMax", platform: "G", roas: "3,21", ctr: "1,8%", conversions: "17", budget: "€ 760" }],
  },
  "30d": {
    metrics: [
      metric("Fatturato del mese", "€ 32.480", "+18%", "rispetto al mese scorso", "chart-3", [18400, 21100, 19800, 23700, 28400, 26700, 32480]),
      metric("Spese del mese", "€ 12.750", "-16%", "rispetto allo stesso periodo dell'anno precedente", "chart-5", [9200, 9800, 8900, 9400, 10800, 10100, 12750]),
      metric("Utile del mese", "€ 19.730", "+22,1%", "rispetto al mese precedente", "chart-1", [18400 - 9200, 21100 - 9800, 19800 - 8900, 23700 - 9400, 28400 - 10800, 26700 - 10100, 32480 - 12750]),
    ],
    leadMonth: metric("Lead del mese", "24", "+26%", "rispetto al mese scorso", "chart-4", [11, 14, 13, 17, 21, 16, 24]),
    campaignPerformance: { roas: "4,18", ctr: "2,12%", conversions: "501", budget: "€ 12.750", change: "+15%", series: months.map((month, index) => ({ month, roas: [2.6, 3.2, 3.1, 3.4, 4.1, 3.8, 4.18][index], ctr: [1.1, 1.5, 1.4, 1.6, 2, 1.7, 2.12][index] })) },
    topCampaigns: [{ campaign: "Aurora - Google Search", platform: "G", roas: "5,21", ctr: "3,2%", conversions: "142", budget: "€ 4.210" }, { campaign: "Mios - Meta Ads", platform: "M", roas: "4,02", ctr: "2,1%", conversions: "118", budget: "€ 3.150" }, { campaign: "Nerone - Performance Max", platform: "G", roas: "3,71", ctr: "1,7%", conversions: "96", budget: "€ 2.980" }],
  },
  "90d": {
    metrics: [
      metric("Fatturato del mese", "€ 96.840", "+22,4%", "rispetto ai 90 giorni precedenti", "chart-3", [51200, 58700, 61400, 70200, 81400, 88500, 96840]),
      metric("Spese del mese", "€ 35.600", "-9,8%", "rispetto allo stesso periodo dell'anno precedente", "chart-5", [38200, 36900, 35400, 34800, 36100, 34200, 35600]),
      metric("Utile del mese", "€ 61.240", "+31,5%", "rispetto al mese precedente", "chart-1", [51200 - 38200, 58700 - 36900, 61400 - 35400, 70200 - 34800, 81400 - 36100, 88500 - 34200, 96840 - 35600]),
    ],
    leadMonth: metric("Lead del mese", "68", "+31%", "rispetto ai 90 giorni precedenti", "chart-4", [28, 36, 42, 47, 51, 61, 68]),
    campaignPerformance: { roas: "4,46", ctr: "2,36%", conversions: "1.486", budget: "€ 35.600", change: "+21%", series: months.map((month, index) => ({ month, roas: [3.1, 3.3, 3.6, 3.9, 4.2, 4.3, 4.46][index], ctr: [1.4, 1.6, 1.8, 2, 2.1, 2.2, 2.36][index] })) },
    topCampaigns: [{ campaign: "Aurora - Google Search", platform: "G", roas: "5,64", ctr: "3,6%", conversions: "402", budget: "€ 12.420" }, { campaign: "Mios - Meta Ads", platform: "M", roas: "4,36", ctr: "2,5%", conversions: "351", budget: "€ 9.850" }, { campaign: "Nerone - Performance Max", platform: "G", roas: "4,08", ctr: "2,1%", conversions: "286", budget: "€ 8.120" }],
  },
}

const monthlyMissionObjectives = [
  { id: "goal-monthly-revenue", icon: "revenue", label: "Fatturato mensile", current: 32_400, target: 45_000, format: "currency" as const, suffix: "" },
  { id: "goal-new-clients", icon: "clients", label: "Nuovi clienti acquisiti", current: 4, target: 6, format: "number" as const, suffix: "clienti" },
  { id: "goal-completed-projects", icon: "projects", label: "Progetti completati", current: 3, target: 5, format: "number" as const, suffix: "progetti" },
]

export const monthlyMission = {
  completionPercentage: 72,
  completedObjectives: 3,
  totalObjectives: 5,
  daysRemaining: 13,
  nextRevenueObjective: 35_000,
  objectives: monthlyMissionObjectives.map((objective) => ({ ...objective, progress: Math.round(objective.current / objective.target * 100), status: "In linea" })),
}

export const missionObjectives = monthlyMission.objectives

export const activeClientsFixtures = {
  "7d": metric("Clienti attivi", "31", "+3,3%", "rispetto alla settimana precedente", "chart-2", [27, 28, 28, 29, 30, 30, 31]),
  "30d": metric("Clienti attivi", "36", "+8%", "rispetto al mese scorso", "chart-2", [29, 30, 31, 32, 33, 35, 36]),
  "90d": metric("Clienti attivi", "42", "+16,7%", "rispetto ai 90 giorni precedenti", "chart-2", [31, 33, 34, 36, 38, 40, 42]),
}

export const dashboardActivities = [
  { id: "activity-review-proposal", title: "Revisione proposta", client: "Mios Website", time: "14:00", priority: "Alta", assignee: "MW" },
  { id: "activity-send-quote", title: "Invio preventivo", client: "Nerone Landing", time: "15:30", priority: "Normale", assignee: "NL" },
  { id: "activity-follow-up-proposal", title: "Follow-up proposta", client: "Aurora E-commerce", time: "17:00", priority: "Urgente", assignee: "AR" },
  { id: "activity-approve-creatives", title: "Approvazione creatività", client: "Green Future", time: "17:30", priority: "Completata", assignee: "GF" },
]

export const dashboardDeadlines = [
  { id: "deadline-delivery-aurora-2026-08-27", date: "27 AGO", title: "Consegna sito web", detail: "Aurora E-commerce", status: "Domani", tone: "destructive" as const },
  { id: "deadline-content-mios-2026-08-30", date: "30 AGO", title: "Revisione contenuti", detail: "Mios Website", status: "Tra 3 giorni", tone: "warning" as const },
  { id: "deadline-payment-nerone-2026-09-05", date: "05 SET", title: "Pagamento fattura", detail: "Nerone Landing", status: "Regolare", tone: "neutral" as const },
  { id: "deadline-report-rossi-2026-09-08", date: "08 SET", title: "Report mensile", detail: "Studio Rossi SEO", status: "Completata", tone: "success" as const },
  { id: "deadline-payment-green-future-2026-09-12", date: "12 SET", title: "Pagamento fattura", detail: "Green Future", status: "Regolare", tone: "neutral" as const },
]

export const dashboardProjects = [
  { id: "project-aurora-ecommerce", name: "Aurora E-commerce", client: "Aurora", progress: 76, deadline: "16 ago", deadlineDate: "2026-08-16", state: "Scaduto", tone: "destructive" as const },
  { id: "project-mios-website", name: "Mios Website", client: "Mios", progress: 58, deadline: "18 ago", deadlineDate: "2026-08-18", state: "Oggi", tone: "destructive" as const },
  { id: "project-studio-rossi-seo", name: "Studio Rossi SEO", client: "Studio Rossi", progress: 42, deadline: "25 ago", deadlineDate: "2026-08-25", state: "Vicino", tone: "warning" as const },
  { id: "project-nerone-landing", name: "Nerone Landing", client: "Nerone", progress: 31, deadline: "10 set", deadlineDate: "2026-09-10", state: "Regolare", tone: "neutral" as const },
  { id: "project-green-future-campaign", name: "Green Future Campaign", client: "Green Future", progress: 64, deadline: "18 set", deadlineDate: "2026-09-18", state: "Regolare", tone: "neutral" as const },
]

const additionalCampaigns = [
  { campaign: "Green Future - Meta Ads", platform: "M", roas: "3,12", ctr: "1,6%", conversions: "81", budget: "€ 1.840" },
  { campaign: "Studio Rossi - Search", platform: "G", roas: "2,85", ctr: "1,4%", conversions: "64", budget: "€ 1.520" },
]

Object.values(overviewRangeFixtures).forEach((fixture) => fixture.topCampaigns.push(...additionalCampaigns))
