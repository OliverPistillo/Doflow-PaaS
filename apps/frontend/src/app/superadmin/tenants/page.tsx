'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.doflow.it';

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type JwtPayload = {
  email?: string;
  role?: string;
};

type ListTenantsResponse = {
  tenants: TenantRow[];
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'border-border bg-accent text-foreground'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {active ? 'active' : 'disabled'}
    </span>
  );
}

function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-lg border border-border bg-card text-card-foreground shadow-xl">
          <div className="p-4 border-b border-border">
            <div className="text-sm font-semibold">{title}</div>
            {description ? (
              <div className="text-xs text-muted-foreground mt-1">{description}</div>
            ) : null}
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('doflow_token');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;

    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(json);

    if (!isRecord(parsed)) return null;

    const email = typeof parsed.email === 'string' ? parsed.email : undefined;
    const role = typeof parsed.role === 'string' ? parsed.role : undefined;

    return { email, role };
  } catch {
    return null;
  }
}

function errorMessage(e: unknown, fallback: string) {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'string') return e || fallback;
  return fallback;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  // Normalizza base e path
  const base = (API_BASE || '').replace(/\/+$/, ''); // no trailing /
  const cleanPath = `/${path.replace(/^\/+/, '')}`;  // always starts with /
  const url = `${base}/api${cleanPath}`;             // <-- globalPrefix

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });

  const text = await res.text().catch(() => '');

  if (!res.ok) {
    // prova a estrarre message/error JSON se presente
    try {
      const j = JSON.parse(text) as { message?: string; error?: string };
      throw new Error(j.message || j.error || text || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }

  return (text ? (JSON.parse(text) as T) : (null as T));
}


export default function SuperadminTenantsPage() {
  const router = useRouter();

  const [tenants, setTenants] = React.useState<TenantRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<'all' | 'active' | 'disabled'>('all');

  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [slug, setSlug] = React.useState('');
  const [name, setName] = React.useState('');
  const [schemaName, setSchemaName] = React.useState('');
  const [adminEmail, setAdminEmail] = React.useState('');
  const [adminPassword, setAdminPassword] = React.useState('');

  const [confirm, setConfirm] = React.useState<null | { tenant: TenantRow }>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    // keep this (optional): it validates token shape early and prevents weird states
    void parseJwtPayload(token);
  }, [router]);

  const loadTenants = React.useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const data = await apiJson<ListTenantsResponse>('/superadmin/tenants', {
      headers: { 'x-doflow-tenant-id': 'public' },
    });

    setTenants(Array.isArray(data?.tenants) ? data.tenants : []);
  } catch (e: unknown) {
    setError(errorMessage(e, 'Errore caricamento tenants'));
  } finally {
    setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const kpi = React.useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.is_active).length;
    const disabled = total - active;
    return { total, active, disabled };
  }, [tenants]);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();

    return tenants.filter((t) => {
      const okStatus =
        status === 'all' ? true : status === 'active' ? t.is_active : !t.is_active;

      if (!okStatus) return false;
      if (!query) return true;

      return (
        t.slug.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        (t.schema_name || '').toLowerCase().includes(query)
      );
    });
  }, [tenants, q, status]);

  function openTenant(slugValue: string) {
    window.location.href = `https://${slugValue}.doflow.it/admin/users`;
  }

  function copyUrl(slugValue: string) {
    const url = `https://${slugValue}.doflow.it`;
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  async function toggleActive(tenant: TenantRow) {
    setBusyId(tenant.id);
    setError(null);

    try {
      await apiJson(`superadmin/tenants/${tenant.id}/toggle-active`, { method: 'POST' });
      await loadTenants();
    } catch (e: unknown) {
      setError(errorMessage(e, 'Errore aggiornamento tenant'));
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      await apiJson('superadmin/tenants', {
        method: 'POST',
        body: JSON.stringify({
          slug: slug.trim().toLowerCase(),
          name: name.trim(),
          schema_name: schemaName.trim() ? schemaName.trim().toLowerCase() : undefined,
          admin_email: adminEmail.trim().toLowerCase(),
          admin_password: adminPassword,
        }),
      });

      setCreateOpen(false);
      setSlug('');
      setName('');
      setSchemaName('');
      setAdminEmail('');
      setAdminPassword('');

      await loadTenants();
    } catch (e: unknown) {
      setError(errorMessage(e, 'Errore creazione tenant'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Control Plane — crea tenant, gestisci stato e accedi al runtime.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTenants} disabled={loading}>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </Button>
          <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}>
            + Crea tenant
          </Button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <Card className="p-3">
          <div className="text-sm font-medium">Errore</div>
          <div className="text-sm text-muted-foreground mt-1 break-words">{error}</div>
        </Card>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Totali</div>
          <div className="text-2xl font-semibold mt-1">{kpi.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Attivi</div>
          <div className="text-2xl font-semibold mt-1">{kpi.active}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Disabilitati</div>
          <div className="text-2xl font-semibold mt-1">{kpi.disabled}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="q">Cerca</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="slug, nome, schema…"
            />
          </div>

          <div className="w-full md:w-56">
            <Label htmlFor="status">Stato</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'disabled')}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Tutti</option>
              <option value="active">Attivi</option>
              <option value="disabled">Disabilitati</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Elenco tenant</div>
          <div className="text-xs text-muted-foreground">
            {loading ? '…' : `${filtered.length} risultati`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium px-4 py-3">Slug</th>
                <th className="text-left font-medium px-4 py-3">Nome</th>
                <th className="text-left font-medium px-4 py-3">Schema</th>
                <th className="text-left font-medium px-4 py-3">Stato</th>
                <th className="text-right font-medium px-4 py-3">Azioni</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    Caricamento tenants…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    Nessun tenant trovato.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-medium">{t.slug}</td>
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.schema_name || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge active={t.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyUrl(t.slug)}>
                          Copia URL
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => openTenant(t.slug)}>
                          Entra
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirm({ tenant: t })}
                          disabled={busyId === t.id}
                        >
                          {t.is_active ? 'Disabilita' : 'Attiva'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create modal */}
      <Modal
        open={createOpen}
        title="Crea tenant"
        description="Crea schema, tabelle e primo admin (bootstrap completo)."
        onClose={() => !creating && setCreateOpen(false)}
      >
        <form onSubmit={onCreate} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="es. acme"
                required
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                URL: https://{`{slug}`}.doflow.it
              </div>
            </div>
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Srl"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="schema_name">Schema name (opzionale)</Label>
            <Input
              id="schema_name"
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value)}
              placeholder="es. tenant_acme"
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              Se vuoto, il backend userà lo slug come schema_name.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="admin_email">Admin email</Label>
              <Input
                id="admin_email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@acme.it"
                required
              />
            </div>
            <div>
              <Label htmlFor="admin_password">Admin password</Label>
              <Input
                id="admin_password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="min 8 caratteri"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Annulla
            </Button>
            <Button variant="default" type="submit" disabled={creating}>
              {creating ? 'Creo…' : 'Crea tenant'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm toggle */}
      <Modal
        open={!!confirm}
        title={confirm?.tenant.is_active ? 'Disabilita tenant' : 'Attiva tenant'}
        description={confirm ? `${confirm.tenant.slug} — ${confirm.tenant.name}` : undefined}
        onClose={() => (busyId ? null : setConfirm(null))}
      >
        <div className="text-sm">
          {confirm?.tenant.is_active
            ? 'Confermi la disattivazione? Il tenant diventerà inaccessibile agli utenti.'
            : 'Confermi l’attivazione? Il tenant tornerà accessibile.'}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={!!busyId}>
            Annulla
          </Button>
          <Button
            variant="default"
            onClick={() => confirm && toggleActive(confirm.tenant)}
            disabled={!!busyId}
          >
            {busyId ? 'Applico…' : 'Conferma'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
