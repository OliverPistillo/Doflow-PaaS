export type FlowPreferences = {
  userId: string
  onboardingStatus: "not_started" | "in_progress" | "completed" | "dismissed"
  tourStep: number
  activeTourId: string
  tutorialVersion: number
  completedTours: string[]
  dismissedModules: string[]
  suggestionsEnabled: boolean
  animationsEnabled: boolean
  reducedMotion: boolean
  illustratedEmptyStates: boolean
  contextualMascotEnabled: boolean
  seenNewsVersion: number
  firstCompletedAt?: string
  updatedAt: string
}

export function shouldAutoOpenFlowWelcome(status: FlowPreferences["onboardingStatus"]) {
  return status === "not_started"
}
