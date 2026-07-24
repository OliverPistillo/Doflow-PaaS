"use client";

import type { DragEvent } from "react";
import { CalendarDays, CheckCircle2, Flag, ListChecks } from "lucide-react";
import type { TeamMember } from "@/lib/tenant-team-api";
import { formatShortDate, taskIsOverdue, type WorkTask } from "./work-model";
import { PriorityBadge, WorkAvatar, WorkProgress } from "./work-ui";

export type ChecklistSummary = { done: number; total: number };

export function taskAssignee(task: WorkTask, members: TeamMember[]) {
  return members.find((member) => member.user_id === task.assignee_id || member.id === task.assignee_id);
}

export function TaskCard({
  task,
  members,
  checklist,
  canMove,
  onOpen,
  onDragStart,
}: {
  task: WorkTask;
  members: TeamMember[];
  checklist?: ChecklistSummary;
  canMove: boolean;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const assignee = taskAssignee(task, members);
  const completed = task.status === "done";
  const overdue = taskIsOverdue(task);
  return (
    <div
      draggable={canMove}
      onDragStart={onDragStart}
      onClick={onOpen}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/20"
    >
      <div className="flex items-start gap-3">
        {completed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : task.milestone_id ? <Flag className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" /> : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{task.project_name || "Progetto non collegato"}</p>
        </div>
        <WorkAvatar name={assignee?.display_name} email={assignee?.email || task.assignee_email} size="sm" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={overdue ? "inline-flex items-center gap-1 text-xs font-medium text-rose-600" : "inline-flex items-center gap-1 text-xs text-slate-500"}>
          <CalendarDays className="h-3.5 w-3.5" /> {formatShortDate(task.due_at)}
        </span>
        {task.priority ? <PriorityBadge value={task.priority} /> : null}
        {checklist?.total ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
            <ListChecks className="h-3.5 w-3.5" /> {checklist.done}/{checklist.total}
          </span>
        ) : null}
      </div>
      {checklist?.total ? <WorkProgress value={(checklist.done / checklist.total) * 100} className="mt-2 h-1.5" /> : null}
    </div>
  );
}
