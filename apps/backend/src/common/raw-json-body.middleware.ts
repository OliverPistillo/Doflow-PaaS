import * as express from 'express';
import type { IncomingMessage } from 'node:http';

export const DOFLOW_JSON_CONTENT_TYPES = [
  'application/json',
  'application/webhook+json',
] as const;

export function createDoflowJsonBodyParser(limit = '50mb'): express.RequestHandler {
  return express.json({
    limit,
    type: [...DOFLOW_JSON_CONTENT_TYPES],
    verify: (request, _response, buffer) => {
      (request as IncomingMessage & { rawBody?: Buffer }).rawBody = buffer;
    },
  });
}
