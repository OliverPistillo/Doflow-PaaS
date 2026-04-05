/**
 * schema.utils.ts — Utility centralizzata per la sanitizzazione dei nomi schema PostgreSQL.
 *
 * REGOLA: Tutti i nomi schema usati in query dinamiche DEVONO passare
 * per questa funzione. Non creare implementazioni locali di safeSchema.
 *
 * FORMATO SLUG TENANT: solo a-z, 0-9, underscore.
 * I trattini (-) vengono normalizzati in underscore (_) durante la creazione del tenant.
 */

/** Caratteri validi per un nome schema PostgreSQL usato in DoFlow. */
const VALID_SCHEMA_RE = /^[a-z0-9_]+$/;

/**
 * Sanitizza e valida un nome schema PostgreSQL.
 *
 * @param input   - Lo slug/schema grezzo (può venire da JWT, header, DB).
 * @param context - Stringa descrittiva per i log di errore (es. "AuthService.login").
 * @returns       - Il nome schema sanificato (lowercase, trimmed).
 * @throws        - Error se il nome non è valido (mai silenziato: fail-fast).
 *
 * @example
 *   safeSchema('oliver_pistillo')  // → 'oliver_pistillo'
 *   safeSchema('PUBLIC')           // → 'public'
 *   safeSchema('oliver-pistillo')  // → Error (trattini non ammessi negli schema)
 *   safeSchema('')                 // → Error
 */
export function safeSchema(input: string, context = 'unknown'): string {
  const s = String(input ?? '').trim().toLowerCase();

  if (!s) {
    throw new Error(`[safeSchema @ ${context}] Schema name cannot be empty.`);
  }

  if (!VALID_SCHEMA_RE.test(s)) {
    throw new Error(
      `[safeSchema @ ${context}] Invalid schema name: "${s}". ` +
      `Only a-z, 0-9 and underscore are allowed. ` +
      `Tenant slugs with hyphens must be normalized to underscores at creation time.`,
    );
  }

  return s;
}

/**
 * Versione "soft" per contesti in cui un fallback su 'public' è accettabile
 * (es. middleware di routing dove il tenant è opzionale).
 *
 * NON usare questa versione in query che scrivono dati — usare sempre `safeSchema`.
 */
export function safeSchemaOrPublic(input: string | undefined | null): string {
  if (!input) return 'public';
  const s = String(input).trim().toLowerCase();
  if (!s || !VALID_SCHEMA_RE.test(s)) return 'public';
  return s;
}

/**
 * Normalizza uno slug di tenant per l'uso come nome schema PostgreSQL.
 * Sostituisce i trattini con underscore e rimuove caratteri non validi.
 * Da usare ESCLUSIVAMENTE al momento della creazione di un nuovo tenant.
 *
 * @example
 *   normalizeSlugToSchema('oliver-pistillo')  // → 'oliver_pistillo'
 *   normalizeSlugToSchema('Azienda SpA')      // → 'azienda_spa'
 */
export function normalizeSlugToSchema(slug: string): string {
  const s = String(slug ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')        // trattini → underscore
    .replace(/[^a-z0-9_]/g, '') // rimuove tutto il resto
    .replace(/^_+|_+$/g, '');   // trim underscores iniziali/finali

  if (!s) {
    throw new Error(`Cannot normalize empty slug to schema name.`);
  }

  return s;
}
