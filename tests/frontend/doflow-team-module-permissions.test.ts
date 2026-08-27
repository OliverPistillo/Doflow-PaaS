import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  MODULE_PERMISSION_FLAGS,
  NEVER_OVERRIDE_FOR_NON_ADMIN,
  buildModulePermissionPatch,
  createModulePermissionDraftState,
  isModulePermissionEditable,
  modulePermissionSource,
  resolvedModulePermission,
  updateModulePermissionDraft,
} from "../../apps/frontend/src/components/team-space/module-permission-policy"
import {
  buildInviteConfiguration,
  updateInviteRole,
} from "../../apps/frontend/src/components/team-space/team-invite-policy"
import { Input } from "../../apps/frontend/src/components/ui/input"
import { loadAllTeamMembers } from "../../apps/frontend/src/components/team-space/team-member-pagination"

test("saving profile or capacity does not create overrides or revoke role defaults", () => {
  const state = createModulePermissionDraftState()
  assert.deepEqual(buildModulePermissionPatch(state, "user"), [])
  assert.deepEqual(resolvedModulePermission(state, "user", "projects"), {
    can_view: true,
    can_create: true,
    can_update: true,
    can_delete: false,
    can_manage: false,
  })
  assert.equal(modulePermissionSource(state, "user", "projects"), "inherited")

  const adminSource = readFileSync(
    new URL("../../apps/frontend/src/components/team-space/doflow-team-account-admin.tsx", import.meta.url),
    "utf8",
  )
  assert.match(adminSource, /const modulePermissionPatch = modulePermissionsReady\s*\? buildModulePermissionPatch/)
  assert.match(adminSource, /if \(modulePermissionPatch\.length > 0\)\s*{\s*await teamApi\.updatePermissions/)
})

test("an explicit user edit produces exactly one complete module override", () => {
  const inherited = createModulePermissionDraftState()
  const changed = updateModulePermissionDraft(
    inherited,
    "user",
    "projects",
    "can_delete",
    true,
  )

  assert.equal(modulePermissionSource(changed, "user", "projects"), "modified")
  assert.deepEqual(buildModulePermissionPatch(changed, "user"), [{
    module_key: "projects",
    can_view: true,
    can_create: true,
    can_update: true,
    can_delete: true,
    can_manage: false,
  }])

  const reverted = updateModulePermissionDraft(
    changed,
    "user",
    "projects",
    "can_delete",
    false,
  )
  assert.deepEqual(buildModulePermissionPatch(reverted, "user"), [])
})

test("impossible positive grants are immutable and never serialized", () => {
  for (const moduleKey of NEVER_OVERRIDE_FOR_NON_ADMIN) {
    const state = createModulePermissionDraftState([{
      module_key: moduleKey,
      can_view: true,
      can_create: true,
      can_update: true,
      can_delete: true,
      can_manage: true,
    }])
    assert.equal(modulePermissionSource(state, "manager", moduleKey), "immutable")
    assert.deepEqual(resolvedModulePermission(state, "manager", moduleKey), {
      can_view: false,
      can_create: false,
      can_update: false,
      can_delete: false,
      can_manage: false,
    })
    for (const flag of MODULE_PERMISSION_FLAGS) {
      assert.equal(isModulePermissionEditable("manager", moduleKey, flag), false)
      assert.equal(updateModulePermissionDraft(state, "manager", moduleKey, flag, true), state)
    }
    assert.deepEqual(buildModulePermissionPatch(state, "manager"), [])
  }
})

test("viewer write grants and mandatory module visibility remain immutable", () => {
  for (const flag of MODULE_PERMISSION_FLAGS.filter((candidate) => candidate !== "can_view")) {
    assert.equal(isModulePermissionEditable("viewer", "projects", flag), false)
  }
  assert.equal(isModulePermissionEditable("viewer", "projects", "can_view"), true)
  assert.equal(isModulePermissionEditable("viewer", "dashboard", "can_view"), false)
  assert.equal(isModulePermissionEditable("manager", "notifications", "can_view"), false)
})

test("invite staging keeps inherited capabilities out of explicit grants", () => {
  const configuration = buildInviteConfiguration({
    tenantRole: "user",
    identity: {
      roles: ["web_developer"],
      capabilities: ["canViewProjects", "canViewAllLeads"],
    },
    modulePermissionState: createModulePermissionDraftState(),
    skillIds: ["skill-a", "skill-a", "skill-b"],
  })

  assert.deepEqual(configuration.doflow_identity, {
    roles: ["web_developer"],
    capabilities: ["canViewAllLeads"],
  })
  assert.deepEqual(configuration.module_permissions, [])
  assert.deepEqual(configuration.skill_ids, ["skill-a", "skill-b"])
})

test("invite staging sends only dirty module overrides and never impossible grants", () => {
  let state = createModulePermissionDraftState()
  state = updateModulePermissionDraft(state, "user", "projects", "can_delete", true)
  state = updateModulePermissionDraft(state, "user", "finance", "can_view", true)

  const configuration = buildInviteConfiguration({
    tenantRole: "user",
    identity: { roles: [], capabilities: [] },
    modulePermissionState: state,
    skillIds: [],
  })
  assert.deepEqual(configuration.module_permissions, [{
    module_key: "projects",
    can_view: true,
    can_create: true,
    can_update: true,
    can_delete: true,
    can_manage: false,
  }])
  assert.equal(configuration.module_permissions.some((row) => row.module_key === "finance"), false)
})

test("selecting an invite role removes capabilities that become inherited", () => {
  const next = updateInviteRole(
    { roles: [], capabilities: ["canViewProjects", "canViewAllLeads"] },
    "web_developer",
    true,
  )
  assert.deepEqual(next.roles, ["web_developer"])
  assert.deepEqual(next.capabilities, ["canViewAllLeads"])

  const adminSource = readFileSync(
    new URL("../../apps/frontend/src/components/team-space/doflow-team-account-admin.tsx", import.meta.url),
    "utf8",
  )
  const invitePolicySource = readFileSync(
    new URL("../../apps/frontend/src/components/team-space/team-invite-policy.ts", import.meta.url),
    "utf8",
  )
  assert.match(adminSource, /buildInviteConfiguration/)
  assert.match(invitePolicySource, /doflow_identity/)
  assert.match(invitePolicySource, /module_permissions/)
  assert.match(invitePolicySource, /skill_ids/)
  assert.doesNotMatch(adminSource, /si configurano dopo l.attivazione/i)
})

test("legacy input defaults preserve explicit consumer geometry utilities", () => {
  const rendered = Input({
    className: "h-9 rounded-md bg-background px-3 py-2 text-sm leading-5 font-normal shadow-none",
    type: "text",
  })
  const classes = String(rendered.props.className)
  for (const expected of [
    "h-9",
    "rounded-md",
    "bg-background",
    "px-3",
    "py-2",
    "text-sm",
    "leading-5",
    "font-normal",
    "shadow-none",
  ]) {
    assert.match(classes, new RegExp(`(?:^|\\s)${expected}(?:$|\\s)`))
  }
  for (const superseded of [
    "h-[var(--input-control-height)]",
    "rounded-[var(--input-control-radius)]",
    "bg-[var(--input-control-background)]",
    "px-[var(--input-control-padding-x)]",
    "py-[var(--input-control-padding-y)]",
    "text-[length:var(--input-control-font-size)]",
    "leading-[var(--input-control-line-height)]",
    "font-[var(--input-control-font-weight)]",
    "shadow-[var(--input-control-shadow)]",
  ]) {
    assert.equal(classes.includes(superseded), false)
  }

  const globals = readFileSync(
    new URL("../../apps/frontend/src/app/globals.css", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(
    globals,
    /html:not\(\[data-tenant-ui="universal"\]\) \[data-slot="input"\]\s*\{[^}]*height:/s,
  )
})

test("Team admin follows backend pagination instead of silently stopping at 100", async () => {
  const calls: Array<{ limit: number; offset: number }> = []
  const members = Array.from({ length: 125 }, (_, index) => ({
    id: `member-${index}`,
    email: `member-${index}@example.test`,
    display_name: `Member ${index}`,
  }))
  const loaded = await loadAllTeamMembers(async (params) => {
    calls.push(params)
    return {
      items: members.slice(params.offset, params.offset + params.limit),
      total: members.length,
    }
  })

  assert.equal(loaded.length, 125)
  assert.deepEqual(calls, [
    { limit: 100, offset: 0 },
    { limit: 100, offset: 100 },
  ])
})

test("Team admin and sidebar fail closed on unverified or filtered access", () => {
  const adminSource = readFileSync(
    new URL("../../apps/frontend/src/components/team-space/doflow-team-account-admin.tsx", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(adminSource, /teamApi\.permissions\([^)]*\)\.catch\(\(\) => \(\{ items: \[\] \}\)\)/)
  assert.match(adminSource, /modulePermissionsReady\s*\?\s*buildModulePermissionPatch/)
  assert.match(adminSource, /&& modulePermissionsReady\s*&& isModulePermissionEditable/)
  assert.match(adminSource, /normalize\(member\.operational_role\) === "ceo_label"/)
  assert.match(adminSource, /\{isOwner \? <Badge[^>]*>Owner<\/Badge>/)

  const sidebarSource = readFileSync(
    new URL("../../apps/frontend/src/components/app-sidebar.tsx", import.meta.url),
    "utf8",
  )
  assert.match(sidebarSource, /const children = item\.items\?\.filter\(\(child\) => !child\.capability \|\| hasCapability\(child\.capability\)\)/)
  assert.match(sidebarSource, /const featureAllowed = item\.url !== "\/dashboard\/company-intelligence" \|\| activeModules\.has\("crm\.sales-intel"\)/)
  assert.match(sidebarSource, /const allowed = featureAllowed && \(!item\.capability \|\| hasCapability\(item\.capability\) \|\| Boolean\(children\?\.length\)\)/)
  assert.doesNotMatch(sidebarSource, /const allowed = !item\.capability \|\| hasCapability\(item\.capability\) \|\| Boolean\(children\?\.length\)/)

  const teamPageSource = readFileSync(
    new URL("../../apps/frontend/src/app/(tenant)/dashboard/team-space/page.tsx", import.meta.url),
    "utf8",
  )
  const teamRouteSource = readFileSync(
    new URL("../../apps/frontend/src/features/chat/team-space-route.tsx", import.meta.url),
    "utf8",
  )
  const teamSidebarSource = readFileSync(
    new URL("../../apps/frontend/src/features/chat/team-space-sidebar.tsx", import.meta.url),
    "utf8",
  )
  const identitySource = readFileSync(
    new URL("../../apps/frontend/src/features/identity/doflow-identity-provider.tsx", import.meta.url),
    "utf8",
  )
  assert.match(teamPageSource, /return <TeamSpaceRoute \/>/)
  assert.match(teamRouteSource, /const requestedTab = searchParams\.get\("tab"\)/)
  assert.match(teamRouteSource, /const activeTab = requestedTab === "team-accounts" && canAdministerAccounts \? "team-accounts" : "chat"/)
  assert.match(teamRouteSource, /if \(activeTab === "team-accounts"\)/)
  assert.match(teamRouteSource, /<DoflowTeamAccountAdmin \/>/)
  assert.match(teamSidebarSource, /canAdministerAccounts \? <Button[^>]*>.*href="\/dashboard\/team-space\?tab=team-accounts"/s)
  assert.match(identitySource, /error instanceof ApiError && error\.status === 403/)
  assert.match(identitySource, /if \(error instanceof ApiError && error\.status === 403\) return \{ items: \[\] \}/)
  assert.doesNotMatch(identitySource, /teamApi\.members\([^)]*\)\.catch\(\(\) =>/)
})
