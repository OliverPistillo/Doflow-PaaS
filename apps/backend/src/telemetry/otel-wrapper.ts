export type TelemetryEvent = {
  type: string;
  ip?: string | null;
  path?: string;
  tenantId?: string;
  timestamp?: string;
};

export class OtelWrapper {
  async emit(event: TelemetryEvent): Promise<void> {
    const enriched: TelemetryEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    console.log('[TELEMETRY]', JSON.stringify(enriched));
  }
}
