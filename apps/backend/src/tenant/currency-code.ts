import { BadRequestException } from '@nestjs/common';

export const DEFAULT_CURRENCY_CODE = 'EUR';

export function normalizeCurrencyCode(value: unknown): string {
  if (value === undefined) return DEFAULT_CURRENCY_CODE;
  if (typeof value !== 'string') throw new BadRequestException('currency non valida');

  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new BadRequestException('currency non valida');
  }
  return normalized;
}
