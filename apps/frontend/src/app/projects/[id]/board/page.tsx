'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { useNotifications, RealtimeEvent } from '@/hooks/useNotifications';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

type RawTask = {
  id: string | number;
  title: string;
  status?: string | null;
  description?: string | null;
  assignee_name?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  priority?: string | null;
};

type BoardTask = RawTask;

type Column = {
  id: string;
  title: string;
};

const COLUMNS: Column[] = [
  { id: 'BACKLOG',       title: 'Backlog' },
  { id: 'TODO',          title: 'Da fare' },
  { id: 'IN_PROGRESS',   title: 'In corso' },
  { id: 'REVIEW',        title: 'In review' },
  { id: 'DONE',          title: 'Completate' },
];

function normalizeStatus(status?: string | null): string {
  if (!status) return 'BACKLOG';
  const s = status.toUpperCase();
  return COLUMNS.some((c) => c.id === s) ? s : 'BACKLOG';
}

function buildTasksUrl(projectId: string) {
  return `${API_BASE}/projects/${encodeURIComponent(projectId)}/tasks`;
}

function buildUpdateTaskUrl(projectId: string, taskId: string) {
  return `${API_BASE}/projects/${encodeURIComponent(
    projectId,
  )}/tasks/${encodeURIComponent(taskId)}`;
}

// Mappa colonna -> lista task
type ColumnsState = Record<string, BoardTask[]>;

// Payload eventi realtime
type TaskEventPayload = {
  kind: string;
  projectId?: string;
  ts?: string;
  [key: string]: unknown;
};

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params?.id as string | undefined;

  const [token, setToken] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnsState>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeInfo, setRealtimeInfo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(window.localStorage.getItem('doflow_token'));
    }
  }, []);

  const initColumnsEmpty = useCallback((): ColumnsState => {
    const base: ColumnsState = {};
    for (const col of COLUMNS) {
      base[col.id] = [];
    }
    return base;
  }, []);

  const loadTasks = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildTasksUrl(projectId), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const text = await res.text();
      if (!res.ok) {
        setError(text || 'Errore caricamento tasks');
        return;
      }

      const data = JSON.parse(text) as { tasks: RawTask[] } | RawTask[];
      const rawTasks = Array.isArray(data) ? data : data.tasks;

      const cols = initColumnsEmpty();
      for (const t of rawTasks) {
        const colId = normalizeStatus(t.status);
        if (!cols[colId]) cols[colId] = [];
        cols[colId].push(t);
      }
      setColumns(cols);
    } catch {
      setError('Errore di rete caricando i tasks');
    } finally {
      setLoading(false);
    }
  }, [token, projectId, initColumnsEmpty]);

  useEffect(() => {
    if (!token || !projectId) return;
    void loadTasks();
  }, [token, projectId, loadTasks]);

  // --- Realtime: su evento => ricarichiamo dal backend ---

  const handleRealtimeEvent = useCallback(
    (ev: RealtimeEvent) => {
      if (ev.type !== 'tenant_notification') return;

      console.log('[Board WS] raw event', ev);

      const payload = ev.payload as TaskEventPayload;
      if (!payload || typeof payload.kind !== 'string') {
        return;
      }

      const eventProjectId =
        typeof payload.projectId === 'string' ? payload.projectId : undefined;

      if (projectId && eventProjectId && eventProjectId !== projectId) {
        console.log(
          '[Board WS] evento di altro progetto, ignorato',
          eventProjectId,
          '!=',
          projectId,
        );
        return;
      }

      if (
        payload.kind === 'task_status_changed' ||
        payload.kind === 'task_created' ||
        payload.kind === 'task_deleted'
      ) {
        console.log('[Board WS] evento task, ricarico tasks da API');
        setRealtimeInfo(
          payload.kind === 'task_created'
            ? 'Nuovo task creato'
            : payload.kind === 'task_status_changed'
              ? 'Task aggiornato'
              : 'Task eliminato',
        );

        void loadTasks();

        setTimeout(() => setRealtimeInfo(null), 3000);
      } else {
        console.log('[Board WS] evento non gestito kind=', payload.kind);
      }
    },
    [projectId, loadTasks],
  );

  const { connected: wsConnected, error: wsError } = useNotifications({
    enabled: !!projectId,
    onEvent: handleRealtimeEvent,
  });

  // --- Drag & Drop ---

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const fromColumnId = source.droppableId;
    const toColumnId = destination.droppableId;

    if (fromColumnId === toColumnId && source.index === destination.index) {
      return;
    }

    // aggiornamento UI locale per l’utente che trascina
    setColumns((prev) => {
      const next: ColumnsState = {};
      for (const col of COLUMNS) {
        next[col.id] = [...(prev[col.id] ?? [])];
      }

      const fromTasks = next[fromColumnId];
      const toTasks = next[toColumnId];

      if (!fromTasks || !toTasks) return prev;

      const [moved] = fromTasks.splice(source.index, 1);
      if (!moved) return prev;

      toTasks.splice(destination.index, 0, moved);

      return next;
    });

    if (!token || !projectId) return;

    setSaving(true);
    try {
      const res = await fetch(buildUpdateTaskUrl(projectId, draggableId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: toColumnId }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Errore update task:', text);
      }
    } catch (e) {
      console.error('Errore rete update task', e);
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-red-400">
          ID progetto non valido nell&apos;URL.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-6">
      <header className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-2xl font-bold">
            Board – Progetto <span className="font-mono text-sm">{projectId}</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Vista Kanban dei task di progetto. Trascina le card tra le colonne per
            aggiornare lo stato. Le modifiche degli altri utenti appaiono in tempo reale.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-zinc-400">
          <span>
            Stato dati:{' '}
            {loading ? (
              <span className="text-yellow-400">caricamento…</span>
            ) : (
              <span className="text-green-400">allineato</span>
            )}
          </span>
          <span>
            Salvataggio:{' '}
            {saving ? (
              <span className="text-yellow-400">in corso…</span>
            ) : (
              <span className="text-zinc-500">idle</span>
            )}
          </span>
          <span>
            Realtime:{' '}
            {wsError ? (
              <span className="text-red-400">errore WS</span>
            ) : wsConnected ? (
              <span className="text-green-400">connesso</span>
            ) : (
              <span className="text-zinc-500">offline</span>
            )}
          </span>
        </div>
      </header>

      {error && (
        <div className="mb-2 text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">
          {error}
        </div>
      )}

      {realtimeInfo && (
        <div className="mb-2 text-xs text-green-400 border border-green-500/40 rounded px-3 py-1">
          {realtimeInfo}
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((column) => {
              const colTasks = columns[column.id] ?? [];
              return (
                <Droppable droppableId={column.id} key={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={[
                        'w-64 flex-shrink-0 rounded-lg border border-zinc-800 bg-black/60 flex flex-col max-h-[80vh]',
                        snapshot.isDraggingOver ? 'ring-1 ring-zinc-400' : '',
                      ].join(' ')}
                      style={{ minHeight: 80 }}
                    >
                      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                          {column.title}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {colTasks.length} task
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                        {colTasks.map((task, index) => (
                          <Draggable
                            key={String(task.id)}
                            draggableId={String(task.id)}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={[
                                  'rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs flex flex-col gap-1 cursor-grab active:cursor-grabbing',
                                  dragSnapshot.isDragging
                                    ? 'shadow-lg shadow-black/70 scale-[1.02]'
                                    : '',
                                ].join(' ')}
                              >
                                <div className="font-medium text-zinc-100 truncate">
                                  {task.title}
                                </div>
                                {task.description && (
                                  <div className="text-[11px] text-zinc-400 line-clamp-2">
                                    {task.description}
                                  </div>
                                )}
                                <div className="flex justify-between items-center mt-1 text-[10px] text-zinc-500">
                                  <div className="flex items-center gap-1">
                                    {task.priority && (
                                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                                        {task.priority}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {task.assignee_name && (
                                      <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700">
                                        {task.assignee_name}
                                      </span>
                                    )}
                                    {task.due_date && (
                                      <span>
                                        {new Date(
                                          task.due_date,
                                        ).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </main>
  );
}
