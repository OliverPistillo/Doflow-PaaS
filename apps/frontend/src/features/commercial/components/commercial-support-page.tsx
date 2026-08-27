"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlarmClock,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Clock3,
  FilePlus2,
  GripVertical,
  History,
  ListFilter,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Pause,
  PauseCircle,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  supportCategories,
  supportPriorities,
  supportSlaHoursByPriority,
  supportStatuses,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from "@/features/commercial/commercial-support";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import { RecordCollaborationPanel } from "@/features/commercial/components/record-collaboration-panel";
import { OpenInCalendarLink } from "@/features/commercial/components/open-in-calendar-link";
import {
  CommercialTimeline,
  type CommercialTimelineItem,
} from "@/features/commercial/components/commercial-timeline";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider";
import { PresenceUserOption } from "@/features/identity/presence-user-option";
import type { PresenceStatus } from "@/features/identity/presence";
import {
  canWorkSupportTicket,
  hasCapability,
} from "@/features/identity/permissions";

const openStatuses: SupportStatus[] = [
  "Nuovo",
  "Da valutare",
  "Assegnato",
  "In lavorazione",
  "In attesa cliente",
  "In attesa fornitore",
  "Bloccato",
  "In revisione",
  "Riaperto",
];
const kanbanStatuses: SupportStatus[] = [
  "Nuovo",
  "Da valutare",
  "Assegnato",
  "In lavorazione",
  "In attesa cliente",
  "Bloccato",
  "In revisione",
  "Risolto",
  "Chiuso",
];
const priorityTone: Record<SupportPriority, string> = {
  Bassa: "border-slate-400/40 text-slate-700 dark:text-slate-300",
  Media: "border-blue-400/40 text-blue-700 dark:text-blue-300",
  Alta: "border-amber-400/50 text-amber-700 dark:text-amber-300",
  Urgente: "border-orange-500/50 text-orange-700 dark:text-orange-300",
  Critica: "border-red-500/60 bg-red-500/5 text-red-700 dark:text-red-300",
};
type View =
  | "list"
  | "kanban"
  | "deadlines"
  | "mine"
  | "team"
  | "review"
  | "urgent"
  | "waiting"
  | "resolved"
  | "history";

export function CommercialSupportPage() {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedMine =
    searchParams.get("scope") === "mine" || searchParams.get("view") === "mine";
  const requestedOpen = searchParams.get("status") === "open";
  const requestedCustomerId = searchParams.get("customerId") ?? undefined;
  const requestedProjectId = searchParams.get("projectId") ?? undefined;
  const requestedCreate = searchParams.get("create") === "ticket";
  const [view, setView] = useState<View>(requestedMine ? "mine" : "list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupportStatus | "all">(
    "all",
  );
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => searchParams.get("ticket") ?? undefined,
  );
  const [createOpen, setCreateOpen] = useState(requestedCreate);
  const [currentTime] = useState(() => Date.now());
  const tickets = useMemo(
    () =>
      store.supportTickets
        .filter((ticket) => {
          const term = query.trim().toLocaleLowerCase("it-IT");
          if (
            term &&
            !`${ticket.code} ${ticket.title} ${ticket.description} ${ticket.category} ${ticket.service}`
              .toLocaleLowerCase("it-IT")
              .includes(term)
          )
            return false;
          if (
            (statusFilter !== "all" && ticket.status !== statusFilter) ||
            (assigneeFilter !== "all" && ticket.assigneeId !== assigneeFilter)
          )
            return false;
          if (requestedOpen && !openStatuses.includes(ticket.status))
            return false;
          if (
            (requestedMine || view === "mine") &&
            ![
              ticket.requesterId,
              ticket.assigneeId,
              ticket.supervisorId,
              ...ticket.collaboratorIds,
            ].includes(identity.currentUserId)
          )
            return false;
          if (view === "review" && ticket.status !== "In revisione")
            return false;
          if (
            view === "urgent" &&
            !["Urgente", "Critica"].includes(ticket.priority)
          )
            return false;
          if (
            view === "waiting" &&
            !["In attesa cliente", "In attesa fornitore"].includes(
              ticket.status,
            )
          )
            return false;
          if (
            view === "resolved" &&
            !["Risolto", "Chiuso"].includes(ticket.status)
          )
            return false;
          if (
            view === "history" &&
            !["Chiuso", "Annullato"].includes(ticket.status)
          )
            return false;
          if (
            view === "deadlines" &&
            (!ticket.dueAt ||
              !openStatuses.includes(ticket.status) ||
              Date.parse(ticket.dueAt) >= currentTime)
          )
            return false;
          return true;
        })
        .sort((a, b) =>
          view === "deadlines"
            ? (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")
            : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [
      assigneeFilter,
      currentTime,
      identity.currentUserId,
      query,
      requestedMine,
      requestedOpen,
      statusFilter,
      store.supportTickets,
      view,
    ],
  );
  const counts = {
    open: store.supportTickets.filter((ticket) =>
      openStatuses.includes(ticket.status),
    ).length,
    urgent: store.supportTickets.filter(
      (ticket) =>
        openStatuses.includes(ticket.status) &&
        ["Urgente", "Critica"].includes(ticket.priority),
    ).length,
    overdue: store.supportTickets.filter(
      (ticket) =>
        openStatuses.includes(ticket.status) &&
        ticket.dueAt &&
        Date.parse(ticket.dueAt) < currentTime,
    ).length,
    waiting: store.supportTickets.filter((ticket) =>
      ["In attesa cliente", "In attesa fornitore"].includes(ticket.status),
    ).length,
    review: store.supportTickets.filter(
      (ticket) => ticket.status === "In revisione",
    ).length,
    resolved: store.supportTickets.filter((ticket) =>
      ["Risolto", "Chiuso"].includes(ticket.status),
    ).length,
  };
  const reset = () => {
    setQuery("");
    setStatusFilter("all");
    setAssigneeFilter("all");
    setView("list");
    router.replace(pathname);
  };
  const kpis = [
    { id: "list", label: "Aperti", value: counts.open, icon: ListFilter },
    {
      id: "urgent",
      label: "Urgenti",
      value: counts.urgent,
      icon: AlertTriangle,
    },
    {
      id: "deadlines",
      label: "Scaduti",
      value: counts.overdue,
      icon: AlarmClock,
    },
    {
      id: "waiting",
      label: "In attesa",
      value: counts.waiting,
      icon: PauseCircle,
    },
    {
      id: "review",
      label: "In revisione",
      value: counts.review,
      icon: ShieldCheck,
    },
    {
      id: "resolved",
      label: "Risolti",
      value: counts.resolved,
      icon: CheckCircle2,
    },
  ] as const;
  return (
    <main className="min-w-0 space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Supporto tecnico</h1>
          <p className="text-sm text-muted-foreground">
            Ticket reali, SLA, timer, collaborazione e approvazioni operative.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Nuovo ticket
        </Button>
      </header>
      {tickets.find((ticket) => ticket.id === selectedId)?.dueAt && (
        <div className="flex justify-end">
          <OpenInCalendarLink
            date={tickets.find((ticket) => ticket.id === selectedId)?.dueAt}
            eventId={`support:${selectedId}`}
          />
        </div>
      )}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(({ id, label, value, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView((current) => (current === id ? "list" : id))}
            className={`rounded-xl border bg-card p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === id ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/40"}`}
          >
            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              {label}
              <Icon className="size-4" />
            </span>
            <span className="mt-1 block text-xl font-semibold">{value}</span>
          </button>
        ))}
      </section>
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
            <Input
              aria-label="Cerca ticket"
              placeholder="Cerca codice, titolo, servizio…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <FieldSelect
              label="Filtra stato"
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as SupportStatus | "all")
              }
              options={[
                { value: "all", label: "Tutti gli stati" },
                ...supportStatuses.map((status) => ({
                  value: status,
                  label: status,
                })),
              ]}
            />
            <FieldSelect
              label="Filtra assegnatario"
              value={assigneeFilter}
              onValueChange={setAssigneeFilter}
              options={[
                { value: "all", label: "Tutto il team" },
                ...identity.users.map((user) => ({
                  value: user.id,
                  label: user.name,
                })),
              ]}
            />
            <Button variant="ghost" onClick={reset}>
              Azzera filtri
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {requestedMine && <Badge variant="secondary">Solo i miei</Badge>}
            {requestedOpen && <Badge variant="secondary">Ticket aperti</Badge>}
            <Badge variant="outline">{tickets.length} risultati</Badge>
          </div>
          <Tabs value={view} onValueChange={(value) => setView(value as View)}>
            <ScrollArea className="w-full whitespace-nowrap">
              <TabsList className="h-auto min-w-max justify-start">
                {[
                  ["list", "Lista"],
                  ["kanban", "Kanban"],
                  ["deadlines", "Scadenze"],
                  ["mine", "I miei"],
                  ["team", "Team"],
                  ["review", "In revisione"],
                  ["urgent", "Urgenti"],
                  ["waiting", "In attesa"],
                  ["resolved", "Risolti"],
                  ["history", "Storico"],
                ].map(([id, label]) => (
                  <TabsTrigger key={id} value={id}>
                    {id === "history" && <History />}
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>
      {view === "kanban" ? (
        <SupportKanban tickets={tickets} onOpen={setSelectedId} />
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              currentTime={currentTime}
              onOpen={() => setSelectedId(ticket.id)}
            />
          ))}
          {!tickets.length && (
            <Card className="border-dashed">
              <CardContent className="grid min-h-48 place-items-center py-10 text-center">
                <div>
                  <MessageCircle className="mx-auto mb-3 size-9 text-muted-foreground" />
                  <p className="font-medium">
                    Nessun ticket nel perimetro selezionato
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Modifica i filtri oppure apri un nuovo ticket.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialCustomerId={requestedCustomerId}
        initialProjectId={requestedProjectId}
        onCreated={setSelectedId}
      />
      <TicketDetail
        key={selectedId ?? "closed"}
        ticket={store.supportTickets.find((ticket) => ticket.id === selectedId)}
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined);
        }}
      />
    </main>
  );
}

function TicketRow({
  ticket,
  currentTime,
  onOpen,
}: {
  ticket: SupportTicket;
  currentTime: number;
  onOpen: () => void;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const customer = store.customers.find(
    (item) => item.id === ticket.customerId,
  );
  const assignee = identity.users.find((item) => item.id === ticket.assigneeId);
  const overdue = Boolean(
    ticket.dueAt &&
      openStatuses.includes(ticket.status) &&
      Date.parse(ticket.dueAt) < currentTime,
  );
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (
          ["Enter", " "].includes(event.key) &&
          event.target === event.currentTarget
        ) {
          event.preventDefault();
          onOpen();
        }
      }}
      className="grid cursor-pointer gap-3 rounded-xl border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[110px_minmax(0,1fr)_150px_minmax(150px,auto)]"
    >
      <div>
        <p className="font-mono text-xs font-medium">{ticket.code}</p>
        <Badge
          variant="outline"
          className={`mt-2 ${priorityTone[ticket.priority]}`}
        >
          {ticket.priority}
        </Badge>
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">
          {ticket.title || "Ticket senza titolo"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {cleanText(customer?.profile?.company) || "Nessun cliente"} ·{" "}
          {ticket.category || "Altro"} ·{" "}
          {ticket.service || "Servizio non indicato"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <UserAvatar
          userId={assignee?.id ?? "none"}
          name={assignee?.name ?? "Non assegnato"}
          className="size-7"
        />
        <span className="truncate text-sm">
          {assignee?.name ?? "Non assegnato"}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2 text-sm">
        <span>
          <Badge variant="secondary">{ticket.status}</Badge>
          <span
            className={
              overdue
                ? "mt-1 block text-xs font-medium text-red-600"
                : "mt-1 block text-xs text-muted-foreground"
            }
          >
            {ticket.dueAt
              ? new Date(ticket.dueAt).toLocaleString("it-IT")
              : "Nessuna scadenza"}
          </span>
        </span>
        <RecordCollaborationPanel
          recordType="support_ticket"
          recordId={ticket.id}
          label={`${ticket.code} · ${ticket.title || "Ticket"}`}
          triggerVariant="list"
        />
      </div>
    </div>
  );
}

function SupportKanban({
  tickets,
  onOpen,
}: {
  tickets: SupportTicket[];
  onOpen: (id: string) => void;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const [draggedId, setDraggedId] = useState<string>();
  const move = (id: string, status: SupportStatus) =>
    store.moveSupportTicket(id, status)
      ? toast.success(`Ticket spostato in ${status}`)
      : toast.error("Spostamento non autorizzato o approvazione mancante");
  return (
    <div className="min-w-0 rounded-xl border bg-muted/20 p-3">
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kanbanStatuses.map((status) => (
          <section
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedId) move(draggedId, status);
              setDraggedId(undefined);
            }}
            className="min-w-0 rounded-lg border bg-background p-2"
          >
            <header className="mb-2 flex min-w-0 items-center justify-between gap-2">
              <h2
                className="min-w-0 truncate text-sm font-semibold"
                title={status}
              >
                {status}
              </h2>
              <Badge variant="secondary" className="shrink-0">
                {tickets.filter((ticket) => ticket.status === status).length}
              </Badge>
            </header>
            <div className="min-h-24 space-y-2">
              {tickets
                .filter((ticket) => ticket.status === status)
                .map((ticket) => {
                  const work =
                    canWorkSupportTicket(identity.currentUser, ticket) ||
                    identity.hasCapability("assignSupportTicket");
                  return (
                    <article
                      key={ticket.id}
                      draggable={work}
                      onDragStart={() => setDraggedId(ticket.id)}
                      onDragEnd={() => setDraggedId(undefined)}
                      className="min-w-0 overflow-hidden rounded-lg border bg-card p-3"
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(ticket.id)}
                        className="w-full min-w-0 text-left"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <GripVertical
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 break-words text-sm font-medium">
                              {ticket.title}
                            </span>
                            <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
                              {ticket.code}
                            </span>
                          </span>
                        </div>
                      </button>
                      {work && (
                        <FieldSelect
                          label={`Sposta ${ticket.code} in`}
                          value={ticket.status}
                          onValueChange={(value) =>
                            move(ticket.id, value as SupportStatus)
                          }
                          options={supportStatuses
                            .filter((item) => item !== "Riaperto")
                            .map((item) => ({ value: item, label: item }))}
                          compact
                        />
                      )}
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

type TicketForm = {
  title: string;
  description: string;
  customerId: string;
  projectId: string;
  service: string;
  category: SupportTicket["category"];
  priority: SupportPriority;
  impact: SupportTicket["impact"];
  urgency: SupportTicket["urgency"];
  assigneeId: string;
  supervisorId: string;
  collaboratorIds: string[];
  slaHours: string;
  estimatedMinutes: string;
};
type TicketFieldError = Partial<
  Record<"title" | "description" | "slaHours", string>
>;
type ComboboxOption = { value: string; label: string; detail?: string };
const cleanText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function CreateTicketDialog({
  open,
  onOpenChange,
  initialCustomerId,
  initialProjectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomerId?: string;
  initialProjectId?: string;
  onCreated: (id: string) => void;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const presence = useDoflowPresence();
  const customers = Array.isArray(store.customers) ? store.customers : [];
  const projects = Array.isArray(store.projects) ? store.projects : [];
  const orders = Array.isArray(store.orders) ? store.orders : [];
  const catalogServices = Array.isArray(store.services) ? store.services : [];
  const initialProject = projects.find((item) => item?.id === initialProjectId);
  const resolvedCustomerId = initialProject?.clientId ?? initialCustomerId;
  const initialCustomer = customers.find(
    (item) => item?.id === resolvedCustomerId,
  );
  const makeInitialForm = (): TicketForm => ({
    title: "",
    description: "",
    customerId: initialCustomer?.id ?? "none",
    projectId: initialProject?.id ?? "none",
    service:
      cleanText(initialProject?.service) ||
      cleanText(initialCustomer?.profile?.service),
    category: "Altro",
    priority: "Media",
    impact: "Medio",
    urgency: "Media",
    assigneeId: "none",
    supervisorId: "none",
    collaboratorIds: [],
    slaHours: String(supportSlaHoursByPriority.Media),
    estimatedMinutes: "60",
  });
  const [form, setForm] = useState<TicketForm>(makeInitialForm);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<TicketFieldError>({});
  const [dueBaseAt] = useState(() => Date.now());
  const submittingRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const selectedCustomer = customers.find(
    (item) => item?.id === form.customerId,
  );
  const selectedProject = projects.find((item) => item?.id === form.projectId);
  const customerOptions: ComboboxOption[] = customers
    .filter((customer) => Boolean(customer?.id))
    .map((customer) => {
      const legacyCustomer = customer as typeof customer & {
        contact?: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
        };
        services?: string[];
      };
      const contacts = Array.isArray(customer.contacts)
        ? customer.contacts
        : [];
      const primaryContact = contacts.find(
        (item) => item?.id === customer.primaryContactId && !item.archivedAt,
      );
      const contact =
        primaryContact ??
        contacts.find((item) => item && !item.archivedAt) ??
        (legacyCustomer.contact && typeof legacyCustomer.contact === "object"
          ? legacyCustomer.contact
          : undefined);
      const profile = customer.profile;
      const personName = [
        cleanText(profile?.firstName),
        cleanText(profile?.lastName),
      ]
        .filter(Boolean)
        .join(" ");
      const company = cleanText(profile?.company);
      const label =
        company ||
        personName ||
        cleanText(contact?.name) ||
        "Cliente senza nome";
      const detail =
        cleanText(contact?.name) !== label
          ? cleanText(contact?.name)
          : cleanText(contact?.email) ||
            cleanText(contact?.phone) ||
            cleanText(profile?.email) ||
            cleanText(profile?.phone);
      return { value: customer.id, label, detail: detail || undefined };
    });
  const projectOptions: ComboboxOption[] = projects
    .filter(
      (project) =>
        Boolean(project?.id) &&
        (form.customerId === "none" || project?.clientId === form.customerId),
    )
    .map((project) => ({
      value: project.id,
      label: cleanText(project.name) || "Progetto senza nome",
      detail: cleanText(project.service) || undefined,
    }));
  const legacyCustomerServices =
    selectedCustomer &&
    Array.isArray(
      (selectedCustomer as typeof selectedCustomer & { services?: unknown[] })
        .services,
    )
      ? (selectedCustomer as typeof selectedCustomer & { services: unknown[] })
          .services
      : [];
  const orderServices = orders
    .filter((order) => order?.customerId === selectedCustomer?.id)
    .flatMap((order) =>
      (Array.isArray(order?.items) ? order.items : []).map((item) =>
        cleanText(item?.name),
      ),
    );
  const contextualServices = Array.from(
    new Set(
      [
        cleanText(selectedProject?.service),
        cleanText(selectedCustomer?.profile?.service),
        ...legacyCustomerServices.map(cleanText),
        ...orderServices,
      ].filter(Boolean),
    ),
  );
  const serviceOptions = contextualServices.length
    ? contextualServices
    : catalogServices
        .filter(
          (service) =>
            service && !service.archivedAt && service.status === "active",
        )
        .map((service) => cleanText(service.name))
        .filter(Boolean);
  const supportUsers = identity.users
    .filter(
      (user) =>
        hasCapability(user, "openSupportTicket") ||
        hasCapability(user, "manageSupport"),
    )
    .sort(
      (left, right) =>
        presenceRank(presence.presenceFor(left.id).status) -
          presenceRank(presence.presenceFor(right.id).status) ||
        left.name.localeCompare(right.name, "it"),
    );
  const canAssign = identity.hasCapability("assignSupportTicket");
  const sla = Number(form.slaHours);
  const dueAt =
    Number.isFinite(sla) && sla >= 1
      ? new Date(dueBaseAt + sla * 3_600_000)
      : undefined;
  const set = <K extends keyof TicketForm>(key: K, value: TicketForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "title" || key === "description" || key === "slaHours")
      setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const reset = () => {
    setForm(makeInitialForm());
    setErrors({});
    setAdvancedOpen(false);
    setSaving(false);
    submittingRef.current = false;
  };
  const changeCustomer = (customerId: string) => {
    const customer = customers.find((item) => item?.id === customerId);
    setForm((current) => ({
      ...current,
      customerId,
      projectId:
        current.projectId !== "none" &&
        projects.some(
          (project) =>
            project?.id === current.projectId &&
            project?.clientId === customerId,
        )
          ? current.projectId
          : "none",
      service: cleanText(customer?.profile?.service),
    }));
  };
  const changeProject = (projectId: string) => {
    const project = projects.find((item) => item?.id === projectId);
    setForm((current) => ({
      ...current,
      projectId,
      customerId: cleanText(project?.clientId) || current.customerId,
      service: cleanText(project?.service) || current.service,
    }));
  };
  const changePriority = (priority: SupportPriority) =>
    setForm((current) => ({
      ...current,
      priority,
      slaHours: String(supportSlaHoursByPriority[priority]),
    }));
  const submit = () => {
    if (submittingRef.current) return;
    const nextErrors: TicketFieldError = {};
    if (!form.title.trim()) nextErrors.title = "Inserisci un titolo.";
    if (!form.description.trim())
      nextErrors.description = "Descrivi la richiesta.";
    if (!Number.isFinite(sla) || sla < 1 || sla > 720)
      nextErrors.slaHours = "Inserisci un valore tra 1 e 720 ore.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      if (nextErrors.title) titleRef.current?.focus();
      else if (nextErrors.description) descriptionRef.current?.focus();
      else document.getElementById("ticket-sla-hours")?.focus();
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    const id = store.addSupportTicket({
      title: form.title,
      description: form.description,
      customerId: form.customerId === "none" ? undefined : form.customerId,
      projectId: form.projectId === "none" ? undefined : form.projectId,
      service: form.service.trim() || "Supporto tecnico",
      category: form.category,
      priority: form.priority,
      impact: form.impact,
      urgency: form.urgency,
      status: form.assigneeId === "none" ? "Nuovo" : "Assegnato",
      assigneeId: form.assigneeId === "none" ? undefined : form.assigneeId,
      collaboratorIds: form.collaboratorIds,
      supervisorId:
        form.supervisorId === "none" ? undefined : form.supervisorId,
      dueAt: dueAt!.toISOString(),
      slaHours: sla,
      estimatedMinutes: Number(form.estimatedMinutes) || undefined,
      attachmentMetadata: [],
    });
    submittingRef.current = false;
    setSaving(false);
    if (!id)
      return toast.error(
        "Il ticket non è stato creato. Controlla assegnazione e autorizzazioni.",
      );
    reset();
    onOpenChange(false);
    onCreated(id);
    toast.success("Ticket creato");
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !saving) reset();
    onOpenChange(nextOpen);
  };
  const valid = Boolean(
    form.title.trim() &&
      form.description.trim() &&
      Number.isFinite(sla) &&
      sla >= 1 &&
      sla <= 720,
  );
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(760px,calc(100dvh-1rem))] w-[calc(100vw-1rem)] max-w-[740px] flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Nuovo ticket</DialogTitle>
          <DialogDescription>
            Registra una richiesta di assistenza e assegnala al collaboratore
            corretto.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          <div className="space-y-5">
            <FormSection title="Informazioni essenziali">
              <div className="grid gap-4">
                <FieldInput
                  inputRef={titleRef}
                  id="ticket-title"
                  label="Titolo *"
                  value={form.title}
                  onChange={(value) => set("title", value)}
                  error={errors.title}
                  autoFocus
                />
                <FieldArea
                  textareaRef={descriptionRef}
                  id="ticket-description"
                  label="Descrizione *"
                  value={form.description}
                  onChange={(value) => set("description", value)}
                  error={errors.description}
                />
              </div>
            </FormSection>
            <FormSection title="Contesto">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-customer">Cliente</Label>
                  <RecordCombobox
                    id="ticket-customer"
                    label="Cliente"
                    value={form.customerId}
                    onValueChange={changeCustomer}
                    options={customerOptions}
                    emptyValue="none"
                    emptyLabel="Nessun cliente"
                    placeholder="Cerca cliente…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-project">Progetto</Label>
                  <RecordCombobox
                    id="ticket-project"
                    label="Progetto"
                    value={form.projectId}
                    onValueChange={changeProject}
                    options={projectOptions}
                    emptyValue="none"
                    emptyLabel="Nessun progetto"
                    placeholder="Cerca progetto…"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Servizio</Label>
                  <Select
                    value={
                      serviceOptions.includes(form.service)
                        ? form.service
                        : form.service
                          ? "other"
                          : "none"
                    }
                    onValueChange={(value) =>
                      set(
                        "service",
                        value === "other"
                          ? "Altro"
                          : value === "none"
                            ? ""
                            : value,
                      )
                    }
                  >
                    <SelectTrigger aria-label="Servizio ticket">
                      <SelectValue placeholder="Seleziona servizio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seleziona servizio</SelectItem>
                      {serviceOptions.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.service && !serviceOptions.includes(form.service) && (
                    <Input
                      aria-label="Servizio personalizzato"
                      value={form.service === "Altro" ? "" : form.service}
                      placeholder="Descrivi il servizio"
                      onChange={(event) =>
                        set("service", event.target.value || "Altro")
                      }
                    />
                  )}
                </div>
              </div>
            </FormSection>
            <FormSection title="Gestione">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldSelect
                  label="Categoria *"
                  value={form.category}
                  onValueChange={(value) =>
                    set("category", value as SupportTicket["category"])
                  }
                  options={supportCategories.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                />
                <div className="space-y-1.5">
                  <Label>Priorità *</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(value) =>
                      changePriority(value as SupportPriority)
                    }
                  >
                    <SelectTrigger aria-label="Priorità ticket">
                      <span className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${priorityDot[form.priority]}`}
                          aria-hidden
                        />
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {supportPriorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          <span className="flex items-center gap-2">
                            <span
                              className={`size-2 rounded-full ${priorityDot[priority]}`}
                              aria-hidden
                            />
                            {priority}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canAssign && (
                  <div className="space-y-1.5">
                    <Label>Assegnatario</Label>
                    <Select
                      value={form.assigneeId}
                      onValueChange={(value) => set("assigneeId", value)}
                    >
                      <SelectTrigger
                        aria-label="Assegnatario ticket"
                        className="h-auto min-h-11"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Da assegnare</SelectItem>
                        {supportUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <PresenceUserOption userId={user.id} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ticket-sla-hours"
                    className="whitespace-nowrap"
                  >
                    SLA (ore)
                  </Label>
                  <Input
                    id="ticket-sla-hours"
                    type="number"
                    min={1}
                    max={720}
                    value={form.slaHours}
                    disabled={!canAssign}
                    aria-describedby="ticket-sla-help ticket-sla-error"
                    aria-invalid={Boolean(errors.slaHours)}
                    onChange={(event) => set("slaHours", event.target.value)}
                  />
                  <p
                    id="ticket-sla-help"
                    className="text-xs text-muted-foreground"
                  >
                    {dueAt
                      ? `Scadenza prevista: ${new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(dueAt)} · ${form.priority}`
                      : `Valore definito dalla priorità ${form.priority}.`}
                  </p>
                  {errors.slaHours && (
                    <p
                      id="ticket-sla-error"
                      className="text-xs text-destructive"
                    >
                      {errors.slaHours}
                    </p>
                  )}
                </div>
              </div>
            </FormSection>
            {canAssign && (
              <Collapsible
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
                className="rounded-xl border"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-between rounded-xl px-4"
                    aria-expanded={advancedOpen}
                  >
                    Opzioni avanzate
                    <ChevronDown
                      className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 border-t p-4">
                    <div className="space-y-1.5">
                      <Label>Supervisore</Label>
                      <Select
                        value={form.supervisorId}
                        onValueChange={(value) => set("supervisorId", value)}
                      >
                        <SelectTrigger
                          aria-label="Supervisore ticket"
                          className="h-auto min-h-11"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuno</SelectItem>
                          {identity.users
                            .filter(
                              (user) =>
                                hasCapability(user, "approveDeliverable") &&
                                user.id !== identity.currentUserId &&
                                user.id !== form.assigneeId &&
                                !form.collaboratorIds.includes(user.id),
                            )
                            .map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                <PresenceUserOption userId={user.id} />
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Collaboratori</Label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {supportUsers
                          .filter(
                            (user) =>
                              user.id !== form.assigneeId &&
                              user.id !== form.supervisorId,
                          )
                          .map((user) => (
                            <label
                              key={user.id}
                              className="flex min-w-0 items-center gap-2 rounded-lg border p-2.5"
                            >
                              <Checkbox
                                checked={form.collaboratorIds.includes(user.id)}
                                onCheckedChange={(checked) =>
                                  set(
                                    "collaboratorIds",
                                    checked
                                      ? [...form.collaboratorIds, user.id]
                                      : form.collaboratorIds.filter(
                                          (id) => id !== user.id,
                                        ),
                                  )
                                }
                              />
                              <PresenceUserOption userId={user.id} compact />
                            </label>
                          ))}
                      </div>
                    </div>
                    <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      Gli allegati saranno disponibili dopo la configurazione
                      dello spazio documenti.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Annulla
            </Button>
            <Button onClick={submit} disabled={!valid || saving}>
              {saving ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Creazione…
                </>
              ) : (
                "Crea ticket"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function RecordCombobox({
  id,
  label,
  value,
  onValueChange,
  options,
  emptyValue,
  emptyLabel,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  emptyValue: string;
  emptyLabel: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          className="w-full min-w-0 justify-between font-normal"
        >
          <span className={!selected ? "text-muted-foreground" : "truncate"}>
            {selected?.label ?? emptyLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
      >
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nessun risultato</CommandEmpty>
            <CommandItem
              value={`${emptyLabel} ${emptyValue}`}
              onSelect={() => {
                onValueChange(emptyValue);
                setOpen(false);
              }}
            >
              <Check
                className={value === emptyValue ? "opacity-100" : "opacity-0"}
              />
              {emptyLabel}
            </CommandItem>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.detail ?? ""}`}
                onSelect={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
                className="min-h-11"
              >
                <Check
                  className={
                    value === option.value ? "opacity-100" : "opacity-0"
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.detail && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.detail}
                    </span>
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
function presenceRank(status: PresenceStatus) {
  return status === "online"
    ? 0
    : ["busy", "do_not_disturb", "in_call", "in_meeting"].includes(status)
      ? 1
      : status === "away"
        ? 2
        : 3;
}
const priorityDot: Record<SupportPriority, string> = {
  Bassa: "bg-slate-400",
  Media: "bg-blue-500",
  Alta: "bg-amber-500",
  Urgente: "bg-orange-500",
  Critica: "bg-red-500",
};

function editableTicket(ticket: SupportTicket) {
  return {
    cause: ticket.cause?.trim() || "",
    solution: ticket.solution?.trim() || "",
    attachmentMetadata: ticket.attachmentMetadata,
    status: ticket.status,
    priority: ticket.priority,
    slaHours: ticket.slaHours,
    dueAt: ticket.dueAt,
    assigneeId: ticket.assigneeId,
    supervisorId: ticket.supervisorId,
    collaboratorIds: [...ticket.collaboratorIds].sort(),
  };
}
function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

function TicketDetail({
  ticket,
  open,
  onOpenChange,
}: {
  ticket?: SupportTicket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<SupportTicket | undefined>(ticket);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timerBusy, setTimerBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const timerLock = useRef(false);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  if (!ticket || !draft) return null;
  const ticketSessions = store.timeSessions.filter(
    (item) => item.supportTicketId === ticket.id && !item.archivedAt,
  );
  const session = ticketSessions.find(
    (item) =>
      item.userId === identity.currentUserId && item.status !== "completed",
  );
  const approval = store.operationalApprovals
    .filter(
      (item) =>
        item.objectType === "support_ticket" &&
        item.objectId === ticket.id &&
        !["Sostituito", "Revocato"].includes(item.status),
    )
    .sort((a, b) => b.version - a.version)[0];
  const customer = store.customers.find(
    (item) => item.id === ticket.customerId,
  );
  const project = store.projects.find((item) => item.id === ticket.projectId);
  const work =
    canWorkSupportTicket(identity.currentUser, ticket) ||
    identity.hasCapability("assignSupportTicket");
  const canAssign = identity.hasCapability("assignSupportTicket");
  const involvedIds = new Set(
    [ticket.requesterId, ticket.assigneeId, ...ticket.collaboratorIds].filter(
      Boolean,
    ),
  );
  const canNormalApprove =
    approval?.requiredApproverId === identity.currentUserId &&
    !involvedIds.has(identity.currentUserId);
  const canOverride =
    identity.currentUser.roles.includes("administrator") &&
    Boolean(approval) &&
    !canNormalApprove;
  const dirty =
    JSON.stringify(editableTicket(draft)) !==
    JSON.stringify(editableTicket(ticket));
  const set = <K extends keyof SupportTicket>(
    key: K,
    value: SupportTicket[K],
  ) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const elapsedMinutes = ticketSessions.reduce(
    (total, item) =>
      total +
      (item.durationMinutes ?? 0) +
      (item.status === "active"
        ? Math.max(
            0,
            Math.floor(
              (now - Date.parse(item.resumedAt ?? item.startedAt)) / 60_000,
            ),
          )
        : 0),
    0,
  );
  const slaMinutes = draft.slaHours * 60;
  const residualMinutes = Math.max(0, slaMinutes - elapsedMinutes);
  const breached =
    elapsedMinutes > slaMinutes ||
    Boolean(
      draft.dueAt &&
        Date.parse(draft.dueAt) < now &&
        openStatuses.includes(draft.status),
    );
  const timelineItems: CommercialTimelineItem[] = [
    ...store.auditEvents
      .filter(
        (event) =>
          event.recordType === "support_ticket" && event.recordId === ticket.id,
      )
      .map((event) => ({
        id: `audit:${event.id}`,
        title: event.action,
        description:
          event.reason ??
          (event.previousValue || event.nextValue
            ? `${event.previousValue || "—"} → ${event.nextValue || "—"}`
            : undefined),
        date: event.createdAt,
        author: event.authorName,
        category: "Revisioni" as const,
      })),
    ...store.comments
      .filter(
        (comment) =>
          comment.recordType === "support_ticket" &&
          comment.recordId === ticket.id &&
          !comment.deletedAt,
      )
      .map((comment) => ({
        id: `comment:${comment.id}`,
        title: comment.parentCommentId
          ? "Risposta aggiunta"
          : "Commento aggiunto",
        description: comment.text,
        date: comment.createdAt,
        author: identity.users.find((user) => user.id === comment.authorId)
          ?.name,
        category: "Commenti" as const,
      })),
    ...store.timelineEvents
      .filter((event) => event.supportTicketId === ticket.id)
      .map((event) => ({
        id: `timeline:${event.id}`,
        title: event.title,
        description: event.detail,
        date: event.date,
        author: event.author,
        category: "Attività" as const,
      })),
  ];
  const save = () => {
    if (!dirty || saving) return;
    setSaving(true);
    const updates: Partial<SupportTicket> = {
      cause: draft.cause?.trim() || undefined,
      solution: draft.solution?.trim() || undefined,
      attachmentMetadata: draft.attachmentMetadata,
      status: draft.status,
    };
    if (canAssign)
      Object.assign(updates, {
        priority: draft.priority,
        slaHours: draft.slaHours,
        dueAt: draft.dueAt,
        assigneeId: draft.assigneeId,
        supervisorId: draft.supervisorId,
        collaboratorIds: draft.collaboratorIds,
      });
    const saved = store.updateSupportTicket(
      ticket.id,
      updates,
      reason || "Aggiornamento ticket",
    );
    if (saved) toast.success("Ticket aggiornato");
    else toast.error("Nessuna modifica valida, RBAC o approvazione mancante");
    setSaving(false);
  };
  const runTimerAction = async (action: () => void | Promise<void>) => {
    if (timerLock.current) return;
    timerLock.current = true;
    setTimerBusy(true);
    await action();
    window.setTimeout(() => {
      timerLock.current = false;
      setTimerBusy(false);
    }, 450);
  };
  const start = () =>
    void runTimerAction(async () => {
      const result = await store.startSupportTicketTime(ticket.id);
      if (result.ok)
        toast.success(result.existing ? "Timer già attivo" : "Timer avviato");
      else toast.error(result.message);
    });
  const pause = () => {
    if (!session) return;
    void runTimerAction(async () => {
      const result = await store.pauseSupportTicketTime(session.id);
      if (result.ok)
        toast.success(
          result.existing ? "Timer già in pausa" : "Timer in pausa",
        );
      else toast.error(result.message);
    });
  };
  const resume = () => {
    if (!session) return;
    void runTimerAction(async () => {
      const result = await store.resumeSupportTicketTime(session.id);
      if (result.ok)
        toast.success(result.existing ? "Timer già attivo" : "Timer ripreso");
      else toast.error(result.message);
    });
  };
  const stop = () => {
    if (!session) return;
    void runTimerAction(async () => {
      const result = await store.stopProjectTime(session.id);
      if (result.ok)
        toast.success(`${result.durationMinutes} minuti registrati`);
      else toast.error(result.message);
    });
  };
  const request = () => {
    const fallback = identity.users.find(
      (user) =>
        user.active !== false &&
        hasCapability(user, "approveDeliverable") &&
        !involvedIds.has(user.id),
    )?.id;
    const requiredApproverId = draft.supervisorId || fallback;
    if (!requiredApproverId) {
      toast.error("Nessun supervisore autorizzato disponibile");
      return;
    }
    const id = store.requestOperationalApproval({
      objectType: "support_ticket",
      objectId: ticket.id,
      requiredApproverId,
      attachments: draft.attachmentMetadata,
    });
    if (id) toast.success("Approvazione richiesta");
    else
      toast.error(
        "Seleziona un supervisore autorizzato e distinto dagli esecutori",
      );
  };
  const decide = (approved: boolean, override = false) => {
    if (!approval) return;
    if (
      store.decideOperationalApproval(approval.id, approved, reason, override)
    ) {
      setDraft((current) =>
        current
          ? {
              ...current,
              status: approved ? "Risolto" : "In lavorazione",
              approvalId: approval.id,
            }
          : current,
      );
      toast.success(
        override
          ? "Override amministrativo registrato"
          : approved
            ? "Lavoro approvato"
            : "Correzioni richieste",
      );
      setReason("");
    } else
      toast.error(
        "Motivazione obbligatoria o separazione dei ruoli non valida",
      );
  };
  const approverOptions = identity.users.filter(
    (user) =>
      hasCapability(user, "approveDeliverable") &&
      !new Set(
        [ticket.requesterId, draft.assigneeId, ...draft.collaboratorIds].filter(
          Boolean,
        ),
      ).has(user.id),
  );
  const workerOptions = identity.users.filter(
    (user) =>
      hasCapability(user, "workSupportTicket") ||
      hasCapability(user, "manageSupport"),
  );
  const requestClose = () =>
    dirty ? setConfirmClose(true) : onOpenChange(false);
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
      >
        <SheetContent
          showCloseButton={false}
          className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[660px]"
        >
          <SheetHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="line-clamp-2 pr-1 text-base leading-5 sm:text-lg">
                  {ticket.title || "Ticket senza titolo"}
                </SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-mono">{ticket.code}</span>
                  <span>
                    {cleanText(customer?.profile?.company) || "Nessun cliente"}
                  </span>
                  {project && (
                    <span>
                      · {cleanText(project.name) || "Progetto senza nome"}
                    </span>
                  )}
                </SheetDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{ticket.status}</Badge>
                  <Badge
                    variant="outline"
                    className={priorityTone[ticket.priority]}
                  >
                    {ticket.priority}
                  </Badge>
                </div>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="shrink-0"
                aria-label="Chiudi dettaglio ticket"
                onClick={requestClose}
              >
                <X />
              </Button>
            </div>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4 sm:p-5">
              <section className="space-y-3 rounded-xl border bg-card p-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    Informazioni operative
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Stato, priorità, SLA e responsabilità.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FieldSelect
                    label="Stato"
                    value={draft.status}
                    onValueChange={(value) =>
                      set("status", value as SupportStatus)
                    }
                    disabled={!work}
                    options={supportStatuses.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                  />
                  <FieldSelect
                    label="Priorità"
                    value={draft.priority}
                    onValueChange={(value) =>
                      set("priority", value as SupportPriority)
                    }
                    disabled={!canAssign}
                    options={supportPriorities.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                  />
                  <FieldInput
                    label="SLA (ore)"
                    value={String(draft.slaHours)}
                    onChange={(value) => set("slaHours", Number(value))}
                    type="number"
                    disabled={!canAssign}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldSelect
                    label="Assegnatario"
                    value={draft.assigneeId ?? "none"}
                    onValueChange={(value) =>
                      set("assigneeId", value === "none" ? undefined : value)
                    }
                    disabled={!canAssign}
                    options={[
                      { value: "none", label: "Non assegnato" },
                      ...workerOptions.map((user) => ({
                        value: user.id,
                        label: user.name,
                      })),
                    ]}
                  />
                  <FieldSelect
                    label="Supervisore"
                    value={draft.supervisorId ?? "none"}
                    onValueChange={(value) =>
                      set("supervisorId", value === "none" ? undefined : value)
                    }
                    disabled={!canAssign}
                    options={[
                      { value: "none", label: "Seleziona supervisore" },
                      ...approverOptions.map((user) => ({
                        value: user.id,
                        label: user.name,
                      })),
                    ]}
                  />
                </div>
              </section>
              <section className="space-y-3 rounded-xl border bg-card p-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    Diagnosi e soluzione
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                    {ticket.description}
                  </p>
                </div>
                <FieldArea
                  label="Causa individuata"
                  placeholder="Descrivi la causa tecnica o operativa…"
                  value={draft.cause ?? ""}
                  onChange={(value) => set("cause", value)}
                  disabled={!work}
                />
                <FieldArea
                  label="Soluzione applicata"
                  placeholder="Descrivi la soluzione e il risultato atteso…"
                  value={draft.solution ?? ""}
                  onChange={(value) => set("solution", value)}
                  disabled={!work}
                />
              </section>
              {canAssign && (
                <section className="space-y-3 rounded-xl border bg-card p-3">
                  <div>
                    <h3 className="text-sm font-semibold">Persone coinvolte</h3>
                    <p className="text-xs text-muted-foreground">
                      Collaboratori compatibili con il lavoro di supporto.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {workerOptions
                      .filter(
                        (user) =>
                          user.id !== ticket.requesterId &&
                          user.id !== draft.supervisorId &&
                          user.id !== draft.assigneeId,
                      )
                      .map((user) => (
                        <Label
                          key={user.id}
                          className="flex min-w-0 items-center gap-2 rounded-lg border p-2.5"
                        >
                          <Checkbox
                            checked={draft.collaboratorIds.includes(user.id)}
                            onCheckedChange={(checked) =>
                              set(
                                "collaboratorIds",
                                checked
                                  ? Array.from(
                                      new Set([
                                        ...draft.collaboratorIds,
                                        user.id,
                                      ]),
                                    )
                                  : draft.collaboratorIds.filter(
                                      (id) => id !== user.id,
                                    ),
                              )
                            }
                          />
                          <UserAvatar
                            userId={user.id}
                            name={user.name}
                            className="size-7"
                          />
                          <span className="min-w-0 truncate text-sm">
                            {user.name}
                          </span>
                        </Label>
                      ))}
                  </div>
                </section>
              )}
              <section
                className={`space-y-3 rounded-xl border p-3 ${breached ? "border-red-500/40 bg-red-500/5" : "bg-card"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Clock3 className="size-4" />
                      SLA e tempo
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Tempo atteso, registrato e residuo.
                    </p>
                  </div>
                  <Badge variant={breached ? "destructive" : "outline"}>
                    {breached
                      ? "SLA superato"
                      : session?.status === "active"
                        ? "Timer attivo"
                        : session?.status === "paused"
                          ? "Timer in pausa"
                          : "Nei tempi"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <SlaValue label="Previsto" value={`${draft.slaHours} ore`} />
                  <SlaValue
                    label="Registrato"
                    value={formatMinutes(elapsedMinutes)}
                  />
                  <SlaValue
                    label="Residuo"
                    value={breached ? "0 min" : formatMinutes(residualMinutes)}
                  />
                </div>
              </section>
              <section className="space-y-3 rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Approvazione operativa
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Il lavoro diventa pronto soltanto dopo approvazione.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {approval?.status ?? "Non richiesta"}
                  </Badge>
                </div>
                {approval && (
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Approvatore</dt>
                      <dd className="font-medium">
                        {identity.users.find(
                          (user) =>
                            user.id ===
                            (approval.decidedBy ?? approval.requiredApproverId),
                        )?.name ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Data</dt>
                      <dd className="font-medium">
                        {approval.decidedAt
                          ? new Date(approval.decidedAt).toLocaleString("it-IT")
                          : "In attesa"}
                      </dd>
                    </div>
                  </dl>
                )}
                {work &&
                  (!approval ||
                    approval.status === "Correzioni richieste" ||
                    (approval.status === "Approvato" &&
                      !["Risolto", "Chiuso"].includes(ticket.status))) && (
                    <Button size="sm" variant="outline" onClick={request}>
                      <ShieldCheck />
                      {approval
                        ? "Richiedi nuova approvazione"
                        : "Richiedi approvazione"}
                    </Button>
                  )}
                {approval?.status === "In attesa approvazione" &&
                  (canNormalApprove || canOverride) && (
                    <>
                      <Textarea
                        aria-label="Motivazione approvazione"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Motivazione obbligatoria"
                        className="min-h-20"
                      />
                      <div className="flex flex-wrap gap-2">
                        {canNormalApprove && (
                          <>
                            <Button size="sm" onClick={() => decide(true)}>
                              Approva
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => decide(false)}
                            >
                              Richiedi correzioni
                            </Button>
                          </>
                        )}
                        {canOverride && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => decide(true, true)}
                          >
                            Override amministrativo
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                {approval?.comment && (
                  <p className="rounded-md bg-muted p-2 text-xs">
                    {approval.comment}
                  </p>
                )}
                {approval?.rejectionReason && (
                  <p className="rounded-md bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
                    {approval.rejectionReason}
                  </p>
                )}
                {approval?.overrideReason && (
                  <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                    Override: {approval.overrideReason}
                  </p>
                )}
              </section>
              {["Risolto", "Chiuso"].includes(ticket.status) && (
                <section className="flex gap-2 rounded-xl border p-3">
                  <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Motivo riapertura"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (store.reopenSupportTicket(ticket.id, reason)) {
                        setDraft((current) =>
                          current
                            ? { ...current, status: "Riaperto" }
                            : current,
                        );
                        setReason("");
                        toast.success("Ticket riaperto");
                      } else toast.error("Motivo obbligatorio");
                    }}
                  >
                    <RotateCcw />
                    Riapri
                  </Button>
                </section>
              )}
              <Tabs
                defaultValue="timeline"
                className="rounded-xl border bg-card p-3"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="timeline">
                    <History />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="comments">
                    <MessageCircle />
                    Commenti
                  </TabsTrigger>
                  <TabsTrigger value="attachments">
                    <Paperclip />
                    Allegati
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="timeline" className="pt-3">
                  <CommercialTimeline
                    items={timelineItems}
                    compact
                    emptyText="Nessuna attività registrata per il ticket."
                  />
                </TabsContent>
                <TabsContent value="comments" className="pt-3">
                  <SupportComments ticketId={ticket.id} />
                </TabsContent>
                <TabsContent value="attachments" className="space-y-3 pt-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">Allegati</h3>
                      <p className="text-xs text-muted-foreground">
                        Solo metadati: nessun file viene caricato nel prototipo.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!work}
                      onClick={() => fileRef.current?.click()}
                    >
                      <FilePlus2 />
                      Aggiungi allegato
                    </Button>
                  </div>
                  <input
                    ref={fileRef}
                    className="hidden"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file && file.size <= 5_000_000)
                        set("attachmentMetadata", [
                          ...draft.attachmentMetadata,
                          {
                            id: crypto.randomUUID(),
                            name: file.name,
                            mimeType: file.type || "application/octet-stream",
                            size: file.size,
                          },
                        ]);
                      else if (file) toast.error("Il file supera 5 MB");
                      event.currentTarget.value = "";
                    }}
                  />
                  <div className="space-y-2">
                    {draft.attachmentMetadata.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-xs"
                      >
                        <Paperclip className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate">{file.name}</b>
                          <span className="text-muted-foreground">
                            {file.mimeType} · {Math.ceil(file.size / 1024)} KB
                          </span>
                        </span>
                        {work && (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Rimuovi ${file.name}`}
                            onClick={() =>
                              set(
                                "attachmentMetadata",
                                draft.attachmentMetadata.filter(
                                  (item) => item.id !== file.id,
                                ),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    ))}
                    {!draft.attachmentMetadata.length && (
                      <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                        Nessun allegato associato.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
          <SheetFooter className="shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {work && !session && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={timerBusy}
                    onClick={start}
                  >
                    <Play />
                    Avvia timer
                  </Button>
                )}
                {session?.status === "active" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={timerBusy}
                      onClick={pause}
                    >
                      <Pause />
                      Pausa
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={timerBusy}
                      onClick={stop}
                    >
                      <Square />
                      Termina
                    </Button>
                  </>
                )}
                {session?.status === "paused" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={timerBusy}
                      onClick={resume}
                    >
                      <Play />
                      Riprendi
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={timerBusy}
                      onClick={stop}
                    >
                      <Square />
                      Termina
                    </Button>
                  </>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={requestClose}>
                  Annulla
                </Button>
                <Button
                  size="sm"
                  disabled={!dirty || saving || !work}
                  onClick={save}
                >
                  <Save />
                  {saving ? "Salvataggio…" : "Salva"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scartare le modifiche?</AlertDialogTitle>
            <AlertDialogDescription>
              Hai modifiche non salvate. Chiudendo il drawer verranno perse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continua a modificare</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              Scarta e chiudi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SlaValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SupportComments({ ticketId }: { ticketId: string }) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [editText, setEditText] = useState("");
  const comments = store.comments
    .filter(
      (comment) =>
        comment.recordType === "support_ticket" &&
        comment.recordId === ticketId &&
        !comment.deletedAt,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const submit = () => {
    const id = store.addComment({
      recordType: "support_ticket",
      recordId: ticketId,
      text,
      attachments: [],
    });
    if (!id) return toast.error("Commento non salvato");
    setText("");
    toast.success("Commento pubblicato");
  };
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Scrivi un commento…"
          className="min-h-20"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey))
              submit();
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {
              comments.filter(
                (comment) => !comment.resolvedAt && !comment.parentCommentId,
              ).length
            }{" "}
            commenti aperti
          </span>
          <Button size="sm" disabled={!text.trim()} onClick={submit}>
            <Send />
            Pubblica
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {comments.map((comment) => {
          const author = identity.users.find(
            (user) => user.id === comment.authorId,
          );
          const canEdit = comment.authorId === identity.currentUserId;
          const canDelete =
            canEdit || identity.currentUser.roles.includes("administrator");
          return (
            <article key={comment.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <UserAvatar
                  userId={author?.id ?? "unknown"}
                  name={author?.name ?? "Utente"}
                  className="size-7"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-sm">{author?.name ?? "Utente"}</b>
                    <time className="text-[11px] text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString("it-IT")}
                    </time>
                    {comment.resolvedAt && (
                      <Badge className="h-5 bg-emerald-600 px-1.5 text-[10px]">
                        Risolto
                      </Badge>
                    )}
                  </div>
                  {editingId === comment.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        className="min-h-16"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setEditingId(undefined)}
                        >
                          Annulla
                        </Button>
                        <Button
                          size="xs"
                          disabled={
                            !editText.trim() || editText === comment.text
                          }
                          onClick={async () => {
                            if (
                              await store.updateComment(
                                comment.id,
                                editText,
                                comment.mentionUserIds,
                              )
                            ) {
                              setEditingId(undefined);
                              toast.success("Commento aggiornato");
                            }
                          }}
                        >
                          Salva
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                      {comment.text}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {canEdit && editingId !== comment.id && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditText(comment.text);
                        }}
                      >
                        Modifica
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        store.resolveComment(comment.id, !comment.resolvedAt)
                      }
                    >
                      {comment.resolvedAt ? "Riapri" : "Risolvi"}
                    </Button>
                    {canDelete && (
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => store.deleteComment(comment.id)}
                      >
                        Elimina
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!comments.length && (
          <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
            Nessun commento.
          </p>
        )}
      </div>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onValueChange,
  options,
  disabled,
  compact,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={compact ? "sr-only" : undefined}>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          className={compact ? "mt-3 h-8 text-xs" : undefined}
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  wide,
  id,
  error,
  autoFocus,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  wide?: boolean;
  id?: string;
  error?: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <Label className={wide ? "sm:col-span-2" : undefined} htmlFor={id}>
      {label}
      <Input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={Boolean(error)}
        aria-describedby={error && id ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <span
          id={id ? `${id}-error` : undefined}
          className="text-xs text-destructive"
        >
          {error}
        </span>
      )}
    </Label>
  );
}
function FieldArea({
  label,
  value,
  onChange,
  wide,
  placeholder,
  disabled,
  id,
  error,
  textareaRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  error?: string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <Label className={wide ? "sm:col-span-2" : undefined} htmlFor={id}>
      {label}
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error && id ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24"
      />
      {error && (
        <span
          id={id ? `${id}-error` : undefined}
          className="text-xs text-destructive"
        >
          {error}
        </span>
      )}
    </Label>
  );
}
