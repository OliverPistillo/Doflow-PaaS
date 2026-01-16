'use client';

import { Card } from '@/components/ui/card';

export default function FedericaOverviewPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Console Federica Nerone — qui metteremo KPI e riepiloghi.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm font-semibold">Clienti</div>
          <p className="text-sm text-muted-foreground mt-2">In arrivo…</p>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold">Appuntamenti</div>
          <p className="text-sm text-muted-foreground mt-2">In arrivo…</p>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold">Documenti</div>
          <p className="text-sm text-muted-foreground mt-2">In arrivo…</p>
        </Card>
      </div>
    </div>
  );
}
