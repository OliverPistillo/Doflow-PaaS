"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { dashboardCurrency } from "./dashboard-format";
import type { RevenuePoint } from "./dashboard-types";

export function DashboardLineChart({ data }: { data: RevenuePoint[] }) {
  return (
    <section className="dashboard-card min-h-[320px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Andamento ricavi</h2>
          <p className="mt-1 text-xs text-slate-500">Snapshot finanziari disponibili</p>
        </div>
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
          Ultimi 6
        </span>
      </div>

      {data.length < 2 ? (
        <div className="flex h-[235px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-8 text-center">
          <div>
            <p className="text-sm font-semibold text-slate-700">Serie storica non ancora disponibile</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              Il grafico apparirà quando saranno presenti almeno due snapshot finanziari reali.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6558e8" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6558e8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#ececf1" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7c7c86", fontSize: 11 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={48}
                tick={{ fill: "#7c7c86", fontSize: 11 }}
                tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
              />
              <Tooltip
                formatter={(value) => dashboardCurrency(Number(value))}
                contentStyle={{ border: "1px solid #ececf1", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,.08)" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#5f50e7"
                strokeWidth={2.5}
                fill="url(#dashboardRevenueFill)"
                dot={{ r: 3.5, fill: "#fff", stroke: "#5f50e7", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: "#5f50e7", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
