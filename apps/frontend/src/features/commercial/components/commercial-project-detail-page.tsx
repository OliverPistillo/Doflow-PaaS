"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  ClipboardCheck,
  Ellipsis,
  Link2,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityDetailSheet } from "@/features/commercial/components/activity-detail-sheet";
import { ActivityFormDialog } from "@/features/commercial/components/activity-form-dialog";
import { ProjectProductionPanel } from "@/features/commercial/components/project-production-panel";
import { RecordCollaborationPanel } from "@/features/commercial/components/record-collaboration-panel";
import { commercePaymentStatusLabel } from "@/features/commercial/commercial-commerce";
import {
  productionProjectStatusLabels,
  projectProgress as productionProjectProgress,
} from "@/features/commercial/commercial-production";
import { DocumentStatusBadge } from "@/features/commercial/document-status";
import {
  getCanonicalCustomerActivities,
  type CommercialProject,
  type CommercialProjectPhase,
  type CustomerActivity,
  useCommercialLeads,
} from "@/features/commercial/components/commercial-leads-provider";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import { AccessDenied } from "@/features/identity/access-denied";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { canManageProject } from "@/features/identity/permissions";
import { formatItalianDate, getRomeDateKey } from "@/lib/date";
import {
  deliveryApi,
  type DeliveryHistoryRow,
} from "@/lib/tenant-delivery-api";
import {
  commerceApi,
  type ProjectCommerceEconomics,
} from "@/lib/tenant-commerce-api";

const labels: Record<string, string> = {
  ...productionProjectStatusLabels,
  waiting_client: "In attesa cliente",
  review: "In revisione",
  completed: "Completato",
  archived: "Archiviato",
};
const phaseLabels: Record<CommercialProjectPhase["status"], string> = {
  not_started: "Da avviare",
  in_progress: "In corso",
  completed: "Completata",
};
const tabs = [
  "overview",
  "activities",
  "phases",
  "production",
  "documents",
  "payments",
  "timeline",
] as const;
const currency = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
const dateTime = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
});
const historyLabels: Record<string, string> = {
  project_created: "Progetto creato",
  project_updated: "Progetto aggiornato",
  project_status_changed: "Stato progetto aggiornato",
  project_comment_created: "Commento aggiunto",
  task_created: "Attività creata",
  task_updated: "Attività aggiornata",
  task_status_changed: "Stato attività aggiornato",
  qa_submitted: "Lavoro inviato in QA",
  qa_changes_requested: "Modifiche richieste",
  qa_approved: "QA approvata",
  project_published: "Progetto pubblicato",
  project_delivered: "Progetto consegnato",
  project_support_started: "Supporto avviato",
};

function phaseProgress(
  phase: CommercialProjectPhase,
  activities: Array<{
    id: string;
    status: string;
    weight?: number;
    estimatedMinutes?: number;
  }>,
) {
  const linked = activities.filter((activity) =>
    phase.activityIds.includes(activity.id),
  );
  const total = linked.reduce(
    (sum, activity) =>
      sum + (activity.weight ?? Math.max(1, activity.estimatedMinutes ?? 30)),
    0,
  );
  const completed = linked
    .filter((activity) => activity.status === "Completata")
    .reduce(
      (sum, activity) =>
        sum + (activity.weight ?? Math.max(1, activity.estimatedMinutes ?? 30)),
      0,
    );
  return total
    ? Math.round((completed / total) * 100)
    : phase.status === "completed"
      ? 100
      : 0;
}
const phaseStatusClass: Record<CommercialProjectPhase["status"], string> = {
  completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  in_progress:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  not_started: "border-border bg-muted text-muted-foreground",
};

export function CommercialProjectDetailPage({
  projectId,
}: {
  projectId: string;
}) {
  const commercialTeam = useCommercialTeam();
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const project = store.projects.find((item) => item.id === projectId);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [, setPendingActivityId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [phaseSheetOpen, setPhaseSheetOpen] = useState(
    Boolean(params.get("phaseId")),
  );
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [history, setHistory] = useState<DeliveryHistoryRow[]>([]);
  const [historyStatus, setHistoryStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [finance, setFinance] = useState<ProjectCommerceEconomics | null>(null);
  const [financeStatus, setFinanceStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const activeTab = tabs.includes(params.get("tab") as (typeof tabs)[number])
    ? params.get("tab")!
    : "overview";
  useEffect(() => {
    if (activeTab !== "timeline") return;
    let cancelled = false;
    void deliveryApi
      .history(projectId)
      .then((result) => {
        if (cancelled) return;
        setHistory(result.items);
        setHistoryStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setHistory([]);
        setHistoryStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, projectId]);
  useEffect(() => {
    if (
      activeTab !== "payments" ||
      !identity.hasCapability("canViewAdministration")
    )
      return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setFinanceStatus("loading");
    });
    void commerceApi
      .projectEconomics(projectId)
      .then((result) => {
        if (cancelled) return;
        setFinance(result);
        setFinanceStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setFinance(null);
        setFinanceStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, identity, projectId]);
  if (!project && store.allProjects.some((item) => item.id === projectId))
    return <AccessDenied resource="a questo progetto" />;
  if (!project)
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Progetto non trovato</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  const customer = store.customers.find((item) => item.id === project.clientId);
  const owner = commercialTeam.find((item) => item.id === project.ownerId);
  const activities = getCanonicalCustomerActivities(customer).filter(
    (item) =>
      item.projectId === project.id ||
      project.activityIds.includes(item.id) ||
      project.phases.some((phase) => phase.activityIds.includes(item.id)),
  );
  const phases = [...project.phases].sort((a, b) => a.order - b.order);
  const completedPhases = phases.filter(
    (phase) =>
      phase.status === "completed" &&
      phase.activityIds.every(
        (id) =>
          activities.find((activity) => activity.id === id)?.status ===
          "Completata",
      ),
  ).length;
  const projectProgress = productionProjectProgress(
    project,
    activities,
  ).internal;
  const phaseFromQuery = params.get("phaseId");
  const selectedPhase =
    phases.find((phase) => phase.id === (selectedPhaseId ?? phaseFromQuery)) ??
    null;
  const openPhase = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
    setPhaseSheetOpen(true);
  };
  const openActivityFromPhase = (activityId: string) => {
    if (selectedPhase) setSelectedPhaseId(selectedPhase.id);
    setPendingActivityId(activityId);
    setPhaseSheetOpen(false);
    window.setTimeout(() => {
      setSelectedActivity(activityId);
      setPendingActivityId(null);
    }, 180);
  };
  const setTab = (tab: string) => router.replace(`${pathname}?tab=${tab}`);
  const reorder = (phase: CommercialProjectPhase, direction: -1 | 1) => {
    const index = phases.findIndex((item) => item.id === phase.id);
    const target = index + direction;
    if (target < 0 || target >= phases.length) return;
    const next = [...phases];
    [next[index], next[target]] = [next[target], next[index]];
    store.reorderProjectPhases(
      project.id,
      next.map((item) => item.id),
    );
  };

  if (!canManageProject(identity.currentUser, project))
    return (
      <main className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <Badge>{labels[project.status]}</Badge>
              <Badge variant="outline">Vista operativa</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Progetto visibile nel perimetro assegnato; configurazione e
              amministrazione non disponibili.
            </p>
          </div>
          <RecordCollaborationPanel
            recordType="project"
            recordId={project.id}
            label={project.name}
            compact
          />
        </header>
        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Avanzamento">
            <p className="text-2xl">{projectProgress}%</p>
            <Progress value={projectProgress} />
          </Metric>
          <Metric label="Scadenza">
            {project.dueDate
              ? formatItalianDate(project.dueDate)
              : "Scadenza non definita"}
          </Metric>
          <Metric label="Responsabile">{owner?.name ?? "—"}</Metric>
        </section>
        <ProjectProductionPanel project={project} activities={activities} />
        <Card>
          <CardHeader>
            <CardTitle>Attività del progetto</CardTitle>
            <CardDescription>
              Puoi aggiornare soltanto le attività assegnate al tuo account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {activities.map((activity) => (
              <button
                key={activity.id}
                className="flex w-full justify-between rounded-md border p-3 text-left hover:bg-muted"
                onClick={() => setSelectedActivity(activity.id)}
              >
                <span>{activity.title}</span>
                <Badge variant="secondary">{activity.status}</Badge>
              </button>
            ))}
            {!activities.length && (
              <p className="text-sm text-muted-foreground">
                Nessuna attività visibile.
              </p>
            )}
          </CardContent>
        </Card>
        <ActivityDetailSheet
          clientId={project.clientId}
          activityId={selectedActivity}
          open={Boolean(selectedActivity)}
          onOpenChange={(open) => !open && setSelectedActivity(null)}
        />
      </main>
    );

  return (
    <main className="@container/project mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <div className="flex gap-2">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge>{labels[project.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {customer ? (
              <Link
                href={`/dashboard/clienti/${project.clientId}?tab=projects`}
              >
                {customer.profile.company}
              </Link>
            ) : (
              "Cliente autorizzato"
            )}{" "}
            · {project.service} · {owner?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Pencil />
            Modifica
          </Button>
          <Button onClick={() => setActivityDialogOpen(true)}>
            <CalendarClock />
            Nuova attività
          </Button>
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 @5xl/project:grid-cols-5">
        <Metric label="Stato">
          <Select
            value={project.status}
            onValueChange={(value) =>
              store.updateProject(project.id, {
                status: value as CommercialProject["status"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(labels).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Metric>
        <Metric label="Avanzamento">
          <p className="text-2xl">{projectProgress}%</p>
          <Progress value={projectProgress} />
          <p>
            {phases.length
              ? `${completedPhases} di ${phases.length} fasi chiuse`
              : `${activities.filter((item) => item.status === "Completata").length} di ${activities.length} attività completate`}
          </p>
        </Metric>
        <Metric label="Scadenza">
          {project.dueDate
            ? formatItalianDate(project.dueDate)
            : "Scadenza non definita"}
        </Metric>
        <Metric label="Responsabile">{owner?.name ?? "—"}</Metric>
        <Metric label="Attività">{activities.length} collegate</Metric>
      </section>
      <Tabs value={activeTab} onValueChange={setTab}>
        <div
          data-testid="project-tabs-scroll"
          className="w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsList className="h-8 min-w-max whitespace-nowrap">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab === "overview"
                  ? "Panoramica"
                  : tab === "activities"
                    ? "Attività"
                    : tab === "phases"
                      ? "Fasi"
                      : tab === "production"
                        ? "Produzione e QA"
                        : tab === "documents"
                          ? "Documenti"
                          : tab === "payments"
                            ? "Pagamenti"
                            : "Timeline"}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 @5xl/project:grid-cols-2">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Attività del progetto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activities.slice(0, 5).map((activity) => (
                    <button
                      key={activity.id}
                      className="block w-full text-left"
                      onClick={() => setSelectedActivity(activity.id)}
                    >
                      {activity.title}
                      <span className="block text-xs text-muted-foreground">
                        {activity.status} · {formatItalianDate(activity.dueAt)}
                      </span>
                    </button>
                  ))}
                  <Button
                    variant="link"
                    className="px-0"
                    onClick={() => setTab("activities")}
                  >
                    Vedi tutte le attività
                  </Button>
                </CardContent>
              </Card>
              <PhaseOverview
                phases={phases}
                activities={activities}
                onConfigure={() => setConfigOpen(true)}
                onOpen={openPhase}
                onAll={() => setTab("phases")}
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Informazioni</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Cliente: {customer?.profile.company}</p>
                <p>
                  Inizio:{" "}
                  {formatItalianDate(project.startDate) || "Non definita"}
                </p>
                <p>
                  Scadenza:{" "}
                  {formatItalianDate(project.dueDate) || "Non definita"}
                </p>
                <p>{project.description || "Nessuna descrizione inserita"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Attività del progetto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  className="flex w-full justify-between rounded-md p-2 text-left hover:bg-muted"
                  onClick={() => setSelectedActivity(activity.id)}
                >
                  <span>{activity.title}</span>
                  <Badge variant="secondary">{activity.status}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="phases" className="mt-4">
          <PhasesTab
            phases={phases}
            activities={activities}
            onConfigure={() => setConfigOpen(true)}
            onOpen={openPhase}
            onMove={reorder}
          />
        </TabsContent>
        <TabsContent value="production" className="mt-4">
          <ProjectProductionPanel project={project} activities={activities} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Documenti del progetto</CardTitle>
              <CardDescription>
                Metadati reali collegati al progetto; nessun upload viene
                simulato.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {(customer?.documents ?? [])
                .filter(
                  (document) =>
                    !document.archivedAt && document.projectId === project.id,
                )
                .map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {document.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Aggiornato il {formatItalianDate(document.updatedAt)}
                      </span>
                    </span>
                    <DocumentStatusBadge status={document.status} />
                  </div>
                ))}
              {!(customer?.documents ?? []).some(
                (document) =>
                  !document.archivedAt && document.projectId === project.id,
              ) && (
                <p className="text-sm text-muted-foreground">
                  Nessun documento collegato a questo progetto.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pagamenti del progetto</CardTitle>
              <CardDescription>
                Totali e movimenti derivati dal Commerce & Cash Core; nessun
                importo viene calcolato nel browser.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!identity.hasCapability("canViewAdministration") ? (
                <p className="text-sm text-muted-foreground">
                  Dati amministrativi non disponibili per il profilo corrente.
                </p>
              ) : financeStatus === "loading" || financeStatus === "idle" ? (
                <p className="text-sm text-muted-foreground">
                  Caricamento dati economici…
                </p>
              ) : financeStatus === "error" ? (
                <p role="alert" className="text-sm text-destructive">
                  Impossibile caricare i dati economici del progetto.
                </p>
              ) : !finance?.orders.length ? (
                <p className="text-sm text-muted-foreground">
                  Nessun ordine collegato a questo progetto.
                </p>
              ) : (
                <div className="space-y-5" data-commerce-source="server">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <Metric label="Totale ordini">
                      <p className="text-xl font-semibold">
                        {currency.format(finance.summary.total)}
                      </p>
                    </Metric>
                    <Metric label="Incassato lordo">
                      <p className="text-xl font-semibold">
                        {currency.format(finance.summary.grossCollected)}
                      </p>
                    </Metric>
                    <Metric label="Rimborsato">
                      <p className="text-xl font-semibold">
                        {currency.format(finance.summary.refunded)}
                      </p>
                    </Metric>
                    <Metric label="Incassato netto">
                      <p className="text-xl font-semibold">
                        {currency.format(finance.summary.netCollected)}
                      </p>
                    </Metric>
                    <Metric label="Residuo">
                      <p className="text-xl font-semibold">
                        {currency.format(finance.summary.residual)}
                      </p>
                      <Badge variant="secondary">
                        {commercePaymentStatusLabel(finance.summary.status)}
                      </Badge>
                    </Metric>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">Ordini</h3>
                      <div className="space-y-2">
                        {finance.orders.map((order) => (
                          <Link
                            key={order.id}
                            href={`/dashboard/ordini/${order.id}`}
                            className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
                          >
                            <span>
                              <span className="block font-medium">
                                {order.code}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {currency.format(order.total)} · residuo{" "}
                                {currency.format(order.residual ?? 0)}
                              </span>
                            </span>
                            <Badge variant="secondary">
                              {commercePaymentStatusLabel(order.paymentStatus)}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">
                        Pagamenti e rimborsi
                      </h3>
                      <div className="space-y-2">
                        {finance.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                          >
                            <span>
                              <span className="block font-medium">
                                {payment.type === "Rimborso" ? "−" : ""}
                                {currency.format(payment.amount)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {payment.method} ·{" "}
                                {formatItalianDate(
                                  payment.effectiveDate ?? payment.date,
                                )}{" "}
                                · {payment.reference}
                              </span>
                            </span>
                            <Badge variant="secondary">{payment.status}</Badge>
                          </div>
                        ))}
                        {!finance.payments.length && (
                          <p className="text-sm text-muted-foreground">
                            Nessun movimento registrato.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                  {!!finance.deadlines.length && (
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">
                        Scadenze economiche
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {finance.deadlines.map((deadline) => (
                          <div
                            key={deadline.id}
                            className="rounded-md border p-3 text-sm"
                          >
                            <p className="font-medium">{deadline.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {currency.format(deadline.amount)} ·{" "}
                              {formatItalianDate(deadline.dueDate)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Fatture, contratti, note di credito e rinnovi saranno
                    disponibili nella Fase 3B; questa scheda non mostra dati
                    simulati.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Timeline del progetto</CardTitle>
                <CardDescription>
                  Workflow event e audit persistenti prodotti dal Delivery Core.
                </CardDescription>
              </div>
              <RecordCollaborationPanel
                recordType="project"
                recordId={project.id}
                label={project.name}
                compact
              />
            </CardHeader>
            <CardContent data-history-source="server" className="space-y-3">
              {historyStatus === "loading" && (
                <p className="text-sm text-muted-foreground">
                  Caricamento eventi…
                </p>
              )}
              {historyStatus === "error" && (
                <p role="alert" className="text-sm text-destructive">
                  Impossibile caricare la Timeline.
                </p>
              )}
              {historyStatus === "loaded" && !history.length && (
                <p className="text-sm text-muted-foreground">
                  Nessun evento registrato.
                </p>
              )}
              {history.map((event) => (
                <article
                  key={event.id}
                  className="border-l-2 border-primary/30 pl-3"
                >
                  <p className="text-sm font-medium">
                    {historyLabels[event.event_type] ??
                      event.event_type.replaceAll("_", " ")}
                  </p>
                  {historyDetail(event) && (
                    <p className="text-sm text-muted-foreground">
                      {historyDetail(event)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.actor_name || "Sistema"} ·{" "}
                    {dateTime.format(new Date(event.created_at))}
                  </p>
                </article>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ActivityFormDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        defaultClientId={project.clientId}
        defaultProjectId={project.id}
        lockClient
        lockProject
      />
      <ActivityDetailSheet
        clientId={project.clientId}
        activityId={selectedActivity}
        open={Boolean(selectedActivity)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedActivity(null);
            if (selectedPhaseId) setPhaseSheetOpen(true);
          }
        }}
      />
      <PhaseConfigDialog
        project={project}
        open={configOpen}
        onOpenChange={setConfigOpen}
      />
      <PhaseSheet
        project={project}
        phase={selectedPhase}
        activities={activities}
        open={phaseSheetOpen && Boolean(selectedPhase)}
        onOpenChange={(open) => {
          setPhaseSheetOpen(open);
          if (!open) {
            setSelectedPhaseId(null);
            if (phaseFromQuery) router.replace(`${pathname}?tab=phases`);
          }
        }}
        onLink={() => setLinkDialogOpen(true)}
        onEdit={() => setConfigOpen(true)}
        onActivity={openActivityFromPhase}
      />
      <LinkActivitiesDialog
        project={project}
        phase={selectedPhase}
        activities={activities}
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
      />
    </main>
  );
}

function historyDetail(event: DeliveryHistoryRow) {
  if (event.reason?.trim()) return event.reason;
  if (
    event.event_type === "project_comment_created" &&
    typeof event.next_state?.body === "string"
  )
    return event.next_state.body;
  if (typeof event.next_state?.status === "string")
    return `Stato: ${event.next_state.status.replaceAll("_", " ")}`;
  return "";
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
function PhaseOverview({
  phases,
  activities,
  onConfigure,
  onOpen,
  onAll,
}: {
  phases: CommercialProjectPhase[];
  activities: Array<{ id: string; status: string }>;
  onConfigure: () => void;
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fasi del progetto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {phases.length ? (
          <>
            {phases.slice(0, 4).map((phase) => (
              <div key={phase.id}>
                <div className="flex justify-between text-sm">
                  <button
                    className={`font-medium hover:underline ${phase.status === "in_progress" ? "text-violet-700 dark:text-violet-300" : phase.status === "completed" ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}
                    onClick={() => onOpen(phase.id)}
                  >
                    {phase.name}
                  </button>
                  <span>{phaseProgress(phase, activities)}%</span>
                </div>
                <Progress value={phaseProgress(phase, activities)} />
                <p className="text-xs text-muted-foreground">
                  {formatItalianDate(phase.dueDate) || "Nessuna scadenza"}
                </p>
              </div>
            ))}
            <Button variant="link" className="px-0" onClick={onAll}>
              Vedi tutte le fasi
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Nessuna fase configurata
            </p>
            <Button variant="outline" onClick={onConfigure}>
              Configura fasi
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
function PhasesTab({
  phases,
  activities,
  onConfigure,
  onOpen,
  onMove,
}: {
  phases: CommercialProjectPhase[];
  activities: Array<{ id: string; status: string }>;
  onConfigure: () => void;
  onOpen: (id: string) => void;
  onMove: (phase: CommercialProjectPhase, direction: -1 | 1) => void;
}) {
  const today = getRomeDateKey(new Date());
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Fasi del progetto</h2>
          <p className="text-sm text-muted-foreground">
            Organizza il lavoro e monitora l’avanzamento
          </p>
        </div>
        <Button onClick={onConfigure}>
          <Pencil />
          Configura fasi
        </Button>
      </header>
      {phases.length ? (
        <div className="space-y-3">
          {phases.map((phase, index) => {
            const total = phase.activityIds.length;
            const completed = activities.filter(
              (activity) =>
                phase.activityIds.includes(activity.id) &&
                activity.status === "Completata",
            ).length;
            const late = Boolean(
              phase.dueDate &&
              getRomeDateKey(phase.dueDate) < today &&
              phase.status !== "completed",
            );
            return (
              <Card
                key={phase.id}
                className={late ? "border-destructive/60" : ""}
              >
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <span className="grid size-7 place-items-center rounded-full bg-muted text-sm">
                    {index + 1}
                  </span>
                  <button
                    className="min-w-48 flex-1 text-left"
                    onClick={() => onOpen(phase.id)}
                  >
                    <p className="font-medium">{phase.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {phase.description || "Nessuna descrizione"}
                    </p>
                  </button>
                  <Badge
                    variant="outline"
                    className={
                      late
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : phaseStatusClass[phase.status]
                    }
                  >
                    {phase.status === "completed" && (
                      <CheckCircle2 className="size-3" />
                    )}
                    {phaseLabels[phase.status]}
                  </Badge>
                  <div className="w-36 text-xs">
                    <Progress value={phaseProgress(phase, activities)} />
                    {completed} di {total} attività completate
                  </div>
                  <span
                    className={
                      late
                        ? "text-sm text-destructive"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {formatItalianDate(phase.dueDate) || "Nessuna scadenza"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpen(phase.id)}
                  >
                    Apri fase
                  </Button>
                  <div className="flex">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onMove(phase, -1)}
                      aria-label="Sposta su"
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onMove(phase, 1)}
                      aria-label="Sposta giù"
                    >
                      <ChevronDown />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <ClipboardCheck className="size-8 text-muted-foreground" />
            <p>Nessuna fase configurata</p>
            <Button onClick={onConfigure}>Configura fasi</Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
function PhaseConfigDialog({
  project,
  open,
  onOpenChange,
}: {
  project: CommercialProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useCommercialLeads();
  const [editing, setEditing] = useState<CommercialProjectPhase | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    status: "not_started" as CommercialProjectPhase["status"],
    startDate: "",
    dueDate: "",
  });
  const save = () => {
    const name = draft.name.trim();
    if (!name) return toast.error("Il nome della fase è obbligatorio");
    if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate)
      return toast.error("La scadenza non può precedere l’inizio");
    if (
      project.phases.some(
        (phase) =>
          phase.id !== editing?.id &&
          phase.name.trim().toLowerCase() === name.toLowerCase(),
      )
    )
      return toast.error("Esiste già una fase con questo nome");
    if (editing)
      store.updateProjectPhase(project.id, editing.id, { ...draft, name });
    else store.addProjectPhase(project.id, { ...draft, name });
    setEditing(null);
    setDraft({
      name: "",
      description: "",
      status: "not_started",
      startDate: "",
      dueDate: "",
    });
  };
  const edit = (phase: CommercialProjectPhase) => {
    setEditing(phase);
    setDraft({
      name: phase.name,
      description: phase.description ?? "",
      status: phase.status,
      startDate: phase.startDate ?? "",
      dueDate: phase.dueDate ?? "",
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configura fasi</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 rounded-md border p-3">
          <Label>
            Nome
            <Input
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </Label>
          <Label>
            Descrizione
            <Textarea
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Label>
              Inizio
              <Input
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  setDraft({ ...draft, startDate: event.target.value })
                }
              />
            </Label>
            <Label>
              Scadenza
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(event) =>
                  setDraft({ ...draft, dueDate: event.target.value })
                }
              />
            </Label>
          </div>
          <Button onClick={save}>
            {editing ? "Salva fase" : "Aggiungi fase"}
          </Button>
        </div>
        <div className="space-y-2">
          {[...project.phases]
            .sort((a, b) => a.order - b.order)
            .map((phase) => (
              <div
                key={phase.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <span className="min-w-0 flex-1 truncate">{phase.name}</span>
                <Button size="sm" variant="ghost" onClick={() => edit(phase)}>
                  Modifica
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Elimina fase"
                    >
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Eliminare questa fase?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Le attività resteranno collegate al progetto.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          store.deleteProjectPhase(project.id, phase.id)
                        }
                      >
                        Elimina
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function PhaseSheet({
  project,
  phase,
  activities,
  open,
  onOpenChange,
  onLink,
  onEdit,
  onActivity,
}: {
  project: CommercialProject;
  phase: CommercialProjectPhase | null;
  activities: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assigneeId: string;
    dueAt: string;
  }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLink: () => void;
  onEdit: () => void;
  onActivity: (id: string) => void;
}) {
  const commercialTeam = useCommercialTeam();
  const store = useCommercialLeads();
  if (!phase) return null;
  const linked = activities.filter((activity) =>
    phase.activityIds.includes(activity.id),
  );
  const completed = linked.filter(
    (activity) => activity.status === "Completata",
  ).length;
  const late = Boolean(
    phase.dueDate &&
    getRomeDateKey(phase.dueDate) < getRomeDateKey(new Date()) &&
    phase.status !== "completed",
  );
  const owners =
    Array.from(
      new Set(
        linked
          .map(
            (activity) =>
              commercialTeam.find((member) => member.id === activity.assigneeId)
                ?.name,
          )
          .filter(Boolean),
      ),
    ).join(", ") || "Nessun responsabile";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-dvh w-full flex-col overflow-hidden p-0 sm:max-w-[480px]">
        <SheetHeader className="shrink-0 border-b px-5 py-5 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fase del progetto
          </p>
          <div className="mt-1 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl">{phase.name}</SheetTitle>
              <SheetDescription className="mt-1 line-clamp-3">
                {phase.description || "Nessuna descrizione inserita"}
              </SheetDescription>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={phaseStatusClass[phase.status]}>
              {phase.status === "completed" && (
                <CheckCircle2 className="size-3" />
              )}
              {phaseLabels[phase.status]}
            </Badge>
            {late && <Badge variant="destructive">In ritardo</Badge>}
            <Link
              href={`/dashboard/progetti/${project.id}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              {project.name}
            </Link>
          </div>
        </SheetHeader>
        <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onEdit}>
              <Pencil />
              Modifica
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" aria-label="Azioni fase">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(event) => event.preventDefault()}
                    >
                      <Trash2 />
                      Elimina fase
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Eliminare questa fase?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Le attività resteranno collegate al progetto.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          store.deleteProjectPhase(project.id, phase.id);
                          onOpenChange(false);
                        }}
                      >
                        Elimina fase
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Avanzamento</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold">
                    {phaseProgress(phase, activities)}%
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {completed}/{linked.length} attività completate
                  </p>
                </div>
                <div className="mt-3">
                  <Progress value={phaseProgress(phase, activities)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pianificazione</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                <PlanValue
                  icon={CircleDot}
                  label="Stato"
                  value={phaseLabels[phase.status]}
                />
                <PlanValue
                  icon={CalendarDays}
                  label="Data di inizio"
                  value={formatItalianDate(phase.startDate) || "Non definita"}
                />
                <PlanValue
                  icon={CalendarClock}
                  label="Scadenza"
                  value={formatItalianDate(phase.dueDate) || "Non definita"}
                />
                <PlanValue icon={Users} label="Responsabili" value={owners} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Attività collegate
                  </CardTitle>
                  <Badge variant="secondary">{linked.length}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={onLink}>
                  <Link2 />
                  Collega attività
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {linked.length ? (
                  linked.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-md border p-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                          onClick={() => onActivity(activity.id)}
                        >
                          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <p className="line-clamp-2 text-sm font-medium leading-5">
                            {activity.title}
                          </p>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="shrink-0"
                              aria-label={`Azioni ${activity.title}`}
                            >
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => onActivity(activity.id)}
                            >
                              Apri attività
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() =>
                                store.unlinkActivityFromProjectPhase(
                                  project.id,
                                  phase.id,
                                  activity.id,
                                )
                              }
                            >
                              Rimuovi dalla fase
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                        <span>
                          Responsabile:{" "}
                          {commercialTeam.find(
                            (member) => member.id === activity.assigneeId,
                          )?.name ?? "—"}
                        </span>
                        <span>Priorità: {activity.priority}</span>
                        <span>
                          Scadenza:{" "}
                          {formatItalianDate(activity.dueAt) ||
                            "Nessuna scadenza"}
                        </span>
                      </p>
                      <Select
                        value={activity.status}
                        onValueChange={(status) =>
                          store.setCustomerActivityStatus(
                            project.clientId,
                            activity.id,
                            status as CustomerActivity["status"],
                          )
                        }
                      >
                        <SelectTrigger className="mt-3 h-9 w-full text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            {activity.status === "Completata" && (
                              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            )}
                            <SelectValue />
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Da fare",
                            "In corso",
                            "In attesa cliente",
                            "Completata",
                          ].map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))
                ) : (
                  <div className="py-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nessuna attività collegata
                    </p>
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      onClick={onLink}
                    >
                      <Link2 />
                      Collega attività
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Descrizione</CardTitle>
                <Button size="sm" variant="ghost" onClick={onEdit}>
                  <Pencil />
                  Modifica
                </Button>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">
                {phase.description || "Nessuna descrizione inserita"}
              </CardContent>
            </Card>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
function PlanValue({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CircleDot;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}
function LinkActivitiesDialog({
  project,
  phase,
  activities,
  open,
  onOpenChange,
}: {
  project: CommercialProject;
  phase: CommercialProjectPhase | null;
  activities: Array<{ id: string; title: string; status: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useCommercialLeads();
  const [selected, setSelected] = useState<string[]>([]);
  if (!phase) return null;
  const unavailable = new Set(
    project.phases
      .filter((item) => item.id !== phase.id)
      .flatMap((item) => item.activityIds),
  );
  const available = activities.filter(
    (activity) => !unavailable.has(activity.id),
  );
  const save = () => {
    store.linkActivityToProjectPhase(project.id, phase.id, selected);
    setSelected([]);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collega attività</DialogTitle>
        </DialogHeader>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {available.map((activity) => (
            <label
              key={activity.id}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <Checkbox
                checked={selected.includes(activity.id)}
                onCheckedChange={(checked) =>
                  setSelected((items) =>
                    checked
                      ? [...items, activity.id]
                      : items.filter((id) => id !== activity.id),
                  )
                }
              />
              <span>
                {activity.title}{" "}
                <span className="text-xs text-muted-foreground">
                  · {activity.status}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={save}>Collega selezionate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
