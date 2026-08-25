'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { clearDoFlowUser } from '@/lib/jwt';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type Task = {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  assignee_email: string | null;
  due_date: string | null;
  created_at: string;
};

type TasksResponse = { tasks: Task[] };

function safeText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Errore inatteso';
}

export default function ProjectTasksClient() {
  const router = useRouter();
  const params = useParams();
  const projectId = (params?.id as string | undefined) ?? undefined;

  const tenantHost = typeof window === 'undefined' ? '' : window.location.host;

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState<string>('');
  const [description, setDescription] = React.useState<string>('');
  const [assignee, setAssignee] = React.useState<string>('');
  const [dueDate, setDueDate] = React.useState<string>('');

  const loadTasks = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!projectId) {
        setError('Project ID mancante.');
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<TasksResponse>(`/projects/${projectId}/tasks`, { signal });
        setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError('Errore nel caricamento task: ' + safeText(e));
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  React.useEffect(() => {
    if (!projectId) return;
    const ac = new AbortController();
    queueMicrotask(() => void loadTasks(ac.signal));
    return () => ac.abort();
  }, [projectId, loadTasks]);

  const handleCreateTask = React.useCallback(async () => {
    if (!projectId) {
      setError('Project ID mancante.');
      return;
    }
    if (!title.trim()) {
      setError('Inserisci un titolo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiFetch(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assignee_email: assignee.trim() || null,
          due_date: dueDate || null,
        }),
      });

      setTitle('');
      setDescription('');
      setAssignee('');
      setDueDate('');

      await loadTasks();
    } catch (e) {
      setError('Errore creazione task: ' + safeText(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, title, description, assignee, dueDate, loadTasks]);

  const handleLogout = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    try { await apiFetch('/auth/logout', { method: 'POST' }); } finally { clearDoFlowUser(); }
    router.push('/login');
  }, [router]);

  if (!projectId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-sm">
          Project ID mancante.{' '}
          <button onClick={() => router.push('/projects')} className="underline">
            Torna ai progetti
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-6">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        <header className="flex flex-col gap-2 border-b border-zinc-800 pb-3 mb-2">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>
              Tenant: <span className="font-mono">{tenantHost || '—'}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800"
            >
              Logout
            </button>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Task progetto #{projectId}</h1>
              <Link href="/projects" className="text-xs text-gray-400 hover:underline">
                ← Torna ai progetti
              </Link>
            </div>

            <button
              onClick={() => void loadTasks()}
              disabled={loading}
              className="text-xs px-3 py-1 border rounded disabled:opacity-50"
              title="Ricarica"
            >
              {loading ? 'Aggiornamento…' : 'Ricarica'}
            </button>
          </div>
        </header>

        {error ? (
          <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">{error}</div>
        ) : null}

        <section className="border rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Crea nuovo task</h2>

          <div className="flex flex-col gap-2">
            <input
              className="border rounded px-3 py-2"
              placeholder="Titolo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              className="border rounded px-3 py-2"
              placeholder="Descrizione (opzionale)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="flex flex-col md:flex-row gap-2">
              <input
                className="border rounded px-3 py-2 flex-1"
                placeholder="Assignee email (opzionale)"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              />

              <input
                type="date"
                className="border rounded px-3 py-2"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />

              <button
                onClick={handleCreateTask}
                disabled={loading}
                className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
              >
                {loading ? 'Creazione…' : 'Crea task'}
              </button>
            </div>
          </div>
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Task del progetto</h2>

          {loading && tasks.length === 0 ? (
            <p className="text-sm text-gray-400">Caricamento…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-400">Nessun task presente per questo progetto.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((t) => (
                <li key={t.id} className="border border-zinc-800 rounded px-3 py-2">
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.title}</div>
                      {t.description ? <div className="text-xs text-gray-400 truncate">{t.description}</div> : null}
                      <div className="text-[11px] text-gray-500">
                        Assegnato a: {t.assignee_email ?? '—'} ·{' '}
                        {t.due_date ? `Scadenza: ${t.due_date}` : 'Senza scadenza'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 shrink-0">Stato: {t.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
