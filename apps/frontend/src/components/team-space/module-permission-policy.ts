export const MODULE_PERMISSION_FLAGS = [
  "can_view",
  "can_create",
  "can_update",
  "can_delete",
  "can_manage",
] as const

export type ModulePermissionFlag = (typeof MODULE_PERMISSION_FLAGS)[number]

export type ModulePermissionValues = Record<ModulePermissionFlag, boolean>

export type ModulePermissionOverride = ModulePermissionValues & {
  module_key: string
}

export type ModulePermissionDraftState = {
  explicitByModule: Record<string, ModulePermissionValues>
  draftByModule: Record<string, ModulePermissionValues>
  dirtyModules: string[]
}

const ADMIN_ROLES = new Set(["owner", "admin", "superadmin", "super_admin"])
const MANAGER_DEFAULTS = new Set([
  "dashboard",
  "briefing",
  "projects",
  "calendar",
  "documents",
  "notifications",
  "team",
  "knowledge",
  "reports",
])
const EMPLOYEE_DEFAULTS = new Set([
  "dashboard",
  "projects",
  "calendar",
  "documents",
  "notifications",
  "knowledge",
])
const ALWAYS_VISIBLE = new Set(["dashboard", "notifications"])

// Mirrors TenantEffectivePermissionsService. Positive grants for these modules
// are deliberately ignored for non-admin roles by the backend.
export const NEVER_OVERRIDE_FOR_NON_ADMIN = new Set([
  "finance",
  "credentials",
  "credentials.read",
  "credentials.create",
  "credentials.edit",
  "credentials.reveal",
  "credentials.manage_permissions",
  "credentials.audit",
  "settings",
  "automations",
])

function emptyPermission(): ModulePermissionValues {
  return {
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
    can_manage: false,
  }
}

function readPermission(): ModulePermissionValues {
  return { ...emptyPermission(), can_view: true }
}

function editPermission(): ModulePermissionValues {
  return {
    can_view: true,
    can_create: true,
    can_update: true,
    can_delete: false,
    can_manage: false,
  }
}

function fullPermission(): ModulePermissionValues {
  return {
    can_view: true,
    can_create: true,
    can_update: true,
    can_delete: true,
    can_manage: true,
  }
}

function normalizeRole(role: string) {
  return String(role || "user").trim().toLowerCase().replace("super_admin", "superadmin")
}

function normalizeValues(values: Partial<ModulePermissionValues>): ModulePermissionValues {
  const canView = Boolean(values.can_view)
  return {
    can_view: canView,
    can_create: Boolean(canView && values.can_create),
    can_update: Boolean(canView && values.can_update),
    can_delete: Boolean(canView && values.can_delete),
    can_manage: Boolean(canView && values.can_manage),
  }
}

function sameValues(left: ModulePermissionValues, right: ModulePermissionValues) {
  return MODULE_PERMISSION_FLAGS.every((flag) => left[flag] === right[flag])
}

export function inheritedModulePermission(roleValue: string, moduleKey: string) {
  const role = normalizeRole(roleValue)
  if (ADMIN_ROLES.has(role)) return fullPermission()
  const defaults = role === "manager" ? MANAGER_DEFAULTS : EMPLOYEE_DEFAULTS
  if (!defaults.has(moduleKey)) return emptyPermission()
  return role === "viewer" ? readPermission() : editPermission()
}

export function createModulePermissionDraftState(
  rows: Array<Partial<ModulePermissionValues> & { module_key: string }> = [],
): ModulePermissionDraftState {
  return {
    explicitByModule: Object.fromEntries(
      rows.map((row) => [row.module_key, normalizeValues(row)]),
    ),
    draftByModule: {},
    dirtyModules: [],
  }
}

function originalModulePermission(
  state: ModulePermissionDraftState,
  roleValue: string,
  moduleKey: string,
) {
  const role = normalizeRole(roleValue)
  const inherited = inheritedModulePermission(role, moduleKey)
  if (ADMIN_ROLES.has(role)) return inherited
  const explicit = state.explicitByModule[moduleKey]
  if (!explicit) return inherited
  if (NEVER_OVERRIDE_FOR_NON_ADMIN.has(moduleKey)) return inherited
  const resolved = role === "viewer"
    ? explicit.can_view ? readPermission() : emptyPermission()
    : normalizeValues(explicit)
  if (ALWAYS_VISIBLE.has(moduleKey)) resolved.can_view = true
  return resolved
}

export function resolvedModulePermission(
  state: ModulePermissionDraftState,
  roleValue: string,
  moduleKey: string,
) {
  return state.draftByModule[moduleKey]
    || originalModulePermission(state, roleValue, moduleKey)
}

export function isModulePermissionEditable(
  roleValue: string,
  moduleKey: string,
  flag: ModulePermissionFlag,
) {
  const role = normalizeRole(roleValue)
  if (ADMIN_ROLES.has(role) || NEVER_OVERRIDE_FOR_NON_ADMIN.has(moduleKey)) return false
  if (role === "viewer" && flag !== "can_view") return false
  if (ALWAYS_VISIBLE.has(moduleKey) && flag === "can_view") return false
  return true
}

export function updateModulePermissionDraft(
  state: ModulePermissionDraftState,
  roleValue: string,
  moduleKey: string,
  flag: ModulePermissionFlag,
  enabled: boolean,
): ModulePermissionDraftState {
  if (!isModulePermissionEditable(roleValue, moduleKey, flag)) return state

  const next = { ...resolvedModulePermission(state, roleValue, moduleKey), [flag]: enabled }
  if (flag === "can_view" && !enabled) {
    for (const permissionFlag of MODULE_PERMISSION_FLAGS) next[permissionFlag] = false
  } else if (flag !== "can_view" && enabled) {
    next.can_view = true
  }
  if (ALWAYS_VISIBLE.has(moduleKey)) next.can_view = true

  const original = originalModulePermission(state, roleValue, moduleKey)
  const draftByModule = { ...state.draftByModule }
  const dirtyModules = new Set(state.dirtyModules)
  if (sameValues(next, original)) {
    delete draftByModule[moduleKey]
    dirtyModules.delete(moduleKey)
  } else {
    draftByModule[moduleKey] = normalizeValues(next)
    dirtyModules.add(moduleKey)
  }
  return { ...state, draftByModule, dirtyModules: Array.from(dirtyModules) }
}

export function buildModulePermissionPatch(
  state: ModulePermissionDraftState,
  roleValue: string,
): ModulePermissionOverride[] {
  const role = normalizeRole(roleValue)
  if (ADMIN_ROLES.has(role)) return []
  return state.dirtyModules
    .filter((moduleKey) => !NEVER_OVERRIDE_FOR_NON_ADMIN.has(moduleKey))
    .flatMap((moduleKey) => {
      const values = state.draftByModule[moduleKey]
      return values ? [{ module_key: moduleKey, ...normalizeValues(values) }] : []
    })
}

export function modulePermissionSource(
  state: ModulePermissionDraftState,
  roleValue: string,
  moduleKey: string,
) {
  const role = normalizeRole(roleValue)
  if (ADMIN_ROLES.has(role) || NEVER_OVERRIDE_FOR_NON_ADMIN.has(moduleKey)) return "immutable" as const
  if (state.dirtyModules.includes(moduleKey)) return "modified" as const
  if (state.explicitByModule[moduleKey]) return "explicit" as const
  return "inherited" as const
}
