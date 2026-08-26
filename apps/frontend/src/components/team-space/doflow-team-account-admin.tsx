"use client"

import * as React from "react"
import {
  Activity,
  BriefcaseBusiness,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  MODULE_PERMISSION_FLAGS,
  NEVER_OVERRIDE_FOR_NON_ADMIN,
  buildModulePermissionPatch,
  createModulePermissionDraftState,
  isModulePermissionEditable,
  modulePermissionSource,
  resolvedModulePermission,
  updateModulePermissionDraft,
  type ModulePermissionDraftState,
} from "@/components/team-space/module-permission-policy"
import {
  buildInviteConfiguration,
  updateInviteCapability,
  updateInviteRole,
} from "@/components/team-space/team-invite-policy"
import { loadAllTeamMembers } from "@/components/team-space/team-member-pagination"
import {
  useDoflowIdentity,
  type DoflowIdentityUser,
} from "@/features/identity/doflow-identity-provider"
import {
  capabilitiesForRoles,
  doflowCapabilities,
  doflowRoles,
  roleLabels,
  type DoflowCapability,
  type DoflowRole,
} from "@/features/identity/permissions"
import {
  teamApi,
  type TeamActivity,
  type TeamMember,
  type TeamOptions,
  type TeamSkill,
  type TeamWorkloadItem,
} from "@/lib/tenant-team-api"

type MemberDraft = {
  tenantRole: string
  operationalRole: string
  capacityHours: string
  availabilityStatus: string
  roles: DoflowRole[]
  capabilities: DoflowCapability[]
}

type InviteDraft = {
  email: string
  displayName: string
  tenantRole: string
  operationalRole: string
  capacityHours: string
  sendInvite: boolean
  roles: DoflowRole[]
  capabilities: DoflowCapability[]
  skillIds: string[]
}

const DEFAULT_INVITE: InviteDraft = {
  email: "",
  displayName: "",
  tenantRole: "user",
  operationalRole: "generic",
  capacityHours: "40",
  sendInvite: true,
  roles: [],
  capabilities: [],
  skillIds: [],
}

const TECHNICAL_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  editor: "Editor",
  user: "Utente",
  viewer: "Viewer",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Attivo",
  invited: "Invito in attesa",
  inactive: "Inattivo",
  suspended: "Sospeso",
  archived: "Archiviato",
}

const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Disponibile",
  busy: "Occupato",
  unavailable: "Non disponibile",
  vacation: "Ferie",
  sick: "Malattia",
  external_limited: "Esterno limitato",
  remote: "Remoto",
  reduced_hours: "Orario ridotto",
  focus_time: "Focus time",
}

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace("super_admin", "superadmin")
}

function label(labels: Record<string, string>, value?: string | null) {
  const key = normalize(value)
  return labels[key] || value || "Non disponibile"
}

function capabilityLabel(capability: DoflowCapability) {
  return capability
    .replace(/^can/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function formatDate(value?: string | null) {
  if (!value) return "Non disponibile"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Non disponibile"
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function identityForMember(users: DoflowIdentityUser[], member?: TeamMember | null) {
  if (!member) return undefined
  return users.find(
    (user) =>
      user.id === String(member.user_id || "") ||
      user.teamMemberId === member.id,
  )
}

function draftFor(member: TeamMember, identity?: DoflowIdentityUser): MemberDraft {
  return {
    tenantRole: normalize(member.tenant_role) || "user",
    operationalRole: String(member.operational_role || "generic"),
    capacityHours: String(member.capacity_hours_per_week || 40),
    availabilityStatus: String(member.availability_status || "available"),
    roles: identity?.roles || [],
    capabilities: identity?.explicitCapabilities || [],
  }
}

export function DoflowTeamAccountAdmin() {
  const identity = useDoflowIdentity()
  const currentTenantRole = normalize(identity.currentUser.tenantRole)
  const canAdminister = identity.hasCapability("canManageRoles") && ["owner", "admin"].includes(currentTenantRole)
  const [members, setMembers] = React.useState<TeamMember[]>([])
  const [options, setOptions] = React.useState<TeamOptions | null>(null)
  const [selectedWorkload, setSelectedWorkload] = React.useState<TeamWorkloadItem | null>(null)
  const [skills, setSkills] = React.useState<TeamSkill[]>([])
  const [activity, setActivity] = React.useState<TeamActivity[]>([])
  const [modulePermissionState, setModulePermissionState] = React.useState<ModulePermissionDraftState>(
    () => createModulePermissionDraftState(),
  )
  const [modulePermissionsReady, setModulePermissionsReady] = React.useState(false)
  const [modulePermissionError, setModulePermissionError] = React.useState<string | null>(null)
  const [modulePermissionReloadKey, setModulePermissionReloadKey] = React.useState(0)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<MemberDraft | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [skillId, setSkillId] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteDraft, setInviteDraft] = React.useState<InviteDraft>(DEFAULT_INVITE)
  const [inviteModulePermissionState, setInviteModulePermissionState] = React.useState<ModulePermissionDraftState>(
    () => createModulePermissionDraftState(),
  )

  const load = React.useCallback(async (preferredMemberId?: string | null) => {
    if (!canAdminister) {
      setLoading(false)
      return false
    }
    setLoading(true)
    setError(null)
    try {
      const [memberData, optionData, skillData] = await Promise.all([
        loadAllTeamMembers((params) => teamApi.members(params)),
        teamApi.options(),
        teamApi.skills({ limit: 500 }).catch(() => ({ items: [] })),
      ])
      const nextMembers = memberData
      setMembers(nextMembers)
      setOptions(optionData)
      setSkills(skillData.items || [])
      setSelectedId((current) =>
        (preferredMemberId || current) && nextMembers.some((member) => member.id === (preferredMemberId || current))
          ? preferredMemberId || current
          : nextMembers[0]?.id || null,
      )
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile caricare Team e account.")
      return false
    } finally {
      setLoading(false)
    }
  }, [canAdminister])

  const reloadTeamAndIdentity = React.useCallback(async (preferredMemberId?: string | null) => {
    const [teamLoaded, identityLoaded] = await Promise.all([
      load(preferredMemberId),
      identity.reloadIdentity(),
    ])
    return teamLoaded && identityLoaded
  }, [identity, load])

  React.useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
    }
  }, [load])

  const selected = members.find((member) => member.id === selectedId) || null
  const selectedIdentity = identityForMember(identity.users, selected)
  const protectedOwner = normalize(selected?.tenant_role) === "owner"
  const selectedHasCeoLabel = normalize(selected?.operational_role) === "ceo_label"
  const identityWritable = Boolean(
    selectedIdentity && selected?.user_id && normalize(selected.status) === "active",
  )
  React.useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      if (!selected) {
        setDraft(null)
        setModulePermissionState(createModulePermissionDraftState())
        setModulePermissionsReady(false)
        setModulePermissionError(null)
        setActivity([])
        setSelectedWorkload(null)
        return
      }
      setDraft(draftFor(selected, identityForMember(identity.users, selected)))
      setModulePermissionState(createModulePermissionDraftState())
      setModulePermissionsReady(false)
      setModulePermissionError(null)
      setActivity([])
      setSelectedWorkload(null)
      void teamApi.permissions(selected.id)
        .then((permissionData) => {
          if (!active) return
          setModulePermissionState(createModulePermissionDraftState(permissionData.items || []))
          setModulePermissionsReady(true)
        })
        .catch((reason) => {
          if (!active) return
          setModulePermissionError(
            reason instanceof Error
              ? reason.message
              : "Impossibile verificare gli override modulo.",
          )
        })
      void teamApi.memberActivity(selected.id)
        .then((activityData) => {
          if (active) setActivity(activityData.items || [])
        })
        .catch(() => {
          if (active) setActivity([])
        })
      void teamApi.memberWorkload(selected.id)
        .then((workloadItem) => {
          if (active) setSelectedWorkload(workloadItem)
        })
        .catch(() => {
          if (active) setSelectedWorkload(null)
        })
    })
    return () => {
      active = false
    }
  }, [identity.users, modulePermissionReloadKey, selected])

  const visibleMembers = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase("it-IT")
    return members.filter((member) => {
      const text = `${member.display_name} ${member.email} ${member.job_title || ""} ${member.tenant_role || ""} ${member.operational_role || ""}`.toLocaleLowerCase("it-IT")
      return (!query || text.includes(query)) && (statusFilter === "all" || normalize(member.status) === statusFilter)
    })
  }, [members, search, statusFilter])

  const canAssignAdmin = ["owner", "superadmin"].includes(currentTenantRole)
  const technicalRoles = (options?.tenantRoles || ["admin", "manager", "editor", "user", "viewer"])
    .map(normalize)
    .filter((role, index, values) =>
      Boolean(role) &&
      !["owner", "superadmin", "ceo"].includes(role) &&
      (role !== "admin" || canAssignAdmin) &&
      values.indexOf(role) === index,
    )
  const operationalRoles = options?.operationalRoles || ["project_manager", "sales", "designer", "developer", "seo_specialist", "copywriter", "administration", "external_collaborator", "generic"]
  const availabilityStatuses = options?.availabilityStatuses || ["available", "busy", "unavailable", "vacation", "sick"]
  const inheritedCapabilities = capabilitiesForRoles(draft?.roles || [])
  const inviteInheritedCapabilities = capabilitiesForRoles(inviteDraft.roles)
  const saveMember = async () => {
    if (!selected || !draft || protectedOwner || !canAdminister) return
    const capacity = Number(draft.capacityHours)
    const modulePermissionPatch = modulePermissionsReady
      ? buildModulePermissionPatch(modulePermissionState, draft.tenantRole)
      : []
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 168) {
      setError("La capacità settimanale deve essere compresa tra 1 e 168 ore.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await teamApi.updateMember(selected.id, {
        tenant_role: draft.tenantRole,
        operational_role: draft.operationalRole,
        capacity_hours_per_week: capacity,
        availability_status: draft.availabilityStatus,
      })
      if (identityWritable && selectedIdentity) {
        const [rolesSaved, capabilitiesSaved] = await Promise.all([
          identity.updateUserRoles(selectedIdentity.id, draft.roles),
          identity.updateUserCapabilities(selectedIdentity.id, draft.capabilities),
        ])
        if (!rolesSaved || !capabilitiesSaved) throw new Error("Ruoli o capability non sono stati confermati dal server.")
      }
      if (modulePermissionPatch.length > 0) {
        await teamApi.updatePermissions(selected.id, modulePermissionPatch)
      }
      if (!(await reloadTeamAndIdentity())) {
        throw new Error("Modifiche salvate, ma il riallineamento di Team e identity non è riuscito.")
      }
      const identityResult = identityWritable
        ? "profilo, ruoli e capability salvati"
        : "profilo salvato; identity invariata finché l’account non è attivo"
      const moduleResult = !modulePermissionsReady
        ? "override modulo non modificati perché non verificati"
        : modulePermissionPatch.length > 0
          ? "override modulo salvati"
          : "permessi modulo ereditati invariati"
      toast.success(`${identityResult}; ${moduleResult}`)
    } catch (reason) {
      const reconciled = await reloadTeamAndIdentity()
      const message = reason instanceof Error ? reason.message : "Aggiornamento non riuscito."
      setError(
        reconciled
          ? message
          : `${message} Non è stato possibile riallineare lo stato mostrato con il server.`,
      )
    } finally {
      setBusy(false)
    }
  }

  const resendInvite = async () => {
    if (!selected || selected.user_id || protectedOwner || !canAdminister) return
    setBusy(true)
    setError(null)
    try {
      const result = await teamApi.inviteMember(selected.id)
      if (!(await reloadTeamAndIdentity(selected.id))) throw new Error("Invito generato, ma Team e identity non sono stati riallineati.")
      toast.success(result.email_sent ? "Invito inviato" : "Invito rigenerato; invio email non confermato")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invito non generato.")
    } finally {
      setBusy(false)
    }
  }

  const createMember = async () => {
    const capacity = Number(inviteDraft.capacityHours)
    if (!inviteDraft.email.trim() || !inviteDraft.displayName.trim()) return
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 168) {
      setError("La capacità settimanale deve essere compresa tra 1 e 168 ore.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const inviteConfiguration = buildInviteConfiguration({
        tenantRole: inviteDraft.tenantRole,
        identity: inviteDraft,
        modulePermissionState: inviteModulePermissionState,
        skillIds: inviteDraft.skillIds,
      })
      const result = await teamApi.createMember({
        email: inviteDraft.email.trim(),
        display_name: inviteDraft.displayName.trim(),
        tenant_role: inviteDraft.tenantRole,
        operational_role: inviteDraft.operationalRole,
        capacity_hours_per_week: capacity,
        status: inviteDraft.sendInvite ? "invited" : "active",
        send_invite: inviteDraft.sendInvite,
        ...inviteConfiguration,
      })
      if (!(await reloadTeamAndIdentity(result.member.id))) {
        throw new Error("Profilo creato, ma Team e identity non sono stati riallineati.")
      }
      setInviteOpen(false)
      setInviteDraft(DEFAULT_INVITE)
      setInviteModulePermissionState(createModulePermissionDraftState())
      toast.success(
        result.invite
          ? result.invite.email_sent
            ? "Membro creato e invito inviato"
            : "Membro creato; invio email non confermato"
          : "Profilo operativo creato",
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Creazione membro non riuscita.")
    } finally {
      setBusy(false)
    }
  }

  const addSkill = async () => {
    if (!selected || !skillId || protectedOwner || !canAdminister) return
    setBusy(true)
    try {
      await teamApi.addMemberSkill(selected.id, { skill_id: skillId })
      setSkillId("")
      if (!(await load(selected.id))) throw new Error("Competenza assegnata, ma il profilo non è stato ricaricato.")
      toast.success("Competenza assegnata")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Competenza non assegnata.")
    } finally {
      setBusy(false)
    }
  }

  const removeSkill = async (memberSkillId: string) => {
    if (!selected || protectedOwner || !canAdminister) return
    setBusy(true)
    try {
      await teamApi.removeMemberSkill(selected.id, memberSkillId)
      if (!(await load(selected.id))) throw new Error("Competenza rimossa, ma il profilo non è stato ricaricato.")
      toast.success("Competenza rimossa")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Competenza non rimossa.")
    } finally {
      setBusy(false)
    }
  }

  const changeAccountStatus = async (status: "active" | "suspended") => {
    if (!selected || protectedOwner || !canAdminister) return
    setBusy(true)
    setError(null)
    try {
      const hadActiveAccount = Boolean(selected.user_id)
      await teamApi.updateMember(selected.id, { status })
      if (!(await reloadTeamAndIdentity())) {
        throw new Error("Stato aggiornato, ma il riallineamento di Team e identity non è riuscito.")
      }
      toast.success(
        hadActiveAccount
          ? status === "active"
            ? "Account riattivato"
            : "Account sospeso e sessioni revocate"
          : status === "active"
            ? "Profilo Team riattivato; l’account resta in attesa di attivazione"
            : "Profilo Team sospeso; nessun account attivo da revocare",
      )
    } catch (reason) {
      await reloadTeamAndIdentity()
      setError(reason instanceof Error ? reason.message : "Stato account non aggiornato.")
    } finally {
      setBusy(false)
    }
  }

  const removeMembership = async () => {
    if (!selected || protectedOwner || !canAdminister) return
    setBusy(true)
    setError(null)
    try {
      await teamApi.deleteMember(selected.id)
      setSelectedId(null)
      if (!(await reloadTeamAndIdentity())) {
        throw new Error("Membership rimossa, ma il riallineamento di Team e identity non è riuscito.")
      }
      toast.success(
        selected.user_id
          ? "Membership tenant rimossa e sessioni revocate"
          : "Profilo Team e invito pendente rimossi dal tenant",
      )
    } catch (reason) {
      await reloadTeamAndIdentity()
      setError(reason instanceof Error ? reason.message : "Membership non rimossa.")
    } finally {
      setBusy(false)
    }
  }

  if (!canAdminister) return null

  return (
    <section className="space-y-4" data-team-account-admin="server">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="text-xl font-semibold tracking-tight">Team e account</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Amministrazione tenant basata su membri, inviti, ruoli e permessi reali.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void reloadTeamAndIdentity()} disabled={loading || busy}>
            <RefreshCw className="size-4" />Aggiorna
          </Button>
          <Button type="button" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />Invita membro
          </Button>
        </div>
      </div>

      {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UsersRound} label="Membri tenant" value={members.length} />
        <Metric icon={Send} label="Inviti in attesa" value={members.filter((member) => !member.user_id && normalize(member.status) === "invited").length} />
        <Metric icon={BriefcaseBusiness} label="Disponibili" value={members.filter((member) => normalize(member.availability_status) === "available").length} />
        <Metric icon={Clock3} label="Ore pianificate" value={Math.round(members.reduce((total, member) => total + Number(member.capacity_hours_per_week || 0), 0))} suffix="h" />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(240px,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 rounded-lg bg-background pl-9 text-sm font-normal shadow-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca nome, email o ruolo…" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filtra per stato"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Account e membri</CardTitle>
            <CardDescription>{visibleMembers.length} risultati nel tenant corrente</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <LoadingLabel /> : (
              <ScrollArea className="h-[620px] px-3 pb-3">
                <div className="space-y-1">
                  {visibleMembers.map((member) => {
                    const isOwner = normalize(member.tenant_role) === "owner"
                    const hasCeoLabel = normalize(member.operational_role) === "ceo_label"
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedId(member.id)}
                        data-active={member.id === selectedId}
                        className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition-colors hover:bg-accent/60 data-[active=true]:border-primary/20 data-[active=true]:bg-accent"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{member.display_name.slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{member.display_name}</span>
                            {isOwner ? <Badge variant="outline" className="shrink-0 text-[10px]">Owner</Badge> : null}
                            {hasCeoLabel ? <Badge variant="secondary" className="shrink-0 text-[10px]">CEO</Badge> : null}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px]">{label(TECHNICAL_ROLE_LABELS, member.tenant_role)}</Badge>
                            <Badge variant="outline" className="text-[10px]">{label(STATUS_LABELS, member.status)}</Badge>
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  {!visibleMembers.length ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nessun membro corrisponde ai filtri.</p> : null}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {selected && draft ? (
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {selected.display_name}
                      {protectedOwner ? <Badge variant="outline">Owner</Badge> : null}
                      {selectedHasCeoLabel ? <Badge variant="secondary">CEO</Badge> : null}
                      {protectedOwner ? <Badge className="gap-1"><ShieldCheck className="size-3" />Account protetto</Badge> : null}
                    </CardTitle>
                    <CardDescription>{selected.email} · creato {formatDate(selected.created_at)}</CardDescription>
                  </div>
                  {!protectedOwner ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {!selected.user_id ? <Button type="button" variant="outline" onClick={() => void resendInvite()} disabled={busy}><Send className="size-4" />Reinvia invito</Button> : null}
                      {["suspended", "inactive"].includes(normalize(selected.status)) ? (
                        <Button type="button" variant="outline" onClick={() => void changeAccountStatus("active")} disabled={busy}><UserRoundCheck className="size-4" />Riattiva</Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button type="button" variant="outline" disabled={busy}><UserRoundX className="size-4" />Sospendi</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Sospendere {selected.display_name}?</AlertDialogTitle>
                              <AlertDialogDescription>L’account del tenant Doflow verrà disattivato e le sessioni correnti revocate. L’identità globale non viene eliminata.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void changeAccountStatus("suspended")}>Sospendi account</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={busy}><Trash2 className="size-4" />Rimuovi</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Rimuovere la membership Doflow?</AlertDialogTitle>
                            <AlertDialogDescription>Il profilo Team sarà archiviato; ruolo, capability, permessi modulo, inviti e sessioni di questo tenant verranno revocati. L’identità globale e gli altri tenant restano invariati.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void removeMembership()}>Rimuovi dal tenant</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : null}
                </div>
                {protectedOwner ? <div className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-foreground">L’ownership tecnica è protetta: ruolo, profilo, capability e permessi non sono modificabili da questa console ordinaria.{selectedHasCeoLabel ? " Anche la label operativa CEO resta invariata." : ""}</div> : null}
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field labelText="Ruolo tenant tecnico">
                    <Select value={draft.tenantRole} onValueChange={(tenantRole) => setDraft((current) => current ? { ...current, tenantRole } : current)} disabled={protectedOwner || busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {protectedOwner ? <SelectItem value="owner">Owner</SelectItem> : null}
                        {technicalRoles.map((role) => <SelectItem key={role} value={role}>{label(TECHNICAL_ROLE_LABELS, role)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field labelText="Ruolo operativo">
                    <Select value={draft.operationalRole} onValueChange={(operationalRole) => setDraft((current) => current ? { ...current, operationalRole } : current)} disabled={protectedOwner || busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{operationalRoles.map((role) => <SelectItem key={role} value={role}>{role.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field labelText="Capacità settimanale">
                    <Input type="number" min={1} max={168} step={0.5} value={draft.capacityHours} onChange={(event) => setDraft((current) => current ? { ...current, capacityHours: event.target.value } : current)} disabled={protectedOwner || busy} className="h-9 rounded-lg bg-background text-sm font-normal shadow-none" />
                  </Field>
                  <Field labelText="Disponibilità">
                    <Select value={draft.availabilityStatus} onValueChange={(availabilityStatus) => setDraft((current) => current ? { ...current, availabilityStatus } : current)} disabled={protectedOwner || busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{availabilityStatuses.map((value) => <SelectItem key={value} value={value}>{label(AVAILABILITY_LABELS, value)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field labelText="Stato account">
                    <div className="flex h-9 items-center rounded-lg border bg-muted/30 px-3 text-sm">{label(STATUS_LABELS, selected.status)}</div>
                  </Field>
                </div>

                <Separator />

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">Ruoli Doflow</h3>
                      <p className="text-xs text-muted-foreground">Ruoli operativi gestiti dall’identity tenant.</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {doflowRoles.map((role) => (
                        <label key={role} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                          <Checkbox checked={draft.roles.includes(role)} disabled={protectedOwner || busy || !identityWritable} onCheckedChange={(checked) => setDraft((current) => current ? { ...current, roles: checked ? Array.from(new Set([...current.roles, role])) : current.roles.filter((candidate) => candidate !== role) } : current)} />
                          {roleLabels[role]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">Capability aggiuntive</h3>
                      <p className="text-xs text-muted-foreground">Disponibili solo per account già attivati.</p>
                    </div>
                    <ScrollArea className="h-48 rounded-lg border p-2">
                      <div className="grid gap-1 pr-3 sm:grid-cols-2">
                        {doflowCapabilities.map((capability) => {
                          const inherited = inheritedCapabilities.has(capability)
                          const explicitlyGranted = draft.capabilities.includes(capability)
                          return (
                            <label key={capability} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50">
                              <Checkbox checked={inherited || explicitlyGranted} disabled={protectedOwner || busy || !identityWritable || inherited} onCheckedChange={(checked) => setDraft((current) => current ? { ...current, capabilities: checked ? Array.from(new Set([...current.capabilities, capability])) : current.capabilities.filter((candidate) => candidate !== capability) } : current)} />
                              <span className="min-w-0 flex-1 truncate" title={capability}>{capabilityLabel(capability)}</span>
                              {inherited ? <Badge variant="outline" className="shrink-0 text-[10px]">Ereditata</Badge> : null}
                            </label>
                          )
                        })}
                      </div>
                    </ScrollArea>
                    {draft.roles.includes("administrator") ? <p className="text-xs text-muted-foreground">Il ruolo Amministratore eredita tutte le capability.</p> : null}
                    {!identityWritable && !protectedOwner ? <p className="text-xs text-muted-foreground">Le assegnazioni identity non sono mostrate né modificabili finché l’account non è attivo; completa l’invito o riattiva l’account.</p> : null}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Permessi modulo</h3>
                    <p className="text-xs text-muted-foreground">Gli amministratori tecnici ereditano l’accesso completo; gli override si applicano agli altri ruoli.</p>
                  </div>
                  {modulePermissionError ? (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-foreground">
                      <span>Override non verificati: editor bloccato e nessun permesso modulo verrà inviato. {modulePermissionError}</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => setModulePermissionReloadKey((current) => current + 1)} disabled={busy}>Riprova</Button>
                    </div>
                  ) : null}
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr><th className="px-3 py-2 text-left font-medium">Modulo</th>{MODULE_PERMISSION_FLAGS.map((key) => <th key={key} className="px-2 py-2 text-center font-medium">{key.replace("can_", "")}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y">
                        {(options?.moduleKeys || []).map((moduleKey) => {
                          const permission = resolvedModulePermission(
                            modulePermissionState,
                            draft.tenantRole,
                            moduleKey,
                          )
                          const source = modulePermissionSource(
                            modulePermissionState,
                            draft.tenantRole,
                            moduleKey,
                          )
                          const sourceLabel = !modulePermissionsReady
                            ? "Non verificato"
                            : source === "explicit"
                              ? "Override esplicito"
                              : source === "modified"
                                ? "Modificato"
                                : source === "immutable"
                                  ? "Immutabile"
                                  : "Ereditato"
                          return (
                            <tr key={moduleKey}>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{moduleKey}</span>
                                  <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>
                                </div>
                                {source === "immutable" && NEVER_OVERRIDE_FOR_NON_ADMIN.has(moduleKey) ? (
                                  <p className="mt-1 max-w-72 text-[10px] leading-snug text-muted-foreground">
                                    Grant positivi riservati ai ruoli amministrativi; gli override non vengono inviati.
                                  </p>
                                ) : null}
                              </td>
                              {MODULE_PERMISSION_FLAGS.map((key) => {
                                const editable = !protectedOwner
                                  && !busy
                                  && modulePermissionsReady
                                  && isModulePermissionEditable(draft.tenantRole, moduleKey, key)
                                return (
                                  <td key={key} className="px-2 py-2 text-center">
                                    <Checkbox
                                      checked={permission[key]}
                                      disabled={!editable}
                                      aria-label={`${moduleKey}: ${key} (${sourceLabel})`}
                                      title={editable ? undefined : modulePermissionsReady ? `${sourceLabel}: valore definito dal ruolo o dal backend` : "Override non verificati: ricarica prima di modificare"}
                                      onCheckedChange={(checked) => setModulePermissionState((current) =>
                                        updateModulePermissionDraft(
                                          current,
                                          draft.tenantRole,
                                          moduleKey,
                                          key,
                                          Boolean(checked),
                                        ))}
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Competenze</h3>
                    <p className="text-xs text-muted-foreground">Catalogo skill e assegnazioni gestiti dal servizio Team.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={skillId || "none"} onValueChange={(value) => setSkillId(value === "none" ? "" : value)} disabled={protectedOwner || busy}>
                      <SelectTrigger className="sm:max-w-sm"><SelectValue placeholder="Seleziona competenza" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Seleziona competenza</SelectItem>{skills.map((skill) => <SelectItem key={skill.id} value={skill.id}>{skill.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={() => void addSkill()} disabled={!skillId || protectedOwner || busy}>Assegna</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selected.skill_items || []).map((skill) => (
                      <Badge key={skill.id} variant="secondary" className="gap-1.5">
                        {skill.name}
                        {!protectedOwner ? <button type="button" onClick={() => void removeSkill(skill.id)} className="rounded px-1 hover:bg-background" aria-label={`Rimuovi ${skill.name}`}>×</button> : null}
                      </Badge>
                    ))}
                    {!selected.skill_items?.length ? <span className="text-sm text-muted-foreground">Nessuna competenza assegnata.</span> : null}
                  </div>
                </div>

                {!protectedOwner ? <div className="flex justify-end"><Button type="button" onClick={() => void saveMember()} disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : null}Salva modifiche</Button></div> : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BriefcaseBusiness className="size-4" />Workload essenziale</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <Info labelText="Task aperti" value={String(selectedWorkload?.openTasks || 0)} />
                  <Info labelText="Scaduti" value={String(selectedWorkload?.overdueTasks || 0)} />
                  <Info labelText="Progetti attivi" value={String(selectedWorkload?.activeProjects || 0)} />
                  <Info labelText="Utilizzo" value={`${selectedWorkload?.utilizationPercent || 0}%`} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" />Attività recente</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {activity.slice(0, 5).map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg border p-2.5 text-sm"><span className="min-w-0 truncate">{entry.action.replaceAll("_", " ")}</span><span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.created_at)}</span></div>)}
                  {!activity.length ? <p className="text-sm text-muted-foreground">Nessuna attività recente disponibile.</p> : null}
                </CardContent>
              </Card>
            </div>

            <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Le azioni account operano soltanto sul tenant Doflow: l’identità globale e le eventuali membership in altri tenant vengono preservate.
            </div>
          </div>
        ) : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Seleziona un membro per vedere i dettagli.</CardContent></Card>}
      </div>

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!open && busy) return
          setInviteOpen(open)
          if (!open) {
            setInviteDraft(DEFAULT_INVITE)
            setInviteModulePermissionState(createModulePermissionDraftState())
          }
        }}
      >
        <DialogContent className="max-h-[92vh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invita membro</DialogTitle>
            <DialogDescription>Prepara account, accessi e competenze prima dell’invito. Owner, Superadmin e label CEO non sono assegnabili.</DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field labelText="Email"><Input type="email" value={inviteDraft.email} onChange={(event) => setInviteDraft((current) => ({ ...current, email: event.target.value }))} className="h-9 rounded-lg bg-background text-sm font-normal shadow-none" /></Field>
            <Field labelText="Nome visualizzato"><Input value={inviteDraft.displayName} onChange={(event) => setInviteDraft((current) => ({ ...current, displayName: event.target.value }))} className="h-9 rounded-lg bg-background text-sm font-normal shadow-none" /></Field>
            <Field labelText="Ruolo tenant tecnico"><Select value={inviteDraft.tenantRole} onValueChange={(tenantRole) => setInviteDraft((current) => ({ ...current, tenantRole }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{technicalRoles.map((role) => <SelectItem key={role} value={role}>{label(TECHNICAL_ROLE_LABELS, role)}</SelectItem>)}</SelectContent></Select></Field>
            <Field labelText="Ruolo operativo"><Select value={inviteDraft.operationalRole} onValueChange={(operationalRole) => setInviteDraft((current) => ({ ...current, operationalRole }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operationalRoles.map((role) => <SelectItem key={role} value={role}>{role.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field>
            <Field labelText="Capacità settimanale"><Input type="number" min={1} max={168} value={inviteDraft.capacityHours} onChange={(event) => setInviteDraft((current) => ({ ...current, capacityHours: event.target.value }))} className="h-9 rounded-lg bg-background text-sm font-normal shadow-none" /></Field>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:mt-6">
              <div><Label htmlFor="send-team-invite">Invia invito</Label><p className="text-xs text-muted-foreground">Password e MFA restano nel flusso auth.</p></div>
              <Switch id="send-team-invite" checked={inviteDraft.sendInvite} onCheckedChange={(sendInvite) => setInviteDraft((current) => ({ ...current, sendInvite }))} />
            </div>
          </div>

          <Separator />

          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Ruoli Doflow</h3>
                <p className="text-xs text-muted-foreground">Vengono applicati atomicamente quando l’invito viene accettato.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {doflowRoles.map((role) => (
                  <label key={role} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                    <Checkbox
                      checked={inviteDraft.roles.includes(role)}
                      disabled={busy}
                      onCheckedChange={(checked) => setInviteDraft((current) => ({
                        ...current,
                        ...updateInviteRole(current, role, Boolean(checked)),
                      }))}
                    />
                    {roleLabels[role]}
                  </label>
                ))}
              </div>
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Capability esplicite</h3>
                <p className="text-xs text-muted-foreground">Le capability ereditate dai ruoli sono visibili ma non vengono duplicate come grant espliciti.</p>
              </div>
              <ScrollArea className="h-52 min-w-0 rounded-lg border p-2">
                <div className="grid gap-1 pr-3 sm:grid-cols-2">
                  {doflowCapabilities.map((capability) => {
                    const inherited = inviteInheritedCapabilities.has(capability)
                    const explicitlyGranted = inviteDraft.capabilities.includes(capability)
                    return (
                      <label key={capability} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50">
                        <Checkbox
                          checked={inherited || explicitlyGranted}
                          disabled={busy || inherited}
                          onCheckedChange={(checked) => setInviteDraft((current) => ({
                            ...current,
                            ...updateInviteCapability(current, capability, Boolean(checked)),
                          }))}
                        />
                        <span className="min-w-0 flex-1 truncate" title={capability}>{capabilityLabel(capability)}</span>
                        {inherited ? <Badge variant="outline" className="shrink-0 text-[10px]">Ereditata</Badge> : null}
                      </label>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <Separator />

          <div className="min-w-0 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Override permessi modulo</h3>
              <p className="text-xs text-muted-foreground">I moduli non modificati restano ereditati dal ruolo tenant. I grant riservati sono immutabili e non vengono inviati.</p>
            </div>
            <div className="max-h-64 w-full min-w-0 overflow-auto rounded-lg border">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left font-medium">Modulo</th>{MODULE_PERMISSION_FLAGS.map((key) => <th key={key} className="px-2 py-2 text-center font-medium">{key.replace("can_", "")}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {(options?.moduleKeys || []).map((moduleKey) => {
                    const permission = resolvedModulePermission(
                      inviteModulePermissionState,
                      inviteDraft.tenantRole,
                      moduleKey,
                    )
                    const source = modulePermissionSource(
                      inviteModulePermissionState,
                      inviteDraft.tenantRole,
                      moduleKey,
                    )
                    const sourceLabel = source === "modified"
                      ? "Override"
                      : source === "immutable"
                        ? "Immutabile"
                        : "Ereditato"
                    return (
                      <tr key={moduleKey}>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{moduleKey}</span>
                            <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>
                          </div>
                        </td>
                        {MODULE_PERMISSION_FLAGS.map((key) => {
                          const editable = !busy && isModulePermissionEditable(
                            inviteDraft.tenantRole,
                            moduleKey,
                            key,
                          )
                          return (
                            <td key={key} className="px-2 py-2 text-center">
                              <Checkbox
                                checked={permission[key]}
                                disabled={!editable}
                                aria-label={`Invito ${moduleKey}: ${key} (${sourceLabel})`}
                                onCheckedChange={(checked) => setInviteModulePermissionState((current) =>
                                  updateModulePermissionDraft(
                                    current,
                                    inviteDraft.tenantRole,
                                    moduleKey,
                                    key,
                                    Boolean(checked),
                                  ))}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          <div className="min-w-0 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Competenze iniziali</h3>
              <p className="text-xs text-muted-foreground">Le skill vengono collegate al profilo Team nella stessa transazione di creazione.</p>
            </div>
            <ScrollArea className="h-32 min-w-0 rounded-lg border p-2">
              <div className="grid gap-1 pr-3 sm:grid-cols-2 lg:grid-cols-3">
                {skills.map((skill) => (
                  <label key={skill.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50">
                    <Checkbox
                      checked={inviteDraft.skillIds.includes(skill.id)}
                      disabled={busy}
                      onCheckedChange={(checked) => setInviteDraft((current) => ({
                        ...current,
                        skillIds: checked
                          ? Array.from(new Set([...current.skillIds, skill.id]))
                          : current.skillIds.filter((candidate) => candidate !== skill.id),
                      }))}
                    />
                    <span className="truncate" title={skill.name}>{skill.name}</span>
                  </label>
                ))}
                {!skills.length ? <p className="px-2 py-1.5 text-xs text-muted-foreground">Nessuna competenza disponibile.</p> : null}
              </div>
            </ScrollArea>
          </div>

          <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Ruoli e capability restano in staging allowlisted fino all’accettazione; il token non contiene né mostra queste assegnazioni. Moduli, skill e capacità vengono salvati sul profilo pending.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setInviteOpen(false)
              setInviteDraft(DEFAULT_INVITE)
              setInviteModulePermissionState(createModulePermissionDraftState())
            }} disabled={busy}>Annulla</Button>
            <Button type="button" onClick={() => void createMember()} disabled={busy || !inviteDraft.email.trim() || !inviteDraft.displayName.trim()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}{inviteDraft.sendInvite ? "Crea e invita" : "Crea profilo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Metric({ icon: Icon, label: labelText, value, suffix = "" }: { icon: typeof UsersRound; label: string; value: number; suffix?: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span><span><span className="block text-xs text-muted-foreground">{labelText}</span><span className="text-xl font-semibold">{value}{suffix}</span></span></CardContent></Card>
}

function Field({ labelText, children }: { labelText: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{labelText}</Label>{children}</div>
}

function Info({ labelText, value }: { labelText: string; value: string }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{labelText}</p><p className="mt-1 font-semibold">{value}</p></div>
}

function LoadingLabel() {
  return <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Caricamento account…</div>
}
