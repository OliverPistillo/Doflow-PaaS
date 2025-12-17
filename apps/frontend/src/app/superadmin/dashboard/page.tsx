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

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ');
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        ok ? 'border-border bg-accent text-foreground' : 'border-border bg-muted text-muted-foreground'
      )}
      title={ok ? 'OK' : 'Degraded'}
    >
      <span className={cx('mr-1 inline-block h-2 w-2 rounded-full', ok ? 'bg-foreground' : 'bg-muted-foreground')} />
      {label}
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

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('doflow_token');
}

export default function SuperadminDashboardPage() {
  const router = useRouter();

  const [tenants, setTenants] = React.useState<TenantRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = getToken();
    if (!token) router.push('/login');
  }, [router]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<ListTenantsResponse>('/api/superadmin/tenants', {
        // lato backend sei già in public quando domini = app/api/localhost,
        // ma lasciamo il header per chiarezza operativa
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

  React.useEffect(() => {
    void load();
  }, [load]);

  const kpi = React.useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.is_active).length;
    const disabled = total - active;
    return { total, active, disabled };
  }, [tenants]);

  const recentTenants = React.useMemo(() => {
    // se created_at manca, fallback su id (non perfetto ma ok)
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
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? 'Aggiorno…' : 'Aggiorna'}
          </Button>
          <Link href="/superadmin/tenants">
            <Button variant="default" size="sm">Gestisci tenants</Button>
          </Link>
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
        <MetricCard label="Tenants totali" value={loading ? '—' : kpi.total} />
        <MetricCard label="Tenants attivi" value={loading ? '—' : kpi.active} />
        <MetricCard label="Tenants disabilitati" value={loading ? '—' : kpi.disabled} />
      </div>

      {/* System status (placeholder “onesto”) */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">System status</div>
            <div className="text-xs text-muted-foreground mt-1">
              (Step successivo: collegare Telemetry/Health reali. Per ora è un pannello “visivo”.)
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill ok label="API" />
            <StatusPill ok label="DB" />
            <StatusPill ok label="Redis" />
            <StatusPill ok label="Realtime" />
            <StatusPill ok label="Storage" />
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
            Nota: “Audit tenant corrente” qui è utile solo per debug. Il vero Audit globale è Step futuro.
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
                          t.is_active
                            ? 'border-border bg-accent text-foreground'
                            : 'border-border bg-muted text-muted-foreground'
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
