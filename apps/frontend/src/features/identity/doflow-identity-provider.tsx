"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api"
import { clearDoFlowUser } from "@/lib/jwt"
import { teamApi, type TeamMember } from "@/lib/tenant-team-api"
import {
  capabilitiesForRoles,
  doflowRoles,
  type DoflowCapability,
  type DoflowRole,
} from "@/features/identity/permissions"

export type LeadOpenMode = "quick" | "full"
export type ClientOpenMode = "quick" | "full"
export type ListPreferences = { sort: string; group: string }

export type DoflowIdentityUser = {
  id: string
  name: string
  email: string
  roles: DoflowRole[]
  capabilities?: DoflowCapability[]
  avatarUrl?: string
  avatarUpdatedAt?: string
  avatarUpdatedBy?: string
  weeklyCapacityHours?: number
  teamMemberId?: string
}

type IdentityPreferences = {
  leadOpenMode: LeadOpenMode
  clientOpenMode: ClientOpenMode
  leadList: ListPreferences
  clientList: ListPreferences
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
  assignments?: Array<{
    userId: string
    roles: DoflowRole[]
    capabilities: DoflowCapability[]
  }>
}

type IdentityContextValue = {
  users: DoflowIdentityUser[]
  currentUser: DoflowIdentityUser
  currentUserId: string
  capabilities: ReadonlySet<DoflowCapability>
  hasCapability: (capability: DoflowCapability) => boolean
  updateUserRoles: (userId: string, roles: DoflowRole[]) => void
  updateUserCapabilities: (userId: string, capabilities: DoflowCapability[]) => void
  updateUserAvatar: (userId: string, avatarUrl?: string) => boolean
  updateUserWeeklyCapacity: (userId: string, hours: number) => boolean
  leadOpenMode: LeadOpenMode
  setLeadOpenMode: (mode: LeadOpenMode) => void
  clientOpenMode: ClientOpenMode
  setClientOpenMode: (mode: ClientOpenMode) => void
  leadListPreferences: ListPreferences
  setLeadListPreferences: (preferences: ListPreferences) => void
  clientListPreferences: ListPreferences
  setClientListPreferences: (preferences: ListPreferences) => void
  hasHydrated: boolean
  isAuthenticated: boolean
  signOut: () => void
}

const defaultPreferences: IdentityPreferences = {
  leadOpenMode: "quick",
  clientOpenMode: "quick",
  leadList: { sort: "updated-desc", group: "none" },
  clientList: { sort: "updated-desc", group: "none" },
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
    },
  }
}

export function DoflowIdentityProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<DoflowIdentityUser[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [authenticatedUserId, setAuthenticatedUserId] = useState("")
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [serverCapabilities, setServerCapabilities] = useState<DoflowCapability[]>([])
  const [hasHydrated, setHasHydrated] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      apiFetch<AuthMe>("/auth/me"),
      teamApi.members({ limit: 200 }),
      apiFetch<IdentityBootstrap>("/tenant/doflow/identity").catch(
        (): IdentityBootstrap => ({ preferences: defaultPreferences, capabilities: [] }),
      ),
    ])
      .then(([auth, members, bootstrap]) => {
        if (cancelled) return
        const tenant = String(auth.user.tenantSlug || auth.user.tenantId || "").toLowerCase()
        const stage = String(auth.user.authStage || "FULL").toUpperCase()
        if (tenant !== "doflow" || stage !== "FULL") throw new Error("Sessione Doflow non valida")

        const mapped = members.items.map((member) => {
          const mappedUser = toIdentityUser(
            member,
            String(member.user_id || member.id) === String(auth.user.id)
              ? auth.user.role
              : String(member.tenant_role || ""),
          )
          const assignment = bootstrap.assignments?.find(
            (candidate) => candidate.userId === mappedUser.id,
          )
          return assignment
            ? { ...mappedUser, roles: assignment.roles, capabilities: assignment.capabilities }
            : mappedUser
        })
        const current =
          mapped.find((candidate) => candidate.id === String(auth.user.id)) ||
          ({
            id: String(auth.user.id),
            name: auth.user.email.split("@")[0] || auth.user.email,
            email: auth.user.email,
            roles: rolesForAccount(auth.user.role),
            weeklyCapacityHours: 40,
          } satisfies DoflowIdentityUser)

        setUsers(mapped.some((candidate) => candidate.id === current.id) ? mapped : [current, ...mapped])
        setCurrentUserId(current.id)
        setAuthenticatedUserId(current.id)
        setPreferences(normalizePreferences(bootstrap.preferences))
        setServerCapabilities(
          (bootstrap.capabilities || []).filter((capability) =>
            capabilitiesForRoles(["administrator"]).has(capability),
          ),
        )
        setIsAuthenticated(true)
      })
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

    return () => {
      cancelled = true
    }
  }, [])

  const currentUser =
    users.find((candidate) => candidate.id === currentUserId) ||
    users.find((candidate) => candidate.id === authenticatedUserId) ||
    anonymousUser
  const capabilitySet = useMemo(
    () => new Set(serverCapabilities),
    [serverCapabilities],
  )

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
      hasCapability: (capability) => capabilitySet.has(capability),
      updateUserRoles: (userId, roles) => {
        if (!capabilitySet.has("canManageRoles")) return
        const normalized = Array.from(new Set(roles.filter((role) => doflowRoles.includes(role))))
        const previous = users.find((user) => user.id === userId)?.roles || []
        setUsers((current) =>
          current.map((user) => (user.id === userId ? { ...user, roles: normalized } : user)),
        )
        void apiFetch(`/tenant/doflow/identity/users/${encodeURIComponent(userId)}/roles`, {
          method: "PATCH",
          body: JSON.stringify({ roles: normalized }),
        }).catch(() => {
          setUsers((current) =>
            current.map((user) => (user.id === userId ? { ...user, roles: previous } : user)),
          )
          toast.error("Impossibile aggiornare i ruoli")
        })
      },
      updateUserCapabilities: (userId, nextCapabilities) => {
        if (!capabilitySet.has("canManageRoles")) return
        const normalized = Array.from(
          new Set(
            nextCapabilities.filter((capability) =>
              capabilitiesForRoles(["administrator"]).has(capability),
            ),
          ),
        )
        const previous = users.find((user) => user.id === userId)?.capabilities || []
        setUsers((current) =>
          current.map((user) =>
            user.id === userId ? { ...user, capabilities: normalized } : user,
          ),
        )
        void apiFetch(
          `/tenant/doflow/identity/users/${encodeURIComponent(userId)}/capabilities`,
          {
            method: "PATCH",
            body: JSON.stringify({ capabilities: normalized }),
          },
        ).catch(() => {
          setUsers((current) =>
            current.map((user) =>
              user.id === userId ? { ...user, capabilities: previous } : user,
            ),
          )
          toast.error("Impossibile aggiornare le capability")
        })
      },
      updateUserAvatar: () => false,
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
      leadOpenMode: preferences.leadOpenMode,
      setLeadOpenMode: (mode) => persistPreferences({ leadOpenMode: mode }),
      clientOpenMode: preferences.clientOpenMode,
      setClientOpenMode: (mode) => persistPreferences({ clientOpenMode: mode }),
      leadListPreferences: preferences.leadList,
      setLeadListPreferences: (leadList) => persistPreferences({ leadList }),
      clientListPreferences: preferences.clientList,
      setClientListPreferences: (clientList) => persistPreferences({ clientList }),
      hasHydrated,
      isAuthenticated,
      signOut: () => {
        void apiFetch("/auth/logout", { method: "POST" }).finally(() => {
          clearDoFlowUser()
          window.open("/login", "_self")
        })
      },
    }),
    [
      authenticatedUserId,
      capabilitySet,
      currentUser,
      hasHydrated,
      isAuthenticated,
      preferences,
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
