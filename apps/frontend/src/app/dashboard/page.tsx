'use client';

export default function DashboardPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">DoFlow Dashboard (client minimal)</h1>
        <p className="text-sm text-zinc-400">
          Questa è una versione <span className="font-mono">use client</span> senza hook e senza fetch.
        </p>
        <p className="text-xs text-zinc-500">
          Se questa schermata funziona in produzione, sappiamo che il problema non è che la route sia client-side
          in sé, ma il codice aggiuntivo (useEffect, fetch, router, ecc.).
        </p>
      </div>
    </main>
  );
}
