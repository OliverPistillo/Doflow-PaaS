import type { CommercialCustomer, CommercialProject, CustomerActivity } from "@/features/commercial/components/commercial-leads-provider"
import type { CommercialLead } from "@/features/commercial/types"

export const doflowRoles = ["administrator", "commercial", "web_developer", "project_manager"] as const
export type DoflowRole = (typeof doflowRoles)[number]

export const roleLabels: Record<DoflowRole, string> = {
  administrator: "Amministratore",
  commercial: "Commerciale",
  web_developer: "Web Developer",
  project_manager: "Project Manager",
}

export const doflowCapabilities = [
  "canViewAllLeads",
  "canViewAssignedLeads",
  "canCreateLeads",
  "canEditAssignedLead",
  "canAssignLeads",
  "canViewCustomers",
  "canEditCustomers",
  "canViewProjects",
  "canViewActivities",
  "canManageProjects",
  "canManageAssignedActivities",
  "canManageRoles",
  "canViewCommercialValues",
  "canViewGlobalCommerceValues",
  "canViewAdministration",
  "canInspectDuplicates",
  "canMergeDuplicates",
  "canViewSales",
  "canManageOwnSales",
  "canViewOrders",
  "canManageOwnOrders",
  "canManagePayments",
  "canRecordPayments",
  "canRecordRefunds",
  "canManagePaymentAllocations",
  "canGenerateProjectFromOrder",
  "canManageCatalog",
  "canViewContracts",
  "canManageOwnContracts",
  "canViewRenewals",
  "canManageOwnRenewals",
  "canManageCommerceRules",
  "canApproveProjectWork",
  "canPublishClientUpdate",
  "canManageArchive",
  "canManageCustomerBranding",
  "canViewCampaigns",
  "canManageCampaigns",
  "canViewQuotes",
  "canManageOwnQuotes",
  "canViewInvoices",
  "canManageInvoices",
  "canViewAutomations",
  "canManageAutomations",
  "canViewAssignedProjects",
  "canCreateProject",
  "canEditProject",
  "canManageProjectMembers",
  "canManageProjectTasks",
  "canTrackProjectTime",
  "canViewTeamTime",
  "canSubmitProjectQa",
  "canSuperviseProject",
  "canPublishProject",
  "canDeliverProject",
  "canReopenProject",
  "canArchiveProject",
  "canViewGlobalWorkload",
  "canUseBuilder",
  "canReadComments",
  "canCreateComments",
  "canReplyComments",
  "canEditOwnComments",
  "canModerateComments",
  "canResolveThreads",
  "canMentionUsers",
  "canReactComments",
  "canAttachCommentFiles",
  "canReadTimeline",
  "canReadHistory",
  "canReadNotifications",
  "canManageNotificationPreferences",
  "canReadAdministrativeAudit",
  "canRunAutomations",
  "canRetryAutomations",
  "canViewAutomationErrors",
  "canViewOwnPoints",
  "canViewGlobalPoints",
  "canManagePointPolicies",
  "canViewRankings",
  "canManageRankings",
  "canManageGoals",
] as const
export type DoflowCapability = (typeof doflowCapabilities)[number]

const roleCapabilities: Record<DoflowRole, readonly DoflowCapability[]> = {
  administrator: doflowCapabilities,
  commercial: ["canViewAssignedLeads", "canCreateLeads", "canEditAssignedLead", "canViewCustomers", "canEditCustomers", "canViewProjects", "canViewActivities", "canViewCommercialValues", "canInspectDuplicates", "canViewSales", "canManageOwnSales", "canViewOrders", "canManageOwnOrders", "canManagePayments", "canRecordPayments", "canRecordRefunds", "canGenerateProjectFromOrder", "canViewContracts", "canManageOwnContracts", "canViewRenewals", "canManageOwnRenewals", "canViewCampaigns", "canViewQuotes", "canManageOwnQuotes", "canViewOwnPoints", "canViewRankings", "canReadComments", "canCreateComments", "canReplyComments", "canEditOwnComments", "canResolveThreads", "canMentionUsers", "canReactComments", "canAttachCommentFiles", "canReadTimeline", "canReadHistory", "canReadNotifications", "canManageNotificationPreferences"],
  web_developer: ["canViewCustomers", "canViewProjects", "canViewAssignedProjects", "canViewActivities", "canManageAssignedActivities", "canManageProjectTasks", "canTrackProjectTime", "canSubmitProjectQa", "canUseBuilder", "canViewOrders", "canViewContracts", "canViewRenewals", "canViewAutomations", "canViewOwnPoints", "canViewRankings", "canReadComments", "canCreateComments", "canReplyComments", "canEditOwnComments", "canResolveThreads", "canMentionUsers", "canReactComments", "canAttachCommentFiles", "canReadTimeline", "canReadHistory", "canReadNotifications", "canManageNotificationPreferences"],
  project_manager: ["canViewCustomers", "canViewProjects", "canViewAssignedProjects", "canCreateProject", "canEditProject", "canManageProjects", "canManageProjectMembers", "canManageProjectTasks", "canTrackProjectTime", "canViewTeamTime", "canSubmitProjectQa", "canSuperviseProject", "canManageAssignedActivities", "canViewOrders", "canViewContracts", "canViewRenewals", "canApproveProjectWork", "canPublishClientUpdate", "canPublishProject", "canDeliverProject", "canReopenProject", "canArchiveProject", "canViewGlobalWorkload", "canUseBuilder", "canViewAutomations", "canRunAutomations", "canViewAutomationErrors", "canViewOwnPoints", "canViewGlobalPoints", "canViewRankings", "canReadComments", "canCreateComments", "canReplyComments", "canEditOwnComments", "canModerateComments", "canResolveThreads", "canMentionUsers", "canReactComments", "canAttachCommentFiles", "canReadTimeline", "canReadHistory", "canReadNotifications", "canManageNotificationPreferences"],
}

export type PermissionIdentity = { id: string; roles: readonly DoflowRole[]; capabilities?: readonly DoflowCapability[] }
export type CommercialScope = { leads: CommercialLead[]; customers: CommercialCustomer[]; projects: CommercialProject[] }

export function capabilitiesForRoles(roles: readonly DoflowRole[]) {
  return new Set(roles.flatMap((role) => roleCapabilities[role]))
}

export function hasCapability(identity: PermissionIdentity, capability: DoflowCapability) {
  return capabilitiesForRoles(identity.roles).has(capability) || Boolean(identity.capabilities?.includes(capability))
}

export function canViewLead(identity: PermissionIdentity, lead: CommercialLead) {
  if (lead.archivedAt) return false
  return hasCapability(identity, "canViewAllLeads") || (hasCapability(identity, "canViewAssignedLeads") && lead.assigneeId === identity.id)
}

export function canEditLead(identity: PermissionIdentity, lead: CommercialLead) {
  return hasCapability(identity, "canViewAllLeads") || (hasCapability(identity, "canEditAssignedLead") && lead.assigneeId === identity.id)
}

export function canViewProject(identity: PermissionIdentity, project: CommercialProject, scope: Pick<CommercialScope, "leads" | "customers">) {
  if (project.archivedAt || project.status === "archived") return false
  if (identity.roles.includes("administrator")) return true
  const customer = scope.customers.find((item) => item.id === project.clientId)
  const lead = scope.leads.find((item) => item.id === (project.sourceLeadId ?? customer?.sourceLeadId))
  const commerciallyOwned = identity.roles.includes("commercial") && lead?.assigneeId === identity.id
  const operationallyAssigned = (identity.roles.includes("web_developer") || identity.roles.includes("project_manager") || hasCapability(identity, "canApproveProjectWork") || hasCapability(identity, "canPublishClientUpdate")) && Boolean(project.ownerId === identity.id || project.memberIds.includes(identity.id) || project.supervisorIds?.includes(identity.id))
  return Boolean(commerciallyOwned || operationallyAssigned)
}

export function canViewCustomer(identity: PermissionIdentity, customer: CommercialCustomer, scope: CommercialScope) {
  if (customer.archivedAt) return false
  if (identity.roles.includes("administrator")) return true
  const lead = scope.leads.find((item) => item.id === customer.sourceLeadId) ?? customer.profile
  if (identity.roles.includes("commercial") && lead.assigneeId === identity.id) return true
  if (scope.projects.some((project) => project.clientId === customer.id && canViewProject(identity, project, scope))) return true
  return (identity.roles.includes("web_developer") || identity.roles.includes("project_manager")) && getCustomerActivities(customer).some((activity) => activity.assigneeId === identity.id)
}

export function canManageCustomerBranding(identity: PermissionIdentity, customer: CommercialCustomer, scope: CommercialScope) {
  if (identity.roles.includes("administrator") || hasCapability(identity, "canManageCustomerBranding")) return true
  const lead = scope.leads.find((item) => item.id === customer.sourceLeadId) ?? customer.profile
  return identity.roles.includes("commercial") && lead.assigneeId === identity.id
}

export function canViewActivity(identity: PermissionIdentity, activity: CustomerActivity, customer: CommercialCustomer, scope: CommercialScope) {
  if (activity.archivedAt) return false
  if (identity.roles.includes("administrator")) return true
  if (activity.assigneeId === identity.id || activity.collaboratorIds?.includes(identity.id)) return true
  const project = scope.projects.find((item) => item.id === activity.projectId)
  if (identity.roles.includes("project_manager") && project && (project.ownerId === identity.id || project.memberIds.includes(identity.id))) return true
  const technicalTypes: CustomerActivity["type"][] = ["Sviluppo", "Bug", "QA/Test", "Contenuto", "Consegna", "Assistenza"]
  if (identity.roles.includes("web_developer") && project && technicalTypes.includes(activity.type) && (project.ownerId === identity.id || project.memberIds.includes(identity.id))) return true
  const lead = scope.leads.find((item) => item.id === (activity.leadId ?? customer.sourceLeadId)) ?? customer.profile
  return identity.roles.includes("commercial") && lead.assigneeId === identity.id
}

export function canManageProject(identity: PermissionIdentity, project: CommercialProject) {
  if (identity.roles.includes("administrator")) return true
  return identity.roles.includes("project_manager") && Boolean(project.ownerId === identity.id || project.memberIds.includes(identity.id) || project.supervisorIds?.includes(identity.id))
}

export function canManageActivity(identity: PermissionIdentity, activity: CustomerActivity, customer?: CommercialCustomer, project?: CommercialProject) {
  if (identity.roles.includes("administrator")) return true
  if (activity.assigneeId === identity.id || activity.collaboratorIds?.includes(identity.id)) return hasCapability(identity, "canManageAssignedActivities") || identity.roles.includes("commercial")
  if (identity.roles.includes("project_manager") && project && (project.ownerId === identity.id || project.memberIds.includes(identity.id))) return true
  return Boolean(identity.roles.includes("commercial") && customer?.profile.assigneeId === identity.id)
}

export function canMergeDuplicateRecords(identity: PermissionIdentity, records: CommercialLead[]) {
  if (!hasCapability(identity, "canMergeDuplicates")) return false
  return identity.roles.includes("administrator") || records.every((record) => canEditLead(identity, record))
}

function getCustomerActivities(customer: CommercialCustomer) {
  const activities = [...(customer.activities ?? [])]
  if (customer.onboardingActivity && !activities.some((item) => item.id === customer.onboardingActivity?.id)) activities.push(customer.onboardingActivity)
  return activities
}
