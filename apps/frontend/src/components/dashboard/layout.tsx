'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

type DashboardLayoutProps = {
  children: React.ReactNode;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  userEmail: string;
};

export function DashboardLayout({ children, role, userEmail }: DashboardLayoutProps) {
  const router = useRouter();

  const handleLogout = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('doflow_token');
      router.push('/login');
    }
  }, [router]);

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar role={role} userEmail={userEmail} onLogout={handleLogout} />

      <SidebarInset>
        {/* Topbar */}
        <header className="flex h-12 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger />
          <div className="text-sm text-muted-foreground">
            {role === 'SUPER_ADMIN' ? 'Control Plane' : 'Workspace'}
          </div>
        </header>

        <main className="p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
