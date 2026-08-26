import { createHash } from 'crypto';

export type CutoverQueryable = {
  query(sql: string, parameters?: unknown[]): Promise<any[]>;
};

export type DoflowCeoFingerprint = {
  alias: `owner_${number}`;
  tenantPresent: boolean;
  publicMirrorPresent: boolean;
  uuidMatches: boolean;
  ownerRole: boolean;
  publicOwnerRole: boolean;
  active: boolean;
  publicActive: boolean;
  mfaEnabled: boolean;
  publicMfaEnabled: boolean;
  emailVerified: boolean;
  publicEmailVerified: boolean;
  tenantBindingMatches: boolean;
  fingerprints: {
    uuid: string;
    passwordHash: string;
    authProvider: string;
    googleId: string;
    mfaSecret: string;
    avatar: string;
    preferences: string;
    tenant: string;
    role: string;
    membership: string;
    roles: string;
    capabilities: string;
    publicMirror: string;
    references: string;
  };
};

export type DoflowCutoverSnapshot = {
  capturedAt: string;
  tenant: {
    present: boolean;
    schemaPresent: boolean;
    bindingValid: boolean;
  };
  ceo: DoflowCeoFingerprint[];
  counts: Record<string, number>;
  economics: Record<string, string>;
  relations: Record<string, number>;
  duplicates: Record<string, number>;
  registries: Record<string, number>;
  secondTenant: {
    tenantCount: number;
    fingerprint: string;
  };
  reconciliation: {
    ceoPresent: boolean;
    relationIssues: number;
    duplicateIssues: number;
    ready: boolean;
  };
  fingerprint: string;
};

type ProtectedOwnerAccount = {
  alias: `owner_${number}`;
  email: string;
};

const DOMAIN_TABLES: Record<string, string> = {
  users: 'users',
  companies: 'companies',
  contacts: 'contacts',
  leads: 'leads',
  opportunities: 'opportunities',
  activities: 'commercial_activities',
  projects: 'projects',
  tasks: 'tasks',
  quotes: 'quotes',
  orders: 'orders',
  payments: 'payments',
  contracts: 'contracts',
  invoices: 'invoices',
  renewals: 'renewals',
  documents: 'documents',
  comments: 'record_comments',
  notifications: 'notifications',
  automations: 'automation_rules',
  automationRuleVersions: 'automation_rule_versions',
  ledger: 'point_ledger',
  ranking: 'ranking_snapshots',
};

const REGISTRY_TABLES = [
  'commercial_idempotency',
  'delivery_idempotency',
  'commerce_idempotency',
  'collaboration_idempotency',
  'automation_execution_registry',
  'performance_event_registry',
  'doflow_migration_runs',
] as const;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function shortCutoverFingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex').slice(0, 16);
}

function safeIdentifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Unsafe database identifier in cutover snapshot.');
  return value;
}

async function schemaExists(db: CutoverQueryable, schema: string) {
  const rows = await db.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name=$1) AS present`,
    [schema],
  );
  return rows[0]?.present === true;
}

async function tableExists(db: CutoverQueryable, schema: string, table: string) {
  const rows = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema=$1 AND table_name=$2 AND table_type='BASE TABLE'
     ) AS present`,
    [schema, table],
  );
  return rows[0]?.present === true;
}

async function countTable(db: CutoverQueryable, schema: string, table: string) {
  if (!(await tableExists(db, schema, table))) return 0;
  const safeSchema = safeIdentifier(schema);
  const safeTable = safeIdentifier(table);
  const rows = await db.query(`SELECT COUNT(*)::int AS count FROM "${safeSchema}"."${safeTable}"`);
  return Number(rows[0]?.count || 0);
}

async function scalarCount(db: CutoverQueryable, sql: string, parameters: unknown[] = []) {
  const rows = await db.query(sql, parameters);
  return Number(rows[0]?.count || 0);
}

async function captureCeo(
  db: CutoverQueryable,
  account: ProtectedOwnerAccount,
  tenantId: string | null,
): Promise<DoflowCeoFingerprint> {
  const tenantRows = await db.query(
    `SELECT id::text, password_hash, role, auth_provider, google_id, avatar_url,
            email_verified_at, mfa_enabled, mfa_secret, is_active
       FROM doflow.users WHERE lower(email)=lower($1) LIMIT 1`,
    [account.email],
  );
  const publicRows = await db.query(
    `SELECT id::text, password_hash, role, tenant_id::text, auth_provider, google_id,
            avatar_url, email_verified_at, mfa_enabled, mfa_secret, is_active
       FROM public.users WHERE lower(email)=lower($1) LIMIT 1`,
    [account.email],
  );
  const tenant = tenantRows[0] || null;
  const mirror = publicRows[0] || null;
  const tenantIdValue = tenantId || '';

  const preferences = tenant && await tableExists(db, 'doflow', 'doflow_user_preferences')
    ? await db.query(`SELECT preferences FROM doflow.doflow_user_preferences WHERE user_id=$1 ORDER BY user_id`, [tenant.id])
    : [];
  const membership = tenant && await tableExists(db, 'doflow', 'team_members')
    ? await db.query(
      `SELECT id::text, user_id::text, lower(email) AS email, display_name,
              tenant_role, operational_role, employment_type, status, metadata
         FROM doflow.team_members WHERE user_id=$1 AND deleted_at IS NULL ORDER BY id`,
      [tenant.id],
    )
    : [];
  const roles = tenant && await tableExists(db, 'doflow', 'doflow_user_roles')
    ? await db.query(`SELECT role FROM doflow.doflow_user_roles WHERE user_id=$1 ORDER BY role`, [tenant.id])
    : [];
  const capabilities = tenant && await tableExists(db, 'doflow', 'doflow_user_capabilities')
    ? await db.query(`SELECT capability FROM doflow.doflow_user_capabilities WHERE user_id=$1 ORDER BY capability`, [tenant.id])
    : [];

  const references: Record<string, unknown> = {};
  if (tenant && await tableExists(db, 'doflow', 'companies')) {
    references.companies = await db.query(
      `SELECT id::text FROM doflow.companies WHERE owner_user_id=$1 ORDER BY id`,
      [tenant.id],
    );
  }
  if (tenant && await tableExists(db, 'doflow', 'projects')) {
    references.projects = await db.query(
      `SELECT id::text, company_id::text, project_manager_id::text, created_by::text, updated_by::text
         FROM doflow.projects
        WHERE project_manager_id=$1 OR created_by=$1 OR updated_by=$1
        ORDER BY id`,
      [tenant.id],
    );
  }

  return {
    alias: account.alias,
    tenantPresent: Boolean(tenant),
    publicMirrorPresent: Boolean(mirror),
    uuidMatches: Boolean(tenant && mirror && tenant.id === mirror.id),
    ownerRole: tenant?.role === 'owner',
    publicOwnerRole: mirror?.role === 'owner',
    active: tenant?.is_active === true,
    publicActive: mirror?.is_active === true,
    mfaEnabled: tenant?.mfa_enabled === true,
    publicMfaEnabled: mirror?.mfa_enabled === true,
    emailVerified: Boolean(tenant?.email_verified_at),
    publicEmailVerified: Boolean(mirror?.email_verified_at),
    tenantBindingMatches: Boolean(mirror && tenantIdValue && mirror.tenant_id === tenantIdValue),
    fingerprints: {
      uuid: shortCutoverFingerprint(tenant?.id || null),
      passwordHash: shortCutoverFingerprint(tenant?.password_hash || null),
      authProvider: shortCutoverFingerprint(tenant?.auth_provider || null),
      googleId: shortCutoverFingerprint(tenant?.google_id || null),
      mfaSecret: shortCutoverFingerprint(tenant?.mfa_secret || null),
      avatar: shortCutoverFingerprint(tenant?.avatar_url || null),
      preferences: shortCutoverFingerprint(preferences),
      tenant: shortCutoverFingerprint(tenantIdValue || null),
      role: shortCutoverFingerprint(tenant?.role || null),
      membership: shortCutoverFingerprint(membership),
      roles: shortCutoverFingerprint(roles),
      capabilities: shortCutoverFingerprint(capabilities),
      publicMirror: shortCutoverFingerprint(mirror),
      references: shortCutoverFingerprint(references),
    },
  };
}

async function discoverProtectedOwnerAccounts(db: CutoverQueryable): Promise<ProtectedOwnerAccount[]> {
  const rows = await db.query(
    `SELECT lower(email) AS email
       FROM doflow.users
      WHERE lower(role) = 'owner' AND is_active = true
      ORDER BY lower(email)`,
  );
  return rows.map((row, index) => ({
    alias: `owner_${index + 1}` as ProtectedOwnerAccount['alias'],
    email: String(row.email),
  }));
}

async function captureSecondTenant(db: CutoverQueryable) {
  const tenants = await db.query(
    `SELECT slug, schema_name FROM public.tenants
      WHERE lower(slug) <> 'doflow' ORDER BY slug, schema_name`,
  );
  const evidence: unknown[] = [];
  for (const tenant of tenants) {
    const schema = String(tenant.schema_name || '');
    if (!/^[a-z_][a-z0-9_]*$/.test(schema) || !(await schemaExists(db, schema))) {
      evidence.push({ binding: shortCutoverFingerprint(tenant), schemaPresent: false });
      continue;
    }
    const tables: Record<string, unknown> = {};
    for (const table of ['users', 'companies', 'contacts', 'leads', 'opportunities', 'projects', 'orders', 'payments']) {
      if (!(await tableExists(db, schema, table))) continue;
      const rows = await db.query(
        `SELECT COUNT(*)::int AS count,
                md5(COALESCE(string_agg(md5(row_to_json(t)::text), ',' ORDER BY id::text), '')) AS rows
           FROM "${safeIdentifier(schema)}"."${safeIdentifier(table)}" t`,
      );
      tables[table] = rows[0];
    }
    evidence.push({ binding: shortCutoverFingerprint(tenant), tables });
  }
  return { tenantCount: tenants.length, fingerprint: shortCutoverFingerprint(evidence) };
}

async function captureCounts(db: CutoverQueryable) {
  const counts: Record<string, number> = {};
  for (const [domain, table] of Object.entries(DOMAIN_TABLES)) {
    counts[domain] = await countTable(db, 'doflow', table);
  }
  counts.refunds = await tableExists(db, 'doflow', 'payments')
    ? await scalarCount(db, `SELECT COUNT(*)::int AS count FROM doflow.payments WHERE payment_type='refund' AND deleted_at IS NULL`)
    : 0;
  counts.creditNotes = await tableExists(db, 'doflow', 'invoices')
    ? await scalarCount(db, `SELECT COUNT(*)::int AS count FROM doflow.invoices WHERE type='credit_note' AND deleted_at IS NULL`)
    : 0;
  return counts;
}

async function captureEconomics(db: CutoverQueryable) {
  if (!(await tableExists(db, 'doflow', 'orders')) || !(await tableExists(db, 'doflow', 'payments'))) return {};
  const rows = await db.query(`
    SELECT
      (SELECT COALESCE(SUM(total),0)::text FROM doflow.orders WHERE deleted_at IS NULL) AS orders_total,
      (SELECT COALESCE(SUM(amount),0)::text FROM doflow.payments
        WHERE deleted_at IS NULL AND payment_type='payment' AND status='confirmed') AS payments_gross,
      (SELECT COALESCE(SUM(amount),0)::text FROM doflow.payments
        WHERE deleted_at IS NULL AND payment_type='refund' AND status='confirmed') AS refunds_total,
      (SELECT COALESCE(SUM(total),0)::text FROM doflow.invoices
        WHERE deleted_at IS NULL AND type <> 'credit_note') AS invoices_total,
      (SELECT COALESCE(SUM(total),0)::text FROM doflow.invoices
        WHERE deleted_at IS NULL AND type='credit_note') AS credit_notes_total
  `);
  return Object.fromEntries(Object.entries(rows[0] || {}).map(([key, value]) => [key, String(value ?? '0')]));
}

async function captureRelations(db: CutoverQueryable) {
  const checks: Record<string, number> = {};
  const relationQueries: Record<string, { tables: string[]; sql: string }> = {
    contactsWithoutCompany: { tables: ['contacts', 'companies'], sql: `SELECT COUNT(*)::int AS count FROM doflow.contacts x LEFT JOIN doflow.companies p ON p.id=x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL` },
    leadsWithoutCompany: { tables: ['leads', 'companies'], sql: `SELECT COUNT(*)::int AS count FROM doflow.leads x LEFT JOIN doflow.companies p ON p.id=x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL` },
    opportunitiesWithoutLead: { tables: ['opportunities', 'leads'], sql: `SELECT COUNT(*)::int AS count FROM doflow.opportunities x LEFT JOIN doflow.leads p ON p.id=x.lead_id WHERE x.lead_id IS NOT NULL AND p.id IS NULL` },
    projectsWithoutCompany: { tables: ['projects', 'companies'], sql: `SELECT COUNT(*)::int AS count FROM doflow.projects x LEFT JOIN doflow.companies p ON p.id=x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL` },
    tasksWithoutProject: { tables: ['tasks', 'projects'], sql: `SELECT COUNT(*)::int AS count FROM doflow.tasks x LEFT JOIN doflow.projects p ON p.id=x.project_id WHERE x.project_id IS NOT NULL AND p.id IS NULL` },
    ordersWithoutCompany: { tables: ['orders', 'companies'], sql: `SELECT COUNT(*)::int AS count FROM doflow.orders x LEFT JOIN doflow.companies p ON p.id=x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL` },
    paymentsWithoutOrder: { tables: ['payments', 'orders'], sql: `SELECT COUNT(*)::int AS count FROM doflow.payments x LEFT JOIN doflow.orders p ON p.id=x.order_id WHERE x.order_id IS NOT NULL AND p.id IS NULL` },
    contractsWithoutCompany: { tables: ['contracts', 'companies'], sql: `SELECT COUNT(*)::int AS count FROM doflow.contracts x LEFT JOIN doflow.companies p ON p.id=x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL` },
    invoicesWithoutCompany: { tables: ['invoices', 'companies'], sql: `SELECT COUNT(*)::int AS count FROM doflow.invoices x LEFT JOIN doflow.companies p ON p.id=x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL` },
  };
  for (const [name, check] of Object.entries(relationQueries)) {
    let available = true;
    for (const table of check.tables) {
      if (!(await tableExists(db, 'doflow', table))) {
        available = false;
        break;
      }
    }
    checks[name] = available ? await scalarCount(db, check.sql) : 0;
  }
  return checks;
}

async function captureDuplicates(db: CutoverQueryable) {
  const checks: Record<string, number> = {};
  if (await tableExists(db, 'doflow', 'orders')) {
    checks.orderCodes = await scalarCount(db, `SELECT COUNT(*)::int AS count FROM (SELECT lower(code) FROM doflow.orders WHERE deleted_at IS NULL GROUP BY lower(code) HAVING COUNT(*)>1) d`);
  }
  if (await tableExists(db, 'doflow', 'payments')) {
    checks.paymentReferences = await scalarCount(db, `SELECT COUNT(*)::int AS count FROM (SELECT order_id,lower(reference) FROM doflow.payments WHERE deleted_at IS NULL AND reference IS NOT NULL GROUP BY order_id,lower(reference) HAVING COUNT(*)>1) d`);
  }
  if (await tableExists(db, 'doflow', 'record_comments')) {
    checks.legacyComments = await scalarCount(db, `SELECT COUNT(*)::int AS count FROM (SELECT legacy_source_type,legacy_source_id FROM doflow.record_comments WHERE legacy_source_id IS NOT NULL GROUP BY legacy_source_type,legacy_source_id HAVING COUNT(*)>1) d`);
  }
  if (await tableExists(db, 'doflow', 'point_ledger')) {
    checks.ledgerOperations = await scalarCount(db, `SELECT COUNT(*)::int AS count FROM (SELECT operation_id,event_type,user_id FROM doflow.point_ledger GROUP BY operation_id,event_type,user_id HAVING COUNT(*)>1) d`);
  }
  return checks;
}

async function captureRegistries(db: CutoverQueryable) {
  const registries: Record<string, number> = {};
  for (const table of REGISTRY_TABLES) registries[table] = await countTable(db, 'doflow', table);
  return registries;
}

export async function captureDoflowCutoverSnapshot(db: CutoverQueryable): Promise<DoflowCutoverSnapshot> {
  const tenantRows = await db.query(
    `SELECT id::text, slug, schema_name, is_active FROM public.tenants
      WHERE lower(slug)='doflow' LIMIT 1`,
  );
  const binding = tenantRows[0] || null;
  const doflowSchemaPresent = await schemaExists(db, 'doflow');
  const tenant = {
    present: Boolean(binding),
    schemaPresent: doflowSchemaPresent,
    bindingValid: Boolean(binding && binding.schema_name === 'doflow' && binding.is_active === true),
  };
  if (!doflowSchemaPresent) {
    const empty = {
      capturedAt: new Date().toISOString(), tenant, ceo: [], counts: {}, economics: {}, relations: {}, duplicates: {}, registries: {},
      secondTenant: await captureSecondTenant(db), reconciliation: { ceoPresent: false, relationIssues: 0, duplicateIssues: 0, ready: false },
    };
    return { ...empty, fingerprint: shortCutoverFingerprint(empty) };
  }

  const ceo: DoflowCeoFingerprint[] = [];
  const protectedOwners = await discoverProtectedOwnerAccounts(db);
  for (const account of protectedOwners) ceo.push(await captureCeo(db, account, binding?.id || null));
  const counts = await captureCounts(db);
  const economics = await captureEconomics(db);
  const relations = await captureRelations(db);
  const duplicates = await captureDuplicates(db);
  const registries = await captureRegistries(db);
  const secondTenant = await captureSecondTenant(db);
  const ceoPresent = ceo.length >= 2 && ceo.every((account) =>
    account.tenantPresent
    && account.publicMirrorPresent
    && account.uuidMatches
    && account.ownerRole
    && account.publicOwnerRole
    && account.active
    && account.publicActive
    && account.tenantBindingMatches,
  );
  const relationIssues = Object.values(relations).reduce((sum, value) => sum + value, 0);
  const duplicateIssues = Object.values(duplicates).reduce((sum, value) => sum + value, 0);
  const payload = {
    capturedAt: new Date().toISOString(), tenant, ceo, counts, economics, relations, duplicates, registries, secondTenant,
    reconciliation: { ceoPresent, relationIssues, duplicateIssues, ready: tenant.bindingValid && ceoPresent && relationIssues === 0 && duplicateIssues === 0 },
  };
  const fingerprintPayload = { ...payload, capturedAt: undefined };
  return { ...payload, fingerprint: shortCutoverFingerprint(fingerprintPayload) };
}

export function compareCeoPreservation(before: DoflowCeoFingerprint[], after: DoflowCeoFingerprint[]) {
  const accounts = before.map((account) => {
    const next = after.find((candidate) => candidate.alias === account.alias);
    return { alias: account.alias, preserved: Boolean(next && canonical(account) === canonical(next)) };
  });
  return { preserved: accounts.length === 2 && accounts.every((account) => account.preserved), accounts };
}

export function compareSecondTenantPreservation(
  before: DoflowCutoverSnapshot['secondTenant'],
  after: DoflowCutoverSnapshot['secondTenant'],
) {
  return {
    preserved: before.tenantCount === after.tenantCount && before.fingerprint === after.fingerprint,
    tenantCountBefore: before.tenantCount,
    tenantCountAfter: after.tenantCount,
  };
}
