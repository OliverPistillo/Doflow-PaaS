import {
  capabilitiesForRoles,
  doflowCapabilities,
  doflowRoles,
  type DoflowCapability,
  type DoflowRole,
} from "../../features/identity/permissions"

import {
  buildModulePermissionPatch,
  type ModulePermissionDraftState,
} from "./module-permission-policy"

export type InviteIdentityDraft = {
  roles: DoflowRole[]
  capabilities: DoflowCapability[]
}

function normalizedRoles(roles: readonly DoflowRole[]) {
  return Array.from(new Set(roles.filter((role) => doflowRoles.includes(role))))
}

function normalizedExplicitCapabilities(
  roles: readonly DoflowRole[],
  capabilities: readonly DoflowCapability[],
) {
  const inherited = capabilitiesForRoles(roles)
  return Array.from(
    new Set(
      capabilities.filter(
        (capability) =>
          doflowCapabilities.includes(capability)
          && !inherited.has(capability),
      ),
    ),
  )
}

export function updateInviteRole(
  draft: InviteIdentityDraft,
  role: DoflowRole,
  enabled: boolean,
): InviteIdentityDraft {
  if (!doflowRoles.includes(role)) return draft
  const roles = normalizedRoles(
    enabled
      ? [...draft.roles, role]
      : draft.roles.filter((candidate) => candidate !== role),
  )
  return {
    roles,
    capabilities: normalizedExplicitCapabilities(roles, draft.capabilities),
  }
}

export function updateInviteCapability(
  draft: InviteIdentityDraft,
  capability: DoflowCapability,
  enabled: boolean,
): InviteIdentityDraft {
  if (
    !doflowCapabilities.includes(capability)
    || capabilitiesForRoles(draft.roles).has(capability)
  ) {
    return draft
  }
  return {
    ...draft,
    capabilities: normalizedExplicitCapabilities(
      draft.roles,
      enabled
        ? [...draft.capabilities, capability]
        : draft.capabilities.filter((candidate) => candidate !== capability),
    ),
  }
}

export function buildInviteConfiguration({
  tenantRole,
  identity,
  modulePermissionState,
  skillIds,
}: {
  tenantRole: string
  identity: InviteIdentityDraft
  modulePermissionState: ModulePermissionDraftState
  skillIds: readonly string[]
}) {
  const roles = normalizedRoles(identity.roles)
  return {
    doflow_identity: {
      roles,
      capabilities: normalizedExplicitCapabilities(roles, identity.capabilities),
    },
    module_permissions: buildModulePermissionPatch(modulePermissionState, tenantRole),
    skill_ids: Array.from(new Set(skillIds.map((skillId) => skillId.trim()).filter(Boolean))),
  }
}
