"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { ApiError, apiFetch } from "@/lib/api"
import { clearDoFlowUser } from "@/lib/jwt"
import { teamApi, type TeamMember } from "@/lib/tenant-team-api"
import { backendContractsApi } from "@/lib/tenant-backend-contracts-api"
import { isDoflowDesktop, notifyDesktopReady, registerDesktopProfile } from "@/lib/desktop-bridge"
import {
  capabilitiesForRoles,
  doflowRoles,
  referenceCapabilityAllowed,
  type DoflowCapability,
  type DoflowRole,
  type ReferenceCapability,
} from "@/features/identity/permissions"

export type LeadOpenMode = "quick" | "full"
export type ClientOpenMode = "quick" | "full"
export type ListPreferences = { sort: string; group: string; groupOrder?: "asc" | "desc"; collapsedGroups?: string[] }
export type AgendaReminderMinutes = 0 | 5 | 15 | 30 | 60
export type NotificationFrequency = "immediate" | "daily" | "off"
export type PersonalPreferences = {
  language: "it" | "en"
  timeZone: string
  homePage: string
  theme: "system" | "light" | "dark"
  density: "comfortable" | "compact"
  dateFormat: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd"
  timeFormat: "24h" | "12h"
  weekStartsOn: "monday" | "sunday"
  calendarView: "month" | "week" | "day" | "agenda"
  commercialView: "list" | "kanban" | "deadlines" | "appointments"
  teamSpaceParticipantsOpen: boolean
  reduceMotion: boolean
  notificationFrequency: NotificationFrequency
  notificationRules: Record<string, NotificationFrequency>
}

export type DoflowIdentityUser = {
  id: string
  name: string
  email: string
  roles: DoflowRole[]
  capabilities?: DoflowCapability[]
  explicitCapabilities?: DoflowCapability[]
  avatarUrl?: string
  avatarUpdatedAt?: string
  avatarUpdatedBy?: string
  weeklyCapacityHours?: number
  teamMemberId?: string
  tenantRole?: string
  lastName?: string
  phone?: string
  signature?: string
  active?: boolean
  lastAccessAt?: string
  metadata?: Record<string, unknown>
}

export type TeamDuty = {
  id: string
  userId: string
  title: string
  responsibilities: string[]
  competencyAreas: string[]
  capabilityIds: DoflowCapability[]
  areaOwners: Array<{ area: string; userId: string }>
  validFrom: string
  validTo?: string
  version: number
  status: "Bozza" | "Attiva" | "Sostituita" | "Archiviata"
  authorId: string
  approverId?: string
  approvedAt?: string
  readAt?: string
  readBy?: string
  notes?: string
  supersedesId?: string
  createdAt: string
  updatedAt: string
  history: Array<{ id: string; field: string; previousValue: string; nextValue: string; authorId: string; createdAt: string }>
}

type IdentityPreferences = {
  leadOpenMode: LeadOpenMode
  clientOpenMode: ClientOpenMode
  leadList: ListPreferences
  clientList: ListPreferences
  agendaReminderMinutes: AgendaReminderMinutes
  personal: PersonalPreferences
}

type AuthMe = {
  user: {
    id: string
    email: string
    role: string
    tenantId?: string
    tenantSlug?: string
    authStage?: string
  }
}

type IdentityBootstrap = {
  preferences?: Partial<IdentityPreferences>
  capabilities?: DoflowCapability[]
  explicitCapabilities?: DoflowCapability[]
  assignments?: Array<{
    userId: string
    roles: DoflowRole[]
    capabilities: DoflowCapability[]
    explicitCapabilities?: DoflowCapability[]
  }>
}

type IdentityContextValue = {
  users: DoflowIdentityUser[]
  currentUser: DoflowIdentityUser
  currentUserId: string
  capabilities: ReadonlySet<DoflowCapability>
  hasCapability: (capability: DoflowCapability | ReferenceCapability) => boolean
  reloadIdentity: () => Promise<boolean>
  updateUserRoles: (userId: string, roles: DoflowRole[]) => Promise<boolean>
  updateUserCapabilities: (userId: string, capabilities: DoflowCapability[]) => Promise<boolean>
  updateUserAvatar: (userId: string, avatarUrl?: string) => boolean
  updateUserProfile: (userId: string, updates: Pick<DoflowIdentityUser, "name" | "lastName" | "email" | "phone" | "signature">) => boolean
  updateUserActive: (userId: string, active: boolean) => boolean
  updateUserWeeklyCapacity: (userId: string, hours: number) => boolean
  teamDuties: TeamDuty[]
  createTeamDutyVersion: (input: Pick<TeamDuty, "userId" | "title" | "responsibilities" | "competencyAreas" | "capabilityIds" | "areaOwners" | "validFrom" | "validTo" | "notes">) => string | null
  updateTeamDuty: (dutyId: string, updates: Partial<Pick<TeamDuty, "title" | "responsibilities" | "competencyAreas" | "capabilityIds" | "areaOwners" | "validFrom" | "validTo" | "notes">>) => boolean
  approveTeamDuty: (dutyId: string) => boolean
  confirmTeamDutyRead: (dutyId: string) => boolean
  archiveTeamDuty: (dutyId: string) => boolean
  leadOpenMode: LeadOpenMode
  setLeadOpenMode: (mode: LeadOpenMode) => void
  clientOpenMode: ClientOpenMode
  setClientOpenMode: (mode: ClientOpenMode) => void
  leadListPreferences: ListPreferences
  setLeadListPreferences: (preferences: ListPreferences) => void
  clientListPreferences: ListPreferences
  setClientListPreferences: (preferences: ListPreferences) => void
  agendaReminderMinutes: AgendaReminderMinutes
  setAgendaReminderMinutes: (minutes: AgendaReminderMinutes) => void
  personalPreferences: PersonalPreferences
  setPersonalPreferences: (updates: Partial<PersonalPreferences>) => boolean
  hasHydrated: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}

const defaultPersonalPreferences: PersonalPreferences = {
  language: "it",
  timeZone: "Europe/Rome",
  homePage: "/dashboard",
  theme: "system",
  density: "comfortable",
  dateFormat: "dd/MM/yyyy",
  timeFormat: "24h",
  weekStartsOn: "monday",
  calendarView: "month",
  commercialView: "list",
  teamSpaceParticipantsOpen: true,
  reduceMotion: false,
  notificationFrequency: "immediate",
  notificationRules: {},
}

const defaultPreferences: IdentityPreferences = {
  leadOpenMode: "quick",
  clientOpenMode: "quick",
  leadList: { sort: "updated-desc", group: "none" },
  clientList: { sort: "updated-desc", group: "none" },
  agendaReminderMinutes: 15,
  personal: defaultPersonalPreferences,
}

const anonymousUser: DoflowIdentityUser = {
  id: "anonymous",
  name: "Utente",
  email: "",
  roles: [],
  weeklyCapacityHours: 40,
}

const IdentityContext = createContext<IdentityContextValue | null>(null)

function normalizeRole(value: unknown): DoflowRole | null {
  const role = String(value || "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_")
  if (doflowRoles.includes(role as DoflowRole)) return role as DoflowRole
  if (role === "sales" || role === "salesperson") return "commercial"
  if (role === "developer" || role === "technical") return "web_developer"
  if (role === "pm" || role === "manager") return "project_manager"
  return null
}

function rolesForAccount(accountRole: string, member?: TeamMember): DoflowRole[] {
  const technicalRole = String(accountRole || "").trim().toLowerCase()
  if (technicalRole === "owner") {
    return ["administrator", "commercial", "web_developer", "project_manager"]
  }
  if (["admin", "superadmin", "super_admin"].includes(technicalRole)) {
    return ["administrator"]
  }
  const candidates = [
    member?.operational_role,
    member?.tenant_role,
    member?.job_title,
    technicalRole,
  ]
    .map(normalizeRole)
    .filter((role): role is DoflowRole => role !== null)
  return Array.from(new Set(candidates))
}

function toIdentityUser(member: TeamMember, accountRole = ""): DoflowIdentityUser {
  return {
    id: String(member.user_id || member.id),
    name: member.display_name || member.email,
    email: member.email,
    roles: rolesForAccount(accountRole, member),
    avatarUrl:
      typeof member.metadata?.avatar_url === "string"
        ? member.metadata.avatar_url
        : undefined,
    weeklyCapacityHours: Number(member.capacity_hours_per_week || 40),
    teamMemberId: member.id,
    tenantRole: String(accountRole || member.tenant_role || "user"),
    lastName: member.last_name || undefined,
    phone: member.phone || undefined,
    signature: typeof member.metadata?.signature === "string" ? member.metadata.signature : undefined,
    active: String(member.status || "active").toLowerCase() === "active",
    lastAccessAt: typeof member.metadata?.last_access_at === "string" ? member.metadata.last_access_at : undefined,
    metadata: member.metadata || {},
  }
}

function normalizePreferences(value?: Partial<IdentityPreferences>): IdentityPreferences {
  return {
    leadOpenMode: value?.leadOpenMode === "full" ? "full" : "quick",
    clientOpenMode: value?.clientOpenMode === "full" ? "full" : "quick",
    leadList: {
      sort: String(value?.leadList?.sort || defaultPreferences.leadList.sort),
      group: String(value?.leadList?.group || defaultPreferences.leadList.group),
    },
    clientList: {
      sort: String(value?.clientList?.sort || defaultPreferences.clientList.sort),
      group: String(value?.clientList?.group || defaultPreferences.clientList.group),
      groupOrder: value?.clientList?.groupOrder === "desc" ? "desc" : "asc",
      collapsedGroups: Array.isArray(value?.clientList?.collapsedGroups) ? value.clientList.collapsedGroups.map(String).slice(0, 100) : [],
    },
    agendaReminderMinutes: ([0, 5, 15, 30, 60] as const).includes(value?.agendaReminderMinutes as AgendaReminderMinutes) ? value!.agendaReminderMinutes! : defaultPreferences.agendaReminderMinutes,
    personal: {
      ...defaultPersonalPreferences,
      ...(value?.personal || {}),
      notificationRules: { ...defaultPersonalPreferences.notificationRules, ...(value?.personal?.notificationRules || {}) },
    },
  }
}

function normalizeCapabilities(values: readonly DoflowCapability[] = []) {
  const allowed = capabilitiesForRoles(["administrator"])
  return Array.from(new Set(values.filter((capability) => allowed.has(capability))))
}

function explicitCapabilitiesForAssignment(
  assignment: NonNullable<IdentityBootstrap["assignments"]>[number],
) {
  if (assignment.explicitCapabilities) {
    return normalizeCapabilities(assignment.explicitCapabilities)
  }
  const inherited = capabilitiesForRoles(assignment.roles)
  return normalizeCapabilities(assignment.capabilities).filter(
    (capability) => !inherited.has(capability),
  )
}

function effectiveCapabilities(
  roles: readonly DoflowRole[],
  explicitCapabilities: readonly DoflowCapability[],
) {
  return Array.from(new Set([...capabilitiesForRoles(roles), ...explicitCapabilities]))
}

export function DoflowIdentityProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<DoflowIdentityUser[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [authenticatedUserId, setAuthenticatedUserId] = useState("")
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [serverCapabilities, setServerCapabilities] = useState<DoflowCapability[]>([])
  const [hasHydrated, setHasHydrated] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const hydrateIdentity = useCallback(
    async ({
      allowIdentityFallback = false,
      shouldApply = () => true,
    }: {
      allowIdentityFallback?: boolean
      shouldApply?: () => boolean
    } = {}) => {
      const identityRequest = apiFetch<IdentityBootstrap>("/tenant/doflow/identity")
      const membersRequest = teamApi.members({ limit: 200 }).catch((error) => {
        if (error instanceof ApiError && error.status === 403) return { items: [] }
        throw error
      })
      const [auth, members, bootstrap] = await Promise.all([
        apiFetch<AuthMe>("/auth/me"),
        membersRequest,
        allowIdentityFallback
          ? identityRequest.catch(
              (): IdentityBootstrap => ({ preferences: defaultPreferences, capabilities: [] }),
            )
          : identityRequest,
      ])
      if (!shouldApply()) return false

      const tenant = String(auth.user.tenantSlug || auth.user.tenantId || "").toLowerCase()
      const stage = String(auth.user.authStage || "FULL").toUpperCase()
      if (tenant !== "doflow" || stage !== "FULL") throw new Error("Sessione Doflow non valida")

      const mapped = members.items
        .filter((member) =>
          Boolean(member.user_id)
          && String(member.status || "active").trim().toLowerCase() === "active",
        )
        .map((member) => {
          const mappedUser = toIdentityUser(
            member,
            String(member.user_id || member.id) === String(auth.user.id)
              ? auth.user.role
              : String(member.tenant_role || ""),
          )
          const assignment = bootstrap.assignments?.find(
            (candidate) => candidate.userId === mappedUser.id,
          )
          if (!assignment) return mappedUser
          const explicitCapabilities = explicitCapabilitiesForAssignment(assignment)
          return {
            ...mappedUser,
            roles: assignment.roles,
            capabilities: normalizeCapabilities(assignment.capabilities),
            explicitCapabilities,
          }
        })
      const fallbackRoles = rolesForAccount(auth.user.role)
      const fallbackExplicitCapabilities = normalizeCapabilities(
        bootstrap.explicitCapabilities || [],
      )
      const current =
        mapped.find((candidate) => candidate.id === String(auth.user.id)) ||
        ({
          id: String(auth.user.id),
          name: auth.user.email.split("@")[0] || auth.user.email,
          email: auth.user.email,
          roles: fallbackRoles,
          capabilities: effectiveCapabilities(fallbackRoles, fallbackExplicitCapabilities),
          explicitCapabilities: fallbackExplicitCapabilities,
          weeklyCapacityHours: 40,
          tenantRole: auth.user.role,
        } satisfies DoflowIdentityUser)

      setUsers(mapped.some((candidate) => candidate.id === current.id) ? mapped : [current, ...mapped])
      setCurrentUserId(current.id)
      setAuthenticatedUserId(current.id)
      setPreferences(normalizePreferences(bootstrap.preferences))
      setServerCapabilities(normalizeCapabilities(bootstrap.capabilities || []))
      setIsAuthenticated(true)
      return true
    },
    [],
  )

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      void hydrateIdentity({ allowIdentityFallback: true, shouldApply: () => !cancelled })
        .catch(() => {
          if (!cancelled) {
            setUsers([])
            setCurrentUserId("")
            setAuthenticatedUserId("")
            setIsAuthenticated(false)
          }
        })
        .finally(() => {
          if (!cancelled) setHasHydrated(true)
        })
    })

    return () => {
      cancelled = true
    }
  }, [hydrateIdentity])

  const reloadIdentity = useCallback(async () => {
    try {
      return await hydrateIdentity()
    } catch {
      toast.error("Impossibile ricaricare ruoli e capability")
      return false
    }
  }, [hydrateIdentity])

  const currentUser =
    users.find((candidate) => candidate.id === currentUserId) ||
    users.find((candidate) => candidate.id === authenticatedUserId) ||
    anonymousUser
  const desktopProfileRegistered = useRef("")
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || currentUser.id === "anonymous" || !isDoflowDesktop()) return
    const registrationKey = `${currentUser.id}:${currentUser.email}`
    if (desktopProfileRegistered.current === registrationKey) return
    desktopProfileRegistered.current = registrationKey
    void registerDesktopProfile({
      userId: currentUser.id,
      tenantId: "doflow",
      tenantSlug: "doflow",
      name: currentUser.name,
      email: currentUser.email,
      avatarUrl: currentUser.avatarUrl?.startsWith("https://") ? currentUser.avatarUrl : undefined,
      initials: currentUser.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    })
      .then((result) => {
        if (result && result.credentialStatus === "unavailable") {
          toast.error("Accesso completato, ma Windows non ha potuto salvare la password in modo sicuro.")
        }
        return notifyDesktopReady("authenticated")
      })
      .catch(() => { desktopProfileRegistered.current = "" })
  }, [currentUser, hasHydrated, isAuthenticated])
  const capabilitySet = useMemo(
    () => new Set(serverCapabilities),
    [serverCapabilities],
  )
  const [teamDuties, setTeamDuties] = useState<TeamDuty[]>([])
  const mapTeamDuty = useCallback((row: Record<string, unknown>): TeamDuty => {
    const content = row.content && typeof row.content === "object" ? row.content as Partial<TeamDuty> : {}
    const recordId = String(row.id || "")
    const version = Number(row.version || row.current_version || 1)
    return { id: `${recordId}:${version}`, userId: String(content.userId || row.duty_key || ""), title: String(content.title || row.title || ""), responsibilities: Array.isArray(content.responsibilities) ? content.responsibilities.map(String) : [], competencyAreas: Array.isArray(content.competencyAreas) ? content.competencyAreas.map(String) : [], capabilityIds: Array.isArray(content.capabilityIds) ? content.capabilityIds as DoflowCapability[] : [], areaOwners: Array.isArray(content.areaOwners) ? content.areaOwners : [], validFrom: String(content.validFrom || row.version_created_at || row.created_at || new Date(0).toISOString()).slice(0, 10), validTo: content.validTo, version, status: content.status ?? "Bozza", authorId: String(row.author_user_id || content.authorId || ""), approverId: content.approverId, approvedAt: content.approvedAt, readAt: row.read_at ? String(row.read_at) : undefined, readBy: row.read_at ? currentUserId : undefined, notes: content.notes, supersedesId: content.supersedesId, createdAt: String(row.version_created_at || row.created_at || new Date(0).toISOString()), updatedAt: String(row.updated_at || row.version_created_at || new Date(0).toISOString()), history: [] }
  }, [currentUserId])
  const refreshTeamDuties = useCallback(async () => {
    const result = await backendContractsApi.teamDuties.list()
    setTeamDuties(result.items.map(mapTeamDuty))
  }, [mapTeamDuty])
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return
    let cancelled = false
    void backendContractsApi.teamDuties.list().then((result) => { if (!cancelled) setTeamDuties(result.items.map(mapTeamDuty)) }).catch(() => { if (!cancelled) setTeamDuties([]) })
    return () => { cancelled = true }
  }, [hasHydrated, isAuthenticated, mapTeamDuty])

  const persistPreferences = (updates: Partial<IdentityPreferences>) => {
    setPreferences((current) => {
      const next = normalizePreferences({ ...current, ...updates })
      void apiFetch("/tenant/doflow/identity/preferences", {
        method: "PATCH",
        body: JSON.stringify(next),
      }).catch(() => undefined)
      return next
    })
  }

  const value = useMemo<IdentityContextValue>(
    () => ({
      users,
      currentUser,
      currentUserId: currentUser.id,
      capabilities: capabilitySet,
      hasCapability: (capability) => capabilitySet.has(capability as DoflowCapability) || referenceCapabilityAllowed(capabilitySet, capability as ReferenceCapability),
      reloadIdentity,
      updateUserRoles: async (userId, roles) => {
        if (!capabilitySet.has("canManageRoles")) return false
        const normalized = Array.from(new Set(roles.filter((role) => doflowRoles.includes(role))))
        const previous = users.find((user) => user.id === userId)
        setUsers((current) =>
          current.map((user) => {
            if (user.id !== userId) return user
            const explicitCapabilities = user.explicitCapabilities || []
            return {
              ...user,
              roles: normalized,
              capabilities: effectiveCapabilities(normalized, explicitCapabilities),
            }
          }),
        )
        try {
          await apiFetch(`/tenant/doflow/identity/users/${encodeURIComponent(userId)}/roles`, {
            method: "PATCH",
            body: JSON.stringify({ roles: normalized }),
          })
          return true
        } catch {
          setUsers((current) =>
            current.map((user) => (user.id === userId && previous ? previous : user)),
          )
          toast.error("Impossibile aggiornare i ruoli")
          return false
        }
      },
      updateUserCapabilities: async (userId, nextCapabilities) => {
        if (!capabilitySet.has("canManageRoles")) return false
        const normalized = normalizeCapabilities(nextCapabilities)
        const previous = users.find((user) => user.id === userId)
        setUsers((current) =>
          current.map((user) =>
            user.id === userId
              ? {
                  ...user,
                  explicitCapabilities: normalized,
                  capabilities: effectiveCapabilities(user.roles, normalized),
                }
              : user,
          ),
        )
        try {
          await apiFetch(
            `/tenant/doflow/identity/users/${encodeURIComponent(userId)}/capabilities`,
            {
              method: "PATCH",
              body: JSON.stringify({ capabilities: normalized }),
            },
          )
          return true
        } catch {
          setUsers((current) =>
            current.map((user) =>
              user.id === userId && previous ? previous : user,
            ),
          )
          toast.error("Impossibile aggiornare le capability")
          return false
        }
      },
      updateUserAvatar: (userId, avatarUrl) => {
        const target = users.find((user) => user.id === userId)
        if (!target || (userId !== authenticatedUserId && !capabilitySet.has("canManageRoles"))) return false
        if (avatarUrl && (!/^data:image\/(?:png|jpeg|webp);base64,/.test(avatarUrl) || avatarUrl.length > 385_000)) return false
        const previous = target
        const nextMetadata = { ...(target.metadata || {}), avatar_url: avatarUrl || null }
        const changedAt = new Date().toISOString()
        setUsers((current) => current.map((user) => user.id === userId ? { ...user, avatarUrl, avatarUpdatedAt: changedAt, avatarUpdatedBy: authenticatedUserId, metadata: nextMetadata } : user))
        void teamApi.updateMember(target.teamMemberId || userId, { metadata: nextMetadata }).catch(() => {
          setUsers((current) => current.map((user) => user.id === userId ? previous : user))
          toast.error("Impossibile aggiornare la foto profilo")
        })
        return true
      },
      updateUserProfile: (userId, updates) => {
        const target = users.find((user) => user.id === userId)
        if (!target || (userId !== authenticatedUserId && !capabilitySet.has("canManageRoles"))) return false
        const name = updates.name.trim()
        const email = updates.email.trim().toLowerCase()
        if (!name || !/^\S+@\S+\.\S+$/.test(email)) return false
        const previous = target
        const nextMetadata = { ...(target.metadata || {}), signature: updates.signature?.trim() || null }
        const next = { ...target, name, lastName: updates.lastName?.trim() || undefined, email, phone: updates.phone?.trim() || undefined, signature: updates.signature?.trim() || undefined, metadata: nextMetadata }
        setUsers((current) => current.map((user) => user.id === userId ? next : user))
        void teamApi.updateMember(target.teamMemberId || userId, { display_name: name, last_name: next.lastName, email, phone: next.phone, metadata: nextMetadata }).catch(() => {
          setUsers((current) => current.map((user) => user.id === userId ? previous : user))
          toast.error("Impossibile aggiornare il profilo")
        })
        return true
      },
      updateUserActive: (userId, active) => {
        const target = users.find((user) => user.id === userId)
        if (!target || userId === authenticatedUserId || !capabilitySet.has("canManageRoles") || (target.active ?? true) === active) return false
        const previous = target
        setUsers((current) => current.map((user) => user.id === userId ? { ...user, active } : user))
        void teamApi.updateMember(target.teamMemberId || userId, { status: active ? "active" : "inactive" }).catch(() => {
          setUsers((current) => current.map((user) => user.id === userId ? previous : user))
          toast.error("Impossibile aggiornare lo stato account")
        })
        return true
      },
      updateUserWeeklyCapacity: (userId, hours) => {
        if (
          !Number.isFinite(hours) ||
          hours < 1 ||
          hours > 168 ||
          (userId !== authenticatedUserId && !capabilitySet.has("canManageRoles"))
        ) {
          return false
        }
        const normalized = Math.round(hours * 2) / 2
        const member = users.find((candidate) => candidate.id === userId)
        if (!member || member.weeklyCapacityHours === normalized) return false
        setUsers((current) =>
          current.map((user) =>
            user.id === userId ? { ...user, weeklyCapacityHours: normalized } : user,
          ),
        )
        void teamApi
          .updateMember(member.teamMemberId || userId, { capacity_hours_per_week: normalized })
          .catch(() => {
            setUsers((current) =>
              current.map((user) =>
                user.id === userId
                  ? { ...user, weeklyCapacityHours: member.weeklyCapacityHours }
                  : user,
              ),
            )
            toast.error("Impossibile aggiornare la capacità settimanale")
          })
        return true
      },
      teamDuties,
      createTeamDutyVersion: (input) => {
        if (!input.title.trim() || !input.validFrom) return null
        const existing = teamDuties.filter((item) => item.userId === input.userId).sort((a, b) => b.version - a.version)[0]
        const recordId = existing?.id.split(":")[0] || crypto.randomUUID(); const version = (existing?.version ?? 0) + 1; const id = `${recordId}:${version}`; const now = new Date().toISOString();
        const content = { ...input, title: input.title.trim(), status: "Bozza" as const, authorId: currentUserId, supersedesId: existing?.id }
        const duty: TeamDuty = { id, ...content, version, createdAt: now, updatedAt: now, history: [] }
        setTeamDuties((items) => [...items, duty])
        const request = existing ? backendContractsApi.teamDuties.update(recordId, { title: duty.title, content, reason: "Nuova versione", optimisticVersion: existing.version }) : backendContractsApi.teamDuties.create({ id: recordId, key: input.userId, title: duty.title, content, reason: "Versione iniziale" })
        void request.then(() => refreshTeamDuties()).catch((error) => { setTeamDuties((items) => items.filter((item) => item.id !== id)); toast.error(error instanceof Error ? error.message : "Mansione non salvata") }); return id
      },
      updateTeamDuty: (dutyId, updates) => {
        const current = teamDuties.find((item) => item.id === dutyId); if (!current) return false; const recordId = dutyId.split(":")[0]; const content = { ...current, ...updates }
        setTeamDuties((items) => items.map((item) => item.id === dutyId ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item))
        void backendContractsApi.teamDuties.update(recordId, { title: content.title, content, reason: "Aggiornamento mansione", optimisticVersion: current.version }).then(() => refreshTeamDuties()).catch((error) => { void refreshTeamDuties(); toast.error(error instanceof Error ? error.message : "Mansione non aggiornata") }); return true
      },
      approveTeamDuty: (dutyId) => {
        const current = teamDuties.find((item) => item.id === dutyId); if (!current || current.authorId === currentUserId || current.status !== "Bozza") return false; const recordId = dutyId.split(":")[0]; const now = new Date().toISOString(); const content = { ...current, status: "Attiva" as const, approverId: currentUserId, approvedAt: now }
        setTeamDuties((items) => [...items.map((item) => item.userId === current.userId && item.status === "Attiva" ? { ...item, status: "Sostituita" as const } : item), { ...content, id: `${recordId}:${current.version + 1}`, version: current.version + 1, updatedAt: now }])
        void backendContractsApi.teamDuties.approve(recordId, current.version).then(() => refreshTeamDuties()).catch((error) => { void refreshTeamDuties(); toast.error(error instanceof Error ? error.message : "Approvazione non registrata") }); return true
      },
      confirmTeamDutyRead: (dutyId) => {
        const current = teamDuties.find((item) => item.id === dutyId); if (!current || current.userId !== currentUserId) return false; const now = new Date().toISOString(); setTeamDuties((items) => items.map((item) => item.id === dutyId ? { ...item, readAt: now, readBy: currentUserId } : item)); void backendContractsApi.teamDuties.read(dutyId.split(":")[0], current.version).catch(() => undefined); return true
      },
      archiveTeamDuty: (dutyId) => {
        const current = teamDuties.find((item) => item.id === dutyId); if (!current) return false; const content = { ...current, status: "Archiviata" as const }; setTeamDuties((items) => items.map((item) => item.id === dutyId ? content : item)); void backendContractsApi.teamDuties.update(dutyId.split(":")[0], { title: current.title, content, reason: "Archiviazione", optimisticVersion: current.version }).then(() => refreshTeamDuties()).catch(() => { void refreshTeamDuties() }); return true
      },
      leadOpenMode: preferences.leadOpenMode,
      setLeadOpenMode: (mode) => persistPreferences({ leadOpenMode: mode }),
      clientOpenMode: preferences.clientOpenMode,
      setClientOpenMode: (mode) => persistPreferences({ clientOpenMode: mode }),
      leadListPreferences: preferences.leadList,
      setLeadListPreferences: (leadList) => persistPreferences({ leadList }),
      clientListPreferences: preferences.clientList,
      setClientListPreferences: (clientList) => persistPreferences({ clientList }),
      agendaReminderMinutes: preferences.agendaReminderMinutes,
      setAgendaReminderMinutes: (agendaReminderMinutes) => persistPreferences({ agendaReminderMinutes }),
      personalPreferences: preferences.personal,
      setPersonalPreferences: (personal) => {
        const next = normalizePreferences({ ...preferences, personal: { ...preferences.personal, ...personal } })
        if (JSON.stringify(next.personal) === JSON.stringify(preferences.personal)) return false
        persistPreferences({ personal: next.personal })
        return true
      },
      hasHydrated,
      isAuthenticated,
      signOut: async () => {
        await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined)
        {
          clearDoFlowUser()
          window.open("/login", "_self")
        }
      },
    }),
    [
      authenticatedUserId,
      capabilitySet,
      currentUser,
      currentUserId,
      hasHydrated,
      isAuthenticated,
      preferences,
      refreshTeamDuties,
      reloadIdentity,
      teamDuties,
      users,
    ],
  )

  if (!hasHydrated) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground" aria-busy="true">
        Caricamento sessione…
      </div>
    )
  }

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
}

export function useDoflowIdentity() {
  const context = useContext(IdentityContext)
  if (!context) {
    throw new Error("useDoflowIdentity deve essere usato dentro DoflowIdentityProvider")
  }
  return context
}

export function useOptionalDoflowIdentity() {
  return useContext(IdentityContext)
}
