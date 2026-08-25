import type { PipelineStage } from "@/features/commercial/types"

export const pipelineStages: Array<{ id: PipelineStage; label: string; probability: number }> = [
  { id: "new", label: "Nuovo", probability: 10 },
  { id: "qualified", label: "Qualificato", probability: 25 },
  { id: "proposal", label: "Proposta", probability: 50 },
  { id: "negotiation", label: "Negoziazione", probability: 75 },
  { id: "won", label: "Vinto", probability: 100 },
  { id: "unqualified", label: "Non qualificato", probability: 0 },
  { id: "not-interested", label: "Non interessato", probability: 0 },
  { id: "follow-up", label: "Follow-up", probability: 20 },
  { id: "lost", label: "Perso", probability: 0 },
]

export function normalizePipelineStage(value: unknown): PipelineStage {
  const normalized = String(value || "").trim().toLowerCase().replaceAll("_", "-")
  return pipelineStages.some((stage) => stage.id === normalized) ? normalized as PipelineStage : "new"
}
