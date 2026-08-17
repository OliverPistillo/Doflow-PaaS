import { BadRequestException } from '@nestjs/common';
import { normalizeCurrencyCode } from './currency-code';

describe('normalizeCurrencyCode', () => {
  it.each([
    [undefined, 'EUR'],
    ['EUR', 'EUR'],
    ['eur', 'EUR'],
    [' EUR ', 'EUR'],
    ['USD', 'USD'],
  ])('normalizza %p in %s', (value, expected) => {
    expect(normalizeCurrencyCode(value)).toBe(expected);
  });

  it.each(['1200€', 'EURO', '€', 978, null, ''])('rifiuta %p', (value) => {
    expect(() => normalizeCurrencyCode(value)).toThrow(BadRequestException);
  });
});
