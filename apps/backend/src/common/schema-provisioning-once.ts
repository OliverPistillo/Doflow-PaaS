type ProvisioningTarget = object;

const provisioningByTarget = new WeakMap<
  ProvisioningTarget,
  Map<string, Promise<void>>
>();

/**
 * Serializes idempotent schema-readiness work for the same target, schema and
 * bounded context. A success remains sticky for the target lifetime; failures
 * are evicted so the next request can retry.
 * PostgreSQL's IF NOT EXISTS does not make concurrent catalog creation safe:
 * two first requests can still race while creating the same relation/type.
 */
export function provisionSchemaOnce(
  target: ProvisioningTarget,
  key: string,
  provision: () => Promise<void>,
): Promise<void> {
  let provisions = provisioningByTarget.get(target);
  if (!provisions) {
    provisions = new Map<string, Promise<void>>();
    provisioningByTarget.set(target, provisions);
  }

  const existing = provisions.get(key);
  if (existing) return existing;

  let pending: Promise<void>;
  pending = Promise.resolve()
    .then(provision)
    .catch((error) => {
      if (provisions?.get(key) === pending) provisions.delete(key);
      throw error;
    });
  provisions.set(key, pending);
  return pending;
}
