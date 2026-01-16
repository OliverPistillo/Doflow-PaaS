'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Sparkles, CalendarDays, FileText, LogOut } from 'lucide-react';

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

function Item({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={href}>
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function FedericaSidebar() {
  const router = useRouter();

  const logout = React.useCallback(() => {
    window.localStorage.removeItem('doflow_token');
    router.push('/login');
  }, [router]);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-2">
          <div className="text-sm font-semibold leading-none">Federica Nerone</div>
          <div className="text-xs text-muted-foreground">Console</div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {/* ✅ Dashboard = ROOT */}
          <Item href="/federicanerone/dashboard" label="Dashboard" icon={LayoutDashboard} />
          <Item href="/federicanerone/clienti" label="Clienti" icon={Users} />
          <Item href="/federicanerone/trattamenti" label="Trattamenti" icon={Sparkles} />
          <Item href="/federicanerone/appuntamenti" label="Appuntamenti" icon={CalendarDays} />
          <Item href="/federicanerone/documenti" label="Documenti" icon={FileText} />
        </SidebarMenu>

        <SidebarSeparator />
      </SidebarContent>

      <SidebarFooter>
        <div className="p-2">
          <Button variant="outline" className="w-full" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
