import { InternalServerErrorException } from '@nestjs/common';

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0' || normalized === '::1';
}

export function resolveFrontendUrl(): string {
  const raw = String(process.env.FRONTEND_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const production = isProduction();

  if (!raw) {
    if (!production) return 'http://localhost:3000';
    throw new InternalServerErrorException('URL frontend pubblico non configurato.');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InternalServerErrorException('URL frontend pubblico non configurato.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new InternalServerErrorException('URL frontend pubblico non configurato.');
  }
  if (url.username || url.password) {
    throw new InternalServerErrorException('URL frontend pubblico non configurato.');
  }
  if (production && url.protocol !== 'https:') {
    throw new InternalServerErrorException('URL frontend pubblico non configurato.');
  }
  if (production && isLocalHostname(url.hostname)) {
    throw new InternalServerErrorException('URL frontend pubblico non configurato.');
  }

  return url.toString().replace(/\/+$/, '');
}

export function buildFrontendPath(pathname: string, params: Record<string, string>) {
  const url = new URL(pathname, `${resolveFrontendUrl()}/`);
  url.search = new URLSearchParams(params).toString();
  return url.toString();
}
