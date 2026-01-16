'use client';

import { Card } from '@/components/ui/card';

export default function FedericaDashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Per ora vuota.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4 lg:col-span-2">
          <div className="text-sm font-semibold">Azioni rapide</div>
          <p className="text-sm text-muted-foreground mt-2">In arrivo.</p>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold">Stato</div>
          <p className="text-sm text-muted-foreground mt-2">In arrivo.</p>
        </Card>
      </div>
    </div>
  );
}
