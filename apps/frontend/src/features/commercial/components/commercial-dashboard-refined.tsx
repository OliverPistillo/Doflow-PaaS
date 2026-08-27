"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import type { DateRange } from "react-day-picker";
import { it } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Handshake,
  Mail,
  PhoneCall,
  Plus,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
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
import { ChartRadialGrid } from "@/components/chart-radial-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  filterCommercialLeadsByPeriod,
  getCommercialAnalysis,
  getCommercialSummary,
  getPipelineDistribution,
  pipelineStages,
} from "@/features/commercial/data/commercial-fixtures";
import { CommercialPipelineBoard } from "@/features/commercial/components/commercial-pipeline-board";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { canViewLead } from "@/features/identity/permissions";
import {
  analyzeDuplicates,
  getDuplicateCandidates,
} from "@/features/commercial/duplicates";
import type {
  CommercialActivity,
  CommercialLead,
  CommercialPeriod,
  LeadSource,
  PipelineStage,
} from "@/features/commercial/types";

const money = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 0,
});
const datetime = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const today = new Date();
const sources: LeadSource[] = [
  "Google Ads",
  "Meta Ads",
  "LinkedIn",
  "Referral",
  "Organico",
  "Evento",
  "Instagram",
  "Manuale",
];
const italianDate = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function useCompactDateRangePicker() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const query = window.matchMedia("(max-width: 1023px)");
    query.addEventListener("change", onStoreChange);
    return () => query.removeEventListener("change", onStoreChange);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth < 1024,
    () => false,
  );
}

function CustomDateRangePicker({
  period,
  range,
  onApply,
}: {
  period: CommercialPeriod;
  range?: DateRange;
  onApply: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange>();
  const compact = useCompactDateRangePicker();
  const label =
    range?.from && range.to
      ? `${italianDate.format(range.from)} – ${italianDate.format(range.to)}`
      : "Personalizzato";
  const defaultMonth = draftRange?.from ?? range?.from ?? new Date();

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setDraftRange(range);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant={period === "custom" ? "default" : "outline"}>
          <CalendarDays />
          {period === "custom" ? label : "Personalizzato"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="z-[100] w-auto max-w-[calc(100vw-2rem)] overflow-hidden border-border bg-popover p-0 shadow-lg lg:min-w-[620px]"
      >
        <div className="border-b px-3 py-2 text-sm text-muted-foreground">
          Da / A
        </div>
        <Calendar
          key={`${open}-${range?.from?.toISOString() ?? "new"}`}
          mode="range"
          numberOfMonths={compact ? 1 : 2}
          weekStartsOn={1}
          locale={it}
          defaultMonth={defaultMonth}
          selected={draftRange}
          onSelect={setDraftRange}
          className="w-full p-3 sm:p-4"
        />
        <div className="flex w-full justify-end gap-2 border-t p-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button
            size="sm"
            disabled={!draftRange?.from || !draftRange.to}
            onClick={() => {
              if (!draftRange?.from || !draftRange.to) return;
              onApply(draftRange);
              setOpen(false);
            }}
          >
            Applica
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function due(iso: string, won = false) {
  const days = Math.ceil(
    (new Date(iso).getTime() - today.getTime()) / 86400000,
  );
  return won
    ? ["Vinto", "bg-chart-3/10 text-chart-3"]
    : days <= 0
      ? [days < 0 ? "Scaduta" : "Oggi", "bg-destructive/10 text-destructive"]
      : days <= 3
        ? ["Vicino", "bg-chart-4/10 text-chart-4"]
        : ["Regolare", "bg-muted text-muted-foreground"];
}
function Owner({ id }: { id: string }) {
  const commercialTeam = useCommercialTeam();
  const member = commercialTeam.find((candidate) => candidate.id === id);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <UserAvatar
            userId={id}
            name={member?.name ?? "Non assegnato"}
            className="size-7"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{member?.name ?? "Non assegnato"}</TooltipContent>
    </Tooltip>
  );
}
function ActivityIcon({ type }: { type: CommercialActivity["type"] }) {
  const Icon =
    type === "email"
      ? Mail
      : type === "proposal"
        ? FileText
        : type === "call"
          ? PhoneCall
          : type === "status-change"
            ? CheckCircle2
            : CalendarDays;
  return <Icon className="size-4" aria-hidden="true" />;
}

export function LeadDialog({
  onCreate,
}: {
  onCreate: (lead: CommercialLead) => void;
}) {
  const commercialTeam = useCommercialTeam();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const [pendingDuplicates, setPendingDuplicates] = useState<
    ReturnType<typeof analyzeDuplicates>
  >([]);
  const [confirmAnyway, setConfirmAnyway] = useState(false);
  const initial = {
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    phone: "",
    source: "Manuale" as LeadSource,
    service: "",
    value: "",
    assigneeId: identity.currentUserId,
    nextAction: "Qualifica iniziale",
    actionDate: (() => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      return date;
    })(),
    notes: "",
  };
  const [form, setForm] = useState(initial);
  const set = (key: keyof typeof initial, value: string | Date) =>
    setForm((current) => ({ ...current, [key]: value }));
  const valid = Boolean(
    form.firstName.trim() &&
      form.company.trim() &&
      (!form.email || /^\S+@\S+\.\S+$/.test(form.email)) &&
      Number(form.value || 0) >= 0,
  );
  const record = (): CommercialLead => {
    const assigneeId = identity.hasCapability("canAssignLeads")
      ? form.assigneeId
      : identity.currentUserId;
    const person = commercialTeam.find((candidate) => candidate.id === assigneeId);
    return {
      id: `lead-${crypto.randomUUID()}`,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      source: form.source,
      service: form.service || "Consulenza",
      stage: "new",
      status: "new",
      value: Number(form.value || 0),
      probability: 15,
      assigneeId,
      owner: person?.name ?? identity.currentUser.name,
      createdAt: new Date().toISOString(),
      lastContact: new Date().toISOString(),
      nextAction: form.nextAction,
      nextActionAt: form.actionDate.toISOString(),
      daysInStage: 0,
    };
  };
  const save = () => {
    onCreate(record());
    setForm(initial);
    setOpen(false);
    setConfirmAnyway(false);
    toast.success("Lead creato");
  };
  const submit = () => {
    if (!valid) return;
    const matches = analyzeDuplicates([
      ...getDuplicateCandidates(store.leads, store.customers),
      {
        id: "new-lead-preview",
        type: "lead",
        name: `${form.firstName} ${form.lastName}`.trim(),
        company: form.company,
        email: form.email,
        phone: form.phone,
      },
    ]).filter((group) =>
      group.candidates.some((item) => item.id === "new-lead-preview"),
    );
    if (matches.length) {
      setPendingDuplicates(matches);
      return;
    }
    save();
  };
  const compareAndMerge = () => {
    if (!firstMatch || !identity.hasCapability("canMergeDuplicates")) return;
    const draft = record();
    onCreate(draft);
    setPendingDuplicates([]);
    setForm(initial);
    setOpen(false);
    router.push(
      `/dashboard/duplicati?compare=${encodeURIComponent(firstMatch.id)},${encodeURIComponent(draft.id)}`,
    );
  };
  const detectedMatch = pendingDuplicates[0]?.candidates.find(
    (item) => item.id !== "new-lead-preview",
  );
  const firstMatchLead =
    detectedMatch?.type === "lead"
      ? store.leads.find((lead) => lead.id === detectedMatch.id)
      : undefined;
  const firstMatch =
    detectedMatch &&
    (detectedMatch.type === "lead"
      ? Boolean(
          firstMatchLead && canViewLead(identity.currentUser, firstMatchLead),
        )
      : identity.currentUser.roles.includes("administrator"))
      ? detectedMatch
      : undefined;
  return (
    <>
      <Dialog
        open={open && pendingDuplicates.length === 0 && !confirmAnyway}
        onOpenChange={setOpen}
      >
        <Button onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Nuovo lead
        </Button>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo lead</DialogTitle>
            <DialogDescription>
              Salvato nel provider commerciale persistente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="new-first">Nome *</FieldLabel>
              <Input
                id="new-first"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="new-last">Cognome</FieldLabel>
              <Input
                id="new-last"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="new-company">Azienda *</FieldLabel>
              <Input
                id="new-company"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="new-email">Email</FieldLabel>
              <Input
                id="new-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="new-phone">Telefono</FieldLabel>
              <Input
                id="new-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Fonte</FieldLabel>
              <Select
                value={form.source}
                onValueChange={(value) => set("source", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="new-service">Servizio richiesto</FieldLabel>
              <Input
                id="new-service"
                value={form.service}
                onChange={(e) => set("service", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="new-value">Valore stimato</FieldLabel>
              <Input
                id="new-value"
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Assegnatario</FieldLabel>
              <Select
                value={form.assigneeId}
                onValueChange={(value) => set("assigneeId", value)}
              >
                <SelectTrigger>
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
              <FieldLabel htmlFor="new-action">Prossima azione</FieldLabel>
              <Input
                id="new-action"
                value={form.nextAction}
                onChange={(e) => set("nextAction", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Data prossima azione</FieldLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="mt-1 justify-start font-normal"
                  >
                    <CalendarDays aria-hidden="true" />
                    {datetime.format(form.actionDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.actionDate}
                    onSelect={(date) => date && set("actionDate", date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="new-notes">Note</FieldLabel>
              <Textarea
                id="new-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button disabled={!valid} onClick={submit}>
              Crea lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={pendingDuplicates.length > 0}
        onOpenChange={(value) => !value && setPendingDuplicates([])}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Possibile duplicato rilevato</AlertDialogTitle>
            <AlertDialogDescription>
              {firstMatch
                ? `${firstMatch.name} · ${firstMatch.type === "client" ? "Cliente" : "Lead"}. Campi coincidenti: ${pendingDuplicates[0].matchingFields.join(", ")}.`
                : "Esistono record simili."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel>Torna al modulo</AlertDialogCancel>
            {firstMatch && (
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link
                  href={
                    firstMatch.type === "lead"
                      ? `/dashboard/commercial/leads/${firstMatch.id}`
                      : `/dashboard/clienti/${firstMatch.customerId ?? firstMatch.id}`
                  }
                >
                  Apri record esistente
                </Link>
              </Button>
            )}
            {firstMatch && identity.hasCapability("canMergeDuplicates") && (
              <Button variant="secondary" onClick={compareAndMerge}>
                Confronta e unisci
              </Button>
            )}
            <AlertDialogAction
              onClick={() => {
                setPendingDuplicates([]);
                setConfirmAnyway(true);
              }}
            >
              Crea comunque
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmAnyway} onOpenChange={setConfirmAnyway}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Creare comunque il lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà creato un solo record. Nessun dato verrà fuso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpen(true)}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction onClick={save}>
              Conferma creazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Pipeline({ leads }: { leads: CommercialLead[] }) {
  const commercialTeam = useCommercialTeam();
  const [assignee, setAssignee] = useState("all");
  const [stageFilter, setStageFilter] = useState<"all" | PipelineStage>("all");
  const filtered = leads.filter(
    (lead) =>
      (assignee === "all" || lead.assigneeId === assignee) &&
      (stageFilter === "all" || lead.stage === stageFilter),
  );
  return (
    <Card className="flex h-full min-h-0 min-w-0 max-h-[580px] flex-col overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Pipeline commerciale</CardTitle>
            <CardDescription>Opportunità suddivise per fase</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {commercialTeam.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={stageFilter}
              onValueChange={(value) =>
                setStageFilter(value as "all" | PipelineStage)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {pipelineStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="outline">
              <Link href="/dashboard/commercial/pipeline">
                Apri pipeline completa
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 min-w-0 flex-1 px-0">
        <CommercialPipelineBoard visibleLeads={filtered} />
      </CardContent>
    </Card>
  );
}
function Operations() {
  const store = useCommercialLeads();
  const commercialActivities: CommercialActivity[] = store.leadActivities
    .filter((activity) => Boolean(activity.leadId) && !activity.archivedAt)
    .map((activity) => ({
      id: activity.id,
      leadId: activity.leadId!,
      type:
        activity.type === "Email"
          ? "email"
          : activity.type === "Chiamata" || activity.type === "WhatsApp"
            ? "call"
            : activity.type === "Riunione"
              ? "meeting"
              : activity.type === "Documento" ||
                  activity.type === "Approvazione cliente"
                ? "proposal"
                : "note",
      title: activity.title,
      description: activity.description,
      date:
        activity.completedAt ??
        activity.dueAt ??
        activity.updatedAt ??
        activity.createdAt,
      assignedToId: activity.assigneeId,
      status: activity.status === "Completata" ? "completed" : "planned",
      priority:
        activity.priority === "Urgente"
          ? "urgent"
          : activity.priority === "Alta"
            ? "high"
            : "normal",
      completedAt: activity.completedAt,
    }));
  const recent = commercialActivities
    .filter((a) => a.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const upcoming = commercialActivities
    .filter((a) => a.status === "planned")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const [tab, setTab] = useState("upcoming");
  const list = tab === "upcoming" ? upcoming : recent;
  return (
    <Card className="flex h-full min-h-0 min-w-0 max-h-[580px] flex-col">
      <CardHeader>
        <CardTitle className="text-base">Operatività</CardTitle>
        <CardDescription>
          Aggiornamenti e prossime azioni commerciali
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recent">Attività recenti</TabsTrigger>
            <TabsTrigger value="upcoming">Prossime attività</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-3">
            {list.map((activity, index) => {
              const lead = store.leads.find(
                (item) => item.id === activity.leadId,
              );
              const status = due(
                activity.date,
                activity.status === "completed",
              );
              return (
                <div key={activity.id}>
                  {index > 0 && <Separator />}
                  <Link
                    href={`/dashboard/commercial/leads/${activity.leadId}`}
                    className="flex items-center gap-2 rounded-md py-2 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <ActivityIcon type={activity.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {lead?.company}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {activity.title}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Owner id={activity.assignedToId} />
                      <Badge className={`border-0 ${status[1]}`}>
                        {activity.status === "completed"
                          ? "Completata"
                          : status[0]}
                      </Badge>
                    </span>
                  </Link>
                </div>
              );
            })}
            {!list.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nessuna attività nel perimetro autorizzato.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button asChild variant="link" className="px-0">
          <Link href="/dashboard/attivita">
            {tab === "upcoming" ? "Vedi calendario" : "Vedi tutte le attività"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function AnalysisCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 flex-1">{children}</CardContent>
      <CardFooter className="mt-auto">
        <Button asChild variant="link" className="px-0">
          <Link href="/dashboard/commercial/pipeline">{footer}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function PipelineStatusRadialChart({
  distribution,
  config,
}: {
  distribution: ReturnType<typeof getPipelineDistribution>;
  config: ChartConfig;
}) {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const activeStatus = selectedStatus ?? hoveredStatus;
  const toggleSelection = (status: string) =>
    setSelectedStatus((current) => (current === status ? null : status));
  const clearHover = () => {
    if (!selectedStatus) setHoveredStatus(null);
  };
  const clearSelection = () => {
    setSelectedStatus(null);
    setHoveredStatus(null);
  };
  const legendColor = (
    item: ReturnType<typeof getPipelineDistribution>[number],
  ) =>
    activeStatus && activeStatus !== item.status
      ? "var(--chart-inactive)"
      : `var(--color-${item.colorKey})`;

  return (
    <div
      tabIndex={0}
      onClick={clearSelection}
      onKeyDown={(event) => {
        if (event.key === "Escape") clearSelection();
      }}
      className="flex min-w-0 flex-col gap-4 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring @3xl/main:flex-row @3xl/main:items-center"
    >
      <ChartRadialGrid
        data={distribution}
        config={config}
        activeStatus={activeStatus}
        onSelect={toggleSelection}
        onHover={(status) => {
          if (!selectedStatus) setHoveredStatus(status);
        }}
        onLeave={clearHover}
      />
      <div
        onClick={(event) => event.stopPropagation()}
        className="min-w-0 flex-1 space-y-2"
      >
        {distribution.map((item) => {
          const inactive = Boolean(
            activeStatus && activeStatus !== item.status,
          );
          const active = activeStatus === item.status;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleSelection(item.status)}
              onMouseEnter={() => {
                if (!selectedStatus) setHoveredStatus(item.status);
              }}
              onMouseLeave={clearHover}
              className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-sm text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${inactive ? "text-muted-foreground" : active ? "text-foreground" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: legendColor(item) }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {money.format(item.economicValue)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Analytics({
  period,
  range,
  leads,
}: {
  period: CommercialPeriod;
  range?: DateRange;
  leads: CommercialLead[];
}) {
  const analytics = getCommercialAnalysis(period, leads);
  const distribution = getPipelineDistribution(
    filterCommercialLeadsByPeriod(leads, period, range),
  );
  const config = {
    new: { label: "Nuovo lead", color: "var(--chart-2)" },
    qualified: { label: "Qualificato", color: "var(--chart-1)" },
    proposal: { label: "Proposta inviata", color: "var(--chart-4)" },
    negotiation: { label: "Negoziazione", color: "var(--destructive)" },
    won: { label: "Vinto", color: "var(--chart-3)" },
    pipelineValue: { label: "Valore pipeline", color: "var(--chart-2)" },
    weightedValue: { label: "Valore ponderato", color: "var(--chart-3)" },
  } satisfies ChartConfig;
  const hasTarget = analytics.target > 0;
  const coverage = hasTarget
    ? (analytics.current.weightedValue / analytics.target) * 100
    : 0;
  const coverageClass =
    coverage < 50
      ? "[&>[data-slot=progress-indicator]]:bg-destructive"
      : coverage < 75
        ? "[&>[data-slot=progress-indicator]]:bg-chart-4"
        : "[&>[data-slot=progress-indicator]]:bg-chart-3";
  const percentageDelta = (current: number, previous: number) =>
    previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / Math.abs(previous)) * 100;
  const metrics = [
    {
      id: "conversion",
      label: "Tasso di conversione",
      value: `${analytics.current.conversionRate.toFixed(1)}%`,
      delta: percentageDelta(
        analytics.current.conversionRate,
        analytics.previous.conversionRate,
      ),
      icon: TrendingUp,
    },
    {
      id: "average",
      label: "Valore medio trattativa",
      value: money.format(analytics.current.averageDealValue),
      delta: percentageDelta(
        analytics.current.averageDealValue,
        analytics.previous.averageDealValue,
      ),
      icon: Handshake,
    },
    {
      id: "won",
      label: "Trattative vinte",
      value: Math.round(analytics.current.wonDeals),
      delta: percentageDelta(
        analytics.current.wonDeals,
        analytics.previous.wonDeals,
      ),
      icon: CheckCircle2,
    },
    {
      id: "time",
      label: "Tempo medio di chiusura",
      value: `${Math.round(analytics.current.averageCloseDays)} gg`,
      delta: percentageDelta(
        analytics.current.averageCloseDays,
        analytics.previous.averageCloseDays,
      ),
      icon: Clock3,
    },
  ];
  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 @3xl/main:grid-cols-2">
      <AnalysisCard
        title="Pipeline per stato"
        description="Distribuzione dei lead nelle fasi commerciali"
        footer="Vedi dettagli"
      >
        <PipelineStatusRadialChart
          distribution={distribution}
          config={config}
        />
      </AnalysisCard>
      <AnalysisCard
        title="Performance vendita"
        description="Indicatori del periodo selezionato"
        footer="Vedi report completo"
      >
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={metric.id} className="min-w-0">
                {index > 1 && <Separator className="mb-4" />}
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {metric.label}
                  </span>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {metric.value}
                </p>
                <Badge
                  className={`mt-2 border-0 ${metric.delta >= 0 ? "bg-chart-3/10 text-chart-3" : "bg-destructive/10 text-destructive"}`}
                >
                  {metric.delta >= 0 ? "+" : ""}
                  {metric.delta.toLocaleString("it-IT", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </Badge>
              </div>
            );
          })}
        </div>
      </AnalysisCard>
      <AnalysisCard
        title="Valore pipeline"
        description="Previsione economica delle opportunità"
        footer="Vedi analisi"
      >
        <div className="space-y-4">
          <p className="text-3xl font-bold tabular-nums">
            {money.format(analytics.current.pipelineValue)}
          </p>
          <div className="flex justify-between gap-3 text-sm">
            <span>Previsione a 90 giorni</span>
            <strong>{money.format(analytics.current.forecast90Days)}</strong>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <span>Valore ponderato</span>
            <strong>{money.format(analytics.current.weightedValue)}</strong>
          </div>
          <Progress
            value={Math.min(
              analytics.current.pipelineValue > 0
                ? (analytics.current.weightedValue /
                    analytics.current.pipelineValue) *
                    100
                : 0,
              100,
            )}
          />
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Copertura target</span>
            <Badge>{hasTarget ? `${coverage.toFixed(0)}%` : "Non configurato"}</Badge>
          </div>
          <Progress value={Math.min(coverage, 100)} className={coverageClass} />
        </div>
      </AnalysisCard>
      <AnalysisCard
        title="Andamento pipeline"
        description="Evoluzione del valore commerciale"
        footer="Vedi analisi completa"
      >
        <ChartContainer
          config={config}
          className="h-64 w-full min-w-0 aspect-auto"
        >
          <AreaChart
            data={analytics.trend}
            margin={{ top: 8, right: 8, left: 2, bottom: 24 }}
          >
            <defs>
              <linearGradient
                id="financial-pipeline"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-pipelineValue)"
                  stopOpacity={0.22}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-pipelineValue)"
                  stopOpacity={0.02}
                />
              </linearGradient>
              <linearGradient
                id="financial-weighted"
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-weightedValue)"
                  stopOpacity={0.18}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-weightedValue)"
                  stopOpacity={0.01}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis
              tickFormatter={(value) => compactMoney.format(Number(value))}
              tickLine={false}
              axisLine={false}
              width={54}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => money.format(Number(value))}
                />
              }
            />
            <Area
              dataKey="pipelineValue"
              type="monotone"
              stroke="var(--color-pipelineValue)"
              fill="url(#financial-pipeline)"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            <Area
              dataKey="weightedValue"
              type="monotone"
              stroke="var(--color-weightedValue)"
              fill="url(#financial-weighted)"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            <ChartLegend
              content={<ChartLegendContent />}
              verticalAlign="bottom"
              wrapperStyle={{ paddingTop: 16 }}
            />
          </AreaChart>
        </ChartContainer>
      </AnalysisCard>
    </section>
  );
}

export function CommercialDashboardRefined() {
  const { leads, addLead } = useCommercialLeads();
  const [period, setPeriod] = useState<CommercialPeriod>("month");
  const [range, setRange] = useState<DateRange>();
  const summary = getCommercialSummary(leads, period, range);
  const periodQuery = new URLSearchParams({ period });
  if (period === "custom" && range?.from && range.to) {
    periodQuery.set("from", range.from.toISOString().slice(0, 10));
    periodQuery.set("to", range.to.toISOString().slice(0, 10));
  }
  const exportCsv = () => {
    const header = [
      "Nome",
      "Cognome",
      "Azienda",
      "Fonte",
      "Stato",
      "Valore",
      "Assegnatario",
      "Prossima azione",
      "Data prossima azione",
    ];
    const csv = [
      header,
      ...leads.map((lead) => [
        lead.firstName,
        lead.lastName,
        lead.company,
        lead.source,
        lead.stage,
        lead.value,
        lead.owner,
        lead.nextAction,
        lead.nextActionAt,
      ]),
    ]
      .map((row) =>
        row.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `doflow-lead-commerciali-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV esportato");
  };
  const kpis = [
    {
      id: "newLeads",
      label: "Nuovi lead",
      description: "Contatti acquisiti nel periodo selezionato.",
      icon: UsersRound,
      href: `/dashboard/commercial/leads?status=new&${periodQuery}`,
      ariaLabel: "Vai ai nuovi lead",
      value: summary.newLeads,
    },
    {
      id: "openDeals",
      label: "Trattative aperte",
      description: "Opportunità commerciali ancora in lavorazione.",
      icon: Handshake,
      href: `/dashboard/commercial/leads?group=open&${periodQuery}`,
      ariaLabel: "Vai alle trattative aperte",
      value: summary.openDeals,
    },
    {
      id: "wonDeals",
      label: "Trattative vinte",
      description: "Opportunità concluse con esito positivo.",
      icon: TrendingUp,
      href: `/dashboard/commercial/leads?status=won&${periodQuery}`,
      ariaLabel: "Vai alle trattative vinte",
      value: summary.wonDeals,
    },
    {
      id: "pipelineValue",
      label: "Valore pipeline",
      description: "Valore complessivo delle trattative attive.",
      icon: FileText,
      href: `/dashboard/commercial/pipeline?group=open&${periodQuery}`,
      ariaLabel: "Apri la pipeline commerciale",
      value: money.format(summary.pipelineValue),
    },
  ];
  return (
    <main className="@container/main mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex min-w-0 flex-col gap-4 @4xl/main:flex-row @4xl/main:items-end @4xl/main:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commerciale</h1>
          <p className="text-sm text-muted-foreground">
            Controlla opportunità, trattative e attività commerciali.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            type="single"
            value={period === "custom" ? "" : period}
            onValueChange={(value) =>
              value && setPeriod(value as CommercialPeriod)
            }
            variant="outline"
            spacing={0}
          >
            <ToggleGroupItem value="today">Oggi</ToggleGroupItem>
            <ToggleGroupItem value="month">Questo mese</ToggleGroupItem>
            <ToggleGroupItem value="previous-month">
              Mese scorso
            </ToggleGroupItem>
          </ToggleGroup>
          <CustomDateRangePicker
            period={period}
            range={range}
            onApply={(nextRange) => {
              setRange(nextRange);
              setPeriod("custom");
            }}
          />
          <Button variant="outline" onClick={exportCsv}>
            <Download />
            Esporta
          </Button>
          <LeadDialog onCreate={addLead} />
        </div>
      </header>
      <section className="grid min-w-0 grid-cols-1 gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.id}
              href={kpi.href}
              aria-label={kpi.ariaLabel}
              className="min-w-0 cursor-pointer rounded-xl outline-none transition-colors hover:border-primary/35 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
            >
              <Card className="h-full min-h-36 transition-colors hover:border-primary/35 hover:bg-muted/30">
                <CardHeader className="space-y-1 py-4">
                  <div className="flex justify-between gap-2">
                    <CardDescription className="font-medium">
                      {kpi.label}
                    </CardDescription>
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-3xl font-bold tracking-tight tabular-nums">
                    {kpi.value}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {kpi.description}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </section>
      <section className="grid min-w-0 items-stretch gap-4 @5xl/main:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
        <Pipeline leads={leads} />
        <Operations />
      </section>
      <Analytics period={period} range={range} leads={leads} />
    </main>
  );
}
