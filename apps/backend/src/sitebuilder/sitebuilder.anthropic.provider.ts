// apps/backend/src/sitebuilder/sitebuilder.anthropic.provider.ts
// Provider NestJS per il client Anthropic — unica istanza condivisa via DI.

import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

export const AnthropicProvider: Provider = {
  provide:    ANTHROPIC_CLIENT,
  inject:     [ConfigService],
  useFactory: (config: ConfigService) =>
    new Anthropic({ apiKey: config.get<string>('ANTHROPIC_API_KEY') ?? '' }),
};