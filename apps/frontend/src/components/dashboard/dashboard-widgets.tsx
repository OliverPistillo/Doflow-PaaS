"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowDown, ArrowUp, DollarSign, Users, CreditCard, Activity } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- WIDGET 1: STAT CARD (Revenue, Utenti, etc) ---
interface StatProps { title: string; value: string; trend: string; trendUp: boolean; icon: any; }
export function StatWidget({ title, value, trend, trendUp, icon: Icon }: StatProps) {
  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1 flex items-center">
          {trendUp ? <ArrowUp className="h-3 w-3 text-emerald-500 mr-1" /> : <ArrowDown className="h-3 w-3 text-rose-500 mr-1" />}
          <span className={trendUp ? "text-emerald-500" : "text-rose-500"}>{trend}</span>
          <span className="ml-1">vs mese scorso</span>
        </p>
      </CardContent>
    </Card>
  );
}

// --- WIDGET 2: GRAFICO VENDITE (Recharts) ---
const data = [
  { name: "Jan", total: 1200 }, { name: "Feb", total: 2100 }, { name: "Mar", total: 1800 },
  { name: "Apr", total: 2400 }, { name: "May", total: 1900 }, { name: "Jun", total: 3200 },
];
export function OverviewWidget() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Panoramica Ricavi</CardTitle>
        <CardDescription>Andamento vendite ultimo semestre.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `€${value}`} />
            <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// --- WIDGET 3: RECENT SALES (Lista) ---
export function RecentSalesWidget() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Transazioni Recenti</CardTitle>
        <CardDescription>Ultimi 5 movimenti registrati.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 overflow-auto">
        {[
            { name: "Mario Rossi", email: "mario@example.com", amount: "+€1,999.00", initial: "MR" },
            { name: "Luca Bianchi", email: "luca@example.com", amount: "+€39.00", initial: "LB" },
            { name: "Sofia Verdi", email: "sofia@example.com", amount: "+€299.00", initial: "SV" },
            { name: "Anna Neri", email: "anna@example.com", amount: "+€99.00", initial: "AN" },
            { name: "Gino Paoli", email: "gino@example.com", amount: "+€150.00", initial: "GP" },
        ].map((sale, i) => (
            <div key={i} className="flex items-center">
            <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold">{sale.initial}</AvatarFallback>
            </Avatar>
            <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">{sale.name}</p>
                <p className="text-xs text-muted-foreground">{sale.email}</p>
            </div>
            <div className="ml-auto font-medium">{sale.amount}</div>
            </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- MAPPA GLOBALE DEI WIDGET ---
// Questo mappa le stringhe del DB ai componenti React
export const COMPONENT_MAP: Record<string, React.ReactNode> = {
    'stat_revenue': <StatWidget title="Ricavi Totali" value="€45,231.89" trend="+20.1%" trendUp={true} icon={DollarSign} />,
    'stat_users': <StatWidget title="Nuovi Clienti" value="+2350" trend="+180.1%" trendUp={true} icon={Users} />,
    'stat_sales': <StatWidget title="Vendite" value="+12,234" trend="+19%" trendUp={true} icon={CreditCard} />,
    'stat_active': <StatWidget title="Attivi Ora" value="+573" trend="+201" trendUp={true} icon={Activity} />,
    'chart_overview': <OverviewWidget />,
    'list_recent_sales': <RecentSalesWidget />,
};