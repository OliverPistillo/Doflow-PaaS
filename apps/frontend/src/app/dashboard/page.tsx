'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Area tenant — contenuti principali (la sidebar è gestita dal layout).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold">Quick actions</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/projects">
              <Button size="sm">Vai ai progetti</Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="outline" size="sm">Gestisci utenti</Button>
            </Link>
            <Link href="/admin/audit">
              <Button variant="outline" size="sm">Audit</Button>
            </Link>
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Nota: questa è la dashboard tenant. Il control plane è su <span className="font-mono">/superadmin/dashboard</span>.
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold">Stato</div>
          <p className="text-sm text-muted-foreground mt-2">
            Contenuti in arrivo. Qui ci metteremo KPI tenant, progetti recenti, attività.
          </p>
        </Card>
      </div>
    </div>
  );
}
