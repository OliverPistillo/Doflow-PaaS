'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export default function BloomTestPage() {
  const [item, setItem] = useState('utente1');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const url = `${API_BASE}/bloom/test?key=login&item=${encodeURIComponent(
        item,
      )}`;
      const res = await fetch(url);
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setResult('Errore chiamata API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Bloom Filter Test</h1>

      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="item (es. utente1)"
        />
        <button
          onClick={handleTest}
          disabled={loading}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {loading ? 'Test in corso...' : 'Testa Bloom'}
        </button>
      </div>

      {result && (
        <pre className="mt-4 w-full max-w-xl border rounded p-3 text-sm bg-gray-50">
          {result}
        </pre>
      )}
    </main>
  );
}
