import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantCommercialAccessService } from './tenant-commercial-access.service';
import { TenantEffectivePermissionsService } from './tenant-effective-permissions.service';
import { isDoflowTenant } from './tenant-context';
import { TenantActor } from './tenant-universal-context';

export type TenantUniversalCapability =
  | 'canReadNotifications'
  | 'canViewTeam'
  | 'canViewProjects'
  | 'canCreateFlowboards'
  | 'canUpdateFlowboards'
  | 'canDeleteFlowboards'
  | 'canCreateFlowboardComments'
  | 'canUpdateFlowboardComments'
  | 'canDeleteFlowboardComments'
  | 'canModerateFlowboardComments'
  | 'canCreateConversations'
  | 'canManageConversations'
  | 'canSendMessages'
  | 'canEditMessages'
  | 'canDeleteMessages'
  | 'canModerateMessages'
  | 'canReactMessages'
  | 'canViewAssignedLeads'
  | 'canAnalyzeCompanies'
  | 'canViewOwnPoints'
  | 'canViewGlobalPoints'
  | 'canManagePointPolicies';

@Injectable()
export class TenantUniversalCapabilitiesService {
  constructor(
    private readonly doflowCapabilities: TenantCommercialAccessService,
    private readonly effectivePermissions: TenantEffectivePermissionsService,
  ) {}

  async require(actor: TenantActor, ...required: TenantUniversalCapability[]): Promise<void> {
    if (!required.length) return;
    for (const capability of required) {
      if (await this.has(actor, capability)) return;
    }
    throw new ForbiddenException('Capability tenant richiesta');
  }

  async has(actor: TenantActor, capability: TenantUniversalCapability): Promise<boolean> {
    if (isDoflowTenant(actor.schema)) {
      const access = await this.doflowCapabilities.current();
      if (access.schema !== actor.schema || access.id !== actor.id) {
        throw new ForbiddenException('Autorita capability non coerente con la sessione');
      }
      return this.doflowCapabilityNames(capability).some((name) =>
        this.doflowCapabilities.has(access, name),
      );
    }

    const access = await this.effectivePermissions.getCurrentAccess();
    if (access.role !== actor.role) throw new ForbiddenException('Autorita capability non coerente con la sessione');
    return this.genericHas(access, capability);
  }

  private doflowCapabilityNames(capability: TenantUniversalCapability): string[] {
    switch (capability) {
      case 'canViewTeam': return ['canViewProjects'];
      case 'canCreateFlowboards': return ['canCreateProject', 'canManageProjects'];
      case 'canUpdateFlowboards': return ['canEditProject', 'canManageProjects'];
      case 'canDeleteFlowboards': return ['canArchiveProject', 'canManageProjects'];
      case 'canCreateFlowboardComments': return ['canCreateComments'];
      case 'canUpdateFlowboardComments': return ['canEditOwnComments', 'canModerateComments'];
      case 'canDeleteFlowboardComments': return ['canEditOwnComments', 'canModerateComments'];
      case 'canModerateFlowboardComments': return ['canModerateComments'];
      case 'canCreateConversations': return ['canCreateComments'];
      case 'canManageConversations': return ['canModerateComments', 'canManageProjects'];
      case 'canSendMessages': return ['canCreateComments'];
      case 'canEditMessages': return ['canEditOwnComments', 'canModerateComments'];
      case 'canDeleteMessages': return ['canEditOwnComments', 'canModerateComments'];
      case 'canModerateMessages': return ['canModerateComments'];
      case 'canReactMessages': return ['canReactComments'];
      case 'canAnalyzeCompanies': return ['canCreateLeads'];
      default: return [capability];
    }
  }

  private genericHas(
    access: Awaited<ReturnType<TenantEffectivePermissionsService['getCurrentAccess']>>,
    capability: TenantUniversalCapability,
  ) {
    switch (capability) {
      case 'canReadNotifications': return Boolean(access.modules.notifications?.can_view);
      case 'canViewTeam': return Boolean(access.modules.team?.can_view);
      case 'canViewProjects': return Boolean(access.modules.projects?.can_view);
      case 'canCreateFlowboards': return Boolean(access.modules.projects?.can_create);
      case 'canUpdateFlowboards': return Boolean(access.modules.projects?.can_update);
      case 'canDeleteFlowboards': return Boolean(access.modules.projects?.can_delete);
      case 'canCreateFlowboardComments': return Boolean(access.modules.projects?.can_create);
      case 'canUpdateFlowboardComments': return Boolean(access.modules.projects?.can_update);
      case 'canDeleteFlowboardComments': return Boolean(access.modules.projects?.can_delete);
      case 'canModerateFlowboardComments': return Boolean(access.modules.projects?.can_manage);
      case 'canCreateConversations': return Boolean(access.modules.team?.can_create);
      case 'canManageConversations': return Boolean(access.modules.team?.can_manage);
      case 'canSendMessages': return Boolean(access.modules.team?.can_create);
      case 'canEditMessages': return Boolean(access.modules.team?.can_update);
      case 'canDeleteMessages': return Boolean(access.modules.team?.can_delete);
      case 'canModerateMessages': return Boolean(access.modules.team?.can_manage);
      case 'canReactMessages': return Boolean(access.modules.team?.can_update);
      case 'canViewAssignedLeads': return Boolean(access.modules.crm?.can_view);
      case 'canAnalyzeCompanies': return Boolean(access.modules.crm?.can_create);
      case 'canViewOwnPoints': return Boolean(access.modules.reports?.can_view);
      case 'canViewGlobalPoints': return Boolean(access.modules.reports?.can_manage);
      case 'canManagePointPolicies': return Boolean(access.modules.reports?.can_manage);
      default:
        return false;
    }
  }
}
