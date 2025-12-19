'use client';

import * as React from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, Users, FolderKanban, LogOut, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

export type AppSidebarProps = {
  role?: Role;
  userEmail?: string;
  onLogout?: () => void;
};

type JwtPayload = { email?: string; role?: string };

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return {
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      role: typeof parsed.role === 'string' ? parsed.role : undefined,
    };
  } catch {
    return null;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('doflow_token');
}

function normalizeRole(r?: string): Role {
  const up = (r || '').toUpperCase();
  if (up === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (up === 'ADMIN') return 'ADMIN';
  if (up === 'MANAGER') return 'MANAGER';
  return 'USER';
}

export function AppSidebar(props: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [derivedRole, setDerivedRole] = React.useState<Role>('USER');
  const [derivedEmail, setDerivedEmail] = React.useState<string>('—');

  React.useEffect(() => {
    const token = getToken();
    const payload = token ? parseJwtPayload(token) : null;
    setDerivedRole(normalizeRole(payload?.role));
    setDerivedEmail(payload?.email || '—');
  }, []);

  const role: Role = props.role ?? derivedRole;
  const userEmail: string = props.userEmail ?? derivedEmail;

  const homePath = role === 'SUPER_ADMIN' ? '/superadmin/dashboard' : '/dashboard';

  const items = React.useMemo(() => {
    return [
      {
        label: role === 'SUPER_ADMIN' ? 'Control Plane' : 'Overview',
        icon: role === 'SUPER_ADMIN' ? Shield : LayoutDashboard,
        href: homePath,
        visible: true,
      },
      {
        label: 'Tenants',
        icon: Building2,
        href: '/superadmin/tenants',
        visible: role === 'SUPER_ADMIN',
      },
      {
        label: 'Utenti',
        icon: Users,
        href: '/admin/users',
        visible: role === 'SUPER_ADMIN' || role === 'ADMIN',
      },
      {
        label: 'Progetti',
        icon: FolderKanban,
        href: '/projects',
        visible: role !== 'SUPER_ADMIN',
      },
    ].filter((x) => x.visible);
  }, [role, homePath]);

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function defaultLogout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('doflow_token');
    }
    router.push('/login');
  }

  const onLogout = props.onLogout ?? defaultLogout;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* SOLO LOGO (niente testo, niente theme switch) */}
        <div className="flex items-center justify-center px-2 py-2">
          <button
            type="button"
            onClick={() => router.push(homePath)}
            className="rounded-md p-1 hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
            aria-label="Home"
            title="Home"
          >
            <Image
              src="/doflow_logo.svg"
              alt="Doflow"
              width={22}
              height={22}
              className="shrink-0"
              priority
            />
          </button>
        </div>
        <SidebarSeparator />
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.label}
                  onClick={() => router.push(item.href)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <div className="px-2 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* in collapsed verrà “tagliato” automaticamente dal layout */}
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{userEmail}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {role.replace('_', ' ').toLowerCase()}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Logout"
              title="Logout"
              onClick={onLogout}
              className="shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>

      {/* NIENTE SidebarRail: spesso crea overlay e “mangia” click */}
    </Sidebar>
  );
}
