import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { livekitConfigured, tenantCallsConfig } from './tenant-calls-config';

export type TenantCallsAvailability = {
  enabled: boolean;
  configured: boolean;
  tenantEnabled: boolean;
  guestEnabled: boolean;
  browserInternalCalls: false;
  reason: 'ready' | 'disabled' | 'tenant-disabled' | 'provider-unconfigured';
};

@Injectable()
export class TenantCallsFeatureService {
  constructor(private readonly dataSource: DataSource) {}

  async availability(schemaValue: string): Promise<TenantCallsAvailability> {
    const schema = safeSchema(schemaValue, 'TenantCallsFeatureService.availability');
    if (schema === 'public') {
      return {
        enabled: false,
        configured: false,
        tenantEnabled: false,
        guestEnabled: false,
        browserInternalCalls: false,
        reason: 'tenant-disabled',
      };
    }
    const config = tenantCallsConfig();
    const rows = await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1
         FROM public.tenants t
         JOIN public.tenant_subscriptions s ON s."tenantId"=t.id
         WHERE t.schema_name=$1
           AND t.is_active=true
           AND s."moduleKey"='collab.calls'
           AND s.status IN ('ACTIVE','TRIAL')
           AND (s."expiresAt" IS NULL OR s."expiresAt">now())
           AND (s.status<>'TRIAL' OR s."trialEndsAt" IS NULL OR s."trialEndsAt">now())
       ) AS enabled`,
      [schema],
    );
    const tenantEnabled = rows[0]?.enabled === true;
    const configured = livekitConfigured(config);
    const enabled = config.masterEnabled && tenantEnabled && configured;
    const reason: TenantCallsAvailability['reason'] = !config.masterEnabled
      ? 'disabled'
      : !tenantEnabled
        ? 'tenant-disabled'
        : !configured
          ? 'provider-unconfigured'
          : 'ready';
    return {
      enabled,
      configured,
      tenantEnabled,
      guestEnabled: enabled && config.guestEnabled,
      browserInternalCalls: false,
      reason,
    };
  }

  async requireInternal(schema: string) {
    const availability = await this.availability(schema);
    if (availability.reason === 'provider-unconfigured') {
      throw new ServiceUnavailableException({
        error: 'LIVEKIT_PROVIDER_UNCONFIGURED',
        message: 'Doflow Calls non è configurato sul server.',
      });
    }
    if (!availability.enabled) {
      throw new ForbiddenException({
        error: 'DESKTOP_CALLS_DISABLED',
        message: 'Doflow Calls non è abilitato per questo spazio di lavoro.',
      });
    }
    return availability;
  }

  async requireGuest(schema: string) {
    const availability = await this.requireInternal(schema);
    if (!availability.guestEnabled) {
      throw new ForbiddenException({
        error: 'DESKTOP_GUEST_CALLS_DISABLED',
        message: 'I link riunione guest non sono abilitati per questo spazio di lavoro.',
      });
    }
    return availability;
  }
}
