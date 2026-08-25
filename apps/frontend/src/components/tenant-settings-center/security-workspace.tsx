"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, KeyRound, Laptop2, LockKeyhole, Plus, ShieldCheck, UserCheck } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { credentialsApi, type CredentialItem, type CredentialsDashboard } from "@/lib/tenant-credentials-api";
import { getDoFlowUser } from "@/lib/jwt";
import { SettingsBadge, SettingsEmpty, SettingsError, SettingsKpi, SettingsLoading, SettingsPageHeader, SettingsPanel } from "./settings-center-ui";
import { SettingsNavigation } from "./settings-navigation";
import { auditLabel, formatDateTime, settingsApi, type TenantAuditEntry } from "./settings-center-model";

export function SecurityWorkspace() {
  const { access, canView, canCreate, canUpdate } = useTenantAccess();
  const [dashboard, setDashboard] = useState<CredentialsDashboard | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [attentionCredentials, setAttentionCredentials] = useState<CredentialItem[]>([]);
  const [audit, setAudit] = useState<TenantAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const credentialsAllowed = canView("credentials") || canView("credentials.read");
  const auditAllowed = ["owner", "admin", "superadmin", "super_admin", "manager"].includes(String(access?.role || ""));
  const canCreateCredential = canCreate("credentials") || canView("credentials.create");
  const tenantSlug = getDoFlowUser()?.tenantSlug;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!canView("settings")) { setLoading(false); return; }
      const credentialRequests = credentialsAllowed
        ? Promise.all([credentialsApi.dashboard(), credentialsApi.list({ limit: 5 }), credentialsApi.expiring({ limit: 5 }), credentialsApi.rotationDue({ limit: 5 })])
        : Promise.resolve([null, { items: [] as CredentialItem[] }, { items: [] as CredentialItem[] }, { items: [] as CredentialItem[] }] as const);
      const auditRequest = auditAllowed ? settingsApi.audit() : Promise.resolve({ entries: [] as TenantAuditEntry[] });
      Promise.all([credentialRequests, auditRequest]).then(([[dashboardData, credentialData, expiringData, rotationData], auditData]) => {
        if (!active) return;
        setDashboard(dashboardData);
        setCredentials(credentialData.items || []);
        setAttentionCredentials(Array.from(new Map([...(expiringData.items || []), ...(rotationData.items || [])].map((item) => [item.id, item])).values()).slice(0, 5));
        setAudit(auditData.entries || []);
      }).catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Impossibile caricare i dati di sicurezza.");
      }).finally(() => active && setLoading(false));
    });
    return () => { active = false; };
  }, [auditAllowed, canView, credentialsAllowed]);

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <SettingsPageHeader title="Sicurezza e accessi" description="Proteggi account e credenziali usando soltanto controlli realmente disponibili." actionLabel="Nuova credenziale" actionHref="/credentials/new" actionIcon={Plus} canAct={canCreateCredential} />
      <SettingsNavigation />
      <SettingsError message={error} />
      {loading ? <SettingsLoading /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SettingsKpi icon={ShieldCheck} label="Protezione account" value="—" hint="Punteggio non esposto" />
            <SettingsKpi icon={LockKeyhole} label="MFA attiva" value="—" hint="Stato account non esposto" tone="blue" />
            <SettingsKpi icon={Laptop2} label="Sessioni attive" value="—" hint="Elenco sessioni non disponibile" tone="slate" />
            <SettingsKpi icon={AlertTriangle} label="Credenziali in scadenza" value={dashboard?.expiringCredentials ?? "—"} hint={credentialsAllowed ? `${dashboard?.rotationDue || 0} rotazioni dovute` : "Modulo Credentials non visibile"} tone="orange" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <SettingsPanel title="Sicurezza account" description="Le azioni disponibili usano i flussi di autenticazione esistenti.">
              <SecurityRow icon={LockKeyhole} title="Autenticazione a due fattori" description="Configurazione MFA supportata; lo stato corrente non è esposto al frontend." action={canUpdate("settings") && tenantSlug ? <Link href={`/${tenantSlug}/mfa?setup=1`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Configura</Link> : null} />
              <SecurityRow icon={UserCheck} title="Accesso con Google" description="OAuth Google è supportato in fase di autenticazione; il collegamento account non è esposto." />
              <SecurityRow icon={Laptop2} title="Sessioni aperte" description="Dispositivi, IP e revoca sessioni non sono disponibili." last />
            </SettingsPanel>
            <SettingsPanel title="Richiede attenzione" description="Scadenze e rotazioni provengono dal vault Credentials.">
              {credentialsAllowed && attentionCredentials.length ? (
                <div className="divide-y divide-slate-100">
                  {attentionCredentials.map((item) => (
                    <Link key={item.id} href={`/credentials/${item.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600"><KeyRound className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.title}</p><p className="truncate text-xs text-slate-500">{item.provider || item.kind} · {item.account_label || "Account non indicato"}</p></div>
                      <div className="text-right"><SettingsBadge label={item.status || "Da controllare"} tone={item.status === "expired" ? "red" : "orange"} /><p className="mt-1 text-xs text-slate-500">{formatDateTime(item.expires_at || item.rotation_due_at)}</p></div>
                    </Link>
                  ))}
                </div>
              ) : <SettingsEmpty>{credentialsAllowed ? "Nessuna credenziale in scadenza o da ruotare." : "Il modulo Credentials non è disponibile con i permessi correnti."}</SettingsEmpty>}
            </SettingsPanel>
            <SettingsPanel title="Credenziali condivise" description="Sono mostrate soltanto informazioni metadata; nessun segreto viene caricato o visualizzato.">
              {credentialsAllowed && credentials.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Servizio</th><th className="pb-3">Account</th><th className="pb-3">Scadenza</th><th className="pb-3">Stato</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{credentials.map((item) => <tr key={item.id}><td className="py-3 font-semibold text-slate-900">{item.title}</td><td className="py-3 text-slate-600">{item.account_label || "Non indicato"}</td><td className="py-3 text-slate-600">{formatDateTime(item.expires_at || item.rotation_due_at)}</td><td className="py-3"><SettingsBadge label={item.status || "Non disponibile"} tone={item.status === "expired" ? "red" : "orange"} /></td></tr>)}</tbody>
                  </table>
                </div>
              ) : <SettingsEmpty>Nessuna credenziale metadata da mostrare.</SettingsEmpty>}
              {credentialsAllowed ? <Link href="/credentials" className="mt-4 inline-flex text-sm font-semibold text-indigo-600">Apri Credentials</Link> : null}
            </SettingsPanel>
            <SettingsPanel title="Attività di sicurezza" description="Audit tenant reale, senza posizione, dispositivo o IP.">
              {audit.length ? (
                <div className="divide-y divide-slate-100">
                  {audit.slice(0, 8).map((entry) => <div key={entry.id} className="flex items-center gap-3 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600"><ShieldCheck className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold capitalize text-slate-900">{auditLabel(entry.action)}</p><p className="truncate text-xs text-slate-500">{entry.actor_email || entry.target_email || "Attore non disponibile"}</p></div><span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span></div>)}
                </div>
              ) : <SettingsEmpty>{auditAllowed ? "Nessuna attività di sicurezza disponibile." : "Audit non disponibile con il ruolo corrente."}</SettingsEmpty>}
            </SettingsPanel>
          </div>
        </>
      )}
    </main>
  );
}

function SecurityRow({ icon: Icon, title, description, action, last = false }: { icon: typeof LockKeyhole; title: string; description: string; action?: React.ReactNode; last?: boolean }) {
  return <div className={`flex items-center gap-3 py-4 ${last ? "" : "border-b border-slate-100"}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{title}</p><p className="text-xs text-slate-500">{description}</p></div>{action}</div>;
}
