"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Database,
  FileText,
  Info,
  KeyRound,
  Link2,
  MessageCircle,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { EntityImageDialog } from "@/components/entity-image-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import {
  useDoflowIdentity,
  type NotificationFrequency,
  type PersonalPreferences,
} from "@/features/identity/doflow-identity-provider";
import { roleLabels } from "@/features/identity/permissions";
import { TeamPresencePanel } from "@/features/identity/team-presence-panel";
import { useCompanyIntelligence } from "@/features/company-intelligence/company-intelligence-provider";
import { useTeamChat } from "@/features/chat/team-chat-provider";
import { FlowSettingsPanel } from "@/features/flow/flow-experience-provider";
import {
  APP_PRODUCT_LABEL,
  APP_RELEASE_DATE,
  APP_RELEASE_HIGHLIGHTS,
  APP_RELEASE_TITLE,
  APP_VERSION,
} from "@/lib/app-version";

type SectionId =
  | "profilo"
  | "sicurezza"
  | "notifiche"
  | "team-space"
  | "calendario"
  | "aspetto"
  | "informazioni"
  | "azienda"
  | "team"
  | "ruoli"
  | "mansioni"
  | "documenti"
  | "vendite"
  | "classifiche"
  | "automazioni"
  | "intelligenza-artificiale"
  | "integrazioni"
  | "dati";
type Section = {
  id: SectionId;
  label: string;
  group: "Personali" | "Azienda e amministrazione";
  icon: typeof UserRound;
  keywords: string;
};

const sections: Section[] = [
  {
    id: "profilo",
    label: "Il mio profilo",
    group: "Personali",
    icon: UserRound,
    keywords:
      "foto nome cognome email telefono lingua fuso orario firma pagina iniziale",
  },
  {
    id: "sicurezza",
    label: "Accesso e sicurezza",
    group: "Personali",
    icon: KeyRound,
    keywords: "password accesso sessioni dispositivi due fattori 2fa",
  },
  {
    id: "notifiche",
    label: "Notifiche",
    group: "Personali",
    icon: Bell,
    keywords:
      "notifiche email browser agenda appuntamenti attività lead progetti pagamenti rinnovi supporto menzioni",
  },
  {
    id: "team-space",
    label: "Team Space",
    group: "Personali",
    icon: MessageCircle,
    keywords: "chat canali messaggi notifiche",
  },
  {
    id: "calendario",
    label: "Calendario e sincronizzazione",
    group: "Personali",
    icon: CalendarDays,
    keywords:
      "Google Calendar Apple ICS calendario sincronizzazione promemoria",
  },
  {
    id: "aspetto",
    label: "Aspetto e assistenza",
    group: "Personali",
    icon: Palette,
    keywords:
      "tema scuro chiaro sistema densità data ora vista animazioni flow tutorial aiuto suggerimenti",
  },
  {
    id: "informazioni",
    label: "Informazioni",
    group: "Personali",
    icon: Info,
    keywords: "versione informazioni novità changelog rilascio",
  },
  {
    id: "azienda",
    label: "Dati aziendali",
    group: "Azienda e amministrazione",
    icon: Building2,
    keywords: "ragione sociale partita iva codice fiscale pec sdi logo valuta",
  },
  {
    id: "team",
    label: "Team e utenti",
    group: "Azienda e amministrazione",
    icon: Users,
    keywords: "utenti invito account accesso attiva disattiva",
  },
  {
    id: "ruoli",
    label: "Ruoli e autorizzazioni",
    group: "Azienda e amministrazione",
    icon: ShieldCheck,
    keywords: "ruoli permessi autorizzazioni approvare assegnare configurare",
  },
  {
    id: "mansioni",
    label: "Mansioni e responsabilità",
    group: "Azienda e amministrazione",
    icon: FileText,
    keywords:
      "mansioni responsabilità aree versione validità storico obiettivi",
  },
  {
    id: "documenti",
    label: "Documenti e numerazione",
    group: "Azienda e amministrazione",
    icon: FileText,
    keywords: "fattura preventivo prefisso numerazione pdf banca firma iva",
  },
  {
    id: "vendite",
    label: "Vendite e pagamenti",
    group: "Azienda e amministrazione",
    icon: WalletCards,
    keywords: "vendite pagamenti valuta iva acconto rinnovi ordini margini",
  },
  {
    id: "classifiche",
    label: "Classifiche, premi e penalità",
    group: "Azienda e amministrazione",
    icon: Sparkles,
    keywords: "classifica metriche pesi punti premi penalità storico",
  },
  {
    id: "automazioni",
    label: "Automazioni",
    group: "Azienda e amministrazione",
    icon: Sparkles,
    keywords: "automazioni regole trigger azioni errori",
  },
  {
    id: "intelligenza-artificiale",
    label: "Intelligenza artificiale",
    group: "Azienda e amministrazione",
    icon: Bot,
    keywords:
      "openai modello budget consumo cache conservazione analisi azienda",
  },
  {
    id: "integrazioni",
    label: "Integrazioni",
    group: "Azienda e amministrazione",
    icon: Link2,
    keywords: "integrazioni whatsapp meta google ads email servizi esterni",
  },
  {
    id: "dati",
    label: "Dati, archivio e privacy",
    group: "Azienda e amministrazione",
    icon: Database,
    keywords:
      "dati archivio privacy esportazione importazione conservazione ripristino cancellazione",
  },
];

const personalIds = new Set<SectionId>([
  "profilo",
  "sicurezza",
  "notifiche",
  "team-space",
  "calendario",
  "aspetto",
  "informazioni",
]);
const notificationCategories = [
  "Appuntamenti",
  "Attività",
  "Lead",
  "Progetti",
  "Consegne",
  "Revisioni",
  "Pagamenti",
  "Rinnovi",
  "Supporto",
  "Menzioni e commenti",
];

export function CommercialSettingsHub({
  calendar,
  duties,
  roles,
  rankings,
  dataTools,
}: {
  calendar: ReactNode;
  duties: ReactNode;
  roles: ReactNode;
  rankings: ReactNode;
  dataTools: ReactNode;
}) {
  const identity = useDoflowIdentity();
  const canAdmin = identity.hasCapability("canManageRoles");
  const allowed = useMemo(
    () =>
      sections.filter(
        (section) =>
          personalIds.has(section.id) || section.id === "team" || canAdmin,
      ),
    [canAdmin],
  );
  const [active, setActive] = useState<SectionId>("profilo");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const sync = () => {
      const requested = new URLSearchParams(window.location.search).get(
        "sezione",
      ) as SectionId | null;
      const next =
        requested && allowed.some((section) => section.id === requested)
          ? requested
          : "profilo";
      if (requested && requested !== next) {
        const url = new URL(window.location.href);
        url.searchParams.set("sezione", next);
        window.history.replaceState({}, "", url);
      }
      setActive(next);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [allowed]);

  const openSection = (id: SectionId) => {
    if (!allowed.some((section) => section.id === id)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("sezione", id);
    window.history.pushState({}, "", url);
    setActive(id);
    setQuery("");
  };
  const matches = query.trim()
    ? allowed.filter((section) =>
        `${section.label} ${section.keywords}`
          .toLocaleLowerCase("it-IT")
          .includes(query.trim().toLocaleLowerCase("it-IT")),
      )
    : [];
  const current =
    allowed.find((section) => section.id === active) ?? allowed[0];

  const content: Record<SectionId, ReactNode> = {
    profilo: <ProfileSettings key={identity.currentUserId} />,
    sicurezza: <SecuritySettings />,
    notifiche: <NotificationSettings />,
    "team-space": <TeamSpaceSettings />,
    calendario: calendar,
    aspetto: (
      <div className="space-y-4">
        <AppearanceSettings />
        <FlowSettingsPanel />
      </div>
    ),
    informazioni: <AboutSettings />,
    azienda: <CompanySettings />,
    team: <TeamSettings />,
    ruoli: roles,
    mansioni: duties,
    documenti: <DocumentSettings />,
    vendite: <SalesSettings />,
    classifiche: rankings,
    automazioni: (
      <StatusCards
        title="Automazioni"
        items={[
          "Regole e trigger",
          "Azioni automatiche",
          "Registro esecuzioni",
        ]}
      />
    ),
    "intelligenza-artificiale": <ArtificialIntelligenceSettings />,
    integrazioni: (
      <StatusCards
        title="Integrazioni"
        items={["WhatsApp", "Meta", "Google Ads", "Email"]}
      />
    ),
    dati: <DataSettings tools={dataTools} />,
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">
          Gestisci il tuo profilo, le preferenze e le configurazioni
          autorizzate.
        </p>
      </header>
      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Cerca nelle impostazioni"
          placeholder="Cerca nelle impostazioni…"
          className="pl-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <Card className="absolute z-30 mt-2 w-full shadow-lg">
            <CardContent className="p-2">
              {matches.length ? (
                matches.map((section) => (
                  <button
                    key={section.id}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openSection(section.id)}
                  >
                    <section.icon className="size-4" />
                    {section.label}
                    <ChevronRight className="ml-auto size-4" />
                  </button>
                ))
              ) : (
                <p className="p-3 text-sm text-muted-foreground">
                  Nessuna impostazione trovata.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <div className="lg:hidden">
        <Label htmlFor="settings-section" className="sr-only">
          Sezione
        </Label>
        <Select
          value={current.id}
          onValueChange={(value) => openSection(value as SectionId)}
        >
          <SelectTrigger id="settings-section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowed.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav
          aria-label="Sezioni impostazioni"
          className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto rounded-xl border bg-card p-2 lg:block"
        >
          {(["Personali", "Azienda e amministrazione"] as const).map(
            (group) => {
              const grouped = allowed.filter(
                (section) => section.group === group,
              );
              return grouped.length ? (
                <div key={group} className="mb-3 last:mb-0">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  {grouped.map((section) => (
                    <button
                      key={section.id}
                      aria-current={
                        section.id === current.id ? "page" : undefined
                      }
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section.id === current.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      onClick={() => openSection(section.id)}
                    >
                      <section.icon className="size-4 shrink-0" />
                      <span className="min-w-0">{section.label}</span>
                    </button>
                  ))}
                </div>
              ) : null;
            },
          )}
        </nav>
        <section className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Impostazioni</span>
            <ChevronRight className="size-3" />
            <span className="font-medium text-foreground">{current.label}</span>
          </div>
          {content[current.id]}
        </section>
      </div>
    </main>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function AboutSettings() {
  return (
    <SectionCard
      title={APP_PRODUCT_LABEL}
      description={`${APP_RELEASE_TITLE} · ${APP_RELEASE_DATE}`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Versione {APP_VERSION}</Badge>
          <Badge variant="outline">Release stabile</Badge>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {APP_RELEASE_HIGHLIGHTS.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 rounded-lg border p-3 text-sm"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Le note delle versioni future saranno pubblicate nella sezione Novità
          di Aiuto e tutorial, senza ripetere automaticamente l’onboarding.
        </p>
      </div>
    </SectionCard>
  );
}

function TeamSpaceSettings() {
  const chat = useTeamChat();
  return (
    <SectionCard
      title="Team Space"
      description="Chat interna collegata al servizio di collaborazione del tenant."
    >
      <div className="rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Chat condivisa</p>
          <Badge variant={chat.connected ? "secondary" : "destructive"}>
            {chat.connected ? "Connessa" : "Riconnessione"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Messaggi e ricevute transitano dal backend e non vengono salvati nel
          localStorage.
        </p>
      </div>
    </SectionCard>
  );
}

function ProfileSettings() {
  const identity = useDoflowIdentity();
  const user = identity.currentUser;
  const [photoOpen, setPhotoOpen] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    lastName: user.lastName ?? "",
    email: user.email,
    phone: user.phone ?? "",
    signature: user.signature ?? "",
  });
  const save = () =>
    identity.updateUserProfile(user.id, form)
      ? toast.success("Profilo aggiornato")
      : toast.info("Nessuna modifica da salvare o dati non validi");
  return (
    <SectionCard
      title="Il mio profilo"
      description="Informazioni personali e preferenze principali."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar userId={user.id} name={user.name} className="size-16" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPhotoOpen(true)}>
              Modifica foto
            </Button>
            {user.avatarUrl && (
              <Button
                variant="ghost"
                onClick={() =>
                  identity.updateUserAvatar(user.id, undefined) &&
                  toast.success("Foto rimossa")
                }
              >
                Rimuovi foto
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome"
            value={form.name}
            onChange={(name) => setForm((old) => ({ ...old, name }))}
          />
          <Field
            label="Cognome"
            value={form.lastName}
            onChange={(lastName) => setForm((old) => ({ ...old, lastName }))}
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(email) => setForm((old) => ({ ...old, email }))}
          />
          <Field
            label="Numero di telefono"
            value={form.phone}
            onChange={(phone) => setForm((old) => ({ ...old, phone }))}
          />
          <div className="sm:col-span-2">
            <Label>Ruoli</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {roleLabels[role]}
                </Badge>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="profile-signature">Firma personale</Label>
            <Textarea
              id="profile-signature"
              value={form.signature}
              onChange={(event) =>
                setForm((old) => ({ ...old, signature: event.target.value }))
              }
            />
          </div>
          <SettingSelect
            label="Lingua"
            value={identity.personalPreferences.language}
            options={[
              ["it", "Italiano"],
              ["en", "English"],
            ]}
            onChange={(language) =>
              identity.setPersonalPreferences({
                language: language as PersonalPreferences["language"],
              })
            }
          />
          <Field
            label="Fuso orario"
            value={identity.personalPreferences.timeZone}
            onChange={(timeZone) =>
              identity.setPersonalPreferences({ timeZone })
            }
          />
          <SettingSelect
            label="Pagina iniziale"
            value={identity.personalPreferences.homePage}
            options={[
              ["/dashboard", "Panoramica"],
              ["/dashboard/attivita", "Attività"],
              ["/dashboard/calendario", "Calendario"],
              ["/dashboard/commercial/leads", "Lead"],
            ]}
            onChange={(homePage) =>
              identity.setPersonalPreferences({ homePage })
            }
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save}>Salva profilo</Button>
        </div>
      </div>
      <EntityImageDialog
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        title="Foto profilo"
        description="Scegli un'immagine quadrata e nitida."
        currentUrl={user.avatarUrl}
        fallback="Profilo"
        onSave={(url) => identity.updateUserAvatar(user.id, url)}
      />
    </SectionCard>
  );
}

function ArtificialIntelligenceSettings() {
  const intelligence = useCompanyIntelligence();
  const openai = intelligence.providers.find(
    (provider) => provider.id === "openai",
  );
  return (
    <div className="space-y-4">
      <SectionCard
        title="OpenAI e Company Intelligence"
        description="Configurazione server per la sintesi dei report aziendali."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Stato OpenAI</p>
            <Badge
              className="mt-2"
              variant={openai?.configured ? "secondary" : "outline"}
            >
              {openai?.configured
                ? "Configurato lato server"
                : "Non configurato"}
            </Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              {openai?.detail ?? "Stato non disponibile"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Budget e consumo</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Budget, costi e limiti vengono mostrati soltanto quando restituiti
              dal contratto backend autorizzato.
            </p>
          </div>
          <div className="rounded-lg border p-3 sm:col-span-2">
            <p className="text-sm font-medium">Conservazione</p>
            <p className="mt-2 text-xs text-muted-foreground">
              I report sono restituiti dal backend e non vengono persistiti nel
              browser.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            intelligence
              .refresh()
              .then(() => toast.success("Stato provider aggiornato"))
          }
        >
          Test connessione sicuro
        </Button>
      </SectionCard>
      <SectionCard title="Limiti di sicurezza">
        <p className="text-sm text-muted-foreground">
          La chiave non viene mai inviata al browser né mostrata dopo la
          configurazione. LinkedIn non viene sottoposto a scraping; gli URL sono
          confermati manualmente o gestiti da un provider autorizzato.
        </p>
      </SectionCard>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Password"
        description="La password viene verificata sul server e non viene salvata nel browser."
      >
        <div className="max-w-xl">
          <p className="text-sm text-muted-foreground">
            Per impostare una nuova password richiedi un collegamento monouso.
            Al completamento tutte le sessioni precedenti vengono invalidate.
          </p>
          <Button asChild className="mt-4">
            <Link href="/forgot-password">Reimposta password</Link>
          </Button>
        </div>
      </SectionCard>
      <SectionCard title="Protezione dell’account">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            [
              "Sessione sicura",
              "Cookie HttpOnly, SameSite Lax e scadenza controllata.",
            ],
            [
              "Ricordami",
              "Estende la durata della sessione soltanto quando richiesto.",
            ],
            [
              "Protezione tentativi",
              "Rate limit e blocco temporaneo riducono gli attacchi ripetuti.",
            ],
            ["Autenticazione a due fattori", "Non ancora configurata."],
          ].map(([item, description]) => (
            <div key={item} className="rounded-lg border p-3">
              <p className="font-medium">{item}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function NotificationSettings() {
  const identity = useDoflowIdentity();
  const prefs = identity.personalPreferences;
  return (
    <SectionCard
      title="Notifiche"
      description="Scegli quando ricevere gli avvisi nel gestionale. I canali esterni non configurati non vengono simulati."
    >
      <div className="space-y-4">
        <SettingSelect
          label="Frequenza predefinita"
          value={prefs.notificationFrequency}
          options={frequencyOptions}
          onChange={(value) =>
            identity.setPersonalPreferences({
              notificationFrequency: value as NotificationFrequency,
            })
          }
        />
        <div className="divide-y rounded-lg border">
          {notificationCategories.map((category) => (
            <div
              key={category}
              className="grid items-center gap-2 p-3 sm:grid-cols-[1fr_220px]"
            >
              <Label>{category}</Label>
              <Select
                value={
                  prefs.notificationRules[category] ??
                  prefs.notificationFrequency
                }
                onValueChange={(value) =>
                  identity.setPersonalPreferences({
                    notificationRules: {
                      ...prefs.notificationRules,
                      [category]: value as NotificationFrequency,
                    },
                  })
                }
              >
                <SelectTrigger aria-label={`Frequenza ${category}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencyOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
const frequencyOptions = [
  ["immediate", "Immediate"],
  ["daily", "Riepilogo giornaliero"],
  ["off", "Disattivate"],
];

function AppearanceSettings() {
  const identity = useDoflowIdentity();
  const prefs = identity.personalPreferences;
  const { setTheme } = useTheme();
  const save = (updates: Partial<PersonalPreferences>) => {
    identity.setPersonalPreferences(updates);
    if (updates.theme) setTheme(updates.theme);
  };
  return (
    <SectionCard title="Aspetto e preferenze">
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingSelect
          label="Tema"
          value={prefs.theme}
          options={[
            ["system", "Sistema"],
            ["light", "Chiaro"],
            ["dark", "Scuro"],
          ]}
          onChange={(theme) =>
            save({ theme: theme as PersonalPreferences["theme"] })
          }
        />
        <SettingSelect
          label="Densità interfaccia"
          value={prefs.density}
          options={[
            ["comfortable", "Comoda"],
            ["compact", "Compatta"],
          ]}
          onChange={(density) =>
            save({ density: density as PersonalPreferences["density"] })
          }
        />
        <SettingSelect
          label="Formato data"
          value={prefs.dateFormat}
          options={[
            ["dd/MM/yyyy", "GG/MM/AAAA"],
            ["MM/dd/yyyy", "MM/GG/AAAA"],
            ["yyyy-MM-dd", "AAAA-MM-GG"],
          ]}
          onChange={(dateFormat) =>
            save({
              dateFormat: dateFormat as PersonalPreferences["dateFormat"],
            })
          }
        />
        <SettingSelect
          label="Formato ora"
          value={prefs.timeFormat}
          options={[
            ["24h", "24 ore"],
            ["12h", "12 ore"],
          ]}
          onChange={(timeFormat) =>
            save({
              timeFormat: timeFormat as PersonalPreferences["timeFormat"],
            })
          }
        />
        <SettingSelect
          label="Primo giorno della settimana"
          value={prefs.weekStartsOn}
          options={[
            ["monday", "Lunedì"],
            ["sunday", "Domenica"],
          ]}
          onChange={(weekStartsOn) =>
            save({
              weekStartsOn: weekStartsOn as PersonalPreferences["weekStartsOn"],
            })
          }
        />
        <SettingSelect
          label="Vista Calendario"
          value={prefs.calendarView}
          options={[
            ["month", "Mese"],
            ["week", "Settimana"],
            ["day", "Giorno"],
            ["agenda", "Agenda"],
          ]}
          onChange={(calendarView) =>
            save({
              calendarView: calendarView as PersonalPreferences["calendarView"],
            })
          }
        />
        <SettingSelect
          label="Vista Commerciale"
          value={prefs.commercialView}
          options={[
            ["list", "Lista"],
            ["kanban", "Kanban"],
            ["deadlines", "Scadenze"],
            ["appointments", "Appuntamenti"],
          ]}
          onChange={(commercialView) =>
            save({
              commercialView:
                commercialView as PersonalPreferences["commercialView"],
            })
          }
        />
        <Label className="flex items-center gap-2 rounded-lg border p-3 font-normal">
          <Checkbox
            checked={prefs.reduceMotion}
            onCheckedChange={(value) => save({ reduceMotion: value === true })}
          />
          Riduci animazioni
        </Label>
      </div>
    </SectionCard>
  );
}

function CompanySettings() {
  const store = useCommercialLeads();
  const settings = store.commerceSettings;
  const [logoOpen, setLogoOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({
    ...settings.supplierProfile,
    currency: settings.currency ?? "EUR",
    vat: String(settings.defaultVatRate ?? 22),
  }));
  const set = (key: string, value: string) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const fields = [
    ["legalName", "Ragione sociale *"],
    ["brandName", "Nome commerciale *"],
    ["legalHolder", "Intestatario"],
    ["vatNumber", "Partita IVA"],
    ["taxCode", "Codice fiscale"],
    ["address", "Indirizzo"],
    ["postalCode", "CAP"],
    ["city", "Città"],
    ["province", "Provincia"],
    ["country", "Paese"],
    ["email", "Email aziendale"],
    ["certifiedEmail", "PEC"],
    ["sdiCode", "Codice SDI"],
    ["phone", "Telefono"],
    ["website", "Sito web"],
  ] as const;
  return (
    <SectionCard
      title="Dati aziendali"
      description="Questi dati vengono utilizzati nei documenti commerciali."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          {draft.logoUrl ? (
            <img
              src={draft.logoUrl}
              alt="Logo aziendale"
              className="size-16 rounded-lg border object-contain"
            />
          ) : (
            <div className="grid size-16 place-items-center rounded-lg border bg-muted">
              <Building2 className="size-6 text-muted-foreground" />
            </div>
          )}
          <Button variant="outline" onClick={() => setLogoOpen(true)}>
            {draft.logoUrl ? "Sostituisci logo" : "Aggiungi logo"}
          </Button>
          {draft.logoUrl && (
            <Button variant="ghost" onClick={() => set("logoUrl", "")}>
              Rimuovi logo
            </Button>
          )}
        </div>
        {fields.map(([key, label]) => (
          <Field
            key={key}
            label={label}
            value={draft[key] ?? ""}
            onChange={(value) => set(key, value)}
          />
        ))}
        <SettingSelect
          label="Valuta"
          value={draft.currency}
          options={[
            ["EUR", "Euro (EUR)"],
            ["USD", "Dollaro (USD)"],
            ["GBP", "Sterlina (GBP)"],
          ]}
          onChange={(value) => set("currency", value)}
        />
        <Field
          label="Aliquota IVA predefinita"
          type="number"
          value={draft.vat}
          onChange={(value) => set("vat", value)}
        />
        <div className="sm:col-span-2 flex justify-end">
          <Button
            onClick={() =>
              store.updateCommerceSettings({
                supplierProfile: {
                  ...Object.fromEntries(
                    fields.map(([key]) => [key, draft[key] ?? ""]),
                  ),
                  logoUrl: draft.logoUrl || undefined,
                } as typeof settings.supplierProfile,
                currency: draft.currency,
                defaultVatRate: Number(draft.vat),
              }) && toast.success("Dati aziendali salvati")
            }
          >
            Salva dati aziendali
          </Button>
        </div>
      </div>
      <EntityImageDialog
        open={logoOpen}
        onOpenChange={setLogoOpen}
        title="Logo aziendale"
        description="Scegli il logo usato nei documenti commerciali."
        currentUrl={draft.logoUrl}
        fallback="Logo"
        onSave={(url) => {
          set("logoUrl", url ?? "");
          return true;
        }}
      />
    </SectionCard>
  );
}

function TeamSettings() {
  const identity = useDoflowIdentity();
  const canAdmin = identity.hasCapability("canManageRoles");
  return (
    <div className="space-y-4">
      <TeamPresencePanel />
      {canAdmin && (
        <SectionCard
          title="Team e utenti"
          description="Gestisci gli account esistenti. Gli inviti saranno disponibili con l’accesso sicuro."
        >
          <div className="space-y-3">
            {identity.users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <UserAvatar userId={user.id} name={user.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {user.name} {user.lastName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {roleLabels[role]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Badge
                  variant={(user.active ?? true) ? "outline" : "secondary"}
                >
                  {(user.active ?? true) ? "Attivo" : "Disattivato"}
                </Badge>
                {user.id !== identity.currentUserId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      identity.updateUserActive(
                        user.id,
                        !(user.active ?? true),
                      ) &&
                      toast.success(
                        (user.active ?? true)
                          ? "Account disattivato"
                          : "Account riattivato",
                      )
                    }
                  >
                    {(user.active ?? true) ? "Disattiva" : "Riattiva"}
                  </Button>
                )}
              </div>
            ))}
            <Button disabled>Invita utente</Button>
            <p className="text-xs text-muted-foreground">
              Inviti, reinvii e trasferimento automatico dei record richiedono
              la gestione account sicura.
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function DocumentSettings() {
  const store = useCommercialLeads();
  const current = store.commerceSettings.documentSettings!;
  const [draft, setDraft] = useState(current);
  return (
    <SectionCard title="Documenti e numerazione">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Prefisso preventivi"
          value={draft.quotePrefix}
          onChange={(quotePrefix) =>
            setDraft((old) => ({ ...old, quotePrefix }))
          }
        />
        <Field
          label="Validità predefinita (giorni)"
          type="number"
          value={String(draft.quoteValidityDays)}
          onChange={(value) =>
            setDraft((old) => ({ ...old, quoteValidityDays: Number(value) }))
          }
        />
        <Field
          label="Termini di pagamento"
          value={draft.paymentTerms}
          onChange={(paymentTerms) =>
            setDraft((old) => ({ ...old, paymentTerms }))
          }
        />
        <Field
          label="Coordinate bancarie"
          value={draft.bankDetails}
          onChange={(bankDetails) =>
            setDraft((old) => ({ ...old, bankDetails }))
          }
        />
        <div className="sm:col-span-2">
          <Label htmlFor="document-notes">Note predefinite</Label>
          <Textarea
            id="document-notes"
            value={draft.defaultNotes}
            onChange={(event) =>
              setDraft((old) => ({ ...old, defaultNotes: event.target.value }))
            }
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button
            onClick={() =>
              store.updateCommerceSettings({ documentSettings: draft }) &&
              toast.success("Impostazioni documenti salvate")
            }
          >
            Salva impostazioni
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function SalesSettings() {
  const store = useCommercialLeads();
  const current = store.commerceSettings.salesSettings!;
  const [draft, setDraft] = useState(current);
  return (
    <SectionCard title="Vendite e pagamenti">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Acconto predefinito (%)"
          type="number"
          value={String(draft.defaultDepositPercent)}
          onChange={(value) =>
            setDraft((old) => ({
              ...old,
              defaultDepositPercent: Number(value),
            }))
          }
        />
        <Field
          label="Promemoria rinnovo (giorni)"
          type="number"
          value={String(draft.renewalReminderDays)}
          onChange={(value) =>
            setDraft((old) => ({ ...old, renewalReminderDays: Number(value) }))
          }
        />
        <div className="sm:col-span-2">
          <Label>Metodi di pagamento abilitati</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            {draft.enabledPaymentMethods.join(", ")}
          </p>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button
            onClick={() =>
              store.updateCommerceSettings({ salesSettings: draft }) &&
              toast.success("Regole di vendita salvate")
            }
          >
            Salva regole
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function StatusCards({ title, items }: { title: string; items: string[] }) {
  return (
    <SectionCard
      title={title}
      description="Le funzioni non configurate sono indicate chiaramente come non disponibili."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{item}</p>
              <Badge variant="secondary">Non configurato</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Nessun collegamento attivo.
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
function DataSettings({ tools }: { tools: ReactNode }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Dati, archivio e privacy">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            [
              "Esportazione dati",
              "Disponibile dalle viste operative autorizzate.",
            ],
            ["Importazione", "Non configurata."],
            ["Log attività", "Consultabile nella History dei record."],
            ["Archivio", "I record archiviati restano recuperabili."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-lg border p-3">
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <section aria-labelledby="danger-zone">
        <h2
          id="danger-zone"
          className="mb-2 text-sm font-semibold text-destructive"
        >
          Zona pericolosa
        </h2>
        {tools}
      </section>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = `setting-${label.toLocaleLowerCase("it-IT").replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  const id = `setting-${label.toLocaleLowerCase("it-IT").replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([option, text]) => (
            <SelectItem key={option} value={option}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
