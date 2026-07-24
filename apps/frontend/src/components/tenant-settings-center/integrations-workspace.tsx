"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, KeyRound, Plug, Search, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { SettingsEmpty, SettingsKpi, SettingsPageHeader, SettingsPanel } from "./settings-center-ui";
import { SettingsNavigation } from "./settings-navigation";

export function IntegrationsWorkspace() {
  const { canView } = useTenantAccess();
  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <SettingsPageHeader title="Integrazioni" description="Collega gli strumenti disponibili e controlla lo stato delle sincronizzazioni reali." />
      <SettingsNavigation />
      <div className="grid gap-4 sm:grid-cols-3">
        <SettingsKpi icon={Plug} label="Collegate" value={0} hint="Nessun catalogo tenant esposto" />
        <SettingsKpi icon={CheckCircle2} label="Da configurare" value={0} hint="Nessun connettore configurabile" tone="green" />
        <SettingsKpi icon={AlertTriangle} label="Con problemi" value={0} hint="Nessuna sincronizzazione monitorata" tone="orange" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <SettingsPanel title="Le tue integrazioni" description="Vengono mostrate soltanto connessioni supportate da API tenant reali.">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input disabled placeholder="Cerca integrazione..." className="pl-9" />
          </div>
          <SettingsEmpty className="min-h-72">
            <div>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Plug className="h-5 w-5" /></span>
              <p className="mt-4 font-semibold text-slate-800">Nessun catalogo integrazioni disponibile</p>
              <p className="mx-auto mt-1 max-w-md">Il frontend non riceve integrazioni, account collegati o stato sincronizzazioni dal backend. Non vengono simulate connessioni OAuth.</p>
            </div>
          </SettingsEmpty>
        </SettingsPanel>
        <div className="space-y-5">
          <SettingsPanel title="Funzioni correlate" description="Collegamenti alle funzioni realmente disponibili.">
            <div className="space-y-3">
              {canView("credentials") ? <RelatedLink href="/credentials" icon={KeyRound} title="Credentials" description="Gestisci metadata e segreti tramite il vault protetto." /> : null}
              {canView("automations") ? <RelatedLink href="/automations/rules" icon={Settings2} title="Automazioni" description="Configura trigger e azioni supportate." /> : null}
              {!canView("credentials") && !canView("automations") ? <p className="text-sm text-slate-500">Nessuna funzione correlata visibile con i permessi correnti.</p> : null}
            </div>
          </SettingsPanel>
          <SettingsPanel title="Autenticazione Google" description="Funzione di accesso disponibile nell’applicazione.">
            <p className="text-sm text-slate-600">Lo stato del collegamento Google del singolo account non è esposto alle impostazioni tenant.</p>
            <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Stato account non disponibile</span>
          </SettingsPanel>
        </div>
      </div>
    </main>
  );
}

function RelatedLink({ href, icon: Icon, title, description }: { href: string; icon: typeof KeyRound; title: string; description: string }) {
  return <Link href={href} className="flex gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="text-xs text-slate-500">{description}</span></span></Link>;
}
