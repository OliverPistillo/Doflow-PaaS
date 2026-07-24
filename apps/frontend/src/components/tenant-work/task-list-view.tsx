"use client";

import { ChevronRight } from "lucide-react";
import type { TeamMember } from "@/lib/tenant-team-api";
import { formatShortDate, taskIsOverdue, type WorkTask } from "./work-model";
import { taskAssignee } from "./task-card";
import { PriorityBadge, TaskStatusBadge, WorkAvatar, WorkEmptyState } from "./work-ui";

export function TaskListView({
  tasks,
  members,
  onOpen,
}: {
  tasks: WorkTask[];
  members: TeamMember[];
  onOpen: (task: WorkTask) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      {tasks.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold text-slate-500">
              <tr><th className="px-5 py-4">Attività</th><th className="px-4 py-4">Progetto</th><th className="px-4 py-4">Responsabile</th><th className="px-4 py-4">Scadenza</th><th className="px-4 py-4">Priorità</th><th className="px-4 py-4">Stato</th><th className="w-12 px-3 py-4" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const assignee = taskAssignee(task, members);
                return (
                  <tr key={task.id} onClick={() => onOpen(task)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-5 py-4"><p className="font-semibold text-slate-900">{task.title}</p>{task.milestone_title ? <p className="mt-1 text-xs text-indigo-600">{task.milestone_title}</p> : null}</td>
                    <td className="px-4 py-4 text-slate-600">{task.project_name || "—"}</td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2"><WorkAvatar name={assignee?.display_name} email={assignee?.email || task.assignee_email} size="sm" /><span className="truncate text-slate-600">{assignee?.display_name || task.assignee_email || "—"}</span></div></td>
                    <td className={taskIsOverdue(task) ? "px-4 py-4 font-medium text-rose-600" : "px-4 py-4 text-slate-600"}>{formatShortDate(task.due_at)}</td>
                    <td className="px-4 py-4"><PriorityBadge value={task.priority} /></td>
                    <td className="px-4 py-4"><TaskStatusBadge value={task.status} /></td>
                    <td className="px-3 py-4 text-slate-400"><ChevronRight className="h-4 w-4" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="p-5"><WorkEmptyState>Nessuna attività corrisponde ai filtri selezionati.</WorkEmptyState></div>}
    </section>
  );
}
