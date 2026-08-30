import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AccessToken, RoomServiceClient, WebhookReceiver, type WebhookEvent } from 'livekit-server-sdk';
import { livekitConfigured, tenantCallsConfig } from './tenant-calls-config';
import type { TenantCallType } from './tenant-calls-domain';

type TokenParticipant = {
  identity: string;
  name: string;
  callId: string;
  roomKey: string;
  kind: 'internal' | 'guest';
  callType: TenantCallType;
};

@Injectable()
export class TenantCallsLivekitProviderService {
  private configuration() {
    const config = tenantCallsConfig();
    if (!livekitConfigured(config)) {
      throw new ServiceUnavailableException({
        error: 'LIVEKIT_PROVIDER_UNCONFIGURED',
        message: 'Provider chiamate non configurato.',
      });
    }
    return config;
  }

  async issueToken(participant: TokenParticipant) {
    const config = this.configuration();
    const access = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: participant.identity,
      name: participant.name,
      ttl: config.tokenTtlSeconds,
      metadata: JSON.stringify({
        callId: participant.callId,
        participantKind: participant.kind,
        callType: participant.callType,
      }),
    });
    access.addGrant({
      roomJoin: true,
      room: participant.roomKey,
      canSubscribe: true,
      canPublish: true,
      canPublishData: false,
    });
    return {
      token: await access.toJwt(),
      serverUrl: config.livekitUrl,
      expiresInSeconds: config.tokenTtlSeconds,
    };
  }

  async deleteRoom(roomKey: string) {
    const config = this.configuration();
    const rooms = new RoomServiceClient(
      config.livekitUrl,
      config.livekitApiKey,
      config.livekitApiSecret,
    );
    await rooms.deleteRoom(roomKey);
  }

  async verifyWebhook(rawBody: Buffer | string | undefined, authorization: string | undefined): Promise<WebhookEvent> {
    const config = this.configuration();
    if (!rawBody || !authorization) throw new UnauthorizedException('Webhook LiveKit non autenticato');
    try {
      const receiver = new WebhookReceiver(config.livekitApiKey, config.livekitApiSecret);
      return await receiver.receive(
        Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody,
        authorization,
      );
    } catch {
      throw new UnauthorizedException('Webhook LiveKit non valido');
    }
  }
}
