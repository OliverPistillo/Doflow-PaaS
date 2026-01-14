'use client';

import * as React from 'react';
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

const API_BASE = '/api';

function getTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('doflow_token');
}

function safeText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Errore inatteso';
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = (await res.json()) as any;
      return j?.error || j?.message || JSON.stringify(j);
    }
    const t = await res.text();
    return t || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function ProjectTasksClient() {
  const router = useRouter();
  const params = useParams();
  const projectId = (params?.id as string | undefined) ?? undefined;

  const [tenantHost, setTenantHost] = React.useState<string>('');
  const [token, setToken] = React.useState<string | null>(null);

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState<string>('');
  const [description, setDescription] = React.useState<string>('');
  const [assignee, setAssignee] = React.useState<string>('');
  const [dueDate, setDueDate] = React.useState<string>('');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setTenantHost(window.location.host);
    setToken(getTokenFromStorage());
  }, []);

  const loadTasks = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!projectId) {
        setError('Project ID mancante.');
        return;
      }
      const t = token ?? getTokenFromStorage();
      if (!t) {
        setError('Token mancante. Effettua il login.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${t}` },
          cache: 'no-store',
          signal,
        });

        if (!res.ok) {
          const msg = await readErrorMessage(res);
          setError(msg);
          setTasks([]);
          return;
        }

        const data = (await res.json()) as TasksResponse;
        setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        setError('Errore nel caricamento task: ' + safeText(e));
      } finally {
        setLoading(false);
      }
    },
    [projectId, token]
  );

  React.useEffect(() => {
    if (!projectId) return;
    if (!token) return;

    const ac = new AbortController();
    void loadTasks(ac.signal);
    return () => ac.abort();
  }, [projectId, token, loadTasks]);

  const handleCreateTask = React.useCallback(async () => {
    if (!projectId) {
      setError('Project ID mancante.');
      return;
    }
    const t = token ?? getTokenFromStorage();
    if (!t) {
      setError('Token mancante. Effettua il login.');
      return;
    }
    if (!title.trim()) {
      setError('Inserisci un titolo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assignee_email: assignee.trim() || null,
          due_date: dueDate || null,
        }),
      });

      if (!res.ok) {
        const msg = await readErrorMessage(res);
        setError(msg);
        return;
      }

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
  }, [projectId, token, title, description, assignee, dueDate, loadTasks]);

  const handleLogout = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem('doflow_token');
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

        {!token ? <p className="text-xs text-red-400">Nessun token trovato: vai su /login.</p> : null}

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
                disabled={loading || !token}
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
