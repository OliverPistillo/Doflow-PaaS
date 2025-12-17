'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type ListTenantsResponse = {
  tenants: TenantRow[];
};

type HealthStatus = 'ok' | 'warn' | 'down';
type HealthCheck = { status: HealthStatus; latency_ms?: number; message?: string };
type SystemHealthResponse = {
  status: HealthStatus;
  checks: {
    api: HealthCheck;
    db: HealthCheck;
    redis: HealthCheck;
    ws: HealthCheck;
    storage: HealthCheck;
  };
  ts: string;
};

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-2">{hint}</div> : null}
    </Card>
  );
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('doflow_token');
}

function StatusPill({
  label,
  check,
}: {
  label: string;
  check?: HealthCheck;
}) {
  const status = check?.status ?? 'down';

  const color =
    status === 'ok'
      ? 'bg-emerald-500'
      : status === 'warn'
      ? 'bg-amber-500'
      : 'bg-red-500';

  const borderBg =
    status === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-foreground'
      : status === 'warn'
      ? 'border-amber-500/30 bg-amber-500/10 text-foreground'
      : 'border-red-500/30 bg-red-500/10 text-foreground';

  const tooltipParts: string[] = [];
  if (check?.latency_ms != null) tooltipParts.push(`latency: ${check.latency_ms}ms`);
  if (check?.message) tooltipParts.push(check.message);
  const title = tooltipParts.length ? tooltipParts.join(' • ') : undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        borderBg,
      )}
      title={title}
    >
      <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', color)} />
      {label}
      {check?.latency_ms != null ? (
        <span className="ml-2 text-[10px] text-muted-foreground">{check.latency_ms}ms</span>
      ) : null}
    </span>
  );
}

function formatTs(ts?: string) {
  if (!ts) return '—';
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) return ts;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return ts;
  }
}

export default function SuperadminDashboardPage() {
  const router = useRouter();

  const [tenants, setTenants] = React.useState<TenantRow[]>([]);
  const [loadingTenants, setLoadingTenants] = React.useState(true);
  const [errorTenants, setErrorTenants] = React.useState<string | null>(null);

  const [health, setHealth] = React.useState<SystemHealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = React.useState(true);
  const [errorHealth, setErrorHealth] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = getToken();
    if (!token) router.push('/login');
  }, [router]);

  const loadTenants = React.useCallback(async () => {
    setLoadingTenants(true);
    setErrorTenants(null);

    try {
      const data = await apiFetch<ListTenantsResponse>('/api/superadmin/tenants', {
        headers: { 'x-doflow-tenant-id': 'public' },
        cache: 'no-store',
      });
      setTenants(Array.isArray(data?.tenants) ? data.tenants : []);
    } catch (e: unknown) {
      setErrorTenants(e instanceof Error ? e.message : 'Errore caricamento tenants');
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  const loadHealth = React.useCallback(async () => {
    setLoadingHealth(true);
    setErrorHealth(null);

    try {
      // Endpoint backend: GET /health/system  (tu lo esponi)
      const data = await apiFetch<SystemHealthResponse>('/api/health/system', {
        headers: { 'x-doflow-tenant-id': 'public' },
        cache: 'no-store',
      });

      // guardrail minimo
      if (!data?.checks) throw new Error('Risposta health non valida');
      setHealth(data);
    } catch (e: unknown) {
      setHealth(null);
      setErrorHealth(e instanceof Error ? e.message : 'Health check fallito');
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTenants();
    void loadHealth();
  }, [loadTenants, loadHealth]);

  // Polling health
  React.useEffect(() => {
    const id = window.setInterval(() => {
      void loadHealth();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [loadHealth]);

  const kpi = React.useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.is_active).length;
    const disabled = total - active;
    return { total, active, disabled };
  }, [tenants]);

  const recentTenants = React.useMemo(() => {
    return [...tenants]
      .sort((a, b) => {
        const da = a.created_at ? Date.parse(a.created_at) : -Infinity;
        const db = b.created_at ? Date.parse(b.created_at) : -Infinity;
        return db - da;
      })
      .slice(0, 6);
  }, [tenants]);

  function openTenant(slug: string) {
    window.location.assign(`https://${slug}.doflow.it/admin/users`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Super Admin</h1>
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium">
              Control Plane
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Vista operativa globale — tenants + stato infrastruttura.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTenants} disabled={loadingTenants}>
            {loadingTenants ? 'Aggiorno…' : 'Aggiorna tenants'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadHealth} disabled={loadingHealth}>
            {loadingHealth ? 'Check…' : 'Aggiorna health'}
          </Button>
          <Link href="/superadmin/tenants">
            <Button variant="default" size="sm">Gestisci tenants</Button>
          </Link>
        </div>
      </div>

      {/* Errors */}
      {errorTenants ? (
        <Card className="p-3">
          <div className="text-sm font-medium">Errore tenants</div>
          <div className="text-sm text-muted-foreground mt-1 break-words">{errorTenants}</div>
        </Card>
      ) : null}

      {errorHealth ? (
        <Card className="p-3">
          <div className="text-sm font-medium">Errore system health</div>
          <div className="text-sm text-muted-foreground mt-1 break-words">{errorHealth}</div>
        </Card>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Tenants totali" value={loadingTenants ? '—' : kpi.total} />
        <MetricCard label="Tenants attivi" value={loadingTenants ? '—' : kpi.active} />
        <MetricCard label="Tenants disabilitati" value={loadingTenants ? '—' : kpi.disabled} />
      </div>

      {/* System status (REAL) */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">System status</div>
            <div className="text-xs text-muted-foreground mt-1">
              Fonte: <span className="font-mono">/health/system</span> • ultimo update: {health ? formatTs(health.ts) : '—'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill label="API" check={health?.checks.api} />
            <StatusPill label="DB" check={health?.checks.db} />
            <StatusPill label="Redis" check={health?.checks.redis} />
            <StatusPill label="WS" check={health?.checks.ws} />
            <StatusPill label="Storage" check={health?.checks.storage} />
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold">Quick actions</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/superadmin/tenants">
              <Button variant="default" size="sm">+ Crea / gestisci tenant</Button>
            </Link>
            <Link href="/superadmin/tenants">
              <Button variant="outline" size="sm">Vai alla lista tenants</Button>
            </Link>
            <Link href="/admin/audit">
              <Button variant="outline" size="sm">Audit (tenant corrente)</Button>
            </Link>
            <Link href="/notifications-test">
              <Button variant="outline" size="sm">Test notifiche</Button>
            </Link>
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Nota: Health è globale. Audit qui è tenant corrente (debug).
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Contesto</div>
          <div className="mt-2 text-sm">
            Dominio: <span className="text-muted-foreground">app.doflow.it</span>
          </div>
          <div className="mt-1 text-sm">
            Tenant: <span className="text-muted-foreground">public</span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Qui governi il condominio. Se cade Redis, senti il boato prima degli inquilini.
          </div>
        </Card>
      </div>

      {/* Recent tenants */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Ultimi tenants</div>
          <div className="text-xs text-muted-foreground">
            {loadingTenants ? '…' : `${recentTenants.length} mostrati`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium px-4 py-3">Slug</th>
                <th className="text-left font-medium px-4 py-3">Nome</th>
                <th className="text-left font-medium px-4 py-3">Stato</th>
                <th className="text-right font-medium px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingTenants ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                    Caricamento…
                  </td>
                </tr>
              ) : recentTenants.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={4}>
                    Nessun tenant disponibile.
                  </td>
                </tr>
              ) : (
                recentTenants.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-medium">{t.slug}</td>
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          t.is_active ? 'border-border bg-accent text-foreground' : 'border-border bg-muted text-muted-foreground',
                        )}
                      >
                        {t.is_active ? 'active' : 'disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openTenant(t.slug)}>
                          Entra
                        </Button>
                        <Link href="/superadmin/tenants">
                          <Button variant="ghost" size="sm">Gestisci</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
