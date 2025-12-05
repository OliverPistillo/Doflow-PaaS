'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

type FileRow = {
  id: number;
  key: string;
  original_name: string;
  content_type: string | null;
  size: number | null;
  created_by: string | null;
  created_at: string;
};

type ListResponse = {
  files: FileRow[];
};

export default function FilesTestPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tenantHost, setTenantHost] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(window.localStorage.getItem('doflow_token'));
      setTenantHost(window.location.host);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadFiles();
  }, [token]);

  const loadFiles = async () => {
    if (!token) {
      setError('Token mancante, effettua il login.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/files`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const text = await res.text();
      if (!res.ok) {
        setError(text);
        return;
      }
      const data = JSON.parse(text) as ListResponse;
      setFiles(data.files);
    } catch (e) {
      setError('Errore caricamento files');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!token) {
      setError('Token mancante, effettua il login.');
      return;
    }
    if (!selectedFile) {
      setError('Seleziona un file.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const form = new FormData();
      form.append('file', selectedFile);

      const res = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const text = await res.text();
      const data = JSON.parse(text);

      if (!res.ok || data.error) {
        setError(data.error ?? 'Errore upload');
        return;
      }

      setInfo(`File caricato: ${data.file.original_name}`);
      setSelectedFile(null);
      await loadFiles();
    } catch (e) {
      setError('Errore upload file');
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

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-6">
      <div className="w-full max-w-4xl flex flex-col gap-4">
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
          <h1 className="text-2xl font-bold">Test Upload File (Multi-tenant)</h1>
        </header>

        {error && (
          <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">
            {error}
          </div>
        )}
        {info && (
          <div className="text-sm text-green-400 border border-green-500/40 rounded px-3 py-2">
            {info}
          </div>
        )}

        <section className="border rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Carica un file</h2>
          <input
            type="file"
            onChange={(e) =>
              setSelectedFile(e.target.files?.[0] ?? null)
            }
          />
          <button
            onClick={handleUpload}
            disabled={loading}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? 'Caricamento...' : 'Carica'}
          </button>
        </section>

        <section className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">File del tenant</h2>
            <button
              onClick={() => void loadFiles()}
              disabled={loading}
              className="text-xs px-3 py-1 border rounded disabled:opacity-50"
            >
              {loading ? 'Aggiornamento...' : 'Ricarica'}
            </button>
          </div>

          {files.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nessun file ancora caricato per questo tenant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="border border-zinc-800 rounded px-3 py-2 flex justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {f.original_name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {f.content_type ?? 'n/a'} ·{' '}
                      {f.size != null ? `${f.size} bytes` : '?'} ·{' '}
                      {new Date(f.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    key:
                    <br />
                    <span className="font-mono">{f.key}</span>
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
