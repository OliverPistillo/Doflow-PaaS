"use client";

import { useEffect, useState } from "react";
import {
  User, Mail, Phone, Building2, Bell, BellOff,
  Moon, Sun, Globe, Lock, Shield, Key, Eye, EyeOff,
  CreditCard, Sparkles, LogOut, Camera, Save, Loader2,
  ChevronRight, Monitor, Palette, Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme } from "next-themes";
import { getDoFlowUser, getInitials } from "@/lib/jwt";
import { usePlan } from "@/contexts/PlanContext";
import { useToast } from "@/hooks/use-toast";

// ─── Component ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { plan, meta, tenantInfo } = usePlan();
  const { toast } = useToast();

  const [user, setUser] = useState<{ email: string; role: string; initials: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  // Profile form state
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phone: "",
    language: "it",
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    emailDigest: false,
    taskAssigned: true,
    taskCompleted: true,
    newLead: true,
    weeklyReport: false,
  });

  // Security settings
  const [security, setSecurity] = useState({
    twoFactor: false,
    sessionTimeout: "30",
  });

  // Load user from JWT
  useEffect(() => {
    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:    payload.email ?? "utente@doflow.it",
        role:     payload.role ?? "user",
        initials: getInitials(payload.email),
      });
      setProfile((p) => ({
        ...p,
        email: payload.email ?? "",
        fullName: payload.email?.split("@")[0]?.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "",
      }));
    }
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    // Simula salvataggio
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast({ title: "Profilo aggiornato ✓", description: "Le modifiche sono state salvate." });
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("doflow_token");
      window.location.href = "/login";
    }
  };

  // ─── Setting Row helper ──
  const SettingRow = ({
    icon: Icon,
    label,
    description,
    children,
    last,
  }: {
    icon: typeof User;
    label: string;
    description?: string;
    children: React.ReactNode;
    last?: boolean;
  }) => (
    <div className={`flex items-center justify-between py-4 ${last ? "" : "border-b"}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
          <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
        </div>
      </div>
      {children}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 pt-4 animate-in fade-in duration-500">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Impostazioni</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestisci il tuo profilo, le preferenze e la sicurezza
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-5">
        <TabsList>
          <TabsTrigger value="profile">Profilo</TabsTrigger>
          <TabsTrigger value="preferences">Preferenze</TabsTrigger>
          <TabsTrigger value="notifications">Notifiche</TabsTrigger>
          <TabsTrigger value="security">Sicurezza</TabsTrigger>
          <TabsTrigger value="billing">Piano</TabsTrigger>
        </TabsList>

        {/* ━━━ PROFILO ━━━ */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informazioni personali</CardTitle>
              <CardDescription>Aggiorna i tuoi dati personali e il tuo profilo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-xl font-bold">
                    {user?.initials ?? "DF"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    <Camera className="mr-1.5 h-4 w-4" /> Cambia foto
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Max 2MB</p>
                </div>
              </div>

              <Separator />

              {/* Form */}
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      value={profile.fullName}
                      onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefono</Label>
                    <Input
                      id="phone"
                      placeholder="+39 ..."
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Ruolo</Label>
                    <Input value={user?.role ?? "user"} disabled className="bg-muted" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  {saving ? "Salvataggio…" : "Salva modifiche"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ━━━ PREFERENZE ━━━ */}
        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aspetto</CardTitle>
              <CardDescription>Personalizza l'aspetto dell'interfaccia.</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingRow icon={theme === "dark" ? Moon : Sun} label="Tema" description="Seleziona il tema dell'interfaccia">
                <Select value={theme ?? "system"} onValueChange={setTheme}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2"><Sun className="h-3.5 w-3.5" /> Chiaro</div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2"><Moon className="h-3.5 w-3.5" /> Scuro</div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" /> Sistema</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow icon={Languages} label="Lingua" description="Lingua dell'interfaccia" last>
                <Select value={profile.language} onValueChange={(v) => setProfile({ ...profile, language: v })}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ━━━ NOTIFICHE ━━━ */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notifiche</CardTitle>
              <CardDescription>Scegli quali notifiche ricevere e come.</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingRow icon={Bell} label="Notifiche push" description="Ricevi notifiche in tempo reale nel browser">
                <Switch
                  checked={notifications.pushEnabled}
                  onCheckedChange={(v) => setNotifications({ ...notifications, pushEnabled: v })}
                />
              </SettingRow>
              <SettingRow icon={Mail} label="Digest email" description="Ricevi un riepilogo giornaliero via email">
                <Switch
                  checked={notifications.emailDigest}
                  onCheckedChange={(v) => setNotifications({ ...notifications, emailDigest: v })}
                />
              </SettingRow>

              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider py-2">Eventi</p>

              <SettingRow icon={User} label="Task assegnato" description="Quando un task viene assegnato a te">
                <Switch
                  checked={notifications.taskAssigned}
                  onCheckedChange={(v) => setNotifications({ ...notifications, taskAssigned: v })}
                />
              </SettingRow>
              <SettingRow icon={User} label="Task completato" description="Quando un task assegnato a te viene completato">
                <Switch
                  checked={notifications.taskCompleted}
                  onCheckedChange={(v) => setNotifications({ ...notifications, taskCompleted: v })}
                />
              </SettingRow>
              <SettingRow icon={User} label="Nuovo lead" description="Quando un nuovo lead viene aggiunto al CRM">
                <Switch
                  checked={notifications.newLead}
                  onCheckedChange={(v) => setNotifications({ ...notifications, newLead: v })}
                />
              </SettingRow>
              <SettingRow icon={Mail} label="Report settimanale" description="Ricevi un report settimanale via email" last>
                <Switch
                  checked={notifications.weeklyReport}
                  onCheckedChange={(v) => setNotifications({ ...notifications, weeklyReport: v })}
                />
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ━━━ SICUREZZA ━━━ */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sicurezza</CardTitle>
              <CardDescription>Gestisci password e autenticazione.</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingRow icon={Key} label="Cambia password" description="Aggiorna la tua password di accesso">
                <Button variant="outline" size="sm">Modifica</Button>
              </SettingRow>
              <SettingRow icon={Shield} label="Autenticazione a due fattori" description="Aggiungi un ulteriore livello di sicurezza">
                <Switch
                  checked={security.twoFactor}
                  onCheckedChange={(v) => setSecurity({ ...security, twoFactor: v })}
                />
              </SettingRow>
              <SettingRow icon={Lock} label="Timeout sessione" description="Disconnetti automaticamente dopo inattività" last>
                <Select value={security.sessionTimeout} onValueChange={(v) => setSecurity({ ...security, sessionTimeout: v })}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minuti</SelectItem>
                    <SelectItem value="30">30 minuti</SelectItem>
                    <SelectItem value="60">1 ora</SelectItem>
                    <SelectItem value="120">2 ore</SelectItem>
                    <SelectItem value="never">Mai</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20">
                    <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Disconnetti</div>
                    <div className="text-xs text-muted-foreground">Esci dal tuo account DoFlow</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20"
                  onClick={() => setShowLogout(true)}
                >
                  Disconnetti
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ━━━ PIANO & BILLING ━━━ */}
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Piano attuale</CardTitle>
              <CardDescription>Gestisci il tuo abbonamento e la fatturazione.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Current plan */}
              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">Piano {meta.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {plan === "STARTER" && "Funzionalità base per iniziare"}
                      {plan === "PRO" && "Tutte le funzionalità per il tuo business"}
                      {plan === "ENTERPRISE" && "Soluzioni avanzate per grandi organizzazioni"}
                    </div>
                  </div>
                </div>
                {meta.nextPlan && (
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
                    <Sparkles className="mr-1.5 h-4 w-4" /> {meta.upgradeLabel}
                  </Button>
                )}
              </div>

              {/* Storage */}
              {tenantInfo && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Spazio utilizzato</span>
                    <span className="font-medium">
                      {(tenantInfo.storageUsedMb / 1024).toFixed(1)} GB / {tenantInfo.storageLimitGb} GB
                    </span>
                  </div>
                  <Progress
                    value={(tenantInfo.storageUsedMb / (tenantInfo.storageLimitGb * 1024)) * 100}
                    className="h-2 [&>div]:bg-indigo-500"
                  />
                </div>
              )}

              <Separator />

              {/* Billing info */}
              <SettingRow icon={CreditCard} label="Metodo di pagamento" description="Visa •••• 4242 — Scad. 12/27">
                <Button variant="outline" size="sm">Modifica</Button>
              </SettingRow>
              <SettingRow icon={Mail} label="Email fatturazione" description={user?.email ?? "—"} last>
                <Button variant="outline" size="sm">Modifica</Button>
              </SettingRow>
            </CardContent>
          </Card>

          {/* Plan comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Confronta i piani</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["STARTER", "PRO", "ENTERPRISE"] as const).map((tier) => {
                  const isActive = plan === tier;
                  const tierMeta = { STARTER: { label: "Starter", price: "Gratis", features: ["Dashboard base", "CRM & Clienti", "Task", "Catalogo"] }, PRO: { label: "Pro", price: "€29/mese", features: ["Tutto di Starter", "Fatture & Pagamenti", "Logistica", "Progetti", "Report avanzati"] }, ENTERPRISE: { label: "Enterprise", price: "Su misura", features: ["Tutto di Pro", "Analytics BI", "Sicurezza avanzata", "SSO & SAML", "Supporto dedicato"] } }[tier];
                  return (
                    <div
                      key={tier}
                      className={`rounded-xl border-2 p-4 transition-colors ${isActive ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10" : "border-border"}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold">{tierMeta.label}</div>
                        {isActive && (
                          <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0 text-[10px]">
                            ATTIVO
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold mb-3">{tierMeta.price}</div>
                      <ul className="space-y-1.5">
                        {tierMeta.features.map((f) => (
                          <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {!isActive && (
                        <Button variant="outline" className="w-full mt-4" size="sm">
                          {tier === "ENTERPRISE" ? "Contattaci" : "Passa a " + tierMeta.label}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Logout confirm */}
      <AlertDialog open={showLogout} onOpenChange={setShowLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnettersi?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrai reindirizzato alla pagina di login. I dati non salvati andranno persi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Disconnetti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
