import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { isCredentialUuid, requireCredentialUuid } from './tenant-credentials-uuid';

describe('tenant credentials UUID validation', () => {
  it('accetta UUID reali validi dalla produzione', () => {
    expect(isCredentialUuid('13be3fc9-0186-4ae5-975e-8b85b4c56d05')).toBe(true);
    expect(isCredentialUuid('d71b7039-30ea-498c-bd2a-06644a9c3ce2')).toBe(true);
    expect(requireCredentialUuid('13be3fc9-0186-4ae5-975e-8b85b4c56d05', 'credential_id')).toBe('13be3fc9-0186-4ae5-975e-8b85b4c56d05');
  });

  it('accetta randomUUID e forma gen_random_uuid v4', () => {
    expect(isCredentialUuid(randomUUID())).toBe(true);
    expect(isCredentialUuid('9f1d97c0-8375-4ad1-a5d0-bc6f41e6807f')).toBe(true);
  });

  it('rifiuta placeholder v0, UUID incompleti e stringhe senza quarto trattino', () => {
    expect(() => requireCredentialUuid('00000000-0000-0000-0000-000000000001', 'credential_id')).toThrow(BadRequestException);
    expect(() => requireCredentialUuid('13be3fc9-0186-4ae5-975e8b85b4c56d05', 'credential_id')).toThrow(BadRequestException);
    expect(() => requireCredentialUuid('not-a-uuid', 'credential_id')).toThrow(BadRequestException);
  });
});
