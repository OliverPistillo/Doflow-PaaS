'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

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

type TasksResponse = {
  tasks: Task[];
};

export default function ProjectTasksPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string | undefined;

  const [tenantHost, setTenantHost] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTenantHost(window.location.host);
      setToken(window.localStorage.getItem('doflow_token'));
    }
  }, []);

  useEffect(() => {
    if (!token || !projectId) return;
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, projectId]);

  const loadTasks = async () => {
    if (!token || !projectId) {
      setError('Token o projectId mancanti.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const text = await res.text();
      if (!res.ok) {
        setError(text);
        return;
      }
      const data = JSON.parse(text) as TasksResponse;
      setTasks(data.tasks);
    } catch (e) {
      setError('Errore nel caricamento task');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!token || !projectId) {
      setError('Token o projectId mancanti.');
      return;
    }
    if (!title) {
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          assignee_email: assignee || undefined,
          due_date: dueDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Errore creazione task');
        return;
      }
      setTitle('');
      setDescription('');
      setAssignee('');
      setDueDate('');
      await loadTasks();
    } catch (e) {
      setError('Errore creazione task');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('doflow_token');
      window.location.href = '/login';
    }
  };

  if (!projectId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-sm">
          Project ID mancante.{' '}
          <button
            onClick={() => router.push('/projects')}
            className="underline"
          >
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
              Tenant: <span className="font-mono">{tenantHost}</span>
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
              <h1 className="text-2xl font-bold">
                Task progetto #{projectId}
              </h1>
              <Link
                href="/projects"
                className="text-xs text-gray-400 hover:underline"
              >
                ← Torna ai progetti
              </Link>
            </div>
          </div>
        </header>

        {!token && (
          <p className="text-xs text-red-400">
            Nessun token trovato: vai su /login.
          </p>
        )}

        {error && (
          <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">
            {error}
          </div>
        )}

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
                {loading ? 'Creazione...' : 'Crea task'}
              </button>
            </div>
          </div>
        </section>

        <section className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Task del progetto</h2>
            <button
              onClick={() => void loadTasks()}
              disabled={loading}
              className="text-xs px-3 py-1 border rounded disabled:opacity-50"
            >
              {loading ? 'Aggiornamento...' : 'Ricarica'}
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nessun task presente per questo progetto.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="border border-zinc-800 rounded px-3 py-2"
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="font-semibold">{t.title}</div>
                      {t.description && (
                        <div className="text-xs text-gray-400">
                          {t.description}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-500">
                        Assegnato a:{' '}
                        {t.assignee_email ?? '—'} ·{' '}
                        {t.due_date ? `Scadenza: ${t.due_date}` : 'Senza scadenza'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Stato: {t.status}
                    </div>
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
