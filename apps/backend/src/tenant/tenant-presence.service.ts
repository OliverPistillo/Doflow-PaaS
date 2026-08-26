import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PresenceRegistryService } from '../realtime/presence-registry.service';
import { rejectActorOverride, tenantActor } from './tenant-universal-context';
import { TenantUniversalCapabilitiesService } from './tenant-universal-capabilities.service';

@Injectable()
export class TenantPresenceService {
  constructor(
    private readonly presence: PresenceRegistryService,
    @Inject(REQUEST) private readonly request: any,
    private readonly capabilities: TenantUniversalCapabilitiesService,
  ) {}
  private actor() { return tenantActor(this.request, 'TenantPresenceService'); }
  private async authorize() {
    const actor = this.actor();
    await this.capabilities.require(actor, 'canViewProjects');
    return actor;
  }
  async list() { const actor = await this.authorize(); return { items: await this.presence.list(actor.schema), timeoutSeconds: 45 }; }
  async heartbeat(body: Record<string, unknown>) { rejectActorOverride(body); const actor = await this.authorize(); return this.presence.heartbeat(actor.schema, actor.id, 'http', String(body.status || 'online'), 'http'); }
  async disconnect() { const actor = await this.authorize(); return this.presence.disconnect(actor.schema, actor.id, 'http'); }
}
