import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    console.error('Action Error:', e);
    return 'Errore interno del server.';
  },
});

export const authAction = actionClient.use(async ({ next }) => {
  const session = { user: { id: '123' }, tenant: { id: 'tenant_A' } };

  if (!session.user || !session.tenant) {
    throw new Error('Unauthorized');
  }

  return next({
    ctx: {
      userId: session.user.id,
      tenantId: session.tenant.id,
    },
  });
});
