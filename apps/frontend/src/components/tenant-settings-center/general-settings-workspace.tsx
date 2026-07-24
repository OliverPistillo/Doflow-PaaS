"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Bell, Building2, CheckCircle2, Crown, Loader2, Save, SunMoon, UserRound } from "lucide-react";
import { usePlan } from "@/contexts/PlanContext";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { getDoFlowUser } from "@/lib/jwt";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from "@/lib/tenant-notifications-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Initials, SettingsError, SettingsLoading, SettingsPageHeader, SettingsPanel } from "./settings-center-ui";
import { SettingsNavigation } from "./settings-navigation";
import { roleLabel } from "./settings-center-model";

type ProfileForm = { display_name: string; first_name: string; last_name: string; phone: string };

export function GeneralSettingsWorkspace() {
  const { theme, setTheme } = useTheme();
  const { tenantInfo, plan, meta } = usePlan();
  const { canView, canUpdate } = useTenantAccess();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [profile, setProfile] = useState<ProfileForm>({ display_name: "", first_name: "", last_name: "", phone: "" });
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const user = useMemo(() => getDoFlowUser(), []);

  useEffect(() => {
    let active = true;
    if (!canView("settings")) { setLoading(false); return; }
    const memberRequest = canView("team") && user?.email
      ? teamApi.members({ search: user.email, limit: 20 })
      : Promise.resolve({ items: [] as TeamMember[] });
    const preferenceRequest = canView("notifications")
      ? getNotificationPreferences()
      : Promise.resolve(null);
    Promise.all([memberRequest, preferenceRequest]).then(([members, notificationPreferences]) => {
      if (!active) return;
      const current = members.items.find((item) => item.user_id === user?.sub || item.email.toLowerCase() === user?.email?.toLowerCase()) || null;
      setMember(current);
      if (current) {
        setProfile({
          display_name: current.display_name || "",
          first_name: current.first_name || "",
          last_name: current.last_name || "",
          phone: current.phone || "",
        });
      }
      setPreferences(notificationPreferences);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Impossibile caricare le impostazioni reali.");
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canView, user?.email, user?.sub]);

  const canSaveProfile = canUpdate("settings") && canView("team") && Boolean(member);
  const canSaveNotifications = canUpdate("settings") && canUpdate("notifications") && Boolean(preferences);
  const canSave = canSaveProfile || canSaveNotifications;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const requests: Promise<unknown>[] = [];
      if (member && canSaveProfile) requests.push(teamApi.updateMember(member.id, profile));
      if (preferences && canSaveNotifications) {
        requests.push(updateNotificationPreferences({
          daily_digest_enabled: preferences.daily_digest_enabled,
          digest_time: preferences.digest_time,
          muted_priorities: preferences.muted_priorities || [],
          muted_types: preferences.muted_types || [],
        }));
      }
      await Promise.all(requests);
      setSuccess("Le modifiche disponibili sono state salvate.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const storagePercent = tenantInfo?.storageLimitGb
    ? Math.min(100, (tenantInfo.storageUsedMb / (tenantInfo.storageLimitGb * 1024)) * 100)
    : 0;

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <SettingsPageHeader title="Impostazioni" description="Configura il workspace Doflow usando preferenze e dati realmente disponibili.">
        {canSave ? (
          <Button onClick={() => void save()} disabled={saving} className="h-11 rounded-xl bg-indigo-600 px-5 text-white hover:bg-indigo-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Salvataggio…" : "Salva modifiche"}
          </Button>
        ) : null}
      </SettingsPageHeader>
      <SettingsNavigation />
      <SettingsError message={error} />
      {success ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{success}</div> : null}
      {loading ? <SettingsLoading /> : (
        <div className="grid gap-5 xl:grid-cols-2">
          <SettingsPanel title="Profilo personale" description={member ? "I dati vengono salvati sul profilo team collegato al tuo account." : "Il profilo team collegato non è disponibile per questo account."}>
            <div className="flex flex-col gap-5 sm:flex-row">
              <Initials name={profile.display_name || user?.email} className="h-20 w-20 text-xl" />
              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                <Field label="Nome" value={profile.first_name} disabled={!canSaveProfile} onChange={(value) => setProfile((current) => ({ ...current, first_name: value }))} />
                <Field label="Cognome" value={profile.last_name} disabled={!canSaveProfile} onChange={(value) => setProfile((current) => ({ ...current, last_name: value }))} />
                <Field label="Nome visualizzato" value={profile.display_name} disabled={!canSaveProfile} onChange={(value) => setProfile((current) => ({ ...current, display_name: value }))} />
                <Field label="Telefono" value={profile.phone} disabled={!canSaveProfile} onChange={(value) => setProfile((current) => ({ ...current, phone: value }))} />
                <Field label="Email" value={member?.email || user?.email || "Non disponibile"} disabled />
                <Field label="Ruolo" value={roleLabel(member?.tenant_role || user?.role)} disabled />
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Workspace" description="Informazioni tenant esposte dal piano attivo.">
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadOnly icon={Building2} label="Nome workspace" value={tenantInfo?.name || "Non disponibile"} />
              <ReadOnly icon={Building2} label="Slug" value={tenantInfo?.slug || user?.tenantSlug || "Non disponibile"} />
              <ReadOnly icon={UserRound} label="Email amministrativa" value={tenantInfo?.adminEmail || "Non disponibile"} />
              <ReadOnly icon={Crown} label="Piano" value={meta.label} />
            </div>
          </SettingsPanel>

          <SettingsPanel title="Preferenze operative" description="Solo le preferenze realmente persistenti sono modificabili.">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><SunMoon className="h-4 w-4" /></span>
                  <div><p className="text-sm font-semibold text-slate-900">Tema interfaccia</p><p className="text-xs text-slate-500">Persistito localmente dal sistema temi.</p></div>
                </div>
                <Select value={theme || "system"} onValueChange={setTheme}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="light">Chiaro</SelectItem><SelectItem value="dark">Scuro</SelectItem><SelectItem value="system">Sistema</SelectItem></SelectContent>
                </Select>
              </div>
              <UnavailableRow label="Lingua workspace" />
              <UnavailableRow label="Fuso orario workspace" />
              <UnavailableRow label="Valuta e formato data" />
            </div>
          </SettingsPanel>

          <SettingsPanel title="Notifiche essenziali" description={preferences ? "Preferenze personali salvate dal modulo Notifications." : "Preferenze non disponibili con i permessi correnti."}>
            {preferences ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Bell className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-slate-900">Digest giornaliero</p><p className="text-xs text-slate-500">Riepilogo delle notifiche tenant.</p></div></div>
                  <Switch checked={preferences.daily_digest_enabled} disabled={!canSaveNotifications} onCheckedChange={(checked) => setPreferences((current) => current ? { ...current, daily_digest_enabled: checked } : current)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="digest-time">Orario digest</Label>
                  <Input id="digest-time" type="time" value={preferences.digest_time || ""} disabled={!canSaveNotifications || !preferences.daily_digest_enabled} onChange={(event) => setPreferences((current) => current ? { ...current, digest_time: event.target.value || null } : current)} />
                </div>
                <Link href="/notifications/preferences" className="inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700">Apri tutte le preferenze notifiche</Link>
              </div>
            ) : <p className="text-sm text-slate-500">Nessuna impostazione notifiche esposta.</p>}
          </SettingsPanel>

          <SettingsPanel title="Piano attivo" description={`Piano ${meta.label}`} className="xl:col-span-2">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]">
              <div className="rounded-xl bg-violet-50 p-5">
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-violet-600"><Crown className="h-5 w-5" /></span><div><p className="text-xl font-semibold text-slate-950">Doflow {meta.label}</p><p className="text-sm text-slate-500">{plan}</p></div></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2"><ReadOnly icon={UserRound} label="Limite utenti" value={tenantInfo ? String(tenantInfo.maxUsers) : "Non disponibile"} /><ReadOnly icon={Building2} label="Tenant attivo" value={tenantInfo ? (tenantInfo.isActive ? "Sì" : "No") : "Non disponibile"} /></div>
              </div>
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Spazio utilizzato</span><span className="font-semibold text-slate-900">{tenantInfo ? `${(tenantInfo.storageUsedMb / 1024).toFixed(1)} / ${tenantInfo.storageLimitGb} GB` : "Non disponibile"}</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${storagePercent}%` }} /></div>
                <div className="mt-5 flex flex-wrap gap-3">{canView("finance") ? <Link href="/finance/invoices" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Visualizza fatture</Link> : null}</div>
              </div>
            </div>
          </SettingsPanel>
        </div>
      )}
    </main>
  );
}

function Field({ label, value, disabled = false, onChange }: { label: string; value: string; disabled?: boolean; onChange?: (value: string) => void }) {
  return <div className="grid gap-2"><Label>{label}</Label><Input value={value} disabled={disabled} onChange={(event) => onChange?.(event.target.value)} /></div>;
}

function ReadOnly({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="truncate text-sm font-semibold text-slate-900">{value}</p></div></div>;
}

function UnavailableRow({ label }: { label: string }) {
  return <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span className="text-sm font-medium text-slate-700">{label}</span><span className="text-xs font-semibold text-slate-400">Non disponibile</span></div>;
}
