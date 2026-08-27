"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import {
  presenceStatuses,
  type ManualPresenceStatus,
  type PresenceRecord,
  type PresenceSource,
  type PresenceStatus,
} from "@/features/identity/presence"
import { collaborationApi, type CollaborationPresence } from "@/lib/tenant-feature-api"

type PresenceDuration = "30m" | "1h" | "today" | "forever"
type PresenceContextValue = {
  records: PresenceRecord[]
  current: PresenceRecord
  connected: boolean
  setManualStatus: (status: ManualPresenceStatus | "automatic", duration?: PresenceDuration) => Promise<boolean>
  setOperationalActivity: (activity: PresenceRecord["currentActivity"] | null) => void
  presenceFor: (userId: string) => PresenceRecord
  quietNotifications: boolean
}

const PresenceContext = createContext<PresenceContextValue | null>(null)
const emptyPresence = (userId: string): PresenceRecord => ({ userId, status: "offline", statusSource: "automatic", activeSessionIds: [] })

function statusOf(value: string): PresenceStatus {
  return presenceStatuses.includes(value as PresenceStatus) ? value as PresenceStatus : "offline"
}

function mapPresence(
  value: CollaborationPresence,
  currentUserId: string,
  currentActivity?: PresenceRecord["currentActivity"],
): PresenceRecord {
  const ownActivity = value.userId === currentUserId ? currentActivity : undefined
  const source: PresenceSource = value.source === "manual" ? "manual" : ownActivity?.kind ?? "automatic"
  return {
    userId: value.userId,
    status: statusOf(value.status),
    statusSource: source,
    lastSeenAt: value.lastSeenAt ?? undefined,
    expiresAt: value.expiresAt ?? undefined,
    activeSessionIds: [],
    currentActivity: ownActivity,
  }
}

export function DoflowPresenceProvider({ children }: { children: React.ReactNode }) {
  const identity = useDoflowIdentity()
  const commercial = useCommercialLeads()
  const visualGateReadOnly = typeof window !== "undefined"
    && Boolean((window as Window & { __DOFLOW_VISUAL_READ_ONLY__?: boolean }).__DOFLOW_VISUAL_READ_ONLY__)
  const [records, setRecords] = useState<PresenceRecord[]>([])
  const [connected, setConnected] = useState(false)
  const operationalActivityRef = useRef<PresenceRecord["currentActivity"]>(undefined)

  const automaticPresence = useCallback((): { status: PresenceStatus; currentActivity?: PresenceRecord["currentActivity"] } => {
    const operationalActivity = operationalActivityRef.current
    if (operationalActivity?.kind === "guided_call") return { status: "in_call", currentActivity: operationalActivity }
    const now = Date.now()
    const meeting = commercial.appointments.find((item) =>
      item.status === "scheduled"
      && item.assigneeId === identity.currentUserId
      && Date.parse(item.startsAt) <= now
      && Date.parse(item.endsAt) >= now,
    )
    if (meeting) {
      return {
        status: "in_meeting",
        currentActivity: { kind: "appointment", label: "Appuntamento", startedAt: meeting.startsAt, endsAt: meeting.endsAt },
      }
    }
    const timer = commercial.timeSessions.find((item) =>
      item.userId === identity.currentUserId && item.status === "active" && !item.archivedAt,
    )
    if (timer) {
      return {
        status: "busy",
        currentActivity: { kind: "timer", label: "Timer operativo", startedAt: timer.resumedAt ?? timer.startedAt },
      }
    }
    return { status: "online" }
  }, [commercial.appointments, commercial.timeSessions, identity.currentUserId])

  const refresh = useCallback(async () => {
    try {
      const page = await collaborationApi.presence()
      const next = page.items.map((item) => mapPresence(item, identity.currentUserId, operationalActivityRef.current))
      setRecords(next)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [identity.currentUserId])

  const sendHeartbeat = useCallback(async () => {
    const automatic = automaticPresence()
    await collaborationApi.setPresence({
      status: automatic.status,
      activity: automatic.currentActivity?.label,
    })
  }, [automaticPresence])

  useEffect(() => {
    if (visualGateReadOnly) {
      const initial = window.setTimeout(() => void refresh(), 0)
      const poll = window.setInterval(() => void refresh(), 5_000)
      return () => {
        window.clearTimeout(initial)
        window.clearInterval(poll)
      }
    }
    const initial = window.setTimeout(() => {
      void sendHeartbeat().then(refresh).catch(() => setConnected(false))
    }, 0)
    const heartbeat = window.setInterval(() => void sendHeartbeat().catch(() => setConnected(false)), 15_000)
    const poll = window.setInterval(() => void refresh(), 5_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(heartbeat)
      window.clearInterval(poll)
      void collaborationApi.clearPresence().catch(() => undefined)
    }
  }, [identity.currentUserId, refresh, sendHeartbeat, visualGateReadOnly])

  const setManualStatus = useCallback(async (status: ManualPresenceStatus | "automatic", duration: PresenceDuration = "forever") => {
    try {
      const automatic = automaticPresence()
      await collaborationApi.setPresence(status === "automatic"
        ? { status: "automatic", automaticStatus: automatic.status }
        : { status, duration })
      await refresh()
      return true
    } catch {
      return false
    }
  }, [automaticPresence, refresh])

  const setOperationalActivity = useCallback((activity: PresenceRecord["currentActivity"] | null) => {
    operationalActivityRef.current = activity ?? undefined
    void sendHeartbeat().then(refresh).catch(() => setConnected(false))
  }, [refresh, sendHeartbeat])

  const presenceFor = useCallback(
    (userId: string) => records.find((item) => item.userId === userId) ?? emptyPresence(userId),
    [records],
  )
  const current = presenceFor(identity.currentUserId)
  const value = useMemo<PresenceContextValue>(() => ({
    records,
    current,
    connected,
    setManualStatus,
    setOperationalActivity,
    presenceFor,
    quietNotifications: ["busy", "do_not_disturb", "in_call", "in_meeting"].includes(current.status),
  }), [connected, current, presenceFor, records, setManualStatus, setOperationalActivity])
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function useDoflowPresence() {
  const value = useContext(PresenceContext)
  if (!value) throw new Error("useDoflowPresence deve essere usato dentro DoflowPresenceProvider")
  return value
}

export function useOptionalDoflowPresence() {
  return useContext(PresenceContext)
}
