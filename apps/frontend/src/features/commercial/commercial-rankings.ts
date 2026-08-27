import type { RankingMetric, RankingRole, RankingSnapshot } from "@/features/commercial/commercial-provider-types"

export const rankingRoleLabels: Record<RankingRole, string> = {
  commercial: "Commerciali",
  developer: "Sviluppatori",
  project_manager: "Project Manager",
  support: "Supporto",
}

export const rankingBadgeLabels: Record<RankingRole, string> = {
  commercial: "Miglior venditore #1",
  developer: "Miglior sviluppatore #1",
  project_manager: "Miglior Project Manager #1",
  support: "Miglior supporto #1",
}

export const rankingMetricLabels: Record<RankingMetric, string> = {
  operational_points: "Punti operativi approvati",
  gross_collected: "Incassato lordo",
  net_collected: "Incassato netto",
  paid_sales: "Vendite pagate",
  new_paying_customers: "Nuovi clienti paganti",
  lead_to_payment_conversion: "Conversione lead → pagamento",
  average_collected_ticket: "Ticket medio incassato",
  refunds: "Rimborsi",
  completed_followups: "Follow-up completati",
  approved_technical_work: "Lavori tecnici approvati",
  resolved_bugs: "Bug risolti",
  on_time_activities: "Attività puntuali",
  qa_passed: "QA superato",
  estimate_accuracy: "Precisione stima/tempo",
  approved_projects: "Progetti approvati/coordinati",
  delivered_projects: "Progetti consegnati",
  on_time_projects: "Consegne puntuali",
  project_delays: "Consegne in ritardo",
  reopened_work: "Riaperture/modifiche richieste",
  support_completed: "Interventi supporto completati",
  renewals_completed: "Rinnovi completati",
}

export type CurrentRankingAward = {
  role: RankingRole
  label: string
  snapshot: RankingSnapshot
  score: number
  metrics: Partial<Record<RankingMetric, number>>
  totalWins: number
  consecutiveWins: number
  validFrom: string
  validThrough: string
}

function shiftPeriod(period: string, offset: number) {
  const date = new Date(`${period}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return date.toISOString().slice(0, 7)
}

export function currentRankingSnapshotPeriod(reference = new Date()) {
  return shiftPeriod(reference.toISOString().slice(0, 7), -1)
}

export function rankingHistory(userId: string, role: RankingRole, snapshots: RankingSnapshot[]) {
  const wins = snapshots
    .filter((snapshot) => snapshot.status !== "revoked" && snapshot.role === role && snapshot.winnerUserId === userId)
    .sort((a, b) => a.period.localeCompare(b.period))
  let longest = 0
  let current = 0
  let previous: string | undefined
  wins.forEach((win) => {
    current = previous && shiftPeriod(previous, 1) === win.period ? current + 1 : 1
    longest = Math.max(longest, current)
    previous = win.period
  })
  let currentStreak = 0
  let expected = wins.at(-1)?.period
  for (let index = wins.length - 1; index >= 0 && expected; index -= 1) {
    if (wins[index].period !== expected) break
    currentStreak += 1
    expected = shiftPeriod(expected, -1)
  }
  return { wins, totalWins: wins.length, consecutiveWins: longest, currentStreak }
}

// Badge presentation derives only from immutable snapshots returned by the backend.
export function getCurrentRankingAwards(userId: string, snapshots: RankingSnapshot[], reference = new Date()): CurrentRankingAward[] {
  const winningPeriod = currentRankingSnapshotPeriod(reference)
  const validPeriod = shiftPeriod(winningPeriod, 1)
  const validThroughDate = new Date(`${validPeriod}-01T12:00:00Z`)
  validThroughDate.setUTCMonth(validThroughDate.getUTCMonth() + 1)
  validThroughDate.setUTCDate(0)
  return snapshots
    .filter((snapshot) => snapshot.status !== "revoked" && snapshot.period === winningPeriod && snapshot.winnerUserId === userId)
    .sort((left, right) => left.role.localeCompare(right.role))
    .map((snapshot) => {
      const history = rankingHistory(userId, snapshot.role, snapshots)
      const score = snapshot.scores.find((item) => item.userId === userId)
      return {
        role: snapshot.role,
        label: rankingBadgeLabels[snapshot.role],
        snapshot,
        score: score?.score ?? 0,
        metrics: score?.metrics ?? {},
        totalWins: history.totalWins,
        consecutiveWins: history.currentStreak,
        validFrom: `${validPeriod}-01`,
        validThrough: validThroughDate.toISOString().slice(0, 10),
      }
    })
}
