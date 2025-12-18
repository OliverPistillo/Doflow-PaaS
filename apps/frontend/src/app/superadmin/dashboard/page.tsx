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

type HealthLevel = 'ok' | 'warn' | 'down';

type HealthCheck = {
  status: HealthLevel;
  latency_ms?: number;
  message?: string;
};

type SystemHealthResponse = {
  status: HealthLevel;
  checks: {
    api?: HealthCheck;
    db?: HealthCheck;
    redis?: HealthCheck;
    ws?: HealthCheck;
    storage?: HealthCheck;
  };
  ts?: string; // ISO string
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('doflow_token');
}

function dotClass(level: HealthLevel) {
  // non settiamo colori custom: usiamo classi Tailwind standard
  if (level === 'ok') return 'bg-emerald-500';
  if (level === 'warn') return 'bg-amber-500';
  return 'bg-rose-500';
}

function pillClass(level: HealthLevel) {
  if (level === 'ok') return 'border-border bg-accent text-foreground';
  if (level === 'warn') return 'border-border bg-amber-500/10 text-foreground';
  return 'border-border bg-rose-500/10 text-foreground';
}

function labelFromLevel(level: HealthLevel) {
  if (level === 'ok') return 'OK';
  if (level === 'warn') return 'WARN';
  return 'DOWN';
}

function StatusPill({
  label,
  status,
  latencyMs,
}: {
  label: string;
  status: HealthLevel;
  latencyMs?: number;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        pillClass(status),
      )}
      title={latencyMs != null ? `${labelFromLevel(status)} • ${latencyMs}ms` : labelFromLevel(status)}
    >
      <span className={cx('mr-1 inline-block h-2 w-2 rounded-full', dotClass(status))} />
      {label}
      {latencyMs != null ? (
        <span className="ml-2 text-[10px] text-muted-foreground">{latencyMs}ms</span>
      ) : null}
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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [health, setHealth] = React.useState<SystemHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);
  const [healthError, setHealthError] = React.useState<string | null>(null);
  const [lastHealthAt, setLastHealthAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = getToken();
    if (!token) router.push('/login');
  }, [router]);

  const loadTenants = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<ListTenantsResponse>('/api/superadmin/tenants', {
        headers: { 'x-doflow-tenant-id': 'public' },
        cache: 'no-store',
      });

      setTenants(Array.isArray(data?.tenants) ? data.tenants : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore caricamento dashboard';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = React.useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);

    try {
      const data = await apiFetch<SystemHealthResponse>('/api/health/system', {
        headers: { 'x-doflow-tenant-id': 'public' },
        cache: 'no-store',
      });

      setHealth(data);
      setLastHealthAt(new Date().toISOString());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore health check';
      setHealthError(msg);
      // fallback “down” se non risponde
      setHealth({
        status: 'down',
        checks: {
          api: { status: 'down', message: msg },
          db: { status: 'down' },
          redis: { status: 'down' },
          ws: { status: 'down' },
          storage: { status: 'down' },
        },
        ts: new Date().toISOString(),
      });
      setLastHealthAt(new Date().toISOString());
    } finally {
      setHealthLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTenants();
    void loadHealth();

    const id = window.setInterval(() => {
      void loadHealth();
    }, 15000);

    return () => window.clearInterval(id);
  }, [loadTenants, loadHealth]);

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
  const overall = health?.status ?? (healthLoading ? 'warn' : 'down');

  const lastCheckedLabel = React.useMemo(() => {
    if (!lastHealthAt) return '—';
    try {
      return new Date(lastHealthAt).toLocaleString();
    } catch {
      return lastHealthAt;
    }
  }, [lastHealthAt]);

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
            <span
              className={cx(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                pillClass(overall),
              )}
              title="Stato complessivo"
            >
              <span className={cx('mr-1 inline-block h-2 w-2 rounded-full', dotClass(overall))} />
              {labelFromLevel(overall)}
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
              void loadTenants();
              void loadHealth();
            }}
            disabled={loading || healthLoading}
          >
            {(loading || healthLoading) ? 'Aggiorno…' : 'Aggiorna'}
          </Button>
          <Link href="/superadmin/tenants">
            <Button variant="default" size="sm">Gestisci tenants</Button>
          </Link>
        </div>
      </div>

      {/* Errors */}
      {error ? (
        <Card className="p-3">
          <div className="text-sm font-medium">Errore tenants</div>
          <div className="text-sm text-muted-foreground mt-1 break-words">{error}</div>
        </Card>
      ) : null}

      {healthError ? (
        <Card className="p-3">
          <div className="text-sm font-medium">Errore system health</div>
          <div className="text-sm text-muted-foreground mt-1 break-words">{healthError}</div>
        </Card>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Tenants totali" value={loading ? '—' : kpi.total} />
        <MetricCard label="Tenants attivi" value={loading ? '—' : kpi.active} />
        <MetricCard label="Tenants disabilitati" value={loading ? '—' : kpi.disabled} />
      </div>

      {/* System status (REALE) */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">System status</div>
            <div className="text-xs text-muted-foreground mt-1">
              Last check: {healthLoading ? '…' : lastCheckedLabel}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill label="API" status={checks.api?.status ?? overall} latencyMs={checks.api?.latency_ms} />
            <StatusPill label="DB" status={checks.db?.status ?? overall} latencyMs={checks.db?.latency_ms} />
            <StatusPill label="Redis" status={checks.redis?.status ?? overall} latencyMs={checks.redis?.latency_ms} />
            <StatusPill label="ws" status={checks.ws?.status ?? overall} latencyMs={checks.ws?.latency_ms} />
            <StatusPill label="Storage" status={checks.storage?.status ?? overall} latencyMs={checks.storage?.latency_ms} />
            <StatusPill label="Realtime" status={checks.ws?.status ?? overall} latencyMs={checks.ws?.latency_ms} />
          </div>
        </div>

        {/* Hint tecnico (solo se serve) */}
        <div className="mt-3 text-xs text-muted-foreground">
          Endpoint: <span className="font-mono">/api/health/system</span>
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
            Nota: “Audit tenant corrente” qui è utile solo per debug. Audit globale = step successivo.
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
            {loading ? '…' : `${recentTenants.length} mostrati`}
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
              {loading ? (
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
