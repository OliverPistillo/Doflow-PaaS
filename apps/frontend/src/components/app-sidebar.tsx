'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  LogOut,
  Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/theme-toggle';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

type AppSidebarProps = {
  role: Role;
  userEmail: string;
  onLogout: () => void;
};

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  visibleFor: Role[];
};

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppSidebar({ role, userEmail, onLogout }: AppSidebarProps) {
  const pathname = usePathname();

  const homePath = role === 'SUPER_ADMIN' ? '/superadmin/dashboard' : '/dashboard';

  const mainItems: NavItem[] = [
    {
      title: role === 'SUPER_ADMIN' ? 'Control Plane' : 'Overview',
      href: homePath,
      icon: role === 'SUPER_ADMIN' ? Shield : LayoutDashboard,
      visibleFor: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
    },
  ];

  const workspaceItems: NavItem[] = [
    {
      title: 'Tenants',
      href: '/superadmin/tenants',
      icon: Building2,
      visibleFor: ['SUPER_ADMIN'],
    },
    {
      title: 'Utenti',
      href: '/admin/users',
      icon: Users,
      visibleFor: ['SUPER_ADMIN', 'ADMIN'],
    },
    {
      title: 'Progetti',
      href: '/projects',
      icon: FolderKanban,
      visibleFor: ['ADMIN', 'MANAGER', 'USER'],
    },
  ];

  const visibleMain = mainItems.filter((i) => i.visibleFor.includes(role));
  const visibleWorkspace = workspaceItems.filter((i) => i.visibleFor.includes(role));

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="gap-2">
        {/* Brand */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Home">
              <Link href={homePath}>
                <Shield className="h-4 w-4" />
                <span>Doflow</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Theme toggle */}
        <div className="px-2">
          <ThemeToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigazione</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleWorkspace.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        {/* User */}
        <div className="px-2">
          <div className="flex items-center gap-2 rounded-md border border-border p-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-[11px] font-semibold text-white">
              {userEmail?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{userEmail}</div>
              <div className="text-[10px] text-muted-foreground uppercase">
                {role.toLowerCase().replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="px-2 pb-2">
          <Button variant="outline" className="w-full justify-start" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
