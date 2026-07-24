import Link from "next/link";
import { ArrowUpRight, Bell, CircleAlert, Clock3, ListChecks } from "lucide-react";

import type { DashboardActivityItem, DashboardTask } from "./dashboard-types";
import { dashboardDate } from "./dashboard-format";

type PriorityRow = {
  id: string;
  title: string;
  context: string;
  dueAt?: string | null;
  tone: "danger" | "warning" | "success";
  href: string;
  kind: "task" | "notification";
};

function priorityRows(tasks: DashboardTask[], notifications: DashboardActivityItem[]): PriorityRow[] {
  const taskRows: PriorityRow[] = tasks
    .filter((task) => task.status !== "done")
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      context: task.project_name || "Attività interna",
      dueAt: task.due_at || task.due_date,
      tone: task.priority === "urgent" || task.status === "blocked" ? "danger" : task.priority === "high" ? "warning" : "success",
      href: task.project_id ? `/projects/${task.project_id}` : "/projects/tasks",
      kind: "task",
    }));
  const notificationRows: PriorityRow[] = notifications.map((item, index) => ({
    id: `notification-${index}-${item.title}`,
    title: item.title,
    context: item.meta || "Notifica operativa",
    dueAt: item.createdAt,
    tone: "warning",
    href: "/notifications",
    kind: "notification",
  }));
  return [...taskRows, ...notificationRows].slice(0, 4);
}

const toneClass = {
  danger: "bg-rose-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
};

export function DashboardPriorities({
  tasks,
  notifications,
}: {
  tasks: DashboardTask[];
  notifications: DashboardActivityItem[];
}) {
  const rows = priorityRows(tasks, notifications);

  return (
    <section className="dashboard-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">Priorità di oggi</h2>
        <Link href="/projects/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          Vedi tutte
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[184px] items-center justify-center text-sm text-slate-500">
          Nessuna priorità richiede attenzione.
        </div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {rows.map((row) => {
            const Icon = row.kind === "task" ? ListChecks : Bell;
            return (
              <Link
                key={row.id}
                href={row.href}
                className="grid min-h-[52px] grid-cols-[26px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.title}</p>
                  <p className="truncate text-xs text-slate-500">{row.context}</p>
                </div>
                <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
                  <span className={`h-2 w-2 rounded-full ${toneClass[row.tone]}`} />
                  {row.tone === "danger" ? "Urgente" : row.tone === "warning" ? "Attenzione" : "In corso"}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  {row.tone === "danger" ? <CircleAlert className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                  {dashboardDate(row.dueAt, true)}
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5 text-slate-400" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
