export const DOFLOW_IDENTITY_ROLES = [
  'administrator',
  'commercial',
  'web_developer',
  'project_manager',
] as const;

export type DoflowIdentityRole = (typeof DOFLOW_IDENTITY_ROLES)[number];

export const DOFLOW_IDENTITY_CAPABILITIES = [
  'canViewAllLeads', 'canViewAssignedLeads', 'canCreateLeads', 'canEditAssignedLead', 'canAssignLeads',
  'canViewCustomers', 'canEditCustomers', 'canViewProjects', 'canViewActivities', 'canManageProjects',
  'canManageAssignedActivities', 'canManageRoles', 'canViewCommercialValues', 'canViewGlobalCommerceValues', 'canViewAdministration',
  'canInspectDuplicates', 'canMergeDuplicates', 'canViewSales', 'canManageOwnSales', 'canViewOrders',
  'canManageOwnOrders', 'canManagePayments', 'canRecordPayments', 'canRecordRefunds',
  'canManagePaymentAllocations', 'canGenerateProjectFromOrder', 'canManageCatalog', 'canViewContracts', 'canManageOwnContracts',
  'canViewRenewals', 'canManageOwnRenewals', 'canManageCommerceRules', 'canApproveProjectWork',
  'canPublishClientUpdate', 'canManageArchive', 'canManageCustomerBranding', 'canViewCampaigns',
  'canManageCampaigns', 'canViewQuotes', 'canManageOwnQuotes', 'canViewInvoices', 'canManageInvoices',
  'canViewAutomations', 'canManageAutomations',
  'canViewAssignedProjects', 'canCreateProject', 'canEditProject', 'canManageProjectMembers',
  'canManageProjectTasks', 'canTrackProjectTime', 'canViewTeamTime', 'canSubmitProjectQa',
  'canSuperviseProject', 'canPublishProject', 'canDeliverProject', 'canReopenProject',
  'canArchiveProject', 'canViewGlobalWorkload', 'canUseBuilder',
  'canReadComments', 'canCreateComments', 'canReplyComments', 'canEditOwnComments',
  'canModerateComments', 'canResolveThreads', 'canMentionUsers', 'canReactComments',
  'canAttachCommentFiles', 'canReadTimeline', 'canReadHistory',
  'canReadNotifications', 'canManageNotificationPreferences', 'canReadAdministrativeAudit',
  'canRunAutomations', 'canRetryAutomations', 'canViewAutomationErrors',
  'canViewOwnPoints', 'canViewGlobalPoints', 'canManagePointPolicies',
  'canViewRankings', 'canManageRankings', 'canManageGoals',
] as const;

export type DoflowIdentityCapability = (typeof DOFLOW_IDENTITY_CAPABILITIES)[number];

export const DOFLOW_ROLE_CAPABILITIES: Record<string, readonly string[]> = {
  administrator: DOFLOW_IDENTITY_CAPABILITIES,
  commercial: ['canViewAssignedLeads', 'canCreateLeads', 'canEditAssignedLead', 'canViewCustomers', 'canEditCustomers', 'canViewProjects', 'canViewActivities', 'canViewCommercialValues', 'canInspectDuplicates', 'canViewSales', 'canManageOwnSales', 'canViewOrders', 'canManageOwnOrders', 'canManagePayments', 'canRecordPayments', 'canRecordRefunds', 'canGenerateProjectFromOrder', 'canViewContracts', 'canManageOwnContracts', 'canViewRenewals', 'canManageOwnRenewals', 'canViewCampaigns', 'canViewQuotes', 'canManageOwnQuotes', 'canViewOwnPoints', 'canViewRankings', 'canReadComments', 'canCreateComments', 'canReplyComments', 'canEditOwnComments', 'canResolveThreads', 'canMentionUsers', 'canReactComments', 'canAttachCommentFiles', 'canReadTimeline', 'canReadHistory', 'canReadNotifications', 'canManageNotificationPreferences'],
  web_developer: ['canViewCustomers', 'canViewProjects', 'canViewAssignedProjects', 'canViewActivities', 'canManageAssignedActivities', 'canManageProjectTasks', 'canTrackProjectTime', 'canSubmitProjectQa', 'canUseBuilder', 'canViewOrders', 'canViewContracts', 'canViewRenewals', 'canViewAutomations', 'canViewOwnPoints', 'canViewRankings', 'canReadComments', 'canCreateComments', 'canReplyComments', 'canEditOwnComments', 'canResolveThreads', 'canMentionUsers', 'canReactComments', 'canAttachCommentFiles', 'canReadTimeline', 'canReadHistory', 'canReadNotifications', 'canManageNotificationPreferences'],
  project_manager: ['canViewCustomers', 'canViewProjects', 'canViewAssignedProjects', 'canCreateProject', 'canEditProject', 'canManageProjects', 'canManageProjectMembers', 'canManageProjectTasks', 'canTrackProjectTime', 'canViewTeamTime', 'canSubmitProjectQa', 'canSuperviseProject', 'canManageAssignedActivities', 'canViewOrders', 'canViewContracts', 'canViewRenewals', 'canApproveProjectWork', 'canPublishClientUpdate', 'canPublishProject', 'canDeliverProject', 'canReopenProject', 'canArchiveProject', 'canViewGlobalWorkload', 'canUseBuilder', 'canViewAutomations', 'canRunAutomations', 'canViewAutomationErrors', 'canViewOwnPoints', 'canViewGlobalPoints', 'canViewRankings', 'canReadComments', 'canCreateComments', 'canReplyComments', 'canEditOwnComments', 'canModerateComments', 'canResolveThreads', 'canMentionUsers', 'canReactComments', 'canAttachCommentFiles', 'canReadTimeline', 'canReadHistory', 'canReadNotifications', 'canManageNotificationPreferences'],
};

export const PENDING_DOFLOW_IDENTITY_METADATA_KEY = 'pending_doflow_identity';

export type PendingDoflowIdentity = {
  roles: DoflowIdentityRole[];
  capabilities: DoflowIdentityCapability[];
};

export type PendingDoflowIdentityInspection = {
  provided: boolean;
  validShape: boolean;
  invalidRoles: string[];
  invalidCapabilities: string[];
  value: PendingDoflowIdentity;
};

function uniqueStrings(value: unknown): { validShape: boolean; values: string[] } {
  if (value === undefined) return { validShape: true, values: [] };
  if (!Array.isArray(value)) return { validShape: false, values: [] };
  const strings = value.filter((item): item is string => typeof item === 'string');
  return {
    validShape: strings.length === value.length,
    values: Array.from(new Set(strings.map((item) => item.trim()).filter(Boolean))),
  };
}

export function inspectPendingDoflowIdentity(value: unknown): PendingDoflowIdentityInspection {
  if (value === undefined || value === null) {
    return {
      provided: false,
      validShape: true,
      invalidRoles: [],
      invalidCapabilities: [],
      value: { roles: [], capabilities: [] },
    };
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      provided: true,
      validShape: false,
      invalidRoles: [],
      invalidCapabilities: [],
      value: { roles: [], capabilities: [] },
    };
  }

  const record = value as Record<string, unknown>;
  const roles = uniqueStrings(record.roles);
  const capabilities = uniqueStrings(record.capabilities);
  const invalidRoles = roles.values.filter(
    (role) => !DOFLOW_IDENTITY_ROLES.includes(role as DoflowIdentityRole),
  );
  const invalidCapabilities = capabilities.values.filter(
    (capability) => !DOFLOW_IDENTITY_CAPABILITIES.includes(capability as DoflowIdentityCapability),
  );
  return {
    provided: true,
    validShape: roles.validShape && capabilities.validShape,
    invalidRoles,
    invalidCapabilities,
    value: {
      roles: roles.values.filter((role): role is DoflowIdentityRole =>
        DOFLOW_IDENTITY_ROLES.includes(role as DoflowIdentityRole)),
      capabilities: capabilities.values.filter((capability): capability is DoflowIdentityCapability =>
        DOFLOW_IDENTITY_CAPABILITIES.includes(capability as DoflowIdentityCapability)),
    },
  };
}

export function inspectPendingDoflowIdentityMetadata(
  metadataValue: unknown,
): PendingDoflowIdentityInspection {
  let metadata = metadataValue;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      return inspectPendingDoflowIdentity(null);
    }
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return inspectPendingDoflowIdentity(null);
  }
  return inspectPendingDoflowIdentity(
    (metadata as Record<string, unknown>)[PENDING_DOFLOW_IDENTITY_METADATA_KEY],
  );
}
