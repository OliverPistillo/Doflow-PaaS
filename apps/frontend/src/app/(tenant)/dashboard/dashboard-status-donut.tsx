"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type StatusDatum = {
  label: string;
  value: number;
  color: string;
};

export function DashboardStatusDonut({ data }: { data: StatusDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="dashboard-card min-h-[320px] p-5">
      <h2 className="text-base font-semibold text-slate-950">Stato attività</h2>
      <div className="mt-4 grid min-h-[235px] grid-cols-[minmax(130px,1fr)_105px] items-center gap-2">
        {total > 0 ? (
          <div className="relative h-[190px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius="55%"
                  outerRadius="82%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={1}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {data.map((item) => <Cell key={item.label} fill={item.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-950">{total}</span>
              <span className="text-[11px] text-slate-500">attività</span>
            </div>
          </div>
        ) : (
          <div className="flex h-[190px] items-center justify-center text-center text-xs text-slate-500">
            Nessuna attività disponibile.
          </div>
        )}
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <div>
                <p className="text-xs text-slate-600">{item.label}</p>
                <p className="text-sm font-bold text-slate-950">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
