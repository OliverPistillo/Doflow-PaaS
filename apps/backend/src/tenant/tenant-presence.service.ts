import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
  async heartbeat(body: Record<string, unknown>) {
    rejectActorOverride(body);
    const actor = await this.authorize();
    const status = String(body.status || 'online');
    const duration = body.duration === undefined ? undefined : String(body.duration);
    if (status === 'automatic') return this.presence.clearManual(actor.schema, actor.id, String(body.automaticStatus || 'online'));
    if (duration !== undefined) {
      if (!['30m', '1h', 'today', 'forever'].includes(duration)) throw new BadRequestException('duration non valida');
      if (!['online', 'away', 'busy', 'offline', 'do_not_disturb'].includes(status)) throw new BadRequestException('status manuale non valido');
      return this.presence.setManual(actor.schema, actor.id, status, duration);
    }
    return this.presence.heartbeat(actor.schema, actor.id, 'http', status, 'http');
  }
  async disconnect() { const actor = await this.authorize(); return this.presence.disconnect(actor.schema, actor.id, 'http'); }
}
