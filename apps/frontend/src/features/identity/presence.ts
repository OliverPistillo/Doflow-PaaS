export const presenceStatuses = ["online", "busy", "away", "offline", "do_not_disturb", "in_call", "in_meeting"] as const
export type PresenceStatus = (typeof presenceStatuses)[number]
export type PresenceSource = "automatic" | "manual" | "guided_call" | "livekit_call" | "appointment" | "timer"
export type ManualPresenceStatus = Extract<PresenceStatus, "online" | "busy" | "away" | "offline" | "do_not_disturb">

export type PresenceRecord = {
  userId: string
  status: PresenceStatus
  statusSource: PresenceSource
  lastSeenAt?: string
  expiresAt?: string
  activeSessionIds: string[]
  currentActivity?: { kind: "guided_call" | "livekit_call" | "appointment" | "timer"; label: string; startedAt: string; endsAt?: string }
}

export const presenceLabels: Record<PresenceStatus, string> = {
  online: "Online",
  busy: "Occupato",
  away: "Assente",
  offline: "Offline",
  do_not_disturb: "Non disturbare",
  in_call: "In chiamata",
  in_meeting: "In riunione",
}

export const presenceDotClasses: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  busy: "bg-red-500",
  away: "bg-amber-400",
  offline: "bg-slate-400",
  do_not_disturb: "bg-red-600",
  in_call: "bg-violet-500",
  in_meeting: "bg-blue-500",
}

export function isNotificationQuiet(status: PresenceStatus) {
  return ["busy", "do_not_disturb", "in_call", "in_meeting"].includes(status)
}
