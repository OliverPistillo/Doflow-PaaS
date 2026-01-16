// apps/frontend/src/app/federicanerone/dashboard/page.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Se hai recharts:
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const mockKpi = {
  new_lead: 0,
  no_answer: 0,
  booked: 0,
  waiting: 0,
  closed_won: 0,
  closed_lost: 0,
  fatturato_eur: 0,
};

const mockMonthly = [
  { month: "Gen", value: 0 },
  { month: "Feb", value: 0 },
  { month: "Mar", value: 0 },
  { month: "Apr", value: 0 },
  { month: "Mag", value: 0 },
  { month: "Giu", value: 0 },
  { month: "Lug", value: 0 },
  { month: "Ago", value: 0 },
  { month: "Set", value: 0 },
  { month: "Ott", value: 0 },
  { month: "Nov", value: 0 },
  { month: "Dic", value: 0 },
];

export default function FedericaDashboardPage() {
  // qui poi ci colleghiamo alle API vere
  const kpi = mockKpi;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          KPI e riepiloghi operativi.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Kpi title="Nuovi lead" value={kpi.new_lead} />
        <Kpi title="Nessuna risposta" value={kpi.no_answer} />
        <Kpi title="Appuntamenti" value={kpi.booked} />
        <Kpi title="Attesa" value={kpi.waiting} />
        <Kpi title="Chiuso" value={kpi.closed_won} />
        <Kpi title="Perso" value={kpi.closed_lost} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-h-[340px]">
          <CardHeader>
            <CardTitle>Fatturato mensile</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockMonthly}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-h-[340px]">
          <CardHeader>
            <CardTitle>Trattamenti</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            (prossimo step: grafico trattamenti + top 5)
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
