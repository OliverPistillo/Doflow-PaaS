import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, DollarSign, Activity } from "lucide-react";

// --- WIDGET DI ESEMPIO (Placeholder) ---
// In un sistema reale, questi sarebbero componenti complessi importati
const KpiWidget = ({ title, value, icon: Icon, color }: any) => (
  <Card className="h-full border-l-4" style={{ borderLeftColor: color }}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground uppercase">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground mt-1">+20.1% dal mese scorso</p>
    </CardContent>
  </Card>
);

const ChartWidget = () => (
  <Card className="h-full flex flex-col justify-center items-center bg-slate-50">
    <BarChart3 className="h-10 w-10 text-slate-300 mb-2" />
    <span className="text-slate-400 font-medium">Grafico Vendite</span>
  </Card>
);

// --- MAPPA DEI WIDGET DISPONIBILI ---
export const WIDGET_REGISTRY: Record<string, React.ReactNode> = {
  kpi_revenue: <KpiWidget title="Ricavi Totali" value="€45,231.89" icon={DollarSign} color="#2563eb" />,
  kpi_users: <KpiWidget title="Nuovi Utenti" value="+2350" icon={Users} color="#16a34a" />,
  kpi_sales: <KpiWidget title="Vendite" value="+12,234" icon={Activity} color="#d97706" />,
  chart_main: <ChartWidget />,
  recent_activity: (
    <Card className="h-full p-4 bg-white">
      <h3 className="font-bold text-sm mb-4">Attività Recenti</h3>
      <div className="space-y-2 text-xs text-slate-500">
        <div className="p-2 bg-slate-50 rounded">Mario Rossi ha creato un preventivo.</div>
        <div className="p-2 bg-slate-50 rounded">Fattura #1029 pagata.</div>
        <div className="p-2 bg-slate-50 rounded">Nuovo ticket di supporto aperto.</div>
      </div>
    </Card>
  )
};

// --- LAYOUT DI DEFAULT (Il "ben sistemato") ---
// W = larghezza (max 3), H = altezza (unità base)
export const DEFAULT_LAYOUT = [
  // Prima Riga: 3 KPI piccoli (1 colonna ciascuno)
  { i: "kpi_revenue", x: 0, y: 0, w: 1, h: 1, minW: 1, maxW: 3, minH: 1 },
  { i: "kpi_users",   x: 1, y: 0, w: 1, h: 1, minW: 1, maxW: 3, minH: 1 },
  { i: "kpi_sales",   x: 2, y: 0, w: 1, h: 1, minW: 1, maxW: 3, minH: 1 },
  
  // Seconda Riga: Grafico grande (2 colonne) + Attività (1 colonna)
  { i: "chart_main",      x: 0, y: 1, w: 2, h: 2, minW: 2, maxW: 3, minH: 2 },
  { i: "recent_activity", x: 2, y: 1, w: 1, h: 2, minW: 1, maxW: 1, minH: 2 },
];