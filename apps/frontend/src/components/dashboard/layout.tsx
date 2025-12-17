'use client';

import { ReactNode, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  LogOut,
  Shield,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/theme-toggle';

type DashboardLayoutProps = {
  children: ReactNode;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  userEmail: string;
};

export function DashboardLayout({ children, role, userEmail }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const homePath = role === 'SUPER_ADMIN' ? '/superadmin/dashboard' : '/dashboard';

  const menuItems = useMemo(
    () => [
      // OVERVIEW (dinamica)
      {
        id: 'overview',
        label: role === 'SUPER_ADMIN' ? 'Control Plane' : 'Overview',
        icon: role === 'SUPER_ADMIN' ? Shield : LayoutDashboard,
        visibleFor: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
        href: homePath,
        onClick: () => router.push(homePath),
      },

      // SUPERADMIN
      {
        id: 'tenants',
        label: 'Tenants',
        icon: Building2,
        visibleFor: ['SUPER_ADMIN'],
        href: '/superadmin/tenants',
        onClick: () => router.push('/superadmin/tenants'),
      },

      // TENANT ADMIN
      {
        id: 'users',
        label: 'Utenti',
        icon: Users,
        visibleFor: ['SUPER_ADMIN', 'ADMIN'],
        href: '/admin/users',
        onClick: () => router.push('/admin/users'),
      },

      // TENANT
      {
        id: 'projects',
        label: 'Progetti',
        icon: FolderKanban,
        visibleFor: ['ADMIN', 'MANAGER', 'USER'],
        href: '/projects',
        onClick: () => router.push('/projects'),
      },
    ],
    [homePath, role, router],
  );

  const visibleItems = menuItems.filter((item) => item.visibleFor.includes(role));

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('doflow_token');
      router.push('/login');
    }
  };

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    // match esatto o sottosezioni (es. /superadmin/tenants/*)
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-border bg-background/70 backdrop-blur-xl transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Top: logo + collapse */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2 overflow-hidden">
            <Image
              src="/logo-doflow.svg"
              alt="Doflow"
              width={28}
              height={28}
              className="flex-shrink-0"
            />
            {!collapsed && <span className="font-semibold text-sm truncate">Doflow</span>}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
          >
            <span className="text-xs">{collapsed ? '»' : '«'}</span>
          </Button>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={[
                  'w-full flex items-center gap-2 px-2 py-2 text-xs rounded-md transition-colors',
                  active
                    ? 'bg-accent text-foreground'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom: theme + user + logout */}
        <div className="border-t border-border px-2 py-2 flex flex-col gap-2">
          {/* Theme toggle */}
          <div className={collapsed ? 'flex justify-center' : ''}>
            {/* Quando collapsed, evitiamo il w-full “brutto” */}
            <div className={collapsed ? 'w-10' : 'w-full'}>
              <ThemeToggle />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1 overflow-hidden">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-semibold text-white">
                {userEmail?.[0]?.toUpperCase() ?? '?'}
              </div>

              {!collapsed && (
                <div className="flex flex-col">
                  <span className="truncate">{userEmail}</span>
                  <span className="uppercase text-[9px] text-blue-500 font-medium">
                    {role.toLowerCase().replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <section className="flex-1 flex flex-col">
        <main className="flex-1 p-4 bg-background">{children}</main>
      </section>
    </div>
  );
}
