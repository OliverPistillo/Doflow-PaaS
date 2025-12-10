// apps/frontend/src/app/dashboard/page.tsx

export default function DashboardPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">DoFlow Dashboard</h1>
        <p className="text-sm text-zinc-400">
          Questa è una versione totalmente statica della dashboard.
        </p>
        <p className="text-xs text-zinc-500">
          Se vedi questa schermata in produzione, TUTTO il problema è nel codice
          client che avevamo aggiunto (useEffect, fetch, router).
        </p>
      </div>
    </main>
  );
}
