"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  Camera,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  ScanSearch,
} from "lucide-react";
import { toast } from "sonner";

import {
  formatItalianDate,
  formatItalianDateTime,
  formatRelativeDeadline,
} from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EntityImageDialog } from "@/components/entity-image-dialog";
import { ClientActivitiesTab } from "@/features/commercial/components/client-activities-tab";
import {
  ClientCareFinanceTab,
  ClientCommunicationsTab,
  ClientContractsRenewalsSummary,
  ClientDocumentsTab,
  ClientTimelineTab,
} from "@/features/commercial/components/client-operations-tabs";
import { ClientProjectsTab } from "@/features/commercial/components/client-projects-tab";
import { CustomerLogo } from "@/features/commercial/components/customer-logo";
import { RecordCollaborationPanel } from "@/features/commercial/components/record-collaboration-panel";
import { OpenInCalendarLink } from "@/features/commercial/components/open-in-calendar-link";
import { DocumentStatusBadge } from "@/features/commercial/document-status";
import {
  type CustomerContact,
  useCommercialLeads,
} from "@/features/commercial/components/commercial-leads-provider";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import { AccessDenied } from "@/features/identity/access-denied";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { canManageCustomerBranding } from "@/features/identity/permissions";
import { DesktopMeetingAction } from "@/features/calls/desktop-meeting-action";
import { DesktopUserCallActions } from "@/features/calls/desktop-user-call-action";

const money = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  maximumFractionDigits: 0,
});
const tabs = [
  "overview",
  "activities",
  "projects",
  "communications",
  "documents",
  "payments",
  "timeline",
] as const;
const customerStatuses = [
  "Da avviare",
  "Onboarding",
  "In corso",
  "Consegnato",
  "Assistenza",
  "Rinnovo",
  "Attivo",
  "In attesa cliente",
  "Sospeso",
  "Completato",
] as const;
type Tab = (typeof tabs)[number];
type ProfileForm = {
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vatNumber: string;
  taxCode: string;
  location: string;
  service: string;
  assigneeId: string;
  status: (typeof customerStatuses)[number];
  notes: string;
};
type ContactForm = {
  name: string;
  role: string;
  email: string;
  phone: string;
  vatNumber: string;
  taxCode: string;
};
const emptyContact: ContactForm = {
  name: "",
  role: "",
  email: "",
  phone: "",
  vatNumber: "",
  taxCode: "",
};

function SummaryBox({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card
      className={
        onClick
          ? "cursor-pointer transition-colors hover:border-primary/35"
          : ""
      }
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm font-medium">{children}</CardContent>
    </Card>
  );
}

export function CommercialClientDetailPage({ clientId }: { clientId: string }) {
  const commercialTeam = useCommercialTeam();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const customer = store.customers.find((item) => item.id === clientId);
  const activeTab = tabs.includes(search.get("tab") as Tab)
    ? (search.get("tab") as Tab)
    : "overview";
  const [activityOpen, setActivityOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm | null>(null);
  const [logoOpen, setLogoOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(
    null,
  );
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<
    "Attività" | "Chiamata" | "WhatsApp" | "Email" | "Riunione"
  >("Attività");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"Bassa" | "Media" | "Alta">("Media");
  if (!customer && store.allCustomers.some((item) => item.id === clientId))
    return <AccessDenied resource="a questa scheda cliente" />;
  if (!customer)
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente non trovato</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  const lead =
    store.leads.find((item) => item.id === customer.sourceLeadId) ??
    customer.profile;
  const owner = commercialTeam.find((member) => member.id === lead.assigneeId);
  const contacts = (customer.contacts ?? []).filter(
    (contact) => !contact.archivedAt,
  );
  const primaryContact = contacts.find(
    (contact) => contact.id === customer.primaryContactId,
  );
  const activities = [
    ...(customer.activities ?? []),
    ...(customer.onboardingActivity ? [customer.onboardingActivity] : []),
  ].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const nextActivity = activities.find(
    (activity) => activity.status !== "Completata",
  );
  const clientProjects = store.projects.filter(
    (project) => project.clientId === customer.id,
  );
  const events = [
    {
      id: `lead-${lead.id}`,
      title: "Lead acquisito",
      detail: `Richiesta acquisita da ${lead.source}.`,
      date: lead.createdAt,
      author: "Sistema",
      badge: "Lead",
    },
    ...store.timelineEvents
      .filter((event) => event.leadId === customer.sourceLeadId)
      .map((event) => ({
        ...event,
        badge: event.title.includes("Cliente")
          ? "Cliente"
          : event.title.includes("Progetto")
            ? "Progetto"
            : "Lead",
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const setTab = (tab: Tab) => router.replace(`${pathname}?tab=${tab}`);
  const saveActivity = () => {
    if (!title.trim() || !dueDate || saving) return;
    setSaving(true);
    store.addCustomerActivity(customer.id, {
      title: title.trim(),
      type,
      description: description.trim(),
      dueAt: new Date(`${dueDate}T12:00:00`).toISOString(),
      assigneeId: lead.assigneeId,
      priority,
      status: "Da fare",
    });
    toast.success("Attività creata");
    setSaving(false);
    setActivityOpen(false);
    setTitle("");
    setDescription("");
    setDueDate("");
  };
  const openProfile = () => {
    setProfileForm({
      company: customer.profile.company,
      firstName: customer.profile.firstName,
      lastName: customer.profile.lastName,
      email: customer.profile.email,
      phone: customer.profile.phone,
      vatNumber: customer.profile.vatNumber ?? "",
      taxCode: customer.profile.taxCode ?? "",
      location: customer.profile.location ?? "",
      service: customer.profile.service,
      assigneeId: customer.profile.assigneeId,
      status: customer.status,
      notes: customer.notes ?? "",
    });
    setProfileOpen(true);
  };
  const saveProfile = () => {
    if (!profileForm?.company.trim()) return;
    const assigneeId = identity.hasCapability("canAssignLeads")
      ? profileForm.assigneeId
      : customer.profile.assigneeId;
    const ownerName =
      commercialTeam.find((member) => member.id === assigneeId)?.name ??
      customer.profile.owner;
    const { status, notes, ...profile } = profileForm;
    store.updateCustomerProfile(
      customer.id,
      {
        ...profile,
        assigneeId,
        company: profile.company.trim(),
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
        owner: ownerName,
      },
      { status, notes },
    );
    setProfileOpen(false);
    toast.success("Anagrafica cliente aggiornata");
  };
  const openContact = (contact?: CustomerContact) => {
    setEditingContact(contact ?? null);
    setContactForm(
      contact
        ? {
            name: contact.name,
            role: contact.role ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            vatNumber: contact.vatNumber ?? "",
            taxCode: contact.taxCode ?? "",
          }
        : emptyContact,
    );
    setContactOpen(true);
  };
  const saveContact = () => {
    if (!contactForm.name.trim()) return;
    const values = {
      ...contactForm,
      name: contactForm.name.trim(),
      role: contactForm.role.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      phone: contactForm.phone.trim() || undefined,
      vatNumber: contactForm.vatNumber.trim() || undefined,
      taxCode: contactForm.taxCode.trim() || undefined,
    };
    if (editingContact)
      store.updateCustomerContact(customer.id, editingContact.id, values);
    else store.addCustomerContact(customer.id, values);
    setContactOpen(false);
    setEditingContact(null);
    toast.success(
      editingContact ? "Referente aggiornato" : "Referente aggiunto",
    );
  };
  const latestCommunication = [...(customer.communications ?? [])]
    .filter((item) => !item.archivedAt)
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )[0];
  const finance = customer.finance ?? {
    total: lead.value,
    deposit: 0,
    paid: 0,
    invoiced: 0,
  };
  const canViewAdministration = identity.hasCapability("canViewAdministration");
  const canEditLogo = canManageCustomerBranding(
    identity.currentUser,
    customer,
    {
      leads: store.allLeads,
      customers: store.allCustomers,
      projects: store.allProjects,
    },
  );

  if (!identity.hasCapability("canEditCustomers"))
    return (
      <main className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{lead.company}</h1>
            <Badge>{customer.status}</Badge>
            <Badge variant="outline">Vista operativa</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {lead.service} · dati commerciali e amministrativi non disponibili
            per questo ruolo.
          </p>
        </header>
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progetti assegnati</CardTitle>
              <CardDescription>
                Fasi, avanzamento e consegne autorizzate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {clientProjects.map((project) => (
                <Button
                  key={project.id}
                  asChild
                  variant="outline"
                  className="w-full justify-between"
                >
                  <Link href={`/dashboard/progetti/${project.id}`}>
                    {project.name}
                    <Badge variant="secondary">{project.status}</Badge>
                  </Link>
                </Button>
              ))}
              {!clientProjects.length && (
                <p className="text-sm text-muted-foreground">
                  Nessun progetto assegnato.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attività assegnate</CardTitle>
              <CardDescription>Scadenze e stati operativi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activities
                .filter(
                  (activity) => activity.assigneeId === identity.currentUserId,
                )
                .map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <span>
                      <span className="block text-sm font-medium">
                        {activity.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatItalianDate(activity.dueAt)}
                      </span>
                    </span>
                    <Badge variant="outline">{activity.status}</Badge>
                  </div>
                ))}
              {!activities.some(
                (activity) => activity.assigneeId === identity.currentUserId,
              ) && (
                <p className="text-sm text-muted-foreground">
                  Nessuna attività assegnata.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Documenti tecnici</CardTitle>
              <CardDescription>
                Metadati dei documenti collegati al cliente o ai progetti
                visibili; nessuna simulazione di upload.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {(customer.documents ?? [])
                .filter(
                  (document) =>
                    !document.archivedAt &&
                    (!document.projectId ||
                      clientProjects.some(
                        (project) => project.id === document.projectId,
                      )),
                )
                .map((document) => (
                  <div key={document.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{document.name}</p>
                    <DocumentStatusBadge
                      className="mt-2"
                      status={document.status}
                    />
                  </div>
                ))}
              {!(customer.documents ?? []).some(
                (document) => !document.archivedAt,
              ) && (
                <p className="text-sm text-muted-foreground">
                  Nessun documento tecnico disponibile.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    );

  return (
    <main
      className="@container/client mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6"
      data-flow-tour="flow-customer-detail"
    >
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline">
          <Link
            href={`/dashboard/company-intelligence?customerId=${customer.id}&url=${encodeURIComponent(lead.email.includes("@") ? lead.email.split("@")[1] : "")}`}
          >
            <ScanSearch />
            Analizza azienda
          </Link>
        </Button>
        <OpenInCalendarLink
          date={nextActivity?.dueAt || nextActivity?.dueDate}
          eventId={nextActivity ? `activity:${nextActivity.id}` : undefined}
        />
      </div>
      <header
        data-flow-tour="flow-client-header"
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <CustomerLogo customer={customer} className="size-14" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {lead.company}
              </h1>
              <Badge>{customer.status}</Badge>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {lead.firstName} {lead.lastName} · {lead.service} ·{" "}
              {owner?.name ?? lead.owner}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DesktopUserCallActions userId={customer.profile.assigneeId} context={{ kind: "company", id: customer.id }} label={owner?.name || "responsabile cliente"} />
          <DesktopMeetingAction context={{ kind: "company", id: customer.id }} />
          <RecordCollaborationPanel
            recordType="customer"
            recordId={customer.id}
            label={lead.company}
          />
          {canEditLogo && (
            <Button variant="outline" onClick={() => setLogoOpen(true)}>
              <Camera />
              Logo
            </Button>
          )}
          <Button variant="outline" onClick={openProfile}>
            <Pencil />
            Modifica
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Azioni cliente">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/commercial/leads/${customer.sourceLeadId}`}
                >
                  Apri trattativa originale
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setActivityOpen(true)}>
            <CalendarClock />
            Nuova attività
          </Button>
        </div>
        {logoOpen && (
          <EntityImageDialog
            open={logoOpen}
            onOpenChange={setLogoOpen}
            title={`Logo di ${lead.company}`}
            description="Salvato sul profilo cliente dopo la conferma del server."
            currentUrl={customer.logoUrl}
            fallback={lead.company.slice(0, 2).toUpperCase()}
            onSave={async (logoUrl) => {
              const saved = await store.updateCustomerLogo(customer.id, logoUrl);
              if (saved)
                toast.success(
                  logoUrl ? "Logo cliente aggiornato" : "Logo cliente rimosso",
                );
              return saved;
            }}
          />
        )}
      </header>
      <section
        data-flow-tour="client-summary-cards"
        className="flow-customer-summary-cards grid gap-3 sm:grid-cols-2 @4xl/client:grid-cols-5"
      >
        <SummaryBox
          label="Prossima azione"
          onClick={() => setTab("activities")}
        >
          {nextActivity ? (
            <>
              <p>{nextActivity.title}</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatItalianDate(nextActivity.dueAt)} ·{" "}
                    {formatRelativeDeadline(nextActivity.dueAt)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  {formatItalianDateTime(nextActivity.dueAt)}
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            "Nessuna attività pianificata"
          )}
        </SummaryBox>
        <SummaryBox label="Referente principale">
          <p>{primaryContact?.name ?? `${lead.firstName} ${lead.lastName}`}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {primaryContact?.email ?? lead.email}
          </p>
          <p className="text-xs text-muted-foreground">
            {primaryContact?.phone ?? lead.phone}
          </p>
          <div className="mt-2 flex gap-1">
            <Button asChild size="icon-sm" variant="ghost">
              <a
                href={`tel:${primaryContact?.phone ?? lead.phone}`}
                aria-label="Chiama"
              >
                <Phone />
              </a>
            </Button>
            <Button asChild size="icon-sm" variant="ghost">
              <a
                href={`https://wa.me/${(primaryContact?.phone ?? lead.phone).replace(/\D/g, "")}`}
                aria-label="WhatsApp"
              >
                <MessageCircle />
              </a>
            </Button>
            <Button asChild size="icon-sm" variant="ghost">
              <a
                href={`mailto:${primaryContact?.email ?? lead.email}`}
                aria-label="Email"
              >
                <Mail />
              </a>
            </Button>
          </div>
        </SummaryBox>
        <SummaryBox
          label="Onboarding / progetto"
          onClick={() =>
            setTab(clientProjects.length ? "projects" : "activities")
          }
        >
          <p>{clientProjects[0]?.name ?? customer.status}</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {clientProjects.length
              ? `${clientProjects.length} progetto${clientProjects.length === 1 ? "" : "i"} collegato${clientProjects.length === 1 ? "" : "i"}`
              : `0/${activities.length || 1} attività completate`}
          </p>
        </SummaryBox>
        <SummaryBox
          label="Ultima comunicazione"
          onClick={() => setTab("communications")}
        >
          {latestCommunication ? (
            <>
              <p>{latestCommunication.title}</p>
              <p className="text-xs text-muted-foreground">
                {latestCommunication.channel} ·{" "}
                {formatItalianDateTime(latestCommunication.occurredAt)}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Nessuna comunicazione registrata
            </p>
          )}
        </SummaryBox>
        {canViewAdministration ? (
          <SummaryBox
            label="Amministrazione"
            onClick={() => setTab("payments")}
          >
            <p>Totale {money.format(finance.total)}</p>
            <p className="text-chart-3">Pagato {money.format(finance.paid)}</p>
            <p className="text-muted-foreground">
              Residuo {money.format(Math.max(0, finance.total - finance.paid))}{" "}
              ·{" "}
              {finance.total
                ? Math.round((finance.paid / finance.total) * 100)
                : 0}
              %
            </p>
          </SummaryBox>
        ) : (
          <SummaryBox
            label="Assistenza e rinnovo"
            onClick={() => setTab("payments")}
          >
            <p>{customer.care?.mode ?? "Nessuna modalità"}</p>
            <p className="text-xs text-muted-foreground">
              {customer.care?.nextDueAt
                ? formatItalianDate(customer.care.nextDueAt)
                : "Nessuna scadenza"}
            </p>
          </SummaryBox>
        )}
      </section>
      <Tabs value={activeTab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="flex h-10 w-full justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            ["overview", "Panoramica"],
            ["activities", "Attività"],
            ["projects", "Progetti"],
            ["communications", "Comunicazioni"],
            ["documents", "Documenti"],
            ["payments", canViewAdministration ? "Pagamenti" : "Assistenza"],
            ["timeline", "Timeline"],
          ].map(([value, label]) => (
            <TabsTrigger
              data-flow-tour={
                value === "activities"
                  ? "flow-customer-activities"
                  : value === "documents"
                    ? "flow-customer-files"
                    : value === "payments"
                      ? "flow-customer-admin"
                      : undefined
              }
              key={value}
              value={value}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <section className="grid gap-4 @4xl/client:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Origine e storico commerciale
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Fonte</span>
                  <br />
                  {lead.source}
                </p>
                <p>
                  <span className="text-muted-foreground">Acquisito il</span>
                  <br />
                  {formatItalianDate(lead.createdAt)}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    Servizio richiesto
                  </span>
                  <br />
                  {lead.service}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    Responsabile commerciale
                  </span>
                  <br />
                  {owner?.name ?? lead.owner}
                </p>
                <p>
                  <span className="text-muted-foreground">Valore iniziale</span>
                  <br />
                  {money.format(lead.value)}
                </p>
                <p>
                  <span className="text-muted-foreground">Valore finale</span>
                  <br />
                  {money.format(lead.value)}
                </p>
                <Button
                  asChild
                  className="w-fit sm:col-span-2"
                  variant="outline"
                >
                  <Link
                    href={`/dashboard/commercial/leads/${customer.sourceLeadId}`}
                  >
                    Apri scheda commerciale
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attività aperte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activities
                  .filter((activity) => activity.status !== "Completata")
                  .slice(0, 3)
                  .map((activity) => (
                    <div key={activity.id} className="flex gap-2 text-sm">
                      <Mail className="mt-0.5 size-4 text-cyan-600" />
                      <div className="min-w-0">
                        <p className="font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatItalianDate(activity.dueAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                <Button
                  size="sm"
                  variant="link"
                  className="px-0"
                  onClick={() => setTab("activities")}
                >
                  Vedi tutte le attività
                </Button>
              </CardContent>
            </Card>
          </section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Referenti</CardTitle>
                <CardDescription>
                  Gestisci i contatti del cliente e scegli il principale.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => openContact()}>
                Aggiungi referente
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {contacts.length ? (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {contact.name}
                        {contact.id === customer.primaryContactId ? (
                          <Badge className="ml-2" variant="secondary">
                            Principale
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[contact.role, contact.email, contact.phone]
                          .filter(Boolean)
                          .join(" · ") || "Nessun recapito"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <DesktopMeetingAction context={{ kind: "contact", id: contact.id }} compact label={`Crea link riunione per ${contact.name}`} />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={contact.id === customer.primaryContactId}
                        onClick={() => {
                          store.setPrimaryCustomerContact(
                            customer.id,
                            contact.id,
                          );
                          toast.success("Referente principale aggiornato");
                        }}
                      >
                        Imposta principale
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openContact(contact)}
                      >
                        Modifica
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          store.removeCustomerContact(customer.id, contact.id);
                          toast.success("Referente eliminato");
                        }}
                      >
                        Elimina
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nessun referente aggiunto.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline unificata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="border-l-2 border-primary/30 pl-3"
                >
                  <p className="text-sm font-medium">
                    {event.title}{" "}
                    <Badge variant="secondary">{event.badge}</Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {event.detail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatItalianDateTime(event.date)} · {event.author}
                  </p>
                </div>
              ))}
              <Button
                variant="link"
                className="px-0"
                onClick={() => setTab("timeline")}
              >
                Apri Timeline completa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent
          data-flow-tour="flow-customer-activities-content"
          value="activities"
          className="mt-4"
        >
          <ClientActivitiesTab
            clientId={customer.id}
            activityId={search.get("activityId")}
            onNew={() => setActivityOpen(true)}
          />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <ClientProjectsTab
            clientId={customer.id}
            onGoToActivities={() => setTab("activities")}
          />
        </TabsContent>
        <TabsContent value="communications" className="mt-4">
          <ClientCommunicationsTab clientId={customer.id} />
        </TabsContent>
        <TabsContent
          data-flow-tour="flow-customer-files-content"
          value="documents"
          className="mt-4"
        >
          <ClientDocumentsTab clientId={customer.id} />
        </TabsContent>
        <TabsContent
          data-flow-tour="flow-customer-admin-content"
          value="payments"
          className="mt-4"
        >
          <ClientCareFinanceTab
            clientId={customer.id}
            showAdministration={canViewAdministration}
          />
          <ClientContractsRenewalsSummary clientId={customer.id} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <ClientTimelineTab clientId={customer.id} />
        </TabsContent>
      </Tabs>
      <Dialog
        open={profileOpen}
        onOpenChange={(open) => {
          setProfileOpen(open);
          if (!open) setProfileForm(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica anagrafica cliente</DialogTitle>
          </DialogHeader>
          {profileForm && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="profile-company">
                  Nome o ragione sociale *
                </Label>
                <Input
                  id="profile-company"
                  value={profileForm.company}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      company: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="profile-first-name">Nome referente</Label>
                <Input
                  id="profile-first-name"
                  value={profileForm.firstName}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      firstName: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="profile-last-name">Cognome referente</Label>
                <Input
                  id="profile-last-name"
                  value={profileForm.lastName}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      lastName: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      email: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="profile-phone">Telefono</Label>
                <Input
                  id="profile-phone"
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      phone: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="profile-vat-number">Partita IVA</Label>
                <Input
                  id="profile-vat-number"
                  value={profileForm.vatNumber}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      vatNumber: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="profile-tax-code">Codice fiscale</Label>
                <Input
                  id="profile-tax-code"
                  value={profileForm.taxCode}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      taxCode: event.target.value,
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="profile-location">Indirizzo</Label>
                <Input
                  id="profile-location"
                  value={profileForm.location}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      location: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="profile-service">Servizio</Label>
                <Input
                  id="profile-service"
                  value={profileForm.service}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      service: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Responsabile</Label>
                <Select
                  value={profileForm.assigneeId}
                  onValueChange={(value) =>
                    setProfileForm({ ...profileForm, assigneeId: value })
                  }
                >
                  <SelectTrigger aria-label="Responsabile cliente">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commercialTeam.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stato cliente</Label>
                <Select
                  value={profileForm.status}
                  onValueChange={(value) =>
                    setProfileForm({
                      ...profileForm,
                      status: value as ProfileForm["status"],
                    })
                  }
                >
                  <SelectTrigger aria-label="Stato cliente">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customerStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="profile-notes">Note</Label>
                <Textarea
                  id="profile-notes"
                  value={profileForm.notes}
                  onChange={(event) =>
                    setProfileForm({
                      ...profileForm,
                      notes: event.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>
              Annulla
            </Button>
            <Button
              disabled={!profileForm?.company.trim()}
              onClick={saveProfile}
            >
              Salva anagrafica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={contactOpen}
        onOpenChange={(open) => {
          setContactOpen(open);
          if (!open) setEditingContact(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Modifica referente" : "Aggiungi referente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="contact-name">Nome e cognome *</Label>
              <Input
                id="contact-name"
                value={contactForm.name}
                onChange={(event) =>
                  setContactForm({ ...contactForm, name: event.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="contact-role">Ruolo</Label>
              <Input
                id="contact-role"
                value={contactForm.role}
                onChange={(event) =>
                  setContactForm({ ...contactForm, role: event.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={contactForm.email}
                onChange={(event) =>
                  setContactForm({ ...contactForm, email: event.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="contact-phone">Telefono</Label>
              <Input
                id="contact-phone"
                value={contactForm.phone}
                onChange={(event) =>
                  setContactForm({ ...contactForm, phone: event.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="contact-vat-number">Partita IVA</Label>
              <Input
                id="contact-vat-number"
                value={contactForm.vatNumber}
                onChange={(event) =>
                  setContactForm({
                    ...contactForm,
                    vatNumber: event.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="contact-tax-code">Codice fiscale</Label>
              <Input
                id="contact-tax-code"
                value={contactForm.taxCode}
                onChange={(event) =>
                  setContactForm({
                    ...contactForm,
                    taxCode: event.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>
              Annulla
            </Button>
            <Button disabled={!contactForm.name.trim()} onClick={saveContact}>
              {editingContact ? "Salva referente" : "Aggiungi referente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova attività</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="activity-title">Titolo</Label>
              <Input
                id="activity-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as typeof type)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Attività",
                      "Chiamata",
                      "WhatsApp",
                      "Email",
                      "Riunione",
                    ].map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorità</Label>
                <Select
                  value={priority}
                  onValueChange={(value) =>
                    setPriority(value as typeof priority)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Bassa", "Media", "Alta"].map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="activity-date">Data</Label>
              <Input
                id="activity-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="activity-description">Descrizione</Label>
              <Textarea
                id="activity-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityOpen(false)}>
              Annulla
            </Button>
            <Button
              disabled={!title.trim() || !dueDate || saving}
              onClick={saveActivity}
            >
              {saving ? "Salvataggio…" : "Crea attività"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
