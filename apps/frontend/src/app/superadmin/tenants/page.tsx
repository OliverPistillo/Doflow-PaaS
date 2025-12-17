'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

import {
  MoreHorizontal,
  ExternalLink,
  Copy,
  Check,
  Power,
  Info,
  AlertTriangle,
} from 'lucide-react';

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

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
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

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    return {
      email: typeof p.email === 'string' ? p.email : undefined,
      role: typeof p.role === 'string' ? p.role : undefined,
    };
  } catch {
    return null;
  }
}

function errorMessage(e: unknown, fallback: string) {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'string') return e || fallback;
  return fallback;
}

function formatDateTime(v?: string) {
  if (!v) return '-';
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return v;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return v;
  }
}

function sanitizeSlug(input: string) {
  // solo lettere/numeri/trattini, lowercase
  return input.replace(/[^a-z0-9-]/gi, '').toLowerCase();
}

export default function SuperadminTenantsPage() {
  const router = useRouter();

  const [tenants, setTenants] = React.useState<TenantRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<'all' | 'active' | 'disabled'>('all');

  // UI States
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedTenant, setSelectedTenant] = React.useState<TenantRow | null>(null);

  const [confirm, setConfirm] = React.useState<null | { tenant: TenantRow }>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // UX: feedback "Copiato" (tenant id)
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Form States
  const [slug, setSlug] = React.useState('');
  const [name, setName] = React.useState('');
  const [schemaName, setSchemaName] = React.useState('');
  const [adminEmail, setAdminEmail] = React.useState('');
  const [adminPassword, setAdminPassword] = React.useState('');

  // Auth guard basic
  React.useEffect(() => {
    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem('doflow_token') : null;

    if (!token) {
      router.push('/login');
      return;
    }

    const payload = parseJwtPayload(token);
    if (!payload) {
      window.localStorage.removeItem('doflow_token');
      router.push('/login');
    }
  }, [router]);

  const loadTenants = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<ListTenantsResponse>('/api/superadmin/tenants', {
        headers: { 'x-doflow-tenant-id': 'public' },
      });
      const list = Array.isArray(data?.tenants) ? data.tenants : [];
      setTenants(list);
      return list;
    } catch (e: unknown) {
      setError(errorMessage(e, 'Errore caricamento tenants'));
      return [];
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
      const okStatus = status === 'all' ? true : status === 'active' ? t.is_active : !t.is_active;
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

  async function copyUrl(t: TenantRow) {
    const url = `https://${t.slug}.doflow.it`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(t.id);
      window.setTimeout(() => setCopiedId(null), 2000);
      return;
    } catch {
      // fallback best effort
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);

        setCopiedId(t.id);
        window.setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // silenzioso: niente crash, solo niente feedback
      }
    }
  }

  function openDetails(t: TenantRow) {
    setSelectedTenant(t);
    setDetailsOpen(true);
  }

  async function toggleActive(tenant: TenantRow) {
    setBusyId(tenant.id);
    setError(null);

    try {
      await apiFetch(`/api/superadmin/tenants/${tenant.id}/toggle-active`, { method: 'POST' });

      const freshList = await loadTenants();

      // Se lo Sheet è aperto sullo stesso tenant, aggiorna i dettagli
      if (selectedTenant && selectedTenant.id === tenant.id) {
        const freshTenant = freshList.find((x) => x.id === tenant.id);
        if (freshTenant) setSelectedTenant(freshTenant);
      }
    } catch (e: unknown) {
      setError(errorMessage(e, 'Errore aggiornamento tenant'));
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  const createValid = React.useMemo(() => {
    const s = sanitizeSlug(slug.trim());
    const n = name.trim();
    const ae = adminEmail.trim();
    const ap = adminPassword;
    return s.length >= 2 && n.length >= 2 && ae.length >= 5 && ap.length >= 8;
  }, [slug, name, adminEmail, adminPassword]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createValid) return;

    setError(null);
    setCreating(true);

    try {
      const s = sanitizeSlug(slug.trim());
      const n = name.trim();
      const sn = schemaName.trim().toLowerCase();

      await apiFetch('/api/superadmin/tenants', {
        method: 'POST',
        body: JSON.stringify({
          slug: s,
          name: n,
          schema_name: sn ? sn : undefined,
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
          <Button variant="outline" size="sm" onClick={() => loadTenants()} disabled={loading}>
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
                    <td className="px-4 py-3 font-medium">
                      <button
                        className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
                        onClick={() => openDetails(t)}
                      >
                        {t.slug}
                      </button>
                    </td>
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.schema_name || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge active={t.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Azioni">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" className="min-w-[180px]">
                            <DropdownMenuItem onClick={() => openTenant(t.slug)}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Entra
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => copyUrl(t)}>
                              {copiedId === t.id ? (
                                <Check className="mr-2 h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="mr-2 h-4 w-4" />
                              )}
                              {copiedId === t.id ? 'Copiato!' : 'Copia URL'}
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => openDetails(t)}>
                              <Info className="mr-2 h-4 w-4" />
                              Dettagli
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => setConfirm({ tenant: t })}
                              disabled={busyId === t.id}
                              className={t.is_active ? 'text-destructive focus:text-destructive' : ''}
                            >
                              <Power className="mr-2 h-4 w-4" />
                              {busyId === t.id ? 'Applico…' : t.is_active ? 'Disabilita' : 'Attiva'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(v: boolean) => !creating && setCreateOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea tenant</DialogTitle>
            <DialogDescription>
              Crea schema, tabelle e primo admin (bootstrap completo).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onCreate} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                  placeholder="es. acme"
                  required
                />
                <div className="text-[11px] text-muted-foreground mt-1">
                  URL: https://{sanitizeSlug(slug) || '...'}.doflow.it
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
              <Label htmlFor="schema_name">Schema name</Label>
              <Input
                id="schema_name"
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                placeholder="es. tenant_acme"
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                Opzionale: se vuoto, verrà usato lo slug come nome schema.
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
                {adminPassword && adminPassword.length < 8 ? (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Password troppo corta (min 8).
                  </div>
                ) : null}
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

              <Button variant="default" type="submit" disabled={creating || !createValid}>
                {creating ? 'Creo…' : 'Crea tenant'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Toggle Alert Dialog */}
      <AlertDialog open={!!confirm} onOpenChange={(v: boolean) => { if (!v && !busyId) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.tenant.is_active ? 'Disabilita tenant' : 'Attiva tenant'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? `${confirm.tenant.slug} — ${confirm.tenant.name}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="text-sm mt-2">
            {confirm?.tenant.is_active
              ? 'Confermi la disattivazione? Il tenant diventerà inaccessibile agli utenti.'
              : 'Confermi l’attivazione? Il tenant tornerà accessibile.'}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && toggleActive(confirm.tenant)}
              disabled={!!busyId}
              className={confirm?.tenant.is_active ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {busyId ? 'Applico…' : 'Conferma'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tenant Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={(v: boolean) => { setDetailsOpen(v); if (!v) setSelectedTenant(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Dettagli tenant</SheetTitle>
            <SheetDescription>Informazioni e azioni rapide</SheetDescription>
          </SheetHeader>

          {selectedTenant ? (
            <div className="flex flex-col h-full">
              <div className="mt-6 space-y-4 text-sm flex-1">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-xs">
                    {selectedTenant.id?.slice(0, 8) ?? selectedTenant.id ?? '...'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Slug</span>
                  <span className="font-medium">{selectedTenant.slug}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{selectedTenant.name}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Schema</span>
                  <span className="font-medium font-mono text-xs">
                    {selectedTenant.schema_name || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Stato</span>
                  <Badge active={selectedTenant.is_active} />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Creato</span>
                  <span className="font-medium">{formatDateTime(selectedTenant.created_at)}</span>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => openTenant(selectedTenant.slug)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Entra nel tenant
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => copyUrl(selectedTenant)}
                  >
                    {copiedId === selectedTenant.id ? (
                      <Check className="mr-2 h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copiedId === selectedTenant.id ? 'URL Copiato' : 'Copia URL'}
                  </Button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="mt-auto pt-6 border-t border-border">
                <div className="bg-destructive/10 p-4 rounded-md border border-destructive/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="font-semibold text-xs text-destructive uppercase">
                      Zona Pericolo
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3">
                    {selectedTenant.is_active
                      ? 'Disabilitando il tenant, nessun utente potrà più accedere.'
                      : 'Attivando il tenant, gli utenti potranno accedere nuovamente.'}
                  </p>

                  <Button
                    variant="default"
                    className={
                      selectedTenant.is_active
                        ? 'w-full bg-destructive text-destructive-foreground hover:bg-destructive/90'
                        : 'w-full'
                    }
                    onClick={() => {
                      // chiudi sheet, poi apri confirm nel frame successivo (evita overlay multipli)
                      setDetailsOpen(false);
                      requestAnimationFrame(() => setConfirm({ tenant: selectedTenant }));
                    }}
                    disabled={busyId === selectedTenant.id}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    {selectedTenant.is_active ? 'Disabilita Tenant' : 'Attiva Tenant'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">Nessun tenant selezionato.</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
