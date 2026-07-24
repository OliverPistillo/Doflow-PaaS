import Link from "next/link";
import { CalendarDays, FolderKanban } from "lucide-react";

import type { DashboardProject } from "./dashboard-types";
import { dashboardDate, dashboardProgress } from "./dashboard-format";

export function DashboardProjects({ projects }: { projects: DashboardProject[] }) {
  return (
    <section className="dashboard-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">Progetti in corso</h2>
        <Link href="/projects" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          Vedi tutti
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex min-h-[184px] items-center justify-center text-sm text-slate-500">
          Nessun progetto attivo.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {projects.slice(0, 4).map((project) => {
            const progress = dashboardProgress(project.progress);
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-xl border border-slate-200 px-3 py-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <FolderKanban className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
                      <span className="text-xs font-bold text-slate-700">{progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 sm:flex">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dashboardDate(project.due_date)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
