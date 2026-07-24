"use client";

import { Plus } from "lucide-react";
import type { TeamMember } from "@/lib/tenant-team-api";
import type { WorkTask } from "./work-model";
import { TaskCard, type ChecklistSummary } from "./task-card";
import { WorkEmptyState } from "./work-ui";

export type BoardColumnId = "todo" | "progress" | "review" | "done";

export const BOARD_COLUMNS: Array<{ id: BoardColumnId; label: string; statuses: string[]; nextStatus: string }> = [
  { id: "todo", label: "Da fare", statuses: ["backlog", "ready"], nextStatus: "backlog" },
  { id: "progress", label: "In corso", statuses: ["in_progress"], nextStatus: "in_progress" },
  { id: "review", label: "In revisione", statuses: ["internal_review", "client_review", "blocked"], nextStatus: "internal_review" },
  { id: "done", label: "Completate", statuses: ["done"], nextStatus: "done" },
];

export function TaskBoard({
  tasks,
  members,
  checklistSummary,
  canMove,
  canCreate,
  onOpen,
  onMove,
  onAdd,
}: {
  tasks: WorkTask[];
  members: TeamMember[];
  checklistSummary: Record<string, ChecklistSummary>;
  canMove: boolean;
  canCreate: boolean;
  onOpen: (task: WorkTask) => void;
  onMove: (task: WorkTask, column: BoardColumnId) => void;
  onAdd: (status: string) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto pb-2">
      <div className="grid min-w-[1080px] grid-cols-4 gap-4">
        {BOARD_COLUMNS.map((column) => {
          const columnTasks = tasks.filter((task) => column.statuses.includes(String(task.status || "")));
          return (
            <section
              key={column.id}
              onDragOver={(event) => {
                if (canMove) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const task = tasks.find((item) => item.id === event.dataTransfer.getData("text/plain"));
                if (task && canMove) onMove(task, column.id);
              }}
              className="flex min-h-[470px] flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <h2 className="text-sm font-semibold text-slate-900">{column.label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{columnTasks.length}</span>
              </div>
              <div className="space-y-3">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    members={members}
                    checklist={checklistSummary[task.id]}
                    canMove={canMove}
                    onOpen={() => onOpen(task)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  />
                ))}
                {!columnTasks.length ? <WorkEmptyState>Nessuna attività in questa colonna.</WorkEmptyState> : null}
              </div>
              {canCreate ? (
                <button type="button" onClick={() => onAdd(column.nextStatus)} className="mt-auto inline-flex items-center gap-2 px-2 pt-5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  <Plus className="h-4 w-4" /> Aggiungi attività
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
