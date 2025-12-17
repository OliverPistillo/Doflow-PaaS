'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

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

type HealthCheck = {
  status: HealthStatus;
  latency_ms?: number;
  message?: string;
};

type HealthResponse = {
  status: HealthStatus;
  checks: {
    api?: HealthCheck;
    db?: HealthCheck;
    redis?: HealthCheck;
    ws?: HealthCheck;
    storage?: HealthCheck;
    [k: string]: HealthCheck | undefined;
  };
  ts?: string;
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('doflow_token');
}

function statusColors(status: HealthStatus) {
  // badge + dot
  switch (status) {
    case 'ok':
      return {
        badge: 'border-border bg-accent text-foreground',
        dot: 'bg-emerald-500',
        title: 'OK',
      };
    case 'warn':
      return {
        badge: 'border-border bg-muted text-foreground',
        dot: 'bg-amber-500',
        title: 'Warn',
      };
    case 'down':
    default:
      return {
        badge: 'border-border bg-muted text-foreground',
        dot: 'bg-red-500',
        title: 'Down',
      };
  }
}

function StatusPill({
  label,
  check,
}: {
  label: string;
  check?: HealthCheck;
}) {
  const status = check?.status ?? 'warn';
  const { badge, dot, title } = statusColors(status);

  const latency =
    typeof check?.latency_ms === 'number' ? `${check.latency_ms}ms` : undefined;

  const hint =
    check?.message ? check.message : latency ? latency : undefined;

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        badge,
      )}
      title={hint ? `${title} • ${hint}` : title}
    >
      <span className={cx('mr-1 inline-block h-2 w-2 rounded-full', dot)} />
      {label}
      {latency ? <span className="ml-1 text-[10px] text-muted-foreground">({latency})</span> : null}
    </span>
  );
}

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

export default function SuperadminDashboardPage() {
  const router = useRouter();

  const [tenants, setTenants] = React.useState<TenantRow[]>([]);
  const [loadingTenants, setLoadingTenants] = React.useState(true);
  const [errorTenants, setErrorTenants] = React.useState<string | null>(null);

  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = React.useState(true);
  const [errorHealth, setErrorHealth] = React.useState<string | null>(null);
  const [lastHealthAt, setLastHealthAt] = React.useState<string | null>(null);

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
      const msg = e instanceof Error ? e.message : 'Errore caricamento tenants';
      setErrorTenants(msg);
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  const loadHealth = React.useCallback(async () => {
    setLoadingHealth(true);
    setErrorHealth(null);

    try {
      // 🔥 IMPORTANTE: usa /api/health/system (coerente con gli altri endpoint)
      const data = await apiFetch<HealthResponse>('/api/health/system', {
        headers: { 'x-doflow-tenant-id': 'public' },
        cache: 'no-store',
      });

      setHealth(data);
      setLastHealthAt(new Date().toISOString());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore caricamento health';
      setErrorHealth(msg);
      setHealth(null);
      setLastHealthAt(new Date().toISOString());
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTenants();
    void loadHealth();
  }, [loadTenants, loadHealth]);

  // refresh health automatico
  React.useEffect(() => {
    const t = window.setInterval(() => {
      void loadHealth();
    }, 15000);
    return () => window.clearInterval(t);
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
        const da = a.created_at ? Date.parse(a.created_at) : 0;
        const db = b.created_at ? Date.parse(b.created_at) : 0;
        return db - da;
      })
      .slice(0, 6);
  }, [tenants]);

  function openTenant(slug: string) {
    window.location.href = `https://${slug}.doflow.it/admin/users`;
  }

  const checks = health?.checks ?? {};
  const overallStatus: HealthStatus = health?.status ?? (errorHealth ? 'down' : 'warn');
  const overall = statusColors(overallStatus);

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
            Vista operativa globale — tenants, stato e accesso rapido.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadHealth();
              void loadTenants();
            }}
            disabled={loadingTenants || loadingHealth}
          >
            {(loadingTenants || loadingHealth) ? 'Aggiorno…' : 'Aggiorna'}
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
          <div className="text-sm font-medium">Errore health</div>
          <div className="text-sm text-muted-foreground mt-1 break-words">{errorHealth}</div>
        </Card>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Tenants totali" value={loadingTenants ? '—' : kpi.total} />
        <MetricCard label="Tenants attivi" value={loadingTenants ? '—' : kpi.active} />
        <MetricCard label="Tenants disabilitati" value={loadingTenants ? '—' : kpi.disabled} />
      </div>

      {/* System status (REALE) */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">System status</div>
              <span
                className={cx(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  overall.badge
                )}
                title={overall.title}
              >
                <span className={cx('mr-1 inline-block h-2 w-2 rounded-full', overall.dot)} />
                {overallStatus.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {lastHealthAt ? `Ultimo check: ${new Date(lastHealthAt).toLocaleTimeString()}` : '—'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill label="API" check={checks.api} />
            <StatusPill label="DB" check={checks.db} />
            <StatusPill label="Redis" check={checks.redis} />
            <StatusPill label="Realtime" check={checks.ws} />
            <StatusPill label="Storage" check={checks.storage} />
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Quick actions</div>
          </div>

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
            Nota: “Audit tenant corrente” qui è utile solo per debug. Audit globale = step futuro.
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
            Regola d’oro: qui non sei “un tenant”, sei l’amministratore del condominio.
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
                        className={cx(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          t.is_active ? 'border-border bg-accent text-foreground' : 'border-border bg-muted text-muted-foreground'
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
