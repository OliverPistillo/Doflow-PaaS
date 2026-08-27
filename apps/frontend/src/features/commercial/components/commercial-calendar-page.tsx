"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ClipboardList,
  Clock3,
  CreditCard,
  ExternalLink,
  FileSignature,
  FileText,
  FilterX,
  Headphones,
  MessageSquare,
  PackageCheck,
  Search,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { orderFinancialsFromServer } from "@/features/commercial/commercial-commerce";
import { formatOperationalValue } from "@/features/commercial/commercial-formatters";
import { ActivityFormDialog } from "@/features/commercial/components/activity-form-dialog";
import { CalendarAppointmentDialog } from "@/features/commercial/components/calendar-appointment-dialog";
import type {
  CommercialAppointment,
  CustomerActivity,
} from "@/features/commercial/components/commercial-leads-provider";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import {
  canEditLead,
  canManageActivity,
} from "@/features/identity/permissions";
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial";

type CalendarView = "month" | "week" | "day" | "agenda";
type EventKind =
  | "activity"
  | "appointment"
  | "project"
  | "delivery"
  | "review"
  | "contract"
  | "quote"
  | "payment"
  | "renewal"
  | "support"
  | "materials";
type CalendarEvent = {
  id: string;
  recordId: string;
  title: string;
  kind: EventKind;
  start: string;
  end?: string;
  allDay?: boolean;
  status: string;
  priority?: string;
  assigneeId?: string;
  customerId?: string;
  leadId?: string;
  projectId?: string;
  href: string;
  editable?: boolean;
  activity?: CustomerActivity;
  activityCustomerId?: string;
  appointment?: CommercialAppointment;
};

const KIND_LABELS: Record<EventKind, string> = {
  activity: "Attività",
  appointment: "Appuntamenti",
  project: "Progetti",
  delivery: "Consegne",
  review: "Revisioni",
  contract: "Contratti",
  quote: "Preventivi",
  payment: "Pagamenti",
  renewal: "Rinnovi",
  support: "Supporto",
  materials: "Materiali",
};
const KIND_STYLES: Record<EventKind, string> = {
  activity:
    "border-violet-400/60 bg-violet-500/12 text-violet-800 dark:text-violet-200",
  appointment: "border-sky-400/60 bg-sky-500/12 text-sky-800 dark:text-sky-200",
  project:
    "border-indigo-400/60 bg-indigo-500/12 text-indigo-800 dark:text-indigo-200",
  delivery:
    "border-indigo-400/60 bg-indigo-500/12 text-indigo-800 dark:text-indigo-200",
  review:
    "border-fuchsia-400/60 bg-fuchsia-500/12 text-fuchsia-800 dark:text-fuchsia-200",
  contract:
    "border-orange-400/60 bg-orange-500/12 text-orange-800 dark:text-orange-200",
  quote:
    "border-orange-400/60 bg-orange-500/12 text-orange-800 dark:text-orange-200",
  payment:
    "border-emerald-400/60 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
  renewal:
    "border-yellow-400/70 bg-yellow-500/12 text-yellow-900 dark:text-yellow-200",
  support: "border-red-400/60 bg-red-500/12 text-red-800 dark:text-red-200",
  materials:
    "border-cyan-400/60 bg-cyan-500/12 text-cyan-800 dark:text-cyan-200",
};
const CLOSED = new Set([
  "Completata",
  "Annullata",
  "completed",
  "cancelled",
  "Risolto",
  "Chiuso",
  "Annullato",
  "Firmato",
  "Accettato",
  "Pagato",
  "Consegnato",
  "delivered",
  "completed",
]);
const dateKey = (value: string) => value.slice(0, 10);
const safeDate = (value?: string) =>
  value
    ? parseISO(value.length === 10 ? `${value}T12:00:00` : value)
    : undefined;
const timeLabel = (value: string, allDay?: boolean) =>
  allDay || value.length === 10
    ? "Tutto il giorno"
    : format(parseISO(value), "HH:mm");
const eventIsOverdue = (event: CalendarEvent) =>
  !CLOSED.has(event.status) &&
  isBefore(safeDate(event.end ?? event.start)!, startOfDay(new Date()));

function eventClass(event: CalendarEvent) {
  if (["Annullata", "cancelled", "Annullato"].includes(event.status))
    return "border-zinc-400/60 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300";
  if (CLOSED.has(event.status))
    return "border-emerald-400/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  if (eventIsOverdue(event))
    return "border-red-500/70 bg-red-500/15 text-red-800 dark:text-red-200";
  return KIND_STYLES[event.kind];
}

function CalendarEventButton({
  event,
  selected,
  onOpen,
  onDragStart,
}: {
  event: CalendarEvent;
  selected: boolean;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  return (
    <button
      type="button"
      draggable={event.editable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", event.id);
        onDragStart();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "group flex w-full min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring",
        eventClass(event),
        selected && "ring-2 ring-ring",
      )}
      aria-label={`${event.title}, ${timeLabel(event.start, event.allDay)}${event.editable ? ", trascinabile" : ""}`}
    >
      {event.editable && (
        <span aria-hidden className="text-[9px] opacity-60">
          ⠿
        </span>
      )}
      <span className="shrink-0 font-semibold">
        {event.allDay ? "" : timeLabel(event.start)}
      </span>
      <span className="line-clamp-2 min-w-0 flex-1">{event.title}</span>
      <span
        className="shrink-0 rounded border border-current/20 px-1 text-[9px] font-medium opacity-70"
        title="Origine: DoFlow"
        aria-label="Origine DoFlow"
      >
        D
      </span>
    </button>
  );
}

export function CommercialCalendarPage() {
  const commercialTeam = useCommercialTeam();
  const { store, identity, leads, customers, projects, activities } =
    useAuthorizedCommercial();
  const router = useRouter();
  const params = useSearchParams();
  const today = startOfDay(new Date());
  const initialDate = safeDate(params.get("date") ?? undefined) ?? today;
  const [anchor, setAnchor] = useState(initialDate);
  const [view, setView] = useState<CalendarView>(
    (params.get("view") as CalendarView) || "month",
  );
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState(params.get("assignee") ?? "all");
  const [team, setTeam] = useState("all");
  const [customerId, setCustomerId] = useState("all");
  const [leadId, setLeadId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [kind, setKind] = useState<EventKind | "all">("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [period, setPeriod] = useState(params.get("period") ?? "all");
  const [mineOnly, setMineOnly] = useState(params.get("scope") === "mine");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(params.get("status") === "open");
  const [createDate, setCreateDate] = useState<string>();
  const [createTime, setCreateTime] = useState("09:00");
  const [activityOpen, setActivityOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [createSubject, setCreateSubject] = useState("");
  const [appointmentLeadId, setAppointmentLeadId] = useState("");
  const draggingId = useRef<string | undefined>(undefined);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(
    params.get("event") ?? undefined,
  );
  const [pendingMove, setPendingMove] = useState<{
    eventId: string;
    day: Date;
  }>();
  const [note, setNote] = useState("");
  const [summaryCategory, setSummaryCategory] = useState<
    | "todo"
    | "support"
    | "quote"
    | "contract"
    | "payment"
    | "materials"
    | "overdue"
  >();
  const [summaryPeriod, setSummaryPeriod] = useState<
    "today" | "seven" | "visible"
  >("visible");
  const personalDeadlineOnly = params.get("source") === "personal-deadlines";
  const canSeeEconomics = identity.hasCapability("canViewCommercialValues");

  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];
    for (const { activity, customer } of activities) {
      const start = activity.dueAt || activity.dueDate || activity.startAt;
      if (!start || activity.archivedAt) continue;
      const project = projects.find((item) => item.id === activity.projectId);
      result.push({
        id: `activity:${activity.id}`,
        recordId: activity.id,
        title: activity.title,
        kind:
          activity.type === "Consegna"
            ? "delivery"
            : activity.type === "QA/Test" ||
                activity.type === "Approvazione cliente"
              ? "review"
              : "activity",
        start,
        end: activity.dueAt || undefined,
        allDay: !activity.dueTime && start.length === 10,
        status: activity.status,
        priority: activity.priority,
        assigneeId: activity.assigneeId,
        customerId: customer.id,
        leadId: activity.leadId,
        projectId: activity.projectId,
        href: `/dashboard/attivita?activityId=${activity.id}`,
        editable: canManageActivity(
          identity.currentUser,
          activity,
          customer,
          project,
        ),
        activity,
        activityCustomerId: customer.id,
      });
    }
    for (const lead of leads.filter(
      (item) => !item.archivedAt && item.nextActionAt,
    ))
      result.push({
        id: `lead-action:${lead.id}`,
        recordId: lead.id,
        title: `${lead.nextAction} · ${lead.company}`,
        kind: "activity",
        start: lead.nextActionAt,
        status: lead.stage,
        assigneeId: lead.assigneeId,
        leadId: lead.id,
        customerId: lead.convertedClientId,
        href: `/dashboard/commercial/leads/${lead.id}`,
      });
    for (const activity of store.leadActivities.filter(
      (item) =>
        !item.archivedAt && leads.some((lead) => lead.id === item.leadId),
    )) {
      const start = activity.startAt || activity.dueAt || activity.dueDate;
      if (!start) continue;
      result.push({
        id: `lead-activity:${activity.id}`,
        recordId: activity.id,
        title: activity.title,
        kind: "activity",
        start,
        end: activity.dueAt || undefined,
        allDay: !activity.dueTime && start.length === 10,
        status: activity.status,
        priority: activity.priority,
        assigneeId: activity.assigneeId,
        leadId: activity.leadId,
        href: `/dashboard/commercial/leads/${activity.leadId}`,
      });
    }
    for (const appointment of store.appointments.filter(
      (item) => !item.archivedAt,
    )) {
      const lead = leads.find((item) => item.id === appointment.leadId);
      if (!lead) continue;
      result.push({
        id: `appointment:${appointment.id}`,
        recordId: appointment.id,
        title: appointment.title,
        kind: "appointment",
        start: appointment.startsAt,
        end: appointment.endsAt,
        status: appointment.status,
        assigneeId: appointment.assigneeId,
        customerId: appointment.customerId,
        leadId: appointment.leadId,
        href: `/dashboard/commercial/leads/${appointment.leadId}`,
        editable: canEditLead(identity.currentUser, lead),
        appointment,
      });
    }
    for (const project of projects.filter((item) => !item.archivedAt)) {
      if (project.dueDate)
        result.push({
          id: `project:${project.id}`,
          recordId: project.id,
          title: `Scadenza · ${project.name}`,
          kind: "project",
          start: project.dueDate,
          allDay: true,
          status: project.status,
          priority: project.priority,
          assigneeId: project.ownerId,
          customerId: project.clientId,
          leadId: project.sourceLeadId,
          projectId: project.id,
          href: `/dashboard/progetti/${project.id}`,
        });
      if (project.deliveredAt)
        result.push({
          id: `delivery:${project.id}`,
          recordId: project.id,
          title: `Consegna · ${project.name}`,
          kind: "delivery",
          start: project.deliveredAt,
          status: "Consegnato",
          assigneeId: project.ownerId,
          customerId: project.clientId,
          projectId: project.id,
          href: `/dashboard/progetti/${project.id}`,
        });
      for (const phase of project.phases.filter((item) => item.dueDate))
        result.push({
          id: `phase:${project.id}:${phase.id}`,
          recordId: phase.id,
          title: `${phase.name} · ${project.name}`,
          kind:
            phase.name.toLowerCase().includes("revision") ||
            phase.name.toLowerCase().includes("qa")
              ? "review"
              : "project",
          start: phase.dueDate!,
          allDay: true,
          status: phase.status,
          assigneeId: project.ownerId,
          customerId: project.clientId,
          projectId: project.id,
          href: `/dashboard/progetti/${project.id}`,
        });
    }
    for (const contract of store.contracts.filter(
      (item) => !item.archivedAt && item.signatureDueAt,
    ))
      result.push({
        id: `contract:${contract.id}`,
        recordId: contract.id,
        title: `Firma · ${contract.title}`,
        kind: "contract",
        start: contract.signatureDueAt!,
        status: contract.status,
        assigneeId: contract.salespersonId,
        customerId: contract.customerId,
        leadId: contract.leadId,
        projectId: contract.projectId,
        href: `/dashboard/contratti?contract=${contract.id}`,
      });
    for (const quote of store.quotes.filter(
      (item) => !item.archivedAt && !item.replacedById,
    ))
      result.push({
        id: `quote:${quote.id}`,
        recordId: quote.id,
        title: `Preventivo ${quote.code}`,
        kind: "quote",
        start: quote.validUntil,
        allDay: true,
        status: quote.status,
        assigneeId: quote.salespersonId,
        customerId: quote.customerId,
        leadId: quote.leadId,
        href: `/dashboard/preventivi/${quote.id}/anteprima`,
      });
    for (const order of store.orders.filter(
      (item) =>
        !item.archivedAt &&
        item.dueDate &&
        !["Annullato", "Rimborsato"].includes(item.administrativeStatus),
    )) {
      const financials = orderFinancialsFromServer(order);
      if (financials.residual <= 0) continue;
      result.push({
        id: `payment:${order.id}`,
        recordId: order.id,
        title: `Pagamento atteso · ${order.code}${canSeeEconomics ? ` · ${financials.residual.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}` : ""}`,
        kind: "payment",
        start: order.dueDate!,
        allDay: true,
        status: order.administrativeStatus,
        assigneeId: order.salespersonId,
        customerId: order.customerId,
        projectId: order.projectId,
        href: `/dashboard/ordini?order=${order.id}`,
      });
    }
    for (const renewal of store.renewals.filter((item) => !item.archivedAt))
      result.push({
        id: `renewal:${renewal.id}`,
        recordId: renewal.id,
        title: `Rinnovo · ${renewal.planName}`,
        kind: "renewal",
        start: renewal.nextDueAt,
        allDay: true,
        status: renewal.status,
        assigneeId: renewal.ownerId,
        customerId: renewal.customerId,
        projectId: renewal.projectId,
        href: `/dashboard/rinnovi?renewal=${renewal.id}`,
      });
    for (const ticket of store.supportTickets.filter(
      (item) => !item.archivedAt && item.dueAt,
    ))
      result.push({
        id: `support:${ticket.id}`,
        recordId: ticket.id,
        title: `${ticket.code} · ${ticket.title}`,
        kind: "support",
        start: ticket.dueAt!,
        status: ticket.status,
        priority: ticket.priority,
        assigneeId: ticket.assigneeId,
        customerId: ticket.customerId,
        projectId: ticket.projectId,
        href: `/dashboard/supporto?ticket=${ticket.id}`,
      });
    for (const customer of customers)
      for (const document of (customer.documents ?? []).filter(
        (item) => !["Firmato", "Archiviato"].includes(item.status),
      ))
        result.push({
          id: `materials:${document.id}`,
          recordId: document.id,
          title: `Materiale · ${document.name}`,
          kind: "materials",
          start: document.updatedAt || document.createdAt,
          allDay: true,
          status: document.status,
          assigneeId: customer.profile.assigneeId,
          customerId: customer.id,
          projectId: document.projectId,
          href: `/dashboard/clienti/${customer.id}`,
        });
    for (const approval of store.operationalApprovals.filter(
      (item) =>
        item.requestedAt && !["Sostituito", "Revocato"].includes(item.status),
    )) {
      const project =
        projects.find((item) => item.id === approval.objectId) ??
        projects.find((item) =>
          item.phases.some((phase) => phase.id === approval.objectId),
        );
      if (!project && approval.objectType !== "activity") continue;
      result.push({
        id: `review:${approval.id}`,
        recordId: approval.id,
        title: `Revisione · ${project?.name ?? "attività operativa"}`,
        kind: "review",
        start: approval.requestedAt!,
        status: approval.status,
        assigneeId: approval.requiredApproverId,
        customerId: project?.clientId,
        projectId: project?.id,
        href: project
          ? `/dashboard/progetti/${project.id}`
          : "/dashboard/attivita",
      });
    }
    return result.sort((a, b) => a.start.localeCompare(b.start));
  }, [
    activities,
    canSeeEconomics,
    customers,
    identity.currentUser,
    leads,
    projects,
    store.appointments,
    store.contracts,
    store.leadActivities,
    store.operationalApprovals,
    store.orders,
    store.quotes,
    store.renewals,
    store.supportTickets,
  ]);

  const filtered = useMemo(
    () =>
      events.filter((event) => {
        const search = query.trim().toLowerCase();
        if (
          search &&
          !`${event.title} ${KIND_LABELS[event.kind]}`
            .toLowerCase()
            .includes(search)
        )
          return false;
        if (
          (mineOnly || assignee === "current") &&
          event.assigneeId !== identity.currentUserId
        )
          return false;
        if (
          assignee !== "all" &&
          assignee !== "current" &&
          event.assigneeId !== assignee
        )
          return false;
        if (
          team !== "all" &&
          !identity.users
            .find((user) => user.id === event.assigneeId)
            ?.roles.some((role) => role.includes(team))
        )
          return false;
        if (
          (customerId !== "all" && event.customerId !== customerId) ||
          (leadId !== "all" && event.leadId !== leadId) ||
          (projectId !== "all" && event.projectId !== projectId)
        )
          return false;
        if (
          (kind !== "all" && event.kind !== kind) ||
          (status !== "all" && event.status !== status) ||
          (priority !== "all" && event.priority !== priority)
        )
          return false;
        if (
          personalDeadlineOnly &&
          !(event.id.startsWith("activity:") || event.id.startsWith("project:"))
        )
          return false;
        if (
          (overdueOnly && !eventIsOverdue(event)) ||
          (openOnly && CLOSED.has(event.status))
        )
          return false;
        if (
          summaryCategory === "todo" &&
          (!["activity", "appointment"].includes(event.kind) ||
            CLOSED.has(event.status))
        )
          return false;
        if (
          summaryCategory === "support" &&
          (event.kind !== "support" || CLOSED.has(event.status))
        )
          return false;
        if (
          summaryCategory === "quote" &&
          (event.kind !== "quote" || CLOSED.has(event.status))
        )
          return false;
        if (
          summaryCategory === "contract" &&
          (event.kind !== "contract" || CLOSED.has(event.status))
        )
          return false;
        if (
          summaryCategory === "payment" &&
          (event.kind !== "payment" || CLOSED.has(event.status))
        )
          return false;
        if (
          summaryCategory === "materials" &&
          (event.kind !== "materials" || CLOSED.has(event.status))
        )
          return false;
        if (summaryCategory === "overdue" && !eventIsOverdue(event))
          return false;
        const date = safeDate(event.start)!;
        if (period === "today" && !isSameDay(date, today)) return false;
        if (
          period === "week" &&
          (isBefore(date, startOfWeek(today, { weekStartsOn: 1 })) ||
            isAfter(date, endOfWeek(today, { weekStartsOn: 1 })))
        )
          return false;
        if (period === "month" && !isSameMonth(date, today)) return false;
        if (
          period === "upcoming" &&
          (isBefore(date, today) || isAfter(date, addDays(today, 3)))
        )
          return false;
        return true;
      }),
    [
      assignee,
      customerId,
      events,
      identity.currentUserId,
      identity.users,
      kind,
      leadId,
      mineOnly,
      openOnly,
      overdueOnly,
      period,
      personalDeadlineOnly,
      priority,
      projectId,
      query,
      status,
      summaryCategory,
      team,
      today,
    ],
  );

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const shownDays = useMemo(
    () =>
      view === "month"
        ? Array.from({ length: 42 }, (_, index) =>
            addDays(
              startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
              index,
            ),
          )
        : view === "week"
          ? Array.from({ length: 7 }, (_, index) =>
              addDays(startOfWeek(anchor, { weekStartsOn: 1 }), index),
            )
          : [anchor],
    [anchor, view],
  );
  const summaryEvents = useMemo(() => {
    const visibleStart = shownDays[0] ?? anchor;
    const visibleEnd = shownDays.at(-1) ?? anchor;
    return events.filter((event) => {
      if (
        (mineOnly || assignee === "current") &&
        event.assigneeId !== identity.currentUserId
      )
        return false;
      if (
        assignee !== "all" &&
        assignee !== "current" &&
        event.assigneeId !== assignee
      )
        return false;
      if (
        team !== "all" &&
        !identity.users
          .find((user) => user.id === event.assigneeId)
          ?.roles.some((role) => role.includes(team))
      )
        return false;
      if (
        (customerId !== "all" && event.customerId !== customerId) ||
        (projectId !== "all" && event.projectId !== projectId)
      )
        return false;
      const eventDate = safeDate(event.start)!;
      if (summaryPeriod === "today") return isSameDay(eventDate, today);
      if (summaryPeriod === "seven")
        return (
          !isBefore(eventDate, today) && !isAfter(eventDate, addDays(today, 7))
        );
      return (
        !isBefore(eventDate, startOfDay(visibleStart)) &&
        !isAfter(eventDate, addDays(startOfDay(visibleEnd), 1))
      );
    });
  }, [
    anchor,
    assignee,
    customerId,
    events,
    identity.currentUserId,
    identity.users,
    mineOnly,
    projectId,
    shownDays,
    summaryPeriod,
    team,
    today,
  ]);
  const summaryCards = [
    {
      id: "todo" as const,
      label: "Da fare",
      icon: ClipboardList,
      count: summaryEvents.filter(
        (event) =>
          ["activity", "appointment"].includes(event.kind) &&
          !CLOSED.has(event.status),
      ).length,
      detail: "attività e appuntamenti aperti",
      style:
        "border-indigo-500/35 bg-indigo-500/5 text-indigo-700 dark:text-indigo-300",
    },
    {
      id: "overdue" as const,
      label: "Scaduti",
      icon: AlertTriangle,
      count: new Set(
        summaryEvents
          .filter(eventIsOverdue)
          .map((event) => `${event.kind}:${event.recordId}`),
      ).size,
      detail: "pratiche oltre scadenza",
      style: "border-red-500/45 bg-red-500/5 text-red-700 dark:text-red-300",
    },
    {
      id: "support" as const,
      label: "Supporto",
      icon: Headphones,
      count: new Set(
        summaryEvents
          .filter(
            (event) => event.kind === "support" && !CLOSED.has(event.status),
          )
          .map((event) => event.recordId),
      ).size,
      detail: `${summaryEvents.filter((event) => event.kind === "support" && (event.priority === "Urgente" || eventIsOverdue(event))).length} urgenti o a rischio`,
      style:
        "border-orange-600/40 bg-orange-600/5 text-orange-800 dark:text-orange-300",
    },
    {
      id: "quote" as const,
      label: "Preventivi",
      icon: FileText,
      count: new Set(
        summaryEvents
          .filter(
            (event) => event.kind === "quote" && !CLOSED.has(event.status),
          )
          .map((event) => event.recordId),
      ).size,
      detail: `${summaryEvents.filter((event) => event.kind === "quote" && eventIsOverdue(event)).length} scaduti`,
      style:
        "border-violet-500/35 bg-violet-500/5 text-violet-700 dark:text-violet-300",
    },
    {
      id: "contract" as const,
      label: "Contratti",
      icon: FileSignature,
      count: new Set(
        summaryEvents
          .filter(
            (event) => event.kind === "contract" && !CLOSED.has(event.status),
          )
          .map((event) => event.recordId),
      ).size,
      detail: "invio, firma o verifica",
      style:
        "border-amber-500/45 bg-amber-500/5 text-amber-800 dark:text-amber-300",
    },
    {
      id: "payment" as const,
      label: "Pagamenti",
      icon: CreditCard,
      count: new Set(
        summaryEvents
          .filter(
            (event) => event.kind === "payment" && !CLOSED.has(event.status),
          )
          .map((event) => event.recordId),
      ).size,
      detail: canSeeEconomics
        ? "acconti e saldi attesi"
        : "verifiche autorizzate",
      style:
        "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    },
    {
      id: "materials" as const,
      label: "Materiali",
      icon: PackageCheck,
      count: new Set(
        summaryEvents
          .filter(
            (event) => event.kind === "materials" && !CLOSED.has(event.status),
          )
          .map((event) => event.recordId),
      ).size,
      detail: "mancanti o da verificare",
      style:
        "border-cyan-500/40 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300",
    },
  ];
  const statuses = [...new Set(events.map((event) => event.status))].sort();
  const priorities = [
    ...new Set(
      events.map((event) => event.priority).filter(Boolean) as string[],
    ),
  ].sort();
  const resetFilters = () => {
    setQuery("");
    setAssignee("all");
    setTeam("all");
    setCustomerId("all");
    setLeadId("all");
    setProjectId("all");
    setKind("all");
    setStatus("all");
    setPriority("all");
    setPeriod("all");
    setMineOnly(false);
    setOverdueOnly(false);
    setOpenOnly(false);
    setSummaryCategory(undefined);
    router.replace("/dashboard/calendario");
  };
  const openCreate = (day: Date, time = "09:00") => {
    setCreateDate(format(day, "yyyy-MM-dd"));
    setCreateTime(time);
  };
  const openDay = (day: Date) => {
    setAnchor(startOfDay(day));
    setView("day");
    setSelectedEventId(undefined);
  };
  const navigate = (direction: -1 | 1) =>
    setAnchor((current) =>
      view === "month" || view === "agenda"
        ? addMonths(current, direction)
        : view === "week"
          ? addWeeks(current, direction)
          : addDays(current, direction),
    );
  const openEvent = (event: CalendarEvent) => setSelectedEventId(event.id);
  const reschedule = async (eventId: string, day: Date) => {
    const event = events.find((item) => item.id === eventId);
    if (!event?.editable || draggingId.current === `saving:${eventId}`) return;
    draggingId.current = `saving:${eventId}`;
    const dayValue = format(day, "yyyy-MM-dd");
    let ok = false;
    if (event.appointment) {
      const start = safeDate(event.appointment.startsAt)!;
      const end = safeDate(event.appointment.endsAt)!;
      const nextStart = new Date(`${dayValue}T${format(start, "HH:mm:ss")}`);
      ok = await store.updateAppointment(event.appointment.id, {
        startsAt: nextStart.toISOString(),
        endsAt: new Date(
          nextStart.getTime() + end.getTime() - start.getTime(),
        ).toISOString(),
      });
    }
    if (event.activity && event.activityCustomerId) {
      const time =
        event.activity.dueTime ||
        (event.activity.dueAt
          ? format(safeDate(event.activity.dueAt)!, "HH:mm")
          : "12:00");
      ok = await store.updateCustomerActivity(
        event.activityCustomerId,
        event.activity.id,
        { dueDate: dayValue, dueTime: time, dueAt: `${dayValue}T${time}:00` },
      );
    }
    toast[ok ? "success" : "error"](
      ok
        ? "Impegno riprogrammato"
        : "Riprogrammazione non autorizzata o invariata",
    );
    window.setTimeout(() => {
      draggingId.current = undefined;
    }, 450);
  };
  const completeEvent = async (event: CalendarEvent) => {
    let ok = false;
    if (event.activity && event.activityCustomerId)
      ok = await store.updateCustomerActivity(
        event.activityCustomerId,
        event.activity.id,
        { status: "Completata" },
      );
    else if (event.appointment)
      ok = await store.updateAppointment(event.appointment.id, {
        status: "completed",
      });
    else if (event.kind === "support")
      ok = await store.updateSupportTicket(
        event.recordId,
        { status: "Risolto" },
        "Completato dal Calendario operativo",
      );
    toast[ok ? "success" : "error"](
      ok
        ? "Impegno completato"
        : "Questo impegno non può essere completato dal Calendario",
    );
  };
  const resizeAppointment = (event: CalendarEvent, minutes: number) => {
    if (
      !event.appointment ||
      !event.editable ||
      draggingId.current === `resize:${event.id}`
    )
      return;
    draggingId.current = `resize:${event.id}`;
    const startsAt = safeDate(event.appointment.startsAt)!;
    const ok = store.updateAppointment(event.appointment.id, {
      endsAt: new Date(startsAt.getTime() + minutes * 60_000).toISOString(),
    });
    toast[ok ? "success" : "error"](
      ok
        ? "Durata appuntamento aggiornata"
        : "Durata invariata o non autorizzata",
    );
    window.setTimeout(() => {
      draggingId.current = undefined;
    }, 450);
  };

  return (
    <div
      className="min-w-0 space-y-4 p-4 sm:p-6"
      data-flow-tour="flow-calendar"
    >
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarDays className="size-6 text-violet-600" />
            Calendario operativo
          </h1>
          <p className="text-sm text-muted-foreground">
            Un’unica agenda derivata dai record reali autorizzati. Nessun dato
            viene duplicato.
          </p>
        </div>
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as CalendarView)}
        >
          <TabsList aria-label="Vista calendario">
            <TabsTrigger value="month">Mese</TabsTrigger>
            <TabsTrigger value="week">Settimana</TabsTrigger>
            <TabsTrigger value="day">Giorno</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      <section aria-labelledby="calendar-summary-title" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="calendar-summary-title" className="text-sm font-semibold">
              Sintesi operativa
            </h2>
            <p className="text-xs text-muted-foreground">
              Pratiche e impegni reali nel perimetro autorizzato.
            </p>
          </div>
          <Select
            value={summaryPeriod}
            onValueChange={(value) =>
              setSummaryPeriod(value as typeof summaryPeriod)
            }
          >
            <SelectTrigger
              className="w-44"
              aria-label="Periodo sintesi operativa"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Oggi</SelectItem>
              <SelectItem value="seven">Prossimi 7 giorni</SelectItem>
              <SelectItem value="visible">Periodo visibile</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={summaryCategory === card.id}
                onClick={() =>
                  setSummaryCategory((current) =>
                    current === card.id ? undefined : card.id,
                  )
                }
                className={cn(
                  "min-w-0 rounded-lg border p-2.5 text-left outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring dark:hover:brightness-110",
                  card.style,
                  summaryCategory === card.id && "ring-2 ring-current",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{card.label}</span>
                </span>
                <strong className="mt-0.5 block text-2xl tabular-nums">
                  {card.count}
                </strong>
                <span className="line-clamp-1 text-[11px] text-muted-foreground">
                  {card.detail}
                </span>
              </button>
            );
          })}
        </div>
        {summaryCategory && (
          <Badge variant="secondary" className="gap-1">
            Filtro:{" "}
            {summaryCards.find((card) => card.id === summaryCategory)?.label}
            <button
              type="button"
              className="rounded px-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSummaryCategory(undefined)}
              aria-label="Rimuovi filtro sintesi"
            >
              ×
            </button>
          </Badge>
        )}
      </section>
      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Periodo precedente"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchor(today)}
            >
              Oggi
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Periodo successivo"
              onClick={() => navigate(1)}
            >
              <ChevronRight />
            </Button>
            <h2 className="min-w-0 flex-1 text-center text-base font-semibold capitalize sm:text-lg">
              {view === "day"
                ? format(anchor, "EEEE d MMMM yyyy", { locale: it })
                : view === "week"
                  ? `${format(shownDays[0], "d MMM", { locale: it })} – ${format(shownDays[6], "d MMM yyyy", { locale: it })}`
                  : format(anchor, "MMMM yyyy", { locale: it })}
            </h2>
            <span className="rounded-full bg-muted px-2 py-1 text-xs">
              {filtered.length} impegni
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Label className="relative sm:col-span-2">
              <span className="sr-only">Cerca</span>
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca impegni…"
                className="pl-8"
              />
            </Label>
            <FilterSelect
              label="Responsabile"
              value={assignee}
              onChange={setAssignee}
              options={[
                { value: "all", label: "Tutti i responsabili" },
                { value: "current", label: "Utente corrente" },
                ...commercialTeam.map((member) => ({
                  value: member.id,
                  label: member.name,
                })),
              ]}
            />
            <FilterSelect
              label="Team"
              value={team}
              onChange={setTeam}
              options={[
                { value: "all", label: "Tutti i team" },
                { value: "commercial", label: "Commerciale" },
                { value: "developer", label: "Sviluppo" },
                { value: "project", label: "Project management" },
                { value: "support", label: "Supporto" },
              ]}
            />
            <FilterSelect
              label="Cliente"
              value={customerId}
              onChange={setCustomerId}
              options={[
                { value: "all", label: "Tutti i clienti" },
                ...customers.map((item) => ({
                  value: item.id,
                  label: item.profile.company,
                })),
              ]}
            />
            <FilterSelect
              label="Lead"
              value={leadId}
              onChange={setLeadId}
              options={[
                { value: "all", label: "Tutti i lead" },
                ...leads.map((item) => ({
                  value: item.id,
                  label: `${item.company} · ${item.firstName} ${item.lastName}`,
                })),
              ]}
            />
            <FilterSelect
              label="Progetto"
              value={projectId}
              onChange={setProjectId}
              options={[
                { value: "all", label: "Tutti i progetti" },
                ...projects.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
            <FilterSelect
              label="Tipologia"
              value={kind}
              onChange={(value) => setKind(value as EventKind | "all")}
              options={[
                { value: "all", label: "Tutte le tipologie" },
                ...Object.entries(KIND_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
            <FilterSelect
              label="Stato"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "Tutti gli stati" },
                ...statuses.map((value) => ({
                  value,
                  label: formatOperationalValue(value),
                })),
              ]}
            />
            <FilterSelect
              label="Priorità"
              value={priority}
              onChange={setPriority}
              options={[
                { value: "all", label: "Tutte le priorità" },
                ...priorities.map((value) => ({ value, label: value })),
              ]}
            />
            <FilterSelect
              label="Periodo"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "all", label: "Periodo visibile" },
                { value: "today", label: "Oggi" },
                { value: "week", label: "Questa settimana" },
                { value: "month", label: "Questo mese" },
                { value: "upcoming", label: "Prossimi 3 giorni" },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Check label="Solo miei" checked={mineOnly} set={setMineOnly} />
            <Check
              label="Solo scaduti"
              checked={overdueOnly}
              set={setOverdueOnly}
            />
            <Check
              label="Solo non completati"
              checked={openOnly}
              set={setOpenOnly}
            />
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <FilterX />
              Azzera filtri
            </Button>
          </div>
        </CardContent>
      </Card>
      <div
        className="flex flex-wrap gap-x-3 gap-y-1"
        aria-label="Legenda calendario"
      >
        {Object.entries(KIND_LABELS).map(([value, label]) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          >
            <span
              className={cn(
                "size-2 rounded-full border",
                KIND_STYLES[value as EventKind],
              )}
            />
            {label}
          </span>
        ))}
      </div>
      {view === "agenda" ? (
        <Agenda
          events={filtered.filter((event) =>
            isSameMonth(safeDate(event.start)!, anchor),
          )}
          selected={selectedEventId}
          onOpen={openEvent}
          onReschedule={(event, date) =>
            setPendingMove({
              eventId: event.id,
              day: parseISO(`${date}T12:00:00`),
            })
          }
          onResize={resizeAppointment}
        />
      ) : view === "day" ? (
        <DaySchedule
          day={anchor}
          events={filtered.filter(
            (event) => dateKey(event.start) === format(anchor, "yyyy-MM-dd"),
          )}
          selected={selectedEventId}
          onOpen={openEvent}
          onCreate={openCreate}
          onDrop={(eventId, day) => setPendingMove({ eventId, day })}
          onDragStart={(eventId) => {
            draggingId.current = eventId;
          }}
        />
      ) : (
        <div className="max-w-full overflow-x-auto rounded-xl border bg-card">
          <div
            className={cn(
              view === "month" ? "min-w-[760px]" : "min-w-[700px]",
              "grid grid-cols-7",
            )}
          >
            {shownDays.slice(0, 7).map((day) => (
              <button
                type="button"
                key={`head-${dateKey(day.toISOString())}`}
                onClick={() => openDay(day)}
                className="border-b border-r p-2 text-center text-xs font-medium outline-none last:border-r-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {format(day, "EEE d", { locale: it })}
              </button>
            ))}
            {shownDays.map((day) => {
              const dayEvents = filtered.filter(
                (event) => dateKey(event.start) === format(day, "yyyy-MM-dd"),
              );
              const visibleEvents =
                view === "month" ? dayEvents.slice(0, 4) : dayEvents;
              return (
                <section
                  key={day.toISOString()}
                  data-calendar-date={format(day, "yyyy-MM-dd")}
                  onClick={() => openDay(day)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDropCapture={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const eventId =
                      e.dataTransfer.getData("text/plain") ||
                      draggingId.current;
                    if (eventId) setPendingMove({ eventId, day });
                  }}
                  className={cn(
                    "min-w-0 border-b border-r p-1.5 last:border-r-0 hover:bg-muted/30",
                    view === "month" ? "min-h-32" : "min-h-[440px]",
                    !isSameMonth(day, anchor) &&
                      view === "month" &&
                      "bg-muted/25 text-muted-foreground",
                  )}
                  aria-label={`Apri il giorno ${format(day, "d MMMM yyyy", { locale: it })}`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDay(day);
                    }}
                    className={cn(
                      "mb-1 flex size-7 items-center justify-center rounded-full text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                      isSameDay(day, today) &&
                        "bg-violet-600 font-semibold text-white",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                  <div className="space-y-1">
                    {visibleEvents.map((event) => (
                      <CalendarEventButton
                        key={event.id}
                        event={event}
                        selected={selectedEventId === event.id}
                        onOpen={() => openEvent(event)}
                        onDragStart={() => {
                          draggingId.current = event.id;
                        }}
                      />
                    ))}
                    {view === "month" &&
                      dayEvents.length > visibleEvents.length && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="w-full justify-start"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDay(day);
                          }}
                        >
                          + altri {dayEvents.length - visibleEvents.length}
                        </Button>
                      )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
      {!filtered.length && (
        <Card>
          <CardHeader className="items-center text-center">
            <CalendarDays className="size-10 text-muted-foreground" />
            <CardTitle>Nessun impegno nel perimetro corrente</CardTitle>
            <CardDescription>
              Modifica i filtri oppure seleziona uno spazio del calendario per
              pianificare un’attività o un appuntamento.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      <EventDetailSheet
        event={selectedEvent}
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => !open && setSelectedEventId(undefined)}
        onComplete={completeEvent}
        onOpenRecord={(event) => router.push(event.href)}
        onReschedule={(event, day) =>
          setPendingMove({ eventId: event.id, day })
        }
        onResize={resizeAppointment}
        note={note}
        setNote={setNote}
      />
      <Dialog
        open={Boolean(pendingMove)}
        onOpenChange={(open) => !open && setPendingMove(undefined)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingMove &&
              [
                "contract",
                "payment",
                "renewal",
                "delivery",
                "review",
                "support",
              ].includes(
                events.find((event) => event.id === pendingMove.eventId)
                  ?.kind ?? "",
              )
                ? "Stai modificando una scadenza operativa"
                : "Sposta impegno"}
            </DialogTitle>
            <DialogDescription>
              {pendingMove
                ? `${events.find((event) => event.id === pendingMove.eventId)?.title ?? "Impegno"} → ${format(pendingMove.day, "d MMMM yyyy", { locale: it })}. Il record sorgente verrà aggiornato senza creare copie.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingMove(undefined)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (!pendingMove) return;
                reschedule(pendingMove.eventId, pendingMove.day);
                setPendingMove(undefined);
              }}
            >
              Conferma spostamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(createDate) && !activityOpen && !appointmentOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDate(undefined);
            setCreateSubject("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cosa vuoi pianificare?</DialogTitle>
            <DialogDescription>
              {createDate
                ? `${format(parseISO(`${createDate}T12:00:00`), "EEEE d MMMM yyyy", { locale: it })} · ${createTime}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Label>
            Collega a
            <Select value={createSubject} onValueChange={setCreateSubject}>
              <SelectTrigger aria-label="Record collegato">
                <SelectValue placeholder="Seleziona lead o cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.length > 0 && (
                  <>
                    <SelectItem value="customer-heading" disabled>
                      Clienti
                    </SelectItem>
                    {customers.map((item) => (
                      <SelectItem key={item.id} value={`customer:${item.id}`}>
                        {item.profile.company}
                      </SelectItem>
                    ))}
                  </>
                )}
                {leads.length > 0 && (
                  <>
                    <SelectItem value="lead-heading" disabled>
                      Lead
                    </SelectItem>
                    {leads.map((item) => (
                      <SelectItem key={item.id} value={`lead:${item.id}`}>
                        {item.company} · {item.firstName} {item.lastName}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto justify-start py-3"
              onClick={() => {
                if (createSubject.startsWith("lead:"))
                  setAppointmentLeadId(createSubject.slice(5));
                setAppointmentOpen(true);
              }}
              disabled={!createSubject.startsWith("lead:")}
            >
              <Clock3 />
              Appuntamento
            </Button>
            {["Attività", "Follow-up", "Promemoria", "Blocco di lavoro"].map(
              (label) => (
                <Button
                  key={label}
                  variant="outline"
                  className="h-auto justify-start py-3"
                  onClick={() => setActivityOpen(true)}
                  disabled={!createSubject}
                >
                  <CirclePlus />
                  {label}
                </Button>
              ),
            )}
          </div>
        </DialogContent>
      </Dialog>
      {createDate && (
        <ActivityFormDialog
          key={`calendar-activity-${createDate}-${createTime}-${createSubject}`}
          open={activityOpen}
          onOpenChange={(open) => {
            setActivityOpen(open);
            if (!open) {
              setCreateDate(undefined);
              setCreateSubject("");
            }
          }}
          defaultClientId={
            createSubject.startsWith("customer:")
              ? createSubject.slice(9)
              : undefined
          }
          defaultLeadId={
            createSubject.startsWith("lead:")
              ? createSubject.slice(5)
              : undefined
          }
          lockClient
          defaultDueDate={createDate}
          defaultDueTime={createTime}
        />
      )}
      <CalendarAppointmentDialog
        key={`calendar-appointment-${createDate ?? "none"}-${createTime}-${appointmentLeadId}`}
        open={appointmentOpen}
        onOpenChange={(open) => {
          setAppointmentOpen(open);
          if (!open) {
            setCreateDate(undefined);
            setAppointmentLeadId("");
          }
        }}
        defaultDate={createDate}
        defaultTime={createTime}
        defaultLeadId={appointmentLeadId}
      />
    </div>
  );
}

function DaySchedule({
  day,
  events,
  selected,
  onOpen,
  onCreate,
  onDrop,
  onDragStart,
}: {
  day: Date;
  events: CalendarEvent[];
  selected?: string;
  onOpen: (event: CalendarEvent) => void;
  onCreate: (day: Date, time?: string) => void;
  onDrop: (eventId: string, day: Date) => void;
  onDragStart: (eventId: string) => void;
}) {
  const allDay = events.filter((event) => event.allDay);
  const hours = Array.from({ length: 12 }, (_, index) => index + 8);
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b pb-3">
        <CardTitle className="capitalize">
          {format(day, "EEEE d MMMM yyyy", { locale: it })}
        </CardTitle>
        <CardDescription>
          {events.length} impegni · seleziona uno slot libero per pianificare.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <section className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] border-b bg-muted/15">
          <div className="border-r p-2 text-xs font-medium text-muted-foreground">
            Tutto il giorno
          </div>
          <div className="space-y-1 p-2">
            {allDay.map((event) => (
              <CalendarEventButton
                key={event.id}
                event={event}
                selected={selected === event.id}
                onOpen={() => onOpen(event)}
                onDragStart={() => onDragStart(event.id)}
              />
            ))}
            {!allDay.length && (
              <span className="text-xs text-muted-foreground">
                Nessuna scadenza senza orario.
              </span>
            )}
          </div>
        </section>
        <div>
          {hours.map((hour) => {
            const time = `${String(hour).padStart(2, "0")}:00`;
            const slotEvents = events.filter(
              (event) =>
                !event.allDay && safeDate(event.start)?.getHours() === hour,
            );
            return (
              <section
                key={hour}
                className="grid min-h-20 min-w-0 grid-cols-[72px_minmax(0,1fr)] border-b last:border-b-0"
              >
                <div className="border-r p-2 text-right text-xs text-muted-foreground">
                  {time}
                </div>
                <button
                  type="button"
                  className="min-w-0 space-y-1 p-2 text-left outline-none hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onCreate(day, time)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(drop) => {
                    drop.preventDefault();
                    drop.stopPropagation();
                    const eventId = drop.dataTransfer.getData("text/plain");
                    if (eventId)
                      onDrop(
                        eventId,
                        new Date(`${format(day, "yyyy-MM-dd")}T${time}:00`),
                      );
                  }}
                  aria-label={`Pianifica alle ${time}`}
                >
                  {slotEvents.map((event) => (
                    <CalendarEventButton
                      key={event.id}
                      event={event}
                      selected={selected === event.id}
                      onOpen={() => onOpen(event)}
                      onDragStart={() => onDragStart(event.id)}
                    />
                  ))}
                  {!slotEvents.length && (
                    <span className="text-xs text-muted-foreground opacity-0 transition-opacity hover:opacity-100">
                      Slot libero · pianifica
                    </span>
                  )}
                </button>
              </section>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function EventDetailSheet({
  event,
  open,
  onOpenChange,
  onComplete,
  onOpenRecord,
  onReschedule,
  onResize,
  note,
  setNote,
}: {
  event?: CalendarEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (event: CalendarEvent) => void;
  onOpenRecord: (event: CalendarEvent) => void;
  onReschedule: (event: CalendarEvent, day: Date) => void;
  onResize: (event: CalendarEvent, minutes: number) => void;
  note: string;
  setNote: (value: string) => void;
}) {
  const { store, identity, leads, customers, projects } =
    useAuthorizedCommercial();
  if (!event) return null;
  const lead = event.leadId
    ? leads.find((item) => item.id === event.leadId)
    : undefined;
  const customer = event.customerId
    ? customers.find((item) => item.id === event.customerId)
    : undefined;
  const project = event.projectId
    ? projects.find((item) => item.id === event.projectId)
    : undefined;
  const ticket =
    event.kind === "support"
      ? store.supportTickets.find((item) => item.id === event.recordId)
      : undefined;
  const owner = identity.users.find((item) => item.id === event.assigneeId);
  const duration =
    event.end && safeDate(event.end) && safeDate(event.start)
      ? Math.max(
          0,
          Math.round(
            (safeDate(event.end)!.getTime() -
              safeDate(event.start)!.getTime()) /
              60_000,
          ),
        )
      : undefined;
  const audit = store.auditEvents
    .filter(
      (item) =>
        item.recordId === event.recordId || item.recordId === event.projectId,
    )
    .slice(0, 5);
  const addNote = () => {
    const recordType =
      event.kind === "support"
        ? "support_ticket"
        : event.kind === "activity"
          ? "activity"
          : ["project", "delivery", "review"].includes(event.kind)
            ? "project"
            : undefined;
    const recordId =
      recordType === "project" ? event.projectId : event.recordId;
    if (!recordType || !recordId || !note.trim())
      return toast.error(
        "Le note collaborative non sono disponibili per questo tipo di impegno",
      );
    const id = store.addComment({ recordType, recordId, text: note.trim() });
    if (!id) return toast.error("Nota non autorizzata");
    setNote("");
    toast.success("Nota interna aggiunta");
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-[560px]"
        aria-describedby="calendar-event-description"
      >
        <SheetHeader className="text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{KIND_LABELS[event.kind]}</Badge>
            <Badge className={eventClass(event)}>
              {formatOperationalValue(event.status)}
            </Badge>
            {event.priority && (
              <Badge variant="secondary">{event.priority}</Badge>
            )}
          </div>
          <SheetTitle>Dettaglio impegno</SheetTitle>
          <SheetDescription id="calendar-event-description">
            {event.title}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-5">
          <section className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
            <Detail
              label="Data"
              value={format(safeDate(event.start)!, "d MMMM yyyy", {
                locale: it,
              })}
            />
            <Detail
              label="Orario"
              value={
                event.allDay
                  ? "Tutto il giorno"
                  : `${timeLabel(event.start)}${event.end ? ` – ${timeLabel(event.end)}` : ""}`
              }
            />
            <Detail
              label="Durata"
              value={
                duration
                  ? `${duration} min`
                  : event.allDay
                    ? "Tutto il giorno"
                    : "Non definita"
              }
            />
            <Detail
              label="Responsabile"
              value={owner?.name ?? "Non assegnato"}
            />
            <Detail
              label="Cliente"
              value={
                customer?.profile.company ||
                [customer?.profile.firstName, customer?.profile.lastName]
                  .filter(Boolean)
                  .join(" ") ||
                "Non collegato"
              }
            />
            <Detail
              label="Lead"
              value={
                lead
                  ? `${lead.company} · ${lead.firstName} ${lead.lastName}`
                  : "Non collegato"
              }
            />
            <Detail label="Progetto" value={project?.name ?? "Non collegato"} />
            <Detail label="Origine" value="DoFlow · record operativo" />
            {ticket && (
              <>
                <Detail
                  label="Ticket"
                  value={`${ticket.code} · ${ticket.category}`}
                />
                <Detail
                  label="SLA"
                  value={`${ticket.slaHours} ore · ${ticket.status === "In attesa cliente" ? "sospeso in attesa cliente" : "attivo"}`}
                />
              </>
            )}
          </section>
          {event.activity?.description && (
            <section>
              <h3 className="text-sm font-semibold">Descrizione</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {event.activity.description}
              </p>
            </section>
          )}
          <section className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => onComplete(event)}
              disabled={CLOSED.has(event.status)}
            >
              <CheckCircle2 />
              Segna completato
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenRecord(event)}
            >
              <ExternalLink />
              Apri record collegato
            </Button>
            {event.editable && (
              <Label className="w-full sm:w-auto">
                <span className="sr-only">Riprogramma</span>
                <Input
                  aria-label="Riprogramma impegno"
                  type="date"
                  value={dateKey(event.start)}
                  onChange={(change) =>
                    onReschedule(
                      event,
                      parseISO(`${change.target.value}T12:00:00`),
                    )
                  }
                />
              </Label>
            )}
            {event.appointment && event.editable && (
              <Select
                value={String(duration ?? 60)}
                onValueChange={(value) => onResize(event, Number(value))}
              >
                <SelectTrigger className="w-32" aria-label="Durata">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 60, 90, 120].map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes < 120 ? `${minutes} min` : "2 ore"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="size-4" />
              Nota interna
            </h3>
            <Textarea
              value={note}
              onChange={(change) => setNote(change.target.value)}
              placeholder="Aggiungi una nota visibile al team autorizzato"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addNote}
              disabled={!note.trim()}
            >
              Aggiungi nota
            </Button>
          </section>
          <section>
            <h3 className="text-sm font-semibold">Timeline essenziale</h3>
            <div className="mt-2 space-y-2">
              {audit.map((item) => (
                <div key={item.id} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{item.action}</p>
                  <p className="text-muted-foreground">
                    {format(new Date(item.createdAt), "d MMM yyyy, HH:mm", {
                      locale: it,
                    })}
                  </p>
                </div>
              ))}
              {!audit.length && (
                <p className="text-sm text-muted-foreground">
                  Nessun aggiornamento storico per questo impegno.
                </p>
              )}
            </div>
          </section>
          {ticket && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <UserRoundCog className="size-4" />
                Pratica Supporto
              </p>
              <p className="mt-1 text-muted-foreground">
                {ticket.priority} · {ticket.status} · prossima scadenza{" "}
                {ticket.dueAt
                  ? format(new Date(ticket.dueAt), "d MMM yyyy, HH:mm", {
                      locale: it,
                    })
                  : "non definita"}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words font-medium">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full">
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
  );
}
function Check({
  label,
  checked,
  set,
}: {
  label: string;
  checked: boolean;
  set: (value: boolean) => void;
}) {
  return (
    <Label className="flex cursor-pointer items-center gap-2 font-normal">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => set(value === true)}
      />
      {label}
    </Label>
  );
}
function Agenda({
  events,
  selected,
  onOpen,
  onReschedule,
  onResize,
}: {
  events: CalendarEvent[];
  selected?: string;
  onOpen: (event: CalendarEvent) => void;
  onReschedule: (event: CalendarEvent, date: string) => void;
  onResize: (event: CalendarEvent, minutes: number) => void;
}) {
  const groups = Object.entries(
    Object.groupBy(events, (event) => dateKey(event.start)),
  ).sort(([left], [right]) => left.localeCompare(right));
  return (
    <Card>
      <CardContent className="space-y-5 p-3 sm:p-5">
        {groups.map(([day, items]) => (
          <section key={day}>
            <h3 className="mb-2 border-b pb-2 text-sm font-semibold capitalize">
              {format(parseISO(`${day}T12:00:00`), "EEEE d MMMM", {
                locale: it,
              })}
            </h3>
            <div className="space-y-2">
              {items?.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <div className="min-w-48 flex-1">
                    <CalendarEventButton
                      event={event}
                      selected={selected === event.id}
                      onOpen={() => onOpen(event)}
                      onDragStart={() => undefined}
                    />
                  </div>
                  {event.editable && (
                    <Label className="shrink-0">
                      <span className="sr-only">Sposta {event.title} in</span>
                      <Input
                        aria-label={`Sposta ${event.title} in`}
                        type="date"
                        className="h-8 w-34 text-xs"
                        value={dateKey(event.start)}
                        onChange={(change) =>
                          onReschedule(event, change.target.value)
                        }
                      />
                    </Label>
                  )}
                  {event.appointment && event.editable && (
                    <Select
                      value={String(
                        Math.round(
                          (safeDate(event.appointment.endsAt)!.getTime() -
                            safeDate(event.appointment.startsAt)!.getTime()) /
                            60_000,
                        ),
                      )}
                      onValueChange={(value) => onResize(event, Number(value))}
                    >
                      <SelectTrigger
                        aria-label={`Durata ${event.title}`}
                        className="h-8 w-28 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                        <SelectItem value="120">2 ore</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        {!events.length && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nessun impegno in agenda.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
