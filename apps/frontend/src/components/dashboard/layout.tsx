'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

import { AppSidebar } from '@/components/app-sidebar';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { apiFetch } from '@/lib/api';
import { ChevronRight, ExternalLink, Search, Shield } from 'lucide-react';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

type DashboardLayoutProps = {
  children: React.ReactNode;
  role: Role;
  userEmail: string;
};

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
};

type ListTenantsResponse = {
  tenants: TenantRow[];
};

function crumbsFromPath(pathname: string | null) {
  if (!pathname) return [];
  const parts = pathname.split('?')[0].split('/').filter(Boolean);

  // Nascondiamo "superadmin" e "admin" come root tecniche: le convertiamo in label
  const mapLabel = (p: string) => {
    if (p === 'superadmin') return 'Super Admin';
    if (p === 'admin') return 'Admin';
    return p.charAt(0).toUpperCase() + p.slice(1);
  };

  const acc: Array<{ label: string; href: string }> = [];
  let href = '';
  for (const p of parts) {
    href += `/${p}`;
    acc.push({ label: mapLabel(p), href });
  }
  return acc;
}

export function DashboardLayout({ children, role, userEmail }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ---- Logout
  const handleLogout = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('doflow_token');
      router.push('/login');
    }
  }, [router]);

  // ---- Breadcrumbs
  const crumbs = React.useMemo(() => crumbsFromPath(pathname), [pathname]);

  // ---- Search (placeholder: UI integrata, logica dopo)
  const [search, setSearch] = React.useState('');

  // ---- Tenant switcher (solo SUPER_ADMIN)
  const [tenants, setTenants] = React.useState<TenantRow[]>([]);
  const [tenantsLoading, setTenantsLoading] = React.useState(false);
  const [tenantsError, setTenantsError] = React.useState<string | null>(null);
  const [tenantQuery, setTenantQuery] = React.useState('');

  const loadTenants = React.useCallback(async () => {
    if (role !== 'SUPER_ADMIN') return;
    setTenantsLoading(true);
    setTenantsError(null);
    try {
      const data = await apiFetch<ListTenantsResponse>('/api/superadmin/tenants', {
        headers: { 'x-doflow-tenant-id': 'public' },
        cache: 'no-store',
      });
      setTenants(Array.isArray(data?.tenants) ? data.tenants : []);
    } catch (e: unknown) {
      setTenantsError(e instanceof Error ? e.message : 'Errore caricamento tenants');
    } finally {
      setTenantsLoading(false);
    }
  }, [role]);

  React.useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const filteredTenants = React.useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    if (!q) return tenants.slice(0, 10);
    return tenants
      .filter((t) => t.slug.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [tenants, tenantQuery]);

  function openTenant(slug: string) {
    window.location.assign(`https://${slug}.doflow.it/admin/users`);
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar role={role} userEmail={userEmail} onLogout={handleLogout} />

      <SidebarInset>
        {/* Header sticky shadcn-style */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
          <SidebarTrigger className="mr-1" />

          {/* Brand (piccolo) */}
          <div className="flex items-center gap-2 pr-2">
            <Image src="/doflow_logo.svg" alt="Doflow" width={60} height={30} />
            {role === 'SUPER_ADMIN' ? (
              <span className="hidden md:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                <Shield className="h-3 w-3" /> Control Plane
              </span>
            ) : null}
          </div>

          {/* Breadcrumb */}
          <nav className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.slice(0, 4).map((c, idx) => (
              <React.Fragment key={c.href}>
                {idx > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                <button
                  onClick={() => router.push(c.href)}
                  className="hover:text-foreground transition-colors"
                >
                  {c.label}
                </button>
              </React.Fragment>
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search (UI integrata) */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-8 w-[240px]"
              />
            </div>
          </div>

          {/* Tenant Switcher (SuperAdmin only) */}
          {role === 'SUPER_ADMIN' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Tenants
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[320px]">
                <div className="p-2">
                  <Input
                    value={tenantQuery}
                    onChange={(e) => setTenantQuery(e.target.value)}
                    placeholder="Cerca tenant…"
                  />
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {tenantsLoading ? 'Carico…' : tenantsError ? tenantsError : `${tenants.length} totali`}
                  </div>
                </div>

                <DropdownMenuSeparator />

                {filteredTenants.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">Nessun tenant.</div>
                ) : (
                  filteredTenants.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => openTenant(t.slug)}
                      disabled={!t.is_active}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{t.slug}.doflow.it</div>
                      </div>

                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>
                  ))
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/superadmin/tenants')}>
                  Gestisci tenants
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {/* Theme toggle in header (shadcn) */}
          <ThemeToggle />
        </header>

        <main className="p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
