import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/tenant-sidebar"; // Assicurati di puntare al file corretto

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* SIDEBAR FISSA */}
      <aside className="hidden w-64 flex-col border-r bg-slate-950 text-white md:flex">
        <Sidebar className="h-full" />
      </aside>

      {/* AREA CONTENUTO */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* HEADER FISSO */}
        <Header />
        
        {/* PAGINA SCROLLABILE */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}