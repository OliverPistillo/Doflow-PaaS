import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { TenantCallsStoreService } from './tenant-calls-store.service';
import { TenantCallsLivekitProviderService } from './tenant-calls-livekit-provider.service';

@Injectable()
export class TenantCallsSweeperService {
  private readonly logger = new Logger(TenantCallsSweeperService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly store: TenantCallsStoreService,
    private readonly livekit: TenantCallsLivekitProviderService,
  ) {}

  @Interval(15_000)
  async expireCalls() {
    if (this.running) return;
    this.running = true;
    try {
      const rows: Array<{ tenant_schema: string }> = await this.dataSource.query(
        `SELECT DISTINCT tenant_schema FROM public.desktop_call_room_index WHERE ended_at IS NULL`,
      );
      for (const row of rows.slice(0, 500)) {
        try {
          const schema = safeSchema(row.tenant_schema, 'TenantCallsSweeperService');
          const summaries = await this.store.expireTenant(schema);
          for (const summary of summaries) {
            const eventSummary = summary as Record<string, unknown>;
            const status = String(eventSummary.status || 'failed');
            await this.store.publishState(schema, eventSummary, `calls.${status}`);
            if (status === 'failed') {
              try {
                const call = await this.store.getCall(schema, String(eventSummary.callId));
                await this.livekit.deleteRoom(call.room_key);
              } catch {
                // The persisted terminal state is authoritative; an empty LiveKit room expires independently.
              }
            }
          }
        } catch {
          // One stale or temporarily unavailable tenant must not block expiry for the others.
          this.logger.warn('Desktop Calls tenant expiry sweep deferred');
        }
      }
      await this.dataSource.query(
        `UPDATE public.desktop_call_guest_invite_index
         SET revoked_at=COALESCE(revoked_at,now())
         WHERE revoked_at IS NULL AND expires_at<=now()`,
      );
    } catch {
      this.logger.error('Desktop Calls expiry sweep failed');
    } finally {
      this.running = false;
    }
  }
}
