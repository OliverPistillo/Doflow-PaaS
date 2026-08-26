import Link from "next/link";
import { CalendarDays, FolderKanban } from "lucide-react";

import type { DashboardProject } from "./dashboard-types";
import { dashboardDate, dashboardProgress } from "./dashboard-format";

export function DashboardProjects({ projects }: { projects: DashboardProject[] }) {
  return (
    <section className="dashboard-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Progetti in corso</h2>
        <Link href="/projects" className="text-xs font-semibold text-primary hover:text-primary/80">
          Vedi tutti
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex min-h-[184px] items-center justify-center text-sm text-muted-foreground">
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
                className="block rounded-xl border border-border px-3 py-3 transition-colors hover:border-primary/30 hover:bg-accent/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderKanban className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
                      <span className="text-xs font-bold text-foreground">{progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
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
