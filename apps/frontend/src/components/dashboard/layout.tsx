'use client';

import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

type DashboardLayoutProps = {
  children: ReactNode;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  userEmail: string;
};

export function DashboardLayout({ children, role, userEmail }: DashboardLayoutProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      visibleFor: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
      onClick: () => router.push('/dashboard'),
    },
    {
      id: 'tenants',
      label: 'Tenants',
      icon: Building2,
      visibleFor: ['SUPER_ADMIN'],
      onClick: () => router.push('/superadmin/tenants'),
    },
    {
      id: 'users',
      label: 'Utenti',
      icon: Users,
      visibleFor: ['SUPER_ADMIN', 'ADMIN'],
      onClick: () => router.push('/admin/users'),
    },
    {
      id: 'projects',
      label: 'Progetti',
      icon: FolderKanban,
      visibleFor: ['ADMIN', 'MANAGER', 'USER'],
      onClick: () => router.push('/projects'),
    },
  ];

  const visibleItems = menuItems.filter((item) =>
    item.visibleFor.includes(role),
  );

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('doflow_token');
      router.push('/login');
    }
  };

  const switchTheme = () => {
    if (typeof document === 'undefined') return;
    const current = document.documentElement.dataset.theme ?? 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
  };

  return (
    <div className="min-h-screen flex bg-black text-zinc-100">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-zinc-800 bg-black/70 backdrop-blur-xl transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Top: logo + toggle */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 overflow-hidden">
            <Image
              src="/logo-doflow.svg"
              alt="Doflow"
              width={28}
              height={28}
              className="flex-shrink-0"
            />
            {!collapsed && (
              <span className="font-semibold text-sm truncate">Doflow</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
            onClick={() => setCollapsed((c) => !c)}
          >
            <span className="text-xs">{collapsed ? '»' : '«'}</span>
          </Button>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className="w-full flex items-center gap-2 px-2 py-2 text-xs rounded-md hover:bg-zinc-900 text-zinc-300"
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom: theme + user + logout */}
        <div className="border-t border-zinc-800 px-2 py-2 flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-zinc-300 hover:bg-zinc-900"
            onClick={switchTheme}
          >
            <Moon className="h-4 w-4 mr-2 hidden dark:inline-block" />
            <Sun className="h-4 w-4 mr-2 inline-block dark:hidden" />
            {!collapsed && <span>Cambia tema</span>}
          </Button>
          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1 overflow-hidden">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-[10px] font-semibold">
                {userEmail?.[0]?.toUpperCase() ?? '?'}
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="truncate">{userEmail}</span>
                  <span className="uppercase text-[9px] text-blue-300">
                    {role.toLowerCase().replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-400 hover:text-red-400"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <section className="flex-1 flex flex-col">
        <main className="flex-1 p-4 bg-gradient-to-br from-black via-zinc-950 to-black">
          {children}
        </main>
      </section>
    </div>
  );
}
