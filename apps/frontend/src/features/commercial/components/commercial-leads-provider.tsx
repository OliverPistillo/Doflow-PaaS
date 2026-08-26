"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { pipelineStages } from "@/features/commercial/pipeline-stages";
import {
  defaultCommerceSettings,
  type CommerceSettings,
  type CommercialContract,
  type CommercialOrder,
  type CommercialPayment,
  type CommercialRenewal,
  type CommercialSale,
  type CommercialService,
} from "@/features/commercial/commercial-commerce";
import {
  defaultPointPolicy,
  type CollaborationRecordType,
  type CommercialAuditEvent,
  type CommercialAuditOrigin,
  type CommercialComment,
  type PointLedgerEntry,
  type PointPolicy,
} from "@/features/commercial/commercial-collaboration";
import type { CommercialCampaign } from "@/features/commercial/commercial-campaigns";
import {
  type CommercialInvoice,
  type CommercialQuote,
} from "@/features/commercial/commercial-documents";
import {
  automationActions,
  automationTriggers,
  type AutomationNotification,
  type AutomationRun,
  type CommercialAutomationRule,
} from "@/features/commercial/commercial-automations";
import type {
  CommercialLead,
  PipelineStage,
} from "@/features/commercial/types";
import { useCommercialCoreCache } from "@/features/commercial/hooks/use-commercial-core-cache";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import {
  canEditLead,
  canManageActivity,
  canManageCustomerBranding,
  canViewCustomer,
  canViewLead,
  canViewProject,
} from "@/features/identity/permissions";
import { ApiError, apiFetch } from "@/lib/api";
import {
  commercialApi,
  type CommercialActivity,
  type CommercialList,
  type CommercialCompany,
  type CommercialContact,
  type CommercialOpportunity,
} from "@/lib/tenant-commercial-api";
import {
  automationsApi,
  type AutomationRule as ServerAutomationRule,
  type AutomationRun as ServerAutomationRun,
} from "@/lib/tenant-automations-api";
import { listDocuments, type TenantDocument } from "@/lib/tenant-documents-api";
import {
  deliveryApi,
  mapDeliveryProject,
  mapDeliveryTask,
  mapDeliveryTimer,
  type DeliveryWorkspace,
} from "@/lib/tenant-delivery-api";
import { commerceApi } from "@/lib/tenant-commerce-api";
import { documentRevenueApi } from "@/lib/tenant-document-revenue-api";
import { collaborationApi } from "@/lib/tenant-collaboration-api";
import {
  performanceApi,
  type PerformanceState,
} from "@/lib/tenant-performance-api";

import {
  type CommercialTimelineEvent,
  type CommercialCustomer,
  type CustomerContact,
  type CustomerCommunication,
  type CustomerDocument,
  type CommercialGoal,
  type RankingRole,
  type RankingConfig,
  type RankingSnapshot,
  type CommercialAppointment,
  type CustomerActivity,
  type CommercialProject,
  type ProjectTimeSession,
  type ArchivedRecord,
  type CommercialLeadsStore,
  type WorkspaceReadinessError,
  type WorkspaceReadinessStatus,
} from "@/features/commercial/commercial-provider-types";
export * from "@/features/commercial/commercial-provider-types";

const CommercialLeadsContext = createContext<CommercialLeadsStore | null>(null);

import {
  initialOrder,
  getCanonicalCustomerActivities,
  synchronizeProjectPhases,
  normalizeActivity,
  getWorkflowSafeActivityUpdates,
  nextRecurrenceDate,
  uniqueById,
  hasMeaningfulChanges,
  createActivityOnServer,
  updateActivityOnServer,
  deleteActivityOnServer,
  automationApiBody,
  textValue,
  numericValue,
  dateValue,
  serverComment,
  leadSource,
  mapOpportunity,
  opportunityPayload,
  type ServerList,
  type ServerActivity,
} from "@/features/commercial/commercial-provider-adapters";
export * from "@/features/commercial/commercial-provider-adapters";

const WORKSPACE_BOOTSTRAP_TIMEOUT_MS = 20_000;

function emptyPerformanceState(): PerformanceState {
  return {
    pointPolicy: null,
    policy: null,
    pointLedger: [],
    rankingConfigs: [],
    rankingSnapshots: [],
    goals: [],
    mission: { items: [] },
    adapters: [],
    permissions: {
      admin: false,
      canViewFinance: false,
      canViewGlobalPoints: false,
      canManagePolicy: false,
      canManageRankings: false,
      canManageGoals: false,
    },
  };
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function workspaceReadinessError(error: unknown): WorkspaceReadinessError {
  const status = error instanceof ApiError ? error.status : undefined;
  if (status === 401) {
    return { status, message: "Sessione scaduta. Nuovo accesso necessario." };
  }
  if (status === 403) {
    return {
      status,
      message: "Non disponi dei permessi per caricare questo workspace.",
    };
  }
  if (status === 429) {
    return {
      status,
      message:
        error instanceof Error
          ? error.message
          : "Troppe richieste. Riprova tra poco.",
    };
  }
  if (status && status >= 500) {
    return {
      status,
      message: "Workspace temporaneamente non disponibile.",
    };
  }
  return {
    ...(status ? { status } : {}),
    message:
      error instanceof Error
        ? error.message
        : "Impossibile caricare il workspace commerciale.",
  };
}

export function CommercialLeadsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = useDoflowIdentity();
  const {
    leads,
    setLeads,
    leadActivities,
    setLeadActivities,
    customers,
    setCustomers,
    order,
    setOrder,
    ignoredDuplicatePairs,
    setIgnoredDuplicatePairs,
    duplicatesLastAnalyzedAt,
    setDuplicatesLastAnalyzedAt,
  } = useCommercialCoreCache(initialOrder);
  const [projects, setProjects] = useState<CommercialProject[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<
    CommercialTimelineEvent[]
  >([]);
  const [goals, setGoals] = useState<CommercialGoal[]>([]);
  const [appointments, setAppointments] = useState<CommercialAppointment[]>([]);
  const [rankingConfigs, setRankingConfigs] = useState<RankingConfig[]>([]);
  const [rankingSnapshots, setRankingSnapshots] = useState<RankingSnapshot[]>(
    [],
  );
  const [services, setServices] = useState<CommercialService[]>([]);
  const [sales, setSales] = useState<CommercialSale[]>([]);
  const [orders, setOrders] = useState<CommercialOrder[]>([]);
  const [payments, setPayments] = useState<CommercialPayment[]>([]);
  const [contracts, setContracts] = useState<CommercialContract[]>([]);
  const [renewals, setRenewals] = useState<CommercialRenewal[]>([]);
  const [campaigns, setCampaigns] = useState<CommercialCampaign[]>([]);
  const [quotes, setQuotes] = useState<CommercialQuote[]>([]);
  const [invoices, setInvoices] = useState<CommercialInvoice[]>([]);
  const [automationRules, setAutomationRules] = useState<
    CommercialAutomationRule[]
  >([]);
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([]);
  const [automationNotifications] = useState<AutomationNotification[]>([]);
  const [commerceSettings, setCommerceSettings] = useState<CommerceSettings>(
    defaultCommerceSettings,
  );
  const [timeSessions, setTimeSessions] = useState<ProjectTimeSession[]>([]);
  const [auditEvents, setAuditEvents] = useState<CommercialAuditEvent[]>([]);
  const [comments, setComments] = useState<CommercialComment[]>([]);
  const [pointLedger, setPointLedger] = useState<PointLedgerEntry[]>([]);
  const [pointPolicy, setPointPolicy] =
    useState<PointPolicy>(defaultPointPolicy);
  const [workspaceStatus, setWorkspaceStatus] =
    useState<WorkspaceReadinessStatus>("loading");
  const [workspaceError, setWorkspaceError] =
    useState<WorkspaceReadinessError | null>(null);
  const [secondaryStatus, setSecondaryStatus] =
    useState<WorkspaceReadinessStatus>("loading");
  const [secondaryError, setSecondaryError] =
    useState<WorkspaceReadinessError | null>(null);
  const [workspaceAttempt, setWorkspaceAttempt] = useState(0);
  const workspaceController = useRef<AbortController | null>(null);
  const secondaryController = useRef<AbortController | null>(null);
  const secondaryLoader = useRef<(() => void) | null>(null);
  const hasHydrated = workspaceStatus === "ready";
  const canReadLeads =
    identity.hasCapability("canViewAllLeads") ||
    identity.hasCapability("canViewAssignedLeads");
  const canReadCustomers = identity.hasCapability("canViewCustomers");
  const canReadActivities = identity.hasCapability("canViewActivities");
  const canReadProjects =
    identity.hasCapability("canViewProjects") ||
    identity.hasCapability("canViewAssignedProjects");
  const canReadAutomationRules = identity.hasCapability("canViewAutomations");
  const canReadAutomationRuns = identity.hasCapability("canViewAutomationErrors");
  const canReadPayments = identity.hasCapability("canManagePayments");
  const canReadSales = identity.hasCapability("canViewSales");
  const canReadOrders = identity.hasCapability("canViewOrders");
  const canReadCampaigns = identity.hasCapability("canViewCampaigns");
  const canReadDocuments = canReadCustomers || canReadProjects;
  const canReadPerformance =
    identity.hasCapability("canViewOwnPoints") ||
    identity.hasCapability("canViewGlobalPoints") ||
    identity.hasCapability("canViewRankings");
  const canReadDocumentRevenue =
    identity.hasCapability("canViewQuotes") ||
    identity.hasCapability("canViewContracts") ||
    identity.hasCapability("canViewInvoices") ||
    identity.hasCapability("canViewRenewals");
  const recurrenceGenerationLocks = useRef(new Map<string, string>());
  const contactsExportLocks = useRef(
    new Map<string, { batchId: string; exportedAt: string }>(),
  );
  const activityMoveLocks = useRef(new Map<string, string>());
  const leadArchiveLocks = useRef(new Set<string>());

  const retryWorkspace = useCallback(() => {
    workspaceController.current?.abort();
    secondaryController.current?.abort();
    secondaryLoader.current = null;
    setWorkspaceError(null);
    setWorkspaceStatus("loading");
    setSecondaryError(null);
    setSecondaryStatus("loading");
    setWorkspaceAttempt((attempt) => attempt + 1);
  }, []);
  const retrySecondary = useCallback(() => {
    secondaryLoader.current?.();
  }, []);

  useEffect(() => {
    if (!identity.hasHydrated) return;
    let cancelled = false;
    let activeSecondaryLoader: (() => void) | null = null;
    const controller = new AbortController();
    workspaceController.current = controller;
    const { signal } = controller;
    const timeoutId = window.setTimeout(() => {
      if (cancelled || signal.aborted) return;
      controller.abort();
      const timeoutError = {
        message:
          "Il caricamento del workspace ha superato il tempo previsto. Riprova.",
      };
      setWorkspaceError(timeoutError);
      setWorkspaceStatus("error");
      setSecondaryError(timeoutError);
      setSecondaryStatus("error");
    }, WORKSPACE_BOOTSTRAP_TIMEOUT_MS);
    queueMicrotask(() => {
      if (cancelled || signal.aborted) return;
      setWorkspaceError(null);
      setWorkspaceStatus("loading");
      setSecondaryError(null);
      setSecondaryStatus("loading");
    });
    const loadCoreSnapshot = () =>
      Promise.all([
        canReadLeads
          ? commercialApi.opportunities({ limit: 500 }, signal)
          : Promise.resolve<CommercialList<CommercialOpportunity>>({
              items: [],
              total: 0,
              limit: 500,
              offset: 0,
            }),
        canReadCustomers
          ? commercialApi.companies({ limit: 500 }, signal)
          : Promise.resolve<CommercialList<CommercialCompany>>({
              items: [],
              total: 0,
              limit: 500,
              offset: 0,
            }),
        canReadCustomers
          ? commercialApi.contacts({ limit: 500 }, signal)
          : Promise.resolve<CommercialList<CommercialContact>>({
              items: [],
              total: 0,
              limit: 500,
              offset: 0,
            }),
        canReadActivities
          ? commercialApi.activities({ limit: 500 }, signal)
          : Promise.resolve<CommercialList<CommercialActivity>>({
              items: [],
              total: 0,
              limit: 500,
              offset: 0,
            }),
        canReadCustomers
          ? commercialApi.communications(signal)
          : Promise.resolve<
              CommercialList<
                Record<string, unknown> & { id: string; version: number }
              >
            >({ items: [], total: 0, limit: 500, offset: 0 }),
        canReadProjects
          ? deliveryApi.listProjects(signal)
          : Promise.resolve<
              Awaited<ReturnType<typeof deliveryApi.listProjects>>
            >({ items: [] }),
      ]);
    type CoreSnapshot = Awaited<ReturnType<typeof loadCoreSnapshot>>;

    const loadSecondarySnapshot = async (
      secondarySignal?: AbortSignal,
    ) => {
      let capturedError: WorkspaceReadinessError | null = null;
      const captureSecondary = async <T,>(
        request: () => Promise<T>,
        fallback: T,
      ): Promise<T> => {
        if (!secondarySignal) return fallback;
        try {
          return await request();
        } catch (error) {
          if (secondarySignal.aborted || isAbortError(error)) throw error;
          if (error instanceof ApiError && error.status === 401) throw error;
          capturedError ??= workspaceReadinessError(error);
          return fallback;
        }
      };
      const performanceState = canReadPerformance
        ? captureSecondary(
            () => performanceApi.state(secondarySignal),
            emptyPerformanceState(),
          )
        : Promise.resolve(emptyPerformanceState());
      const values = await Promise.all([
        canReadAutomationRules
          ? captureSecondary(
              () => automationsApi.rules({ limit: 500 }, secondarySignal),
              { items: [] },
            )
          : Promise.resolve({ items: [] }),
        canReadAutomationRuns
          ? captureSecondary(
              () => automationsApi.runs({ limit: 500 }, secondarySignal),
              { items: [] },
            )
          : Promise.resolve({ items: [] }),
        canReadPayments
          ? captureSecondary(
              () =>
                apiFetch<ServerList<Record<string, unknown> & { id: string }>>(
                  "/tenant/doflow/commerce/payments",
                  { signal: secondarySignal },
                ),
              { items: [] },
            )
          : Promise.resolve({ items: [] }),
        canReadDocuments
          ? captureSecondary(
              () => listDocuments({ limit: 500 }, secondarySignal),
              { items: [] },
            )
          : Promise.resolve({ items: [] }),
        canReadSales
          ? captureSecondary(
              () =>
                apiFetch<ServerList<Record<string, unknown> & { id: string }>>(
                  "/tenant/doflow/commerce/services",
                  { signal: secondarySignal },
                ),
              { items: [] },
            )
          : Promise.resolve({ items: [] }),
        canReadSales
          ? captureSecondary(
              () =>
                apiFetch<ServerList<Record<string, unknown> & { id: string }>>(
                  "/tenant/doflow/commerce/sales",
                  { signal: secondarySignal },
                ),
              { items: [] },
            )
          : Promise.resolve({ items: [] }),
        canReadOrders
          ? captureSecondary(
              () =>
                apiFetch<ServerList<Record<string, unknown> & { id: string }>>(
                  "/tenant/doflow/commerce/orders",
                  { signal: secondarySignal },
                ),
              { items: [] },
            )
          : Promise.resolve({ items: [] }),
        canReadCampaigns
          ? captureSecondary(
              () =>
                apiFetch<ServerList<Record<string, unknown> & { id: string }>>(
                  "/tenant/doflow/commerce/campaigns",
                  { signal: secondarySignal },
                ),
              { items: [] },
            )
          : Promise.resolve({ items: [] }),
        Promise.resolve<ServerList<Record<string, unknown> & { id: string }>>({
          items: [],
        }),
        performanceState.then((state) => ({
          items: state.pointLedger.map((entry) => ({ id: entry.id, user_id: entry.userId, points: entry.points, rule: entry.rule,
            record_type: entry.recordType, record_id: entry.recordId, source_event_id: entry.sourceEventId,
            valid_due_at: entry.validDueAt, occurred_at: entry.occurredAt, status: entry.status,
            reason: entry.reason, reverses_entry_id: entry.reversesEntryId, created_by: entry.createdBy })),
          policy: state.pointPolicy ? { on_time_base: state.pointPolicy.onTimeBase, early_per_day: state.pointPolicy.earlyPerDay,
            early_maximum: state.pointPolicy.earlyMaximum, late_per_day: state.pointPolicy.latePerDay,
            late_maximum: state.pointPolicy.lateMaximum, qa_first_pass: state.pointPolicy.qaFirstPass,
            qa_rejected: state.pointPolicy.qaRejected, reopened: state.pointPolicy.reopened,
            delivered_project: state.pointPolicy.deliveredProject, collected_per_hundred_euro: state.pointPolicy.collectedPerHundredEuro } : undefined,
        })),
        performanceState.then((state) => ({
          configs: state.rankingConfigs,
          snapshots: state.rankingSnapshots.map((snapshot) => ({ id: snapshot.id, period: snapshot.period, role: snapshot.role,
            winner_user_id: snapshot.winnerUserId, tied_user_ids: snapshot.tiedUserIds, scores: snapshot.scores,
            computed_at: snapshot.computedAt, formula_version: snapshot.formulaVersion, status: snapshot.status,
            revoked_at: snapshot.revokedAt, revoked_by: snapshot.revokedBy, revocation_reason: snapshot.revocationReason,
            supersedes_id: snapshot.supersedesId, recalculation_reason: snapshot.recalculationReason })),
        })),
        performanceState.then((state) => ({
          items: state.goals.map((goal) => ({ id: goal.id, title: goal.title, description: goal.description,
            target_type: goal.targetType, target_id: goal.targetId, metric: goal.metric, target_value: goal.targetValue,
            unit: goal.unit, starts_at: goal.startsAt, ends_at: goal.endsAt, status: goal.status,
            responsible_id: goal.responsibleId, notes: goal.notes, created_at: goal.createdAt, updated_at: goal.updatedAt })),
        })),
        canReadDocumentRevenue
          ? captureSecondary(
              () => documentRevenueApi.state(secondarySignal),
              {
                quotes: [],
                contracts: [],
                invoices: [],
                renewals: [],
                customerFinance: [],
                redacted: true,
              },
            )
          : Promise.resolve({
              quotes: [],
              contracts: [],
              invoices: [],
              renewals: [],
              customerFinance: [],
              redacted: true,
            }),
      ]);
      return { values, error: capturedError };
    };
    type SecondarySnapshot = Awaited<
      ReturnType<typeof loadSecondarySnapshot>
    >["values"];
    const combineWorkspaceSnapshot = (
      core: CoreSnapshot,
      secondary: SecondarySnapshot,
    ) => [...core, ...secondary] as const;
    type WorkspaceSnapshot = ReturnType<typeof combineWorkspaceSnapshot>;
    const loadDeliveryWorkspaces = async (projectPage: CoreSnapshot[5]) => {
      const workspaces = await Promise.all(
        projectPage.items.map(async (project) => {
          try {
            return [await deliveryApi.workspace(project.id, signal)];
          } catch (error) {
            if (signal.aborted || isAbortError(error)) throw error;
            if (error instanceof ApiError && [403, 404].includes(error.status)) {
              return [];
            }
            throw error;
          }
        }),
      );
      return workspaces.flat();
    };
    type DeliveryWorkspaces = Awaited<
      ReturnType<typeof loadDeliveryWorkspaces>
    >;

    const applyWorkspaceSnapshot = (
      [
          opportunityPage,
          companyPage,
          contactPage,
          activityPage,
          communicationPage,
          projectPage,
          automationRulePage,
          automationRunPage,
          paymentPage,
          documentPage,
          servicePage,
          salePage,
          orderPage,
          campaignPage,
          commentPage,
          pointPage,
          rankingPage,
          goalPage,
          documentRevenueState,
      ]: WorkspaceSnapshot,
      deliveryWorkspaces: DeliveryWorkspaces,
      applyCoreState: boolean,
    ) => {
          if (cancelled) return;
          const ownerNames = new Map(
            identity.users.map((user) => [user.id, user.name]),
          );
          const customerFinanceByCompany = new Map(
            documentRevenueState.customerFinance.map((entry) => [
              entry.customerId,
              entry,
            ]),
          );
          const campaignByName = new Map(
            campaignPage.items.map((campaign) => [
              textValue(campaign.name).trim().toLowerCase(),
              campaign.id,
            ]),
          );
          const mappedLeads = opportunityPage.items.map((opportunity) => {
            const lead = mapOpportunity(
              opportunity,
              ownerNames.get(textValue(opportunity.assigned_to)) ||
                "Non assegnato",
            );
            const attribution = opportunity.intake_attribution;
            if (opportunity.campaign_id)
              return { ...lead, campaignId: opportunity.campaign_id };
            const canonicalAttribution = opportunity.commercial_attribution;
            const campaignName =
              canonicalAttribution && typeof canonicalAttribution === "object"
                ? textValue(canonicalAttribution.campaign_name)
                    .trim()
                    .toLowerCase()
                : attribution && typeof attribution === "object"
                  ? textValue(attribution.utm_campaign).trim().toLowerCase()
                  : "";
            return campaignName && campaignByName.has(campaignName)
              ? { ...lead, campaignId: campaignByName.get(campaignName) }
              : lead;
          });
          const leadByCompany = new Map<string, CommercialLead>();
          opportunityPage.items.forEach((opportunity, index) => {
            if (
              opportunity.company_id &&
              !leadByCompany.has(opportunity.company_id)
            ) {
              leadByCompany.set(opportunity.company_id, mappedLeads[index]);
            }
          });
          const contactsByCompany = new Map<string, CommercialContact[]>();
          contactPage.items.forEach((contact) => {
            if (!contact.company_id) return;
            contactsByCompany.set(contact.company_id, [
              ...(contactsByCompany.get(contact.company_id) || []),
              contact,
            ]);
          });

          const activityRecords =
            activityPage.items as unknown as ServerActivity[];
          const taskRecords = deliveryWorkspaces.flatMap(
            (workspace) => workspace.tasks,
          ) as ServerActivity[];
          const projectCompanyById = new Map(
            projectPage.items.map((project) => [
              project.id,
              textValue(project.company_id),
            ]),
          );
          const activitiesByCompany = new Map<string, CustomerActivity[]>();
          const communicationsByCompany = new Map<
            string,
            CustomerCommunication[]
          >();
          communicationPage.items.forEach((communication) => {
            const companyId = textValue(communication.company_id);
            if (!companyId) return;
            const channelValue = textValue(communication.channel).toLowerCase();
            const channel: CustomerCommunication["channel"] =
              channelValue === "whatsapp"
                ? "WhatsApp"
                : channelValue === "email"
                  ? "Email"
                  : ["phone", "chiamata"].includes(channelValue)
                    ? "Chiamata"
                    : "Nota";
            const createdAt = dateValue(communication.created_at);
            communicationsByCompany.set(companyId, [
              ...(communicationsByCompany.get(companyId) || []),
              {
                id: communication.id,
                version: numericValue(communication.version) || 1,
                channel,
                title: textValue(communication.title),
                body: textValue(communication.body),
                occurredAt: dateValue(communication.occurred_at, createdAt),
                leadId: textValue(communication.lead_id) || undefined,
                createdAt,
                updatedAt: dateValue(communication.updated_at, createdAt),
              },
            ]);
          });
          const mappedAppointments = activityRecords.flatMap((activity) => {
            if (textValue(activity.type).toLowerCase() !== "appointment")
              return [];
            const companyId = textValue(activity.company_id);
            const leadId =
              textValue(activity.opportunity_id) ||
              leadByCompany.get(companyId)?.id ||
              textValue(activity.lead_id);
            if (!leadId) return [];
            const metadata =
              activity.metadata && typeof activity.metadata === "object"
                ? (activity.metadata as Record<string, unknown>)
                : {};
            const rawStatus = textValue(
              metadata.appointment_status || activity.status,
            ).toLowerCase();
            const createdAt = dateValue(activity.created_at);
            const startsAt = dateValue(activity.due_at, createdAt);
            return [
              {
                id: activity.id,
                version: numericValue(activity.version) || 1,
                title: textValue(activity.title),
                startsAt,
                endsAt: dateValue(metadata.ends_at, startsAt),
                status: ([
                  "scheduled",
                  "completed",
                  "cancelled",
                  "no_show",
                ].includes(rawStatus)
                  ? rawStatus
                  : activity.completed_at
                    ? "completed"
                    : "scheduled") as CommercialAppointment["status"],
                leadId,
                customerId: companyId || undefined,
                assigneeId: textValue(activity.assigned_to),
                activityId: activity.id,
                notes: textValue(activity.description) || undefined,
                createdAt,
                updatedAt: dateValue(activity.updated_at, createdAt),
                archivedAt: activity.deleted_at
                  ? dateValue(activity.deleted_at)
                  : undefined,
              },
            ];
          });
          const mappedLeadActivities = activityRecords.flatMap((activity) => {
            const companyId = textValue(activity.company_id);
            const opportunityId =
              textValue(activity.opportunity_id) ||
              leadByCompany.get(companyId)?.id ||
              textValue(activity.lead_id);
            if (!opportunityId) return [];
            const createdAt = dateValue(activity.created_at);
            const dueAt = dateValue(activity.due_at, createdAt);
            const record = normalizeActivity(
              {
                id: activity.id,
                version: numericValue(activity.version) || 1,
                title: textValue(activity.title),
                description: textValue(activity.description),
                type:
                  textValue(activity.type) === "call"
                    ? "Chiamata"
                    : textValue(activity.type) === "meeting"
                      ? "Riunione"
                      : textValue(activity.type) === "email"
                        ? "Email"
                        : "Attività",
                status:
                  textValue(activity.status) === "completed" ||
                  activity.completed_at
                    ? "Completata"
                    : textValue(activity.status) === "in_progress"
                      ? "In corso"
                      : textValue(activity.status) === "waiting_client"
                        ? "In attesa cliente"
                        : textValue(activity.status) === "cancelled"
                          ? "Annullata"
                          : "Da fare",
                priority:
                  textValue(activity.priority) === "urgent"
                    ? "Urgente"
                    : textValue(activity.priority) === "high"
                      ? "Alta"
                      : textValue(activity.priority) === "low"
                        ? "Bassa"
                        : "Media",
                assigneeId: textValue(activity.assigned_to),
                leadId: opportunityId,
                dueAt,
                createdAt,
                updatedAt: dateValue(activity.updated_at, createdAt),
                completedAt: activity.completed_at
                  ? dateValue(activity.completed_at)
                  : undefined,
                kanbanOrder: numericValue(activity.kanban_order),
              },
              { assigneeId: textValue(activity.assigned_to), createdAt },
            );
            if (companyId)
              activitiesByCompany.set(companyId, [
                ...(activitiesByCompany.get(companyId) || []),
                record,
              ]);
            return [record];
          });

          for (const task of taskRecords) {
            const companyId =
              textValue(task.company_id) ||
              projectCompanyById.get(textValue(task.project_id)) ||
              "";
            const opportunityId = leadByCompany.get(companyId)?.id;
            if (!companyId || !opportunityId) continue;
            const record = { ...mapDeliveryTask(task), leadId: opportunityId };
            mappedLeadActivities.push(record);
            activitiesByCompany.set(companyId, [
              ...(activitiesByCompany.get(companyId) || []),
              record,
            ]);
          }

          const mappedCustomers = companyPage.items.map(
            (company: CommercialCompany): CommercialCustomer => {
              const source =
                leadByCompany.get(company.id) ||
                ({
                  id: company.id,
                  opportunityName: company.name,
                  firstName: "",
                  lastName: "",
                  company: company.name,
                  email: textValue(company.email),
                  phone: textValue(company.phone),
                  vatNumber: textValue(company.vat_number) || undefined,
                  taxCode: textValue(company.fiscal_code) || undefined,
                  location: [company.address, company.city, company.province]
                    .filter(Boolean)
                    .join(", "),
                  source: leadSource(company.source),
                  service: textValue(company.industry),
                  stage: "won",
                  status: "won",
                  value: 0,
                  probability: 100,
                  assigneeId: textValue(company.owner_user_id),
                  owner:
                    ownerNames.get(textValue(company.owner_user_id)) ||
                    "Non assegnato",
                  createdAt: dateValue(company.created_at),
                  lastContact: dateValue(
                    company.updated_at,
                    dateValue(company.created_at),
                  ),
                  nextAction: "",
                  nextActionAt: "",
                  daysInStage: 0,
                } satisfies CommercialLead);
              const normalizedStatus = textValue(company.status).toLowerCase();
              const status: CommercialCustomer["status"] =
                normalizedStatus.includes("sosp")
                  ? "Sospeso"
                  : normalizedStatus.includes("complet")
                    ? "Completato"
                    : normalizedStatus.includes("onboard")
                      ? "Onboarding"
                      : "Attivo";
              const contacts: CustomerContact[] = (
                contactsByCompany.get(company.id) || []
              ).map((contact) => ({
                id: contact.id,
                version: contact.version,
                name: [contact.first_name, contact.last_name]
                  .filter(Boolean)
                  .join(" "),
                role: textValue(contact.role_title) || undefined,
                email: textValue(contact.email) || undefined,
                phone: textValue(contact.phone) || undefined,
                createdAt: dateValue(contact.created_at),
                updatedAt: dateValue(
                  contact.updated_at,
                  dateValue(contact.created_at),
                ),
              }));
              const companyFinance = customerFinanceByCompany.get(company.id);
              const documents: CustomerDocument[] = (
                documentPage.items as TenantDocument[]
              )
                .filter(
                  (document) =>
                    (document.entity_type === "company" &&
                      document.entity_id === company.id) ||
                    (document.entity_type === "project" &&
                      projectCompanyById.get(
                        String(document.entity_id || ""),
                      ) === company.id),
                )
                .map((document) => ({
                  id: document.id,
                  name: document.title || document.original_filename,
                  status: document.deleted_at
                    ? "Archiviato"
                    : textValue(document.status).toLowerCase() === "signed"
                      ? "Firmato"
                      : "Ricevuto",
                  notes: textValue(document.description) || undefined,
                  projectId:
                    document.entity_type === "project"
                      ? textValue(document.entity_id)
                      : undefined,
                  createdAt: dateValue(document.created_at),
                  updatedAt: dateValue(
                    document.updated_at,
                    dateValue(document.created_at),
                  ),
                  archivedAt: document.deleted_at
                    ? dateValue(document.deleted_at)
                    : undefined,
                }));
              return {
                id: company.id,
                version: company.version,
                leadId: source.id,
                sourceLeadId: source.id,
                sourceDealId: source.id,
                profile: {
                  ...source,
                  vatNumber:
                    source.vatNumber ||
                    textValue(company.vat_number) ||
                    undefined,
                  taxCode:
                    source.taxCode ||
                    textValue(company.fiscal_code) ||
                    undefined,
                  location:
                    source.location ||
                    [company.address, company.city, company.province]
                      .filter(Boolean)
                      .join(", "),
                },
                createdAt: dateValue(company.created_at),
                status,
                activities: activitiesByCompany.get(company.id) || [],
                communications: communicationsByCompany.get(company.id) || [],
                contacts,
                documents,
                primaryContactId: (
                  contactsByCompany.get(company.id) || []
                ).find((contact) => contact.is_primary)?.id,
                notes: textValue(company.notes) || undefined,
                logoUrl: textValue(company.logo_url) || undefined,
                logoUpdatedAt: company.logo_updated_at
                  ? dateValue(company.logo_updated_at)
                  : undefined,
                logoUpdatedBy: textValue(company.logo_updated_by) || undefined,
                finance: {
                  total: companyFinance?.netInvoiced ?? 0,
                  deposit: 0,
                  paid: companyFinance?.netPaid ?? 0,
                  invoiced: companyFinance?.netInvoiced ?? 0,
                },
              };
            },
          );

          const allowedProjectTypes = new Set([
            "website",
            "ecommerce",
            "landing",
            "branding",
            "marketing",
            "maintenance",
            "consulting",
            "software",
            "saas",
            "other",
          ]);
          const allowedProjectStatuses = new Set([
            "not_started",
            "onboarding",
            "in_progress",
            "blocked",
            "qa_internal",
            "internal_review",
            "ready_client",
            "client_review",
            "changes_requested",
            "ready_publish",
            "published",
            "delivered",
            "support",
            "suspended",
            "cancelled",
            "archived",
          ]);
          const mappedProjects = deliveryWorkspaces.flatMap(
            (workspace): CommercialProject[] => {
              const project = mapDeliveryProject(workspace);
              return [
                {
                  ...project,
                  sourceLeadId:
                    leadByCompany.get(project.clientId)?.id ??
                    project.sourceLeadId,
                  type: allowedProjectTypes.has(project.type)
                    ? project.type
                    : "other",
                  status: allowedProjectStatuses.has(project.status)
                    ? project.status
                    : "not_started",
                },
              ];
            },
          );

          const mappedTimeline: CommercialTimelineEvent[] =
            activityRecords.flatMap((activity) => {
              const companyId = textValue(activity.company_id);
              const leadId =
                textValue(activity.opportunity_id) ||
                leadByCompany.get(companyId)?.id ||
                textValue(activity.lead_id);
              if (!leadId) return [];
              return [
                {
                  id: activity.id,
                  leadId,
                  activityId: activity.id,
                  customerId: companyId || undefined,
                  kind: "status",
                  title: textValue(activity.title),
                  detail: textValue(activity.description),
                  date: dateValue(
                    activity.completed_at ||
                      activity.due_at ||
                      activity.created_at,
                  ),
                  author:
                    ownerNames.get(textValue(activity.assigned_to)) ||
                    "Sistema",
                },
              ];
            });

          if (applyCoreState) {
            setLeads(mappedLeads);
            setLeadActivities(mappedLeadActivities);
            setCustomers(mappedCustomers);
            setAppointments(mappedAppointments);
            setProjects(mappedProjects);
            setTimelineEvents(mappedTimeline);
            setOrder(
              Object.fromEntries(
                pipelineStages.map((stage) => [
                  stage.id,
                  mappedLeads
                    .filter((lead) => lead.stage === stage.id)
                    .map((lead) => lead.id),
                ]),
              ) as Record<PipelineStage, string[]>,
            );
          } else {
            const campaignIdByLead = new Map(
              mappedLeads
                .filter((lead) => lead.campaignId)
                .map((lead) => [lead.id, lead.campaignId]),
            );
            setLeads((items) =>
              items.map((lead) => {
                const campaignId = campaignIdByLead.get(lead.id);
                return campaignId && campaignId !== lead.campaignId
                  ? { ...lead, campaignId }
                  : lead;
              }),
            );
            const financeByCustomer = new Map(
              mappedCustomers.map((customer) => [customer.id, customer]),
            );
            setCustomers((items) =>
              items.map((customer) => {
                const enriched = financeByCustomer.get(customer.id);
                return enriched
                  ? {
                      ...customer,
                      documents: enriched.documents,
                      finance: enriched.finance,
                    }
                  : customer;
              }),
            );
          }
          setServices(
            servicePage.items.map((service) => ({
              id: service.id,
              version: Math.max(1, numericValue(service.version)),
              name: textValue(service.name),
              category: (textValue(service.category) ||
                "Altro") as CommercialService["category"],
              description: textValue(service.description),
              price: numericValue(service.price),
              status:
                textValue(service.status) === "inactive"
                  ? "inactive"
                  : "active",
              availability: (textValue(service.availability) ||
                "available") as CommercialService["availability"],
              deposit: numericValue(service.deposit),
              balance: numericValue(service.balance),
              installments: Math.max(1, numericValue(service.installments)),
              promotions: Array.isArray(service.promotions)
                ? service.promotions.map(
                    (promotion: Record<string, unknown>) => ({
                      id: textValue(promotion.id),
                      name: textValue(promotion.name),
                      kind:
                        textValue(promotion.kind) === "percentage"
                          ? ("percentage" as const)
                          : ("fixed" as const),
                      value: numericValue(promotion.value),
                      active: promotion.active !== false,
                    }),
                  )
                : [],
              extras: Array.isArray(service.extras)
                ? service.extras.map((extra: Record<string, unknown>) => ({
                    id: textValue(extra.id),
                    name: textValue(extra.name),
                    price: numericValue(extra.price),
                    active: extra.active !== false,
                  }))
                : [],
              renewal: {
                enabled: service.renewal_enabled === true,
                interval: (textValue(service.renewal_interval) ||
                  "annual") as CommercialService["renewal"]["interval"],
                price: numericValue(service.renewal_price),
              },
              billingPlans: Array.isArray(service.billing_plans)
                ? service.billing_plans.map(
                    (plan: Record<string, unknown>) => ({
                      id: textValue(plan.id),
                      name: textValue(plan.name),
                      description: textValue(plan.description),
                      oneTimePrice: numericValue(plan.one_time_price),
                      recurringPrice: numericValue(plan.recurring_price),
                      recurrence:
                        textValue(plan.recurrence) === "monthly"
                          ? ("monthly" as const)
                          : ("annual" as const),
                      renewal:
                        textValue(plan.renewal) === "required"
                          ? ("required" as const)
                          : ("optional" as const),
                      included: Array.isArray(plan.included)
                        ? plan.included.map(String)
                        : [],
                      active: plan.active !== false,
                    }),
                  )
                : [],
              projectTemplate: service.project_template_name
                ? {
                    name: textValue(service.project_template_name),
                    projectType: (textValue(service.project_template_type) ||
                      "other") as NonNullable<
                      CommercialService["projectTemplate"]
                    >["projectType"],
                    phases: Array.isArray(service.project_template_phases)
                      ? service.project_template_phases.map(String)
                      : [],
                  }
                : undefined,
              createdAt: dateValue(service.created_at),
              updatedAt: dateValue(
                service.updated_at,
                dateValue(service.created_at),
              ),
            })),
          );
          setSales(
            salePage.items.map((sale) => ({
              id: sale.id,
              version: Math.max(1, numericValue(sale.version)),
              customerId: textValue(sale.company_id) || undefined,
              leadId: textValue(sale.lead_id) || undefined,
              opportunityId: textValue(sale.opportunity_id) || undefined,
              serviceId: textValue(sale.service_id),
              salespersonId: textValue(sale.salesperson_id),
              origin: (textValue(sale.origin) ||
                "Commerciale") as CommercialSale["origin"],
              value: numericValue(sale.value),
              cost: sale.cost == null ? undefined : numericValue(sale.cost),
              currency: textValue(sale.currency) || undefined,
              date: textValue(sale.sale_date),
              status: (textValue(sale.status) ||
                "Bozza") as CommercialSale["status"],
              dealId: textValue(sale.deal_id),
              orderId: textValue(sale.order_id) || undefined,
              projectId: textValue(sale.project_id) || undefined,
              notes: textValue(sale.notes) || undefined,
              createdAt: dateValue(sale.created_at),
              updatedAt: dateValue(sale.updated_at, dateValue(sale.created_at)),
            })),
          );
          setOrders(
            orderPage.items.map((orderRecord) => ({
              id: orderRecord.id,
              version: Math.max(1, numericValue(orderRecord.version)),
              idempotencyKey:
                textValue(orderRecord.idempotency_key) || undefined,
              code: textValue(orderRecord.code),
              customerId: textValue(orderRecord.company_id),
              saleId: textValue(orderRecord.sale_id) || undefined,
              leadId: textValue(orderRecord.lead_id) || undefined,
              opportunityId: textValue(orderRecord.opportunity_id) || undefined,
              dealId: textValue(orderRecord.deal_id) || undefined,
              salespersonId: textValue(orderRecord.salesperson_id),
              items: Array.isArray(orderRecord.items)
                ? orderRecord.items.map((item: Record<string, unknown>) => ({
                    id: textValue(item.id),
                    serviceId: textValue(item.service_id),
                    name: textValue(item.service_name_snapshot),
                    quantity: numericValue(item.quantity),
                    unitPrice: numericValue(item.unit_price_snapshot),
                    discount: numericValue(item.discount),
                    planId: textValue(item.plan_id) || undefined,
                    planName: textValue(item.plan_name_snapshot) || undefined,
                    oneTimePrice:
                      item.one_time_price_snapshot == null
                        ? undefined
                        : numericValue(item.one_time_price_snapshot),
                    recurringPrice:
                      item.recurring_price_snapshot == null
                        ? undefined
                        : numericValue(item.recurring_price_snapshot),
                    firstPeriodTotal:
                      item.first_period_total == null
                        ? undefined
                        : numericValue(item.first_period_total),
                    renewalPrice:
                      item.renewal_price_snapshot == null
                        ? undefined
                        : numericValue(item.renewal_price_snapshot),
                    recurrence:
                      textValue(item.recurrence) === "monthly"
                        ? ("monthly" as const)
                        : textValue(item.recurrence) === "annual"
                          ? ("annual" as const)
                          : undefined,
                    renewalRequired:
                      item.renewal_required == null
                        ? undefined
                        : item.renewal_required === true,
                    includedSnapshot: Array.isArray(item.included_snapshot)
                      ? item.included_snapshot.map(String)
                      : undefined,
                    nextDueAt: textValue(item.next_due_at) || undefined,
                  }))
                : [],
              discount: numericValue(orderRecord.discount),
              subtotal: numericValue(orderRecord.subtotal),
              taxTotal: numericValue(orderRecord.tax_total),
              total: numericValue(orderRecord.total),
              deposit: numericValue(orderRecord.deposit),
              balance: numericValue(orderRecord.balance),
              currency: textValue(orderRecord.currency) || undefined,
              grossCollected: numericValue(orderRecord.gross_collected),
              refundedTotal: numericValue(orderRecord.refunded_total),
              netCollected: numericValue(orderRecord.net_collected),
              residual: numericValue(orderRecord.residual),
              paymentStatus: (textValue(orderRecord.payment_status) ||
                "not_started") as CommercialOrder["paymentStatus"],
              installments: Math.max(1, numericValue(orderRecord.installments)),
              projectId: textValue(orderRecord.project_id) || undefined,
              administrativeStatus: (textValue(
                orderRecord.administrative_status,
              ) || "Bozza") as CommercialOrder["administrativeStatus"],
              orderDate: textValue(orderRecord.order_date),
              dueDate: textValue(orderRecord.due_date) || undefined,
              notes: textValue(orderRecord.notes) || undefined,
              createdAt: dateValue(orderRecord.created_at),
              updatedAt: dateValue(
                orderRecord.updated_at,
                dateValue(orderRecord.created_at),
              ),
            })),
          );
          setCampaigns(
            campaignPage.items.map((campaign) => ({
              id: campaign.id,
              name: textValue(campaign.name),
              channel: (textValue(campaign.channel) ||
                "Manuale") as CommercialCampaign["channel"],
              account: textValue(campaign.account),
              status: (textValue(campaign.status) ||
                "draft") as CommercialCampaign["status"],
              startsAt: textValue(campaign.starts_at),
              endsAt: textValue(campaign.ends_at) || undefined,
              spend: numericValue(campaign.spend),
              impressions: numericValue(campaign.impressions),
              clicks: numericValue(campaign.clicks),
              adGroups: Array.isArray(campaign.ad_groups)
                ? campaign.ad_groups.map((group: Record<string, unknown>) => ({
                    id: textValue(group.id),
                    name: textValue(group.name),
                    status: (textValue(group.status) || "active") as
                      "active" | "paused" | "archived",
                    ads: Array.isArray(group.ads)
                      ? group.ads.map((ad: Record<string, unknown>) => ({
                          id: textValue(ad.id),
                          name: textValue(ad.name),
                          status: (textValue(ad.status) || "active") as
                            "active" | "paused" | "archived",
                        }))
                      : [],
                  }))
                : [],
              createdAt: dateValue(campaign.created_at),
              updatedAt: dateValue(
                campaign.updated_at,
                dateValue(campaign.created_at),
              ),
            })),
          );
          if (applyCoreState) {
            setComments(commentPage.items.map(serverComment));
            setTimeSessions(
              deliveryWorkspaces.flatMap((workspace) =>
                workspace.timers.map(mapDeliveryTimer),
              ),
            );
          }
          setPointLedger(
            pointPage.items.map((entry) => ({
              id: entry.id,
              userId: textValue(entry.user_id),
              points: numericValue(entry.points),
              rule: textValue(entry.rule) as PointLedgerEntry["rule"],
              recordType: textValue(
                entry.record_type,
              ) as PointLedgerEntry["recordType"],
              recordId: textValue(entry.record_id),
              sourceEventId: textValue(entry.source_event_id),
              validDueAt: textValue(entry.valid_due_at) || undefined,
              occurredAt: dateValue(entry.occurred_at),
              status: textValue(entry.status) as PointLedgerEntry["status"],
              reason: textValue(entry.reason),
              reversesEntryId: textValue(entry.reverses_entry_id) || undefined,
              createdBy: textValue(entry.created_by),
            })),
          );
          if (pointPage.policy) {
            setPointPolicy({
              onTimeBase: numericValue(pointPage.policy.on_time_base),
              earlyPerDay: numericValue(pointPage.policy.early_per_day),
              earlyMaximum: numericValue(pointPage.policy.early_maximum),
              latePerDay: numericValue(pointPage.policy.late_per_day),
              lateMaximum: numericValue(pointPage.policy.late_maximum),
              qaFirstPass: numericValue(pointPage.policy.qa_first_pass),
              qaRejected: numericValue(pointPage.policy.qa_rejected),
              reopened: numericValue(pointPage.policy.reopened),
              deliveredProject: numericValue(
                pointPage.policy.delivered_project,
              ),
              collectedPerHundredEuro: numericValue(
                pointPage.policy.collected_per_hundred_euro,
              ),
            });
          }
          if (rankingPage.configs.length) {
            const overrides = new Map(
              rankingPage.configs.map((config) => [
                textValue(config.role),
                Array.isArray(config.metrics) ? config.metrics : [],
              ]),
            );
            setRankingConfigs(
              rankingPage.configs.map((config) => ({
                role: textValue(config.role) as RankingRole,
                metrics: (overrides.get(textValue(config.role)) || []) as RankingConfig["metrics"],
                formulaVersion: numericValue(config.formulaVersion),
                optimisticVersion: numericValue(config.optimisticVersion) || 1,
              })),
            );
          }
          setRankingSnapshots(
            rankingPage.snapshots.map((snapshot) => ({
              id: snapshot.id,
              period: textValue(snapshot.period),
              role: textValue(snapshot.role) as RankingRole,
              winnerUserId: textValue(snapshot.winner_user_id),
              tiedUserIds: Array.isArray(snapshot.tied_user_ids)
                ? snapshot.tied_user_ids.map(String)
                : [],
              scores: Array.isArray(snapshot.scores)
                ? (snapshot.scores as RankingSnapshot["scores"])
                : [],
              computedAt: dateValue(snapshot.computed_at),
              formulaVersion: numericValue(snapshot.formula_version) || 2,
              status: textValue(snapshot.status) as RankingSnapshot["status"],
              revokedAt: snapshot.revoked_at
                ? dateValue(snapshot.revoked_at)
                : undefined,
              revokedBy: textValue(snapshot.revoked_by) || undefined,
              revocationReason:
                textValue(snapshot.revocation_reason) || undefined,
              supersedesId: textValue(snapshot.supersedes_id) || undefined,
              recalculationReason:
                textValue(snapshot.recalculation_reason) || undefined,
            })),
          );
          setGoals(
            goalPage.items.map((goal) => ({
              id: goal.id,
              title: textValue(goal.title),
              description: textValue(goal.description),
              targetType: textValue(
                goal.target_type,
              ) as CommercialGoal["targetType"],
              targetId: textValue(goal.target_id) || undefined,
              metric: textValue(goal.metric) as CommercialGoal["metric"],
              targetValue: numericValue(goal.target_value),
              unit: textValue(goal.unit) as CommercialGoal["unit"],
              startsAt: dateValue(goal.starts_at),
              endsAt: dateValue(goal.ends_at),
              status: textValue(goal.status) as CommercialGoal["status"],
              responsibleId: textValue(goal.responsible_id) || undefined,
              notes: textValue(goal.notes) || undefined,
              createdAt: dateValue(goal.created_at),
              updatedAt: dateValue(goal.updated_at, dateValue(goal.created_at)),
            })),
          );
          setAutomationRules(
            (automationRulePage.items as ServerAutomationRule[]).map((rule) => {
              const actions = Array.isArray(rule.actions) ? rule.actions : [];
              const firstAction =
                actions[0] && typeof actions[0] === "object"
                  ? (actions[0] as Record<string, unknown>)
                  : {};
              const triggerValue = textValue(rule.trigger_type);
              const actionValue = textValue(
                firstAction.type || firstAction.action,
              );
              const createdAt = dateValue(rule.created_at);
              return {
                id: rule.id,
                name: rule.name,
                trigger: (automationTriggers.includes(
                  triggerValue as (typeof automationTriggers)[number],
                )
                  ? triggerValue
                  : "activity_due") as CommercialAutomationRule["trigger"],
                conditions:
                  typeof rule.conditions === "string"
                    ? rule.conditions
                    : JSON.stringify(rule.conditions || {}),
                recipientId:
                  textValue(firstAction.recipient_id || firstAction.user_id) ||
                  identity.currentUser.id,
                action: (automationActions.includes(
                  actionValue as (typeof automationActions)[number],
                )
                  ? actionValue
                  : "create_notification") as CommercialAutomationRule["action"],
                message:
                  textValue(firstAction.message || firstAction.body) ||
                  textValue(rule.description),
                enabled: rule.is_enabled,
                optimisticVersion: numericValue(rule.optimistic_version) || 1,
                lastRunAt: rule.last_run_at
                  ? dateValue(rule.last_run_at)
                  : undefined,
                nextRunAt: rule.next_run_at
                  ? dateValue(rule.next_run_at)
                  : undefined,
                createdAt,
                updatedAt: dateValue(rule.updated_at, createdAt),
              };
            }),
          );
          setAutomationRuns(
            (automationRunPage.items as ServerAutomationRun[]).map((run) => ({
              id: run.id,
              ruleId: textValue(run.rule_id),
              executionKey: run.id,
              status: textValue(run.status).toLowerCase().includes("success")
                ? "success"
                : textValue(run.status).toLowerCase().includes("skip")
                  ? "skipped"
                  : "error",
              startedAt: dateValue(run.started_at),
              completedAt: dateValue(
                run.finished_at,
                dateValue(run.started_at),
              ),
              output: run.result_payload
                ? JSON.stringify(run.result_payload)
                : "",
              error: textValue(run.error_message) || undefined,
            })),
          );
          const paymentMethodMap: Record<string, CommercialPayment["method"]> =
            {
              bank_transfer: "Bonifico",
              cash: "Contanti",
              card: "Carta",
              paypal: "PayPal",
              stripe: "Stripe",
              other: "Altro",
            };
          setPayments(
            paymentPage.items.map((payment) => {
              const createdAt = dateValue(payment.created_at);
              const rawStatus = textValue(payment.status).toLowerCase();
              return {
                id: payment.id,
                version: Math.max(1, numericValue(payment.version)),
                orderId:
                  textValue(
                    payment.order_id ||
                      payment.invoice_id ||
                      payment.project_id,
                  ) || payment.id,
                amount: numericValue(payment.amount),
                date: textValue(payment.payment_date) || createdAt.slice(0, 10),
                method:
                  paymentMethodMap[textValue(payment.method).toLowerCase()] ||
                  "Altro",
                reference: textValue(payment.reference) || payment.id,
                type:
                  textValue(payment.payment_type) === "refund"
                    ? "Rimborso"
                    : "Saldo",
                originalPaymentId:
                  textValue(payment.original_payment_id) || undefined,
                refundReason: textValue(payment.refund_reason) || undefined,
                status:
                  rawStatus === "confirmed"
                    ? "Confermato"
                    : rawStatus === "failed"
                      ? "Fallito"
                      : rawStatus === "cancelled"
                        ? "Annullato"
                        : "Da confermare",
                effectiveDate: textValue(payment.payment_date) || undefined,
                operatorId: textValue(payment.created_by) || undefined,
                notes: textValue(payment.notes) || undefined,
                createdAt,
                updatedAt: dateValue(payment.updated_at, createdAt),
                archivedAt: payment.deleted_at
                  ? dateValue(payment.deleted_at)
                  : undefined,
              };
            }),
          );
          // Phase 3B: these bounded contexts are projected exclusively from
          // the Doflow PostgreSQL authority endpoint.
          setQuotes(documentRevenueState.quotes);
          setContracts(documentRevenueState.contracts);
          setInvoices(documentRevenueState.invoices);
          setRenewals(documentRevenueState.renewals);
    };
    const applyCoreSnapshot = (
      snapshot: WorkspaceSnapshot,
      deliveryWorkspaces: DeliveryWorkspaces,
    ) => applyWorkspaceSnapshot(snapshot, deliveryWorkspaces, true);
    const applySecondarySnapshot = (
      snapshot: WorkspaceSnapshot,
      deliveryWorkspaces: DeliveryWorkspaces,
    ) => applyWorkspaceSnapshot(snapshot, deliveryWorkspaces, false);

    const runCoreWorkspace = async () => {
      try {
        const coreSnapshot = await loadCoreSnapshot();
        const deliveryWorkspaces = await loadDeliveryWorkspaces(coreSnapshot[5]);
        const fallbackSecondary = await loadSecondarySnapshot();
        if (cancelled || signal.aborted) return;
        applyCoreSnapshot(
          combineWorkspaceSnapshot(coreSnapshot, fallbackSecondary.values),
          deliveryWorkspaces,
        );
        if (cancelled || signal.aborted) return;
        window.clearTimeout(timeoutId);
        setWorkspaceError(null);
        setWorkspaceStatus("ready");

        const startSecondary = () => {
          secondaryController.current?.abort();
          const controllerForSecondary = new AbortController();
          secondaryController.current = controllerForSecondary;
          const secondarySignal = controllerForSecondary.signal;
          setSecondaryError(null);
          setSecondaryStatus("loading");
          const secondaryTimeoutId = window.setTimeout(() => {
            if (cancelled || secondarySignal.aborted) return;
            controllerForSecondary.abort();
            setSecondaryError({
              message:
                "Alcuni dati secondari non hanno risposto in tempo. Riprova.",
            });
            setSecondaryStatus("error");
          }, WORKSPACE_BOOTSTRAP_TIMEOUT_MS);

          void (async () => {
            try {
              const secondarySnapshot =
                await loadSecondarySnapshot(secondarySignal);
              if (cancelled || secondarySignal.aborted) return;
              applySecondarySnapshot(
                combineWorkspaceSnapshot(
                  coreSnapshot,
                  secondarySnapshot.values,
                ),
                deliveryWorkspaces,
              );
              if (cancelled || secondarySignal.aborted) return;
              window.clearTimeout(secondaryTimeoutId);
              setSecondaryError(secondarySnapshot.error);
              setSecondaryStatus(
                secondarySnapshot.error ? "error" : "ready",
              );
            } catch (error) {
              window.clearTimeout(secondaryTimeoutId);
              if (
                cancelled ||
                secondarySignal.aborted ||
                isAbortError(error)
              )
                return;
              const readinessError = workspaceReadinessError(error);
              setSecondaryError(readinessError);
              setSecondaryStatus("error");
              if (readinessError.status === 401) {
                setWorkspaceError(readinessError);
                setWorkspaceStatus("error");
              }
            }
          })();
        };
        activeSecondaryLoader = startSecondary;
        secondaryLoader.current = startSecondary;
        startSecondary();
      } catch (error) {
        if (cancelled || signal.aborted || isAbortError(error)) return;
        window.clearTimeout(timeoutId);
        const readinessError = workspaceReadinessError(error);
        setWorkspaceError(readinessError);
        setWorkspaceStatus("error");
        setSecondaryError(readinessError);
        setSecondaryStatus("error");
        toast.error(readinessError.message);
      }
    };
    void runCoreWorkspace();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
      secondaryController.current?.abort();
      if (workspaceController.current === controller) {
        workspaceController.current = null;
      }
      if (secondaryLoader.current === activeSecondaryLoader) {
        secondaryLoader.current = null;
      }
    };
  }, [
    identity.currentUser.id,
    identity.hasHydrated,
    identity.users,
    canReadActivities,
    canReadAutomationRules,
    canReadAutomationRuns,
    canReadCampaigns,
    canReadCustomers,
    canReadDocumentRevenue,
    canReadDocuments,
    canReadLeads,
    canReadOrders,
    canReadPayments,
    canReadPerformance,
    canReadProjects,
    canReadSales,
    setCustomers,
    setLeadActivities,
    setLeads,
    setOrder,
    workspaceAttempt,
  ]);
  const permissionScope = useMemo(
    () => ({ leads, customers, projects }),
    [customers, leads, projects],
  );
  const visibleLeads = useMemo(
    () => leads.filter((lead) => canViewLead(identity.currentUser, lead)),
    [identity.currentUser, leads],
  );
  const visibleLeadActivities = useMemo(
    () =>
      leadActivities.filter(
        (activity) =>
          !activity.archivedAt &&
          visibleLeads.some((lead) => lead.id === activity.leadId),
      ),
    [leadActivities, visibleLeads],
  );
  const visibleCustomers = useMemo(
    () =>
      customers
        .filter((customer) =>
          canViewCustomer(identity.currentUser, customer, permissionScope),
        )
        .map((customer) => ({
          ...customer,
          profile: identity.hasCapability("canViewCommercialValues")
            ? customer.profile
            : { ...customer.profile, value: 0 },
          finance: identity.hasCapability("canViewAdministration")
            ? customer.finance
            : undefined,
        })),
    [customers, identity, permissionScope],
  );
  const visibleProjects = useMemo(
    () =>
      projects
        .filter((project) =>
          canViewProject(identity.currentUser, project, permissionScope),
        )
        .map((project) =>
          identity.hasCapability("canViewCommercialValues")
            ? project
            : { ...project, agreedValue: 0 },
        ),
    [identity, permissionScope, projects],
  );
  const visibleLeadIds = useMemo(
    () =>
      new Set([
        ...visibleLeads.map((lead) => lead.id),
        ...visibleCustomers.map((customer) => customer.sourceLeadId),
      ]),
    [visibleCustomers, visibleLeads],
  );
  const visibleTimelineEvents = useMemo(
    () =>
      timelineEvents
        .filter((event) => visibleLeadIds.has(event.leadId))
        .map((event) => {
          if (
            identity.hasCapability("canViewCommercialValues") ||
            (!event.saleId &&
              !event.orderId &&
              !event.paymentId &&
              !event.renewalId)
          )
            return event;
          return { ...event, detail: "Aggiornamento operativo collegato." };
        }),
    [identity, timelineEvents, visibleLeadIds],
  );
  const visibleAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          !appointment.archivedAt && visibleLeadIds.has(appointment.leadId),
      ),
    [appointments, visibleLeadIds],
  );
  const visibleRankingSnapshots = useMemo(
    () =>
      identity.hasCapability("canViewAllLeads")
        ? rankingSnapshots
        : rankingSnapshots
            .filter(
              (snapshot) => snapshot.winnerUserId === identity.currentUser.id,
            )
            .map((snapshot) => ({
              ...snapshot,
              tiedUserIds: snapshot.tiedUserIds.filter(
                (id) => id === identity.currentUser.id,
              ),
              scores: snapshot.scores.filter(
                (score) => score.userId === identity.currentUser.id,
              ),
            })),
    [identity, rankingSnapshots],
  );
  const visibleOrder = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(order).map(([stage, ids]) => [
          stage,
          ids.filter((id) => visibleLeadIds.has(id)),
        ]),
      ) as Record<PipelineStage, string[]>,
    [order, visibleLeadIds],
  );
  const visibleServices = useMemo(
    () =>
      services
        .filter(
          (service) =>
            !service.archivedAt &&
            (identity.hasCapability("canManageCatalog") ||
              service.status === "active"),
        )
        .map((service) =>
          identity.hasCapability("canViewCommercialValues")
            ? service
            : {
                ...service,
                price: 0,
                deposit: 0,
                balance: 0,
                promotions: [],
                extras: [],
                renewal: { ...service.renewal, price: 0 },
                billingPlans: service.billingPlans?.map((plan) => ({
                  ...plan,
                  oneTimePrice: 0,
                  recurringPrice: 0,
                })),
              },
        ),
    [identity, services],
  );
  const visibleSales = useMemo(
    () =>
      sales
        .filter(
          (sale) =>
            !sale.archivedAt &&
            (identity.hasCapability("canViewAllLeads") ||
              (identity.hasCapability("canViewSales") &&
                sale.salespersonId === identity.currentUser.id)),
        )
        .map((sale) =>
          identity.hasCapability("canViewCommercialValues")
            ? sale
            : { ...sale, value: 0, cost: undefined },
        ),
    [identity, sales],
  );
  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.map((project) => project.id)),
    [visibleProjects],
  );
  const visibleTimeSessions = useMemo(
    () =>
      timeSessions.filter(
        (session) =>
          !session.archivedAt &&
          visibleProjectIds.has(session.projectId) &&
          (identity.currentUser.roles.includes("administrator") ||
            identity.currentUser.roles.includes("project_manager") ||
            session.userId === identity.currentUser.id),
      ),
    [identity.currentUser, timeSessions, visibleProjectIds],
  );
  const visibleOrders = useMemo(
    () =>
      orders
        .filter(
          (commercialOrder) =>
            !commercialOrder.archivedAt &&
            (identity.hasCapability("canViewAllLeads") ||
              (identity.hasCapability("canManageOwnOrders") &&
                commercialOrder.salespersonId === identity.currentUser.id) ||
              Boolean(
                commercialOrder.projectId &&
                visibleProjectIds.has(commercialOrder.projectId),
              )),
        )
        .map((commercialOrder) =>
          identity.hasCapability("canViewCommercialValues")
            ? commercialOrder
            : {
                ...commercialOrder,
                items: commercialOrder.items.map((item) => ({
                  ...item,
                  unitPrice: 0,
                  discount: 0,
                })),
                discount: 0,
                total: 0,
                deposit: 0,
                balance: 0,
              },
        ),
    [identity, orders, visibleProjectIds],
  );
  const visiblePayments = useMemo(
    () =>
      identity.hasCapability("canViewAdministration")
        ? payments.filter((payment) => !payment.archivedAt)
        : [],
    [identity, payments],
  );
  const visibleContracts = useMemo(
    () =>
      contracts
        .filter(
          (contract) =>
            !contract.archivedAt &&
            (identity.hasCapability("canViewAllLeads") ||
              (identity.hasCapability("canViewContracts") &&
                (contract.salespersonId === identity.currentUser.id ||
                  Boolean(
                    contract.projectId &&
                    visibleProjectIds.has(contract.projectId),
                  )))),
        )
        .map((contract) =>
          identity.hasCapability("canViewCommercialValues")
            ? contract
            : {
                ...contract,
                signatoryName: "Riservato",
                documentName: undefined,
                documentReference: undefined,
                notes: undefined,
                sendHistory: [],
              },
        ),
    [contracts, identity, visibleProjectIds],
  );
  const visibleRenewals = useMemo(
    () =>
      renewals
        .filter(
          (renewal) =>
            !renewal.archivedAt &&
            (identity.hasCapability("canViewAllLeads") ||
              (identity.hasCapability("canViewRenewals") &&
                (renewal.salespersonId === identity.currentUser.id ||
                  Boolean(
                    renewal.projectId &&
                    visibleProjectIds.has(renewal.projectId),
                  )))),
        )
        .map((renewal) =>
          identity.hasCapability("canViewCommercialValues")
            ? renewal
            : { ...renewal, priceSnapshot: 0 },
        ),
    [identity, renewals, visibleProjectIds],
  );
  const visibleCampaigns = useMemo(() => {
    if (identity.currentUser.roles.includes("administrator"))
      return campaigns.filter((campaign) => !campaign.archivedAt);
    const campaignIds = new Set(
      visibleLeads.map((lead) => lead.campaignId).filter(Boolean),
    );
    return campaigns
      .filter(
        (campaign) => !campaign.archivedAt && campaignIds.has(campaign.id),
      )
      .map((campaign) => ({
        ...campaign,
        spend: 0,
        impressions: 0,
        clicks: 0,
      }));
  }, [campaigns, identity.currentUser.roles, visibleLeads]);
  const visibleQuotes = useMemo(
    () =>
      quotes.filter(
        (quote) =>
          !quote.archivedAt &&
          identity.hasCapability("canViewQuotes") &&
          (identity.currentUser.roles.includes("administrator") ||
            quote.salespersonId === identity.currentUser.id) &&
          (!quote.leadId || visibleLeadIds.has(quote.leadId)),
      ),
    [identity, quotes, visibleLeadIds],
  );
  const visibleCustomerIds = useMemo(
    () => new Set(visibleCustomers.map((customer) => customer.id)),
    [visibleCustomers],
  );
  const visibleInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          !invoice.archivedAt &&
          identity.hasCapability("canViewInvoices") &&
          visibleCustomerIds.has(invoice.customerId),
      ),
    [identity, invoices, visibleCustomerIds],
  );
  const visibleAutomationRules = useMemo(
    () =>
      identity.hasCapability("canViewAutomations")
        ? automationRules.filter((rule) => !rule.archivedAt)
        : [],
    [automationRules, identity],
  );
  const visibleAutomationRuleIds = useMemo(
    () => new Set(visibleAutomationRules.map((rule) => rule.id)),
    [visibleAutomationRules],
  );
  const visibleAutomationRuns = useMemo(
    () =>
      automationRuns.filter((run) => visibleAutomationRuleIds.has(run.ruleId)),
    [automationRuns, visibleAutomationRuleIds],
  );
  const visibleAutomationNotifications = useMemo(
    () =>
      automationNotifications.filter(
        (notification) =>
          notification.recipientId === identity.currentUser.id ||
          identity.currentUser.roles.includes("administrator"),
      ),
    [automationNotifications, identity.currentUser],
  );
  const visibleRecordKeys = useMemo(
    () =>
      new Set([
        ...visibleLeads.map((item) => `lead:${item.id}`),
        ...visibleCustomers.map((item) => `customer:${item.id}`),
        ...visibleProjects.map((item) => `project:${item.id}`),
        ...visibleLeadActivities.map((item) => `activity:${item.id}`),
        ...visibleCustomers.flatMap((customer) =>
          getCanonicalCustomerActivities(customer).map(
            (activity) => `activity:${activity.id}`,
          ),
        ),
        ...visibleContracts.map((item) => `contract:${item.id}`),
        ...visibleOrders.map((item) => `order:${item.id}`),
        ...visiblePayments.map((item) => `payment:${item.id}`),
        ...visibleRenewals.map((item) => `renewal:${item.id}`),
        ...visibleCustomers.flatMap((customer) =>
          (customer.documents ?? [])
            .filter(
              (document) =>
                !document.archivedAt &&
                (!document.projectId ||
                  visibleProjectIds.has(document.projectId)),
            )
            .map((document) => `document:${document.id}`),
        ),
      ]),
    [
      visibleContracts,
      visibleCustomers,
      visibleLeadActivities,
      visibleLeads,
      visibleOrders,
      visiblePayments,
      visibleProjectIds,
      visibleProjects,
      visibleRenewals,
    ],
  );
  const canAccessRecord = useCallback(
    (recordType: CollaborationRecordType, recordId: string) =>
      visibleRecordKeys.has(`${recordType}:${recordId}`),
    [visibleRecordKeys],
  );
  const visibleAuditEvents = useMemo(
    () =>
      auditEvents
        .filter((event) =>
          visibleRecordKeys.has(`${event.recordType}:${event.recordId}`),
        )
        .map((event) =>
          event.sensitive && !identity.hasCapability("canViewCommercialValues")
            ? { ...event, previousValue: "Riservato", nextValue: "Riservato" }
            : event,
        ),
    [auditEvents, identity, visibleRecordKeys],
  );
  const visibleComments = useMemo(
    () =>
      comments.filter((comment) =>
        visibleRecordKeys.has(`${comment.recordType}:${comment.recordId}`),
      ),
    [comments, visibleRecordKeys],
  );
  const visiblePointLedger = useMemo(() => {
    if (identity.currentUser.roles.includes("administrator"))
      return pointLedger;
    const visiblePeople = new Set([
      identity.currentUser.id,
      ...visibleProjects.flatMap((project) => [
        project.ownerId,
        ...project.memberIds,
        ...(project.supervisorIds ?? []),
      ]),
    ]);
    return pointLedger.filter(
      (entry) =>
        entry.userId === identity.currentUser.id ||
        (identity.hasCapability("canApproveProjectWork") &&
          visiblePeople.has(entry.userId)),
    );
  }, [identity, pointLedger, visibleProjects]);
  const archivedRecords = useMemo<ArchivedRecord[]>(() => {
    if (!identity.hasCapability("canManageArchive")) return [];
    return [
      ...leads
        .filter((item) => item.archivedAt)
        .map((item): ArchivedRecord => ({
          id: item.id,
          type: "lead",
          label: `${item.firstName} ${item.lastName} · ${item.company}`,
          archivedAt: item.archivedAt!,
          archivedBy: item.archivedBy,
          reason: item.archivedReason,
          mergedIntoId: item.mergedIntoId,
          primaryHref: item.mergedIntoId
            ? `/dashboard/commercial/leads/${item.mergedIntoId}`
            : undefined,
          restorable: !item.mergedIntoId,
        })),
      ...customers
        .filter((item) => item.archivedAt)
        .map((item): ArchivedRecord => ({
          id: item.id,
          type: "customer",
          label: item.profile.company,
          archivedAt: item.archivedAt!,
          mergedIntoId: item.mergedIntoId,
          primaryHref: item.mergedIntoId
            ? `/dashboard/clienti/${item.mergedIntoId}`
            : undefined,
          restorable: !item.mergedIntoId,
        })),
      ...leadActivities
        .filter((item) => item.archivedAt)
        .map((item): ArchivedRecord => ({
          id: item.id,
          type: "activity",
          label: item.title,
          archivedAt: item.archivedAt!,
          restorable: true,
        })),
      ...customers.flatMap((customer) =>
        [
          ...(customer.activities ?? []),
          ...(customer.onboardingActivity ? [customer.onboardingActivity] : []),
        ]
          .filter((item) => item.archivedAt)
          .map((item): ArchivedRecord => ({
            id: item.id,
            type: "activity",
            label: `${item.title} · ${customer.profile.company}`,
            archivedAt: item.archivedAt!,
            restorable: true,
          })),
      ),
      ...projects
        .filter((item) => item.archivedAt || item.status === "archived")
        .map((item): ArchivedRecord => ({
          id: item.id,
          type: "project",
          label: item.name,
          archivedAt: item.archivedAt ?? item.updatedAt,
          restorable: true,
        })),
      ...customers.flatMap((customer) =>
        (customer.contacts ?? [])
          .filter((item) => item.archivedAt)
          .map((item): ArchivedRecord => ({
            id: item.id,
            type: "contact",
            label: `${item.name} · ${customer.profile.company}`,
            archivedAt: item.archivedAt!,
            mergedIntoId: item.mergedIntoId,
            restorable: !item.mergedIntoId,
          })),
      ),
      ...contracts
        .filter((item) => item.archivedAt)
        .map((item): ArchivedRecord => ({
          id: item.id,
          type: "contract",
          label: item.code,
          archivedAt: item.archivedAt!,
          restorable: true,
        })),
      ...customers.flatMap((customer) =>
        (customer.documents ?? [])
          .filter((item) => item.archivedAt)
          .map((item): ArchivedRecord => ({
            id: item.id,
            type: "document",
            label: `${item.name} · ${customer.profile.company}`,
            archivedAt: item.archivedAt!,
            restorable: true,
          })),
      ),
      ...orders
        .filter((item) => item.archivedAt)
        .map((item): ArchivedRecord => ({
          id: item.id,
          type: "order",
          label: item.code,
          archivedAt: item.archivedAt!,
          restorable: true,
        })),
      ...services
        .filter((item) => item.archivedAt)
        .map((item): ArchivedRecord => ({
          id: item.id,
          type: "service",
          label: item.name,
          archivedAt: item.archivedAt!,
          restorable: true,
        })),
    ].sort((left, right) => right.archivedAt.localeCompare(left.archivedAt));
  }, [
    contracts,
    customers,
    identity,
    leadActivities,
    leads,
    orders,
    projects,
    services,
  ]);

  const appendAuditChanges = useCallback(
    (
      recordType: CollaborationRecordType,
      recordId: string,
      before: object,
      updates: object,
      origin: CommercialAuditOrigin = "manual",
      reason?: string,
      sensitiveFields: string[] = [],
    ) => {
      // Audit, History and point movements are emitted by the backend transaction/outbox.
      // This compatibility callback intentionally keeps no client-side authority.
      void recordType; void recordId; void before; void updates; void origin; void reason; void sensitiveFields;
      return [];
    },
    [],
  );

  const applyDeliveryWorkspace = useCallback(
    (workspace: DeliveryWorkspace) => {
      const project = mapDeliveryProject(workspace);
      const tasks = workspace.tasks.map(mapDeliveryTask);
      const timers = workspace.timers.map(mapDeliveryTimer);

      setProjects((items) =>
        items.some((item) => item.id === project.id)
          ? items.map((item) => (item.id === project.id ? project : item))
          : [...items, project],
      );
      setCustomers((items) =>
        items.map((customer) =>
          customer.id !== project.clientId
            ? customer
            : {
                ...customer,
                activities: [
                  ...(customer.activities ?? []).filter(
                    (activity) =>
                      activity.projectId !== project.id &&
                      !project.activityIds.includes(activity.id),
                  ),
                  ...tasks,
                ],
              },
        ),
      );
      setTimeSessions((items) => [
        ...items.filter((session) => session.projectId !== project.id),
        ...timers,
      ]);
      return project;
    },
    [setCustomers, setProjects],
  );

  const reloadDeliveryProject = useCallback(
    async (projectId: string) =>
      applyDeliveryWorkspace(await deliveryApi.workspace(projectId)),
    [applyDeliveryWorkspace],
  );

  const reloadCommerceState = useCallback(async () => {
    const state = await commerceApi.state();
    setServices(state.services);
    setSales(state.sales);
    setOrders(state.orders);
    setPayments(state.payments);
    return state;
  }, []);

  const reloadDocumentRevenueState = useCallback(async () => {
    const state = await documentRevenueApi.state();
    setQuotes(state.quotes);
    setContracts(state.contracts);
    setInvoices(state.invoices);
    setRenewals(state.renewals);
    return state;
  }, []);

  const value = useMemo<CommercialLeadsStore>(
    () => ({
      leads: visibleLeads,
      leadActivities: visibleLeadActivities,
      customers: visibleCustomers,
      projects: visibleProjects,
      allLeads: leads,
      allCustomers: customers,
      allProjects: projects,
      timelineEvents: visibleTimelineEvents,
      goals,
      appointments: visibleAppointments,
      rankingConfigs,
      rankingSnapshots: visibleRankingSnapshots,
      services: visibleServices,
      sales: visibleSales,
      orders: visibleOrders,
      payments: visiblePayments,
      contracts: visibleContracts,
      renewals: visibleRenewals,
      campaigns: visibleCampaigns,
      quotes: visibleQuotes,
      invoices: visibleInvoices,
      automationRules: visibleAutomationRules,
      automationRuns: visibleAutomationRuns,
      automationNotifications: visibleAutomationNotifications,
      commerceSettings,
      timeSessions: visibleTimeSessions,
      order: visibleOrder,
      auditEvents: visibleAuditEvents,
      comments: visibleComments,
      pointLedger: visiblePointLedger,
      pointPolicy,
      ignoredDuplicatePairs,
      duplicatesLastAnalyzedAt,
      archivedRecords,
      async restoreArchivedRecord(type, id) {
        if (!identity.hasCapability("canManageArchive")) return false;
        const record = archivedRecords.find(
          (item) => item.type === type && item.id === id,
        );
        if (!record?.restorable) return false;
        if (["lead", "customer", "contact", "activity"].includes(type)) {
          const version =
            type === "lead"
              ? leads.find((item) => item.id === id)?.version
              : type === "customer"
                ? customers.find((item) => item.id === id)?.version
                : type === "activity"
                  ? (leadActivities.find((item) => item.id === id)?.version ??
                    customers
                      .flatMap((item) => getCanonicalCustomerActivities(item))
                      .find((item) => item.id === id)?.version)
                  : customers
                      .flatMap((item) => item.contacts ?? [])
                      .find((item) => item.id === id)?.version;
          if (!version) return false;
          try {
            const response = await commercialApi.restore(
              type as "lead" | "customer" | "contact" | "activity",
              id,
              version,
            );
            const nextVersion = response.item.version;
            if (type === "lead") {
              const lead = leads.find((item) => item.id === id);
              setLeads((items) =>
                items.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        version: nextVersion,
                        archivedAt: undefined,
                        archivedBy: undefined,
                        archivedReason: undefined,
                      }
                    : item,
                ),
              );
              if (lead)
                setOrder((current) => ({
                  ...current,
                  [lead.stage]: Array.from(
                    new Set([...(current[lead.stage] ?? []), id]),
                  ),
                }));
            } else if (type === "customer") {
              setCustomers((items) =>
                items.map((item) =>
                  item.id === id
                    ? { ...item, version: nextVersion, archivedAt: undefined }
                    : item,
                ),
              );
            } else if (type === "activity") {
              setLeadActivities((items) =>
                items.map((item) =>
                  item.id === id
                    ? { ...item, version: nextVersion, archivedAt: undefined }
                    : item,
                ),
              );
              setCustomers((items) =>
                items.map((item) => ({
                  ...item,
                  activities: item.activities?.map((activity) =>
                    activity.id === id
                      ? {
                          ...activity,
                          version: nextVersion,
                          archivedAt: undefined,
                        }
                      : activity,
                  ),
                })),
              );
            } else {
              setCustomers((items) =>
                items.map((item) => ({
                  ...item,
                  contacts: item.contacts?.map((contact) =>
                    contact.id === id
                      ? {
                          ...contact,
                          version: nextVersion,
                          archivedAt: undefined,
                        }
                      : contact,
                  ),
                })),
              );
            }
            return true;
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Ripristino non riuscito",
            );
            return false;
          }
        }
        if (type === "service") {
          try {
            const restored = await commerceApi.restoreService(id);
            setServices((items) =>
              items.map((item) => (item.id === id ? restored : item)),
            );
            return true;
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Ripristino servizio non riuscito",
            );
            return false;
          }
        }
        const now = new Date().toISOString();
        let leadId = "";
        if (type === "lead") {
          const lead = leads.find(
            (item) => item.id === id && item.archivedAt && !item.mergedIntoId,
          );
          if (!lead) return false;
          leadId = lead.id;
          setLeads((items) =>
            items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    archivedAt: undefined,
                    archivedBy: undefined,
                    archivedReason: undefined,
                  }
                : item,
            ),
          );
          setOrder((current) => ({
            ...current,
            [lead.stage]: Array.from(
              new Set([...(current[lead.stage] ?? []), id]),
            ),
          }));
        } else if (type === "customer") {
          const customer = customers.find(
            (item) => item.id === id && item.archivedAt && !item.mergedIntoId,
          );
          if (!customer) return false;
          leadId = customer.sourceLeadId;
          setCustomers((items) =>
            items.map((item) =>
              item.id === id ? { ...item, archivedAt: undefined } : item,
            ),
          );
        } else if (type === "project") {
          const project = projects.find(
            (item) =>
              item.id === id && (item.archivedAt || item.status === "archived"),
          );
          if (!project) return false;
          leadId =
            project.sourceLeadId ??
            customers.find((item) => item.id === project.clientId)
              ?.sourceLeadId ??
            "";
          setProjects((items) =>
            items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    archivedAt: undefined,
                    status: "not_started",
                    updatedAt: now,
                  }
                : item,
            ),
          );
        } else if (type === "contract") {
          // Contract restoration has no Phase 3B server transition yet; never
          // simulate it in the browser.
          return false;
        } else if (type === "order") {
          const commercialOrder = orders.find(
            (item) => item.id === id && item.archivedAt,
          );
          if (!commercialOrder) return false;
          try {
            const restored = await commerceApi.restoreOrder(id);
            setOrders((items) =>
              items.map((item) => (item.id === id ? restored : item)),
            );
            return true;
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Ripristino ordine non riuscito",
            );
            return false;
          }
        } else if (type === "activity") {
          const leadActivity = leadActivities.find(
            (item) => item.id === id && item.archivedAt,
          );
          if (leadActivity) {
            leadId = leadActivity.leadId ?? "";
            setLeadActivities((items) =>
              items.map((item) =>
                item.id === id
                  ? { ...item, archivedAt: undefined, updatedAt: now }
                  : item,
              ),
            );
          } else {
            const customer = customers.find((item) =>
              [
                ...(item.activities ?? []),
                ...(item.onboardingActivity ? [item.onboardingActivity] : []),
              ].some((activity) => activity.id === id && activity.archivedAt),
            );
            if (!customer) return false;
            leadId = customer.sourceLeadId;
            setCustomers((items) =>
              items.map((item) =>
                item.id !== customer.id
                  ? item
                  : {
                      ...item,
                      activities: item.activities?.map((activity) =>
                        activity.id === id
                          ? {
                              ...activity,
                              archivedAt: undefined,
                              updatedAt: now,
                            }
                          : activity,
                      ),
                      onboardingActivity:
                        item.onboardingActivity?.id === id
                          ? {
                              ...item.onboardingActivity,
                              archivedAt: undefined,
                              updatedAt: now,
                            }
                          : item.onboardingActivity,
                    },
              ),
            );
          }
        } else if (type === "contact" || type === "document") {
          const customer = customers.find((item) =>
            type === "contact"
              ? item.contacts?.some(
                  (entry) =>
                    entry.id === id && entry.archivedAt && !entry.mergedIntoId,
                )
              : item.documents?.some(
                  (entry) => entry.id === id && entry.archivedAt,
                ),
          );
          if (!customer) return false;
          leadId = customer.sourceLeadId;
          setCustomers((items) =>
            items.map((item) =>
              item.id !== customer.id
                ? item
                : type === "contact"
                  ? {
                      ...item,
                      contacts: item.contacts?.map((entry) =>
                        entry.id === id
                          ? { ...entry, archivedAt: undefined }
                          : entry,
                      ),
                    }
                  : {
                      ...item,
                      documents: item.documents?.map((entry) =>
                        entry.id === id
                          ? { ...entry, archivedAt: undefined, updatedAt: now }
                          : entry,
                      ),
                    },
            ),
          );
        } else return false;
        setTimelineEvents((items) => [
          {
            id: `archive-restored:${type}:${id}`,
            leadId,
            kind: "status",
            title: "Record ripristinato",
            detail: `${record.label} è tornato nelle viste operative.`,
            date: now,
            author: identity.currentUser.name,
          },
          ...items.filter(
            (event) => event.id !== `archive-restored:${type}:${id}`,
          ),
        ]);
        return true;
      },
      ignoreDuplicatePair(leftId, rightId) {
        if (!identity.hasCapability("canMergeDuplicates")) return;
        void commercialApi
          .decideDuplicate(leftId, rightId, "ignored")
          .then(({ pairKey }) => {
            setIgnoredDuplicatePairs((items) =>
              items.includes(pairKey) ? items : [...items, pairKey],
            );
          })
          .catch((error) =>
            toast.error(
              error instanceof Error
                ? error.message
                : "Decisione duplicato non salvata",
            ),
          );
      },
      restoreDuplicatePair(leftId, rightId) {
        if (!identity.hasCapability("canMergeDuplicates")) return;
        const pair = [leftId, rightId].sort().join("::");
        void commercialApi
          .decideDuplicate(leftId, rightId, "pending")
          .then(() => {
            setIgnoredDuplicatePairs((items) =>
              items.filter((item) => item !== pair),
            );
          })
          .catch((error) =>
            toast.error(
              error instanceof Error
                ? error.message
                : "Decisione duplicato non salvata",
            ),
          );
      },
      markDuplicatesAnalyzed() {
        void commercialApi
          .duplicateGroups()
          .then((result) => setDuplicatesLastAnalyzedAt(result.analyzedAt))
          .catch((error) =>
            toast.error(
              error instanceof Error
                ? error.message
                : "Analisi duplicati non riuscita",
            ),
          );
      },
      recordAuditEvent(input) {
        // Audit tecnico e Timeline sono prodotti esclusivamente dai servizi backend.
        // Il composition layer non sintetizza più eventi autorevoli nel browser.
        void input;
        return null;
      },
      async loadComments(recordType, recordId) {
        if (!canAccessRecord(recordType, recordId)) return;
        const params = new URLSearchParams({ recordType, recordId });
        const [page, auditPage] = await Promise.all([
          apiFetch<ServerList<Record<string, unknown> & { id: string }>>(
            `/tenant/doflow/collaboration/comments?${params.toString()}`,
          ),
          apiFetch<ServerList<Record<string, unknown> & { id: string }>>(
            `/tenant/doflow/collaboration/audit?${params.toString()}`,
          ),
        ]);
        const hydrated = page.items.map(serverComment);
        setComments((items) => [
          ...items.filter(
            (item) =>
              item.recordType !== recordType || item.recordId !== recordId,
          ),
          ...hydrated,
        ]);
        const audits = auditPage.items.map((event) => {
          const metadata =
            event.metadata &&
            typeof event.metadata === "object" &&
            !Array.isArray(event.metadata)
              ? (event.metadata as Record<string, unknown>)
              : {};
          const actor = identity.users.find(
            (user) =>
              user.email.toLowerCase() ===
              textValue(event.actor_email).toLowerCase(),
          );
          const rawOrigin = textValue(metadata.origin);
          const origin = ["manual", "kanban", "automation", "merge"].includes(
            rawOrigin,
          )
            ? (rawOrigin as CommercialAuditEvent["origin"])
            : "system";
          return {
            id: event.id,
            recordType,
            recordId,
            action: textValue(event.action),
            field: textValue(metadata.field) || undefined,
            previousValue:
              textValue(metadata.previousValue || metadata.previous_value) ||
              undefined,
            nextValue:
              textValue(
                metadata.nextValue ||
                  metadata.next_value ||
                  metadata.new_status ||
                  metadata.new_stage,
              ) || undefined,
            origin,
            reason: textValue(metadata.reason) || undefined,
            relatedRecords: [],
            authorId: actor?.id || "system",
            authorName:
              actor?.name || textValue(event.actor_email) || "Sistema",
            authorAvatarUrl: actor?.avatarUrl,
            createdAt: dateValue(event.created_at),
          } satisfies CommercialAuditEvent;
        });
        setAuditEvents((items) => [
          ...items.filter(
            (item) =>
              item.recordType !== recordType || item.recordId !== recordId,
          ),
          ...audits,
        ]);
      },
      async addComment(input) {
        const text = input.text.trim();
        if (
          !text ||
          !canAccessRecord(input.recordType, input.recordId) ||
          (input.parentCommentId &&
            !comments.some(
              (comment) =>
                comment.id === input.parentCommentId &&
                comment.recordType === input.recordType &&
                comment.recordId === input.recordId,
            ))
        )
          return null;
        const attachments = (input.attachments ?? []).filter(
          (attachment) =>
            attachment.name.trim() &&
            attachment.size >= 0 &&
            attachment.size <= 5_000_000 &&
            !attachment.reference?.startsWith("data:") &&
            !attachment.reference?.startsWith("blob:"),
        );
        const mentionUserIds = Array.from(
          new Set(input.mentionUserIds ?? []),
        ).filter((id) => identity.users.some((user) => user.id === id));
        try {
          const saved = serverComment(
            await collaborationApi.create({
              recordType: input.recordType,
              recordId: input.recordId,
              text,
              parentCommentId: input.parentCommentId,
              mentionUserIds,
              attachments: attachments.map((attachment) => ({
                reference: attachment.reference,
              })),
            }),
          );
          setComments((items) => [
            ...items.filter((item) => item.id !== saved.id),
            saved,
          ]);
          return saved.id;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile pubblicare il commento",
          );
          return null;
        }
      },
      async updateComment(commentId, text, mentionUserIds = []) {
        const comment = comments.find((item) => item.id === commentId);
        const value = text.trim();
        if (
          !comment ||
          comment.deletedAt ||
          (comment.authorId !== identity.currentUser.id &&
            !identity.currentUser.roles.includes("administrator")) ||
          !value ||
          !canAccessRecord(comment.recordType, comment.recordId) ||
          (comment.text === value &&
            JSON.stringify(comment.mentionUserIds) ===
              JSON.stringify(mentionUserIds))
        )
          return false;
        const nextMentionUserIds = Array.from(new Set(mentionUserIds)).filter(
          (id) => identity.users.some((user) => user.id === id),
        );
        try {
          const saved = serverComment(
            await collaborationApi.update(commentId, {
              text: value,
              mentionUserIds: nextMentionUserIds,
              expectedVersion: comment.optimisticVersion,
            }),
          );
          setComments((items) =>
            items.map((item) => (item.id === commentId ? saved : item)),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare il commento",
          );
          return false;
        }
      },
      async deleteComment(commentId) {
        const comment = comments.find((item) => item.id === commentId);
        if (
          !comment ||
          comment.deletedAt ||
          (comment.authorId !== identity.currentUser.id &&
            !identity.currentUser.roles.includes("administrator")) ||
          !canAccessRecord(comment.recordType, comment.recordId)
        )
          return false;
        try {
          const saved = serverComment(
            await collaborationApi.remove(commentId, {
              expectedVersion: comment.optimisticVersion,
            }),
          );
          setComments((items) =>
            items.map((item) => (item.id === commentId ? saved : item)),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile eliminare il commento",
          );
          return false;
        }
      },
      async resolveComment(commentId, resolved) {
        const comment = comments.find((item) => item.id === commentId);
        if (
          !comment ||
          comment.deletedAt ||
          !canAccessRecord(comment.recordType, comment.recordId)
        )
          return false;
        try {
          const saved = serverComment(
            await collaborationApi.resolve(commentId, {
              resolved,
              expectedVersion: comment.optimisticVersion,
            }),
          );
          setComments((items) =>
            items.map((item) => (item.id === commentId ? saved : item)),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare la conversazione",
          );
          return false;
        }
      },
      async toggleCommentReaction(commentId, emoji) {
        const comment = comments.find((item) => item.id === commentId);
        if (
          !comment ||
          comment.deletedAt ||
          !emoji.trim() ||
          emoji.length > 12 ||
          !canAccessRecord(comment.recordType, comment.recordId)
        )
          return false;
        try {
          const saved = serverComment(
            await collaborationApi.reaction(commentId, emoji),
          );
          setComments((items) =>
            items.map((item) => (item.id === commentId ? saved : item)),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare la reazione",
          );
          return false;
        }
      },
      async addPointEntry(input) {
        const allowed =
          identity.currentUser.roles.includes("administrator") ||
          identity.hasCapability("canApproveProjectWork");
        if (
          !allowed ||
          !Number.isFinite(input.points) ||
          !input.reason.trim() ||
          !canAccessRecord(input.recordType, input.recordId)
        )
          return null;
        try {
          const saved = await performanceApi.adjustPoints(
            { userId: input.userId, amount: input.points, reason: input.reason },
            input.sourceEventId,
          );
          setPointLedger((items) => items.some((item) => item.id === saved.id) ? items : [saved, ...items]);
          return saved.id;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Impossibile registrare i punti");
          return null;
        }
      },
      async updatePointPolicy(updates, reason = "Aggiornamento policy punti") {
        if (
          !identity.currentUser.roles.includes("administrator") ||
          !Object.values(updates).every(
            (value) =>
              typeof value === "number" &&
              Number.isFinite(value) &&
              Math.abs(value) <= 10_000,
          ) ||
          !hasMeaningfulChanges(pointPolicy, updates)
        )
          return false;
        try {
          const saved = await performanceApi.updatePolicy({ ...pointPolicy, ...updates }, reason);
          setPointPolicy(saved.pointPolicy);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare la policy punti",
          );
          return false;
        }
      },
      addCampaign(input) {
        if (
          !identity.currentUser.roles.includes("administrator") ||
          !input.name.trim() ||
          !input.account.trim() ||
          [input.spend, input.impressions, input.clicks].some(
            (value) => !Number.isFinite(value) || value < 0,
          ) ||
          input.clicks > input.impressions
        )
          return null;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const record = {
          ...input,
          id,
          name: input.name.trim(),
          account: input.account.trim(),
          createdAt: now,
          updatedAt: now,
        };
        setCampaigns((items) => [...items, record]);
        void apiFetch(`/tenant/doflow/commerce/campaigns`, {
          method: "POST",
          body: JSON.stringify(record),
        }).catch((error) => {
          setCampaigns((items) => items.filter((item) => item.id !== id));
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile creare la campagna",
          );
        });
        return id;
      },
      updateCampaign(campaignId, updates) {
        const campaign = campaigns.find((item) => item.id === campaignId);
        if (
          !identity.currentUser.roles.includes("administrator") ||
          !campaign ||
          (updates.name !== undefined && !updates.name.trim()) ||
          (updates.account !== undefined && !updates.account.trim()) ||
          [updates.spend, updates.impressions, updates.clicks].some(
            (value) =>
              value !== undefined && (!Number.isFinite(value) || value < 0),
          ) ||
          (updates.clicks ?? campaign.clicks) >
            (updates.impressions ?? campaign.impressions) ||
          !hasMeaningfulChanges(campaign, updates)
        )
          return false;
        setCampaigns((items) =>
          items.map((item) =>
            item.id === campaignId
              ? {
                  ...item,
                  ...updates,
                  id: item.id,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
        void apiFetch(`/tenant/doflow/commerce/campaigns/${campaignId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        }).catch((error) => {
          setCampaigns((items) =>
            items.map((item) => (item.id === campaignId ? campaign : item)),
          );
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare la campagna",
          );
        });
        return true;
      },
      archiveCampaign(campaignId) {
        const campaign = campaigns.find((item) => item.id === campaignId);
        if (
          !identity.currentUser.roles.includes("administrator") ||
          !campaign ||
          campaign.archivedAt
        )
          return false;
        const now = new Date().toISOString();
        setCampaigns((items) =>
          items.map((item) =>
            item.id === campaignId
              ? { ...item, status: "archived", archivedAt: now, updatedAt: now }
              : item,
          ),
        );
        void apiFetch(`/tenant/doflow/commerce/campaigns/${campaignId}`, {
          method: "DELETE",
        }).catch((error) => {
          setCampaigns((items) =>
            items.map((item) => (item.id === campaignId ? campaign : item)),
          );
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile archiviare la campagna",
          );
        });
        return true;
      },
      async addQuote(input) {
        const lead = input.leadId
          ? leads.find((item) => item.id === input.leadId)
          : undefined;
        const customer = input.customerId
          ? customers.find((item) => item.id === input.customerId)
          : undefined;
        if (
          !identity.hasCapability("canManageOwnQuotes") ||
          !input.lines.length ||
          (!lead && !customer) ||
          input.lines.some((line) => !line.serviceId || line.quantity <= 0)
        )
          return null;
        try {
          const result = await documentRevenueApi.createQuote({
            customerId: customer?.id,
            leadId: lead?.id,
            opportunityId: lead?.id,
            title:
              lead?.opportunityName ||
              lead?.company ||
              customer?.profile.opportunityName ||
              customer?.profile.company,
            validUntil: input.validUntil,
            conditions: input.conditions,
            notes: input.notes,
            lines: input.lines.map((line) => ({
              serviceId: line.serviceId,
              quantity: line.quantity,
              discount: line.discount,
            })),
          });
          await reloadDocumentRevenueState();
          return result.id;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile creare il preventivo",
          );
          return null;
        }
      },
      async updateQuote(quoteId, updates) {
        const quote = quotes.find((item) => item.id === quoteId);
        if (
          !quote ||
          !identity.hasCapability("canManageOwnQuotes") ||
          (!identity.currentUser.roles.includes("administrator") &&
            quote.salespersonId !== identity.currentUser.id) ||
          quote.replacedById ||
          updates.lines !== undefined ||
          updates.discount !== undefined ||
          updates.vatRate !== undefined ||
          !hasMeaningfulChanges(quote, updates)
        )
          return false;
        try {
          await documentRevenueApi.updateQuote(quoteId, {
            version: quote.recordVersion,
            status: updates.status,
            validUntil: updates.validUntil,
            conditions: updates.conditions,
            notes: updates.notes,
          });
          await reloadDocumentRevenueState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare il preventivo",
          );
          return false;
        }
      },
      async createQuoteVersion(quoteId) {
        const quote = quotes.find((item) => item.id === quoteId);
        if (
          !quote ||
          !identity.hasCapability("canManageOwnQuotes") ||
          (!identity.currentUser.roles.includes("administrator") &&
            quote.salespersonId !== identity.currentUser.id)
        )
          return {
            ok: false,
            message: "Preventivo non trovato o operazione non autorizzata.",
          };
        if (quote.replacedById)
          return { ok: true as const, id: quote.replacedById, existing: true };
        try {
          const result = await documentRevenueApi.quoteVersion(quoteId);
          await reloadDocumentRevenueState();
          return {
            ok: true as const,
            id: result.id,
            existing: result.existing,
          };
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile creare la nuova versione",
          );
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Impossibile creare la nuova versione",
          };
        }
      },
      async addInvoice(input) {
        const order = orders.find(
          (item) => item.id === input.orderId && !item.archivedAt,
        );
        if (
          !identity.hasCapability("canManageInvoices") ||
          !order ||
          order.customerId !== input.customerId ||
          input.kind !== "invoice"
        )
          return null;
        try {
          const result = await documentRevenueApi.createInvoice({
            orderId: order.id,
            dueAt: input.dueAt,
            notes: input.notes,
          });
          await reloadDocumentRevenueState();
          return result.id;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile creare la fattura locale",
          );
          return null;
        }
      },
      async updateInvoice(invoiceId, updates) {
        const invoice = invoices.find((item) => item.id === invoiceId);
        if (
          !identity.hasCapability("canManageInvoices") ||
          !invoice ||
          invoice.archivedAt ||
          !updates.status ||
          !hasMeaningfulChanges(invoice, updates)
        )
          return false;
        try {
          await documentRevenueApi.transitionInvoice(invoiceId, updates.status);
          await reloadDocumentRevenueState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare la fattura",
          );
          return false;
        }
      },
      async createCreditNote(invoiceId, amount, notes) {
        const invoice = invoices.find(
          (item) =>
            item.id === invoiceId &&
            item.kind === "invoice" &&
            !item.archivedAt,
        );
        if (
          !identity.hasCapability("canManageInvoices") ||
          !invoice ||
          !Number.isFinite(amount) ||
          amount <= 0 ||
          !notes.trim()
        )
          return {
            ok: false,
            message: "Importo e motivazione sono obbligatori.",
          };
        try {
          const result = await documentRevenueApi.creditNote(
            invoiceId,
            amount,
            notes.trim(),
          );
          await reloadDocumentRevenueState();
          return { ok: true as const, id: result.id };
        } catch (error) {
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Nota di credito non creata.",
          };
        }
      },
      async addAutomationRule(input) {
        if (
          !identity.hasCapability("canManageAutomations") ||
          !input.name.trim() ||
          !input.recipientId ||
          !identity.users.some((user) => user.id === input.recipientId) ||
          !input.message.trim()
        )
          return null;
        try {
          const saved = await automationsApi.createRule(automationApiBody(input));
          const createdAt = dateValue(saved.created_at);
          setAutomationRules((items) => [...items, {
            ...input,
            id: saved.id,
            name: input.name.trim(),
            message: input.message.trim(),
            createdAt,
            updatedAt: dateValue(saved.updated_at, createdAt),
          }]);
          return saved.id;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Impossibile creare l’automazione");
          return null;
        }
      },
      async updateAutomationRule(ruleId, updates) {
        const rule = automationRules.find((item) => item.id === ruleId);
        if (
          !identity.hasCapability("canManageAutomations") ||
          !rule ||
          (updates.recipientId &&
            !identity.users.some((user) => user.id === updates.recipientId)) ||
          !hasMeaningfulChanges(rule, updates)
        )
          return false;
        try {
          const persist = [automationsApi.updateRule(ruleId, automationApiBody({ ...updates, optimisticVersion: rule.optimisticVersion || 1 }))];
          if (updates.enabled !== undefined) persist.push(updates.enabled ? automationsApi.enableRule(ruleId) : automationsApi.disableRule(ruleId));
          const [saved] = await Promise.all(persist);
          setAutomationRules((items) =>
            items.map((item) => item.id === ruleId ? {
              ...item,
              ...updates,
              id: item.id,
              optimisticVersion: numericValue(saved.optimistic_version) || item.optimisticVersion,
              updatedAt: dateValue(saved.updated_at, item.updatedAt),
            } : item),
          );
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Impossibile aggiornare l’automazione");
          return false;
        }
      },
      async runAutomationRule(ruleId, retryOfId) {
        const rule = automationRules.find(
          (item) => item.id === ruleId && !item.archivedAt,
        );
        if (!identity.hasCapability("canManageAutomations") || !rule)
          return {
            ok: false,
            message: "Automazione non trovata o operazione non autorizzata.",
          };
        const minute = new Date().toISOString().slice(0, 16);
        const executionKey = retryOfId
          ? `retry:${retryOfId}:${minute}`
          : `manual:${rule.id}:${minute}`;
        const existing = automationRuns.find(
          (run) => run.executionKey === executionKey,
        );
        if (existing) return { ok: true, runId: existing.id, existing: true };
        try {
          const server = await automationsApi.runRule(rule.id, {
            retry_of_id: retryOfId,
            execution_key: executionKey,
          });
          const run = server as Partial<ServerAutomationRun>;
          const runId = textValue(run.id);
          setAutomationRuns((items) => [{
            id: runId,
            ruleId: rule.id,
            executionKey,
            status: "skipped",
            startedAt: dateValue(run.started_at),
            completedAt: dateValue(run.finished_at, dateValue(run.started_at)),
            output: "Esecuzione accodata dal backend.",
            retryOfId,
          }, ...items]);
          return { ok: true as const, runId, existing: false };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Esecuzione automazione non riuscita";
          toast.error(message);
          return { ok: false as const, message };
        }
      },
      async addGoal(goal) {
        if (!identity.hasCapability("canManageRoles")) return null;
        try {
          const saved = await apiFetch<Record<string, unknown>>("/tenant/doflow/goals", { method: "POST", body: JSON.stringify(goal) });
          const createdAt = dateValue(saved.created_at);
          setGoals((items) => [...items, { ...goal, id: textValue(saved.id), createdAt, updatedAt: dateValue(saved.updated_at, createdAt) }]);
          return textValue(saved.id);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Impossibile creare l’obiettivo");
          return null;
        }
      },
      async updateGoal(goalId, updates) {
        const current = goals.find((goal) => goal.id === goalId);
        if (!identity.hasCapability("canManageRoles") || !current) return false;
        try {
          const saved = await apiFetch<Record<string, unknown>>(`/tenant/doflow/goals/${goalId}`, { method: "PATCH", body: JSON.stringify(updates) });
          setGoals((items) => items.map((item) => item.id === goalId ? { ...item, ...updates, id: item.id, updatedAt: dateValue(saved.updated_at, item.updatedAt) } : item));
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Impossibile aggiornare l’obiettivo");
          return false;
        }
      },
      async archiveGoal(goalId) {
        const current = goals.find((goal) => goal.id === goalId);
        if (!identity.hasCapability("canManageRoles") || !current) return false;
        try {
          const saved = await apiFetch<Record<string, unknown>>(`/tenant/doflow/goals/${goalId}/archive`, { method: "PATCH" });
          setGoals((items) => items.map((item) => item.id === goalId ? { ...item, status: "archived", updatedAt: dateValue(saved.updated_at, item.updatedAt) } : item));
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Impossibile archiviare l’obiettivo");
          return false;
        }
      },
      addAppointment(appointment) {
        const lead = leads.find((item) => item.id === appointment.leadId);
        if (!lead || !canEditLead(identity.currentUser, lead)) return null;
        const now = new Date().toISOString();
        const id = `optimistic:${crypto.randomUUID()}`;
        const assigneeId = identity.hasCapability("canAssignLeads")
          ? appointment.assigneeId
          : identity.currentUser.id;
        const record = {
          ...appointment,
          assigneeId,
          id,
          createdAt: now,
          updatedAt: now,
        };
        setAppointments((items) => [...items, record]);
        const customer = customers.find(
          (item) =>
            item.id === appointment.customerId || item.sourceLeadId === lead.id,
        );
        void commercialApi
          .createActivity({
            company_id: customer?.id || null,
            opportunity_id: lead.id,
            type: "appointment",
            title: record.title,
            description: record.notes || null,
            due_at: record.startsAt,
            completed_at: record.status === "completed" ? now : null,
            assigned_to: assigneeId,
            status:
              record.status === "completed"
                ? "completed"
                : record.status === "cancelled" || record.status === "no_show"
                  ? "cancelled"
                  : "todo",
            metadata: {
              ends_at: record.endsAt,
              appointment_status: record.status,
            },
          })
          .then((saved) => {
            setAppointments((items) =>
              items.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      id: saved.id,
                      activityId: saved.id,
                      version: saved.version,
                      createdAt: dateValue(saved.created_at, item.createdAt),
                      updatedAt: dateValue(saved.updated_at, item.updatedAt),
                    }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setAppointments((items) => items.filter((item) => item.id !== id));
            toast.error(
              error instanceof Error
                ? error.message
                : "Impossibile creare l’appuntamento",
            );
          });
        return id;
      },
      updateAppointment(appointmentId, updates) {
        const appointment = appointments.find(
          (item) => item.id === appointmentId,
        );
        const lead =
          appointment && leads.find((item) => item.id === appointment.leadId);
        if (
          !appointment ||
          !lead ||
          !canEditLead(identity.currentUser, lead) ||
          (updates.leadId && updates.leadId !== appointment.leadId)
        )
          return false;
        const authorizedUpdates = identity.hasCapability("canAssignLeads")
          ? updates
          : { ...updates, assigneeId: appointment.assigneeId };
        const changed = Object.fromEntries(
          Object.entries(authorizedUpdates).filter(
            ([key, value]) =>
              appointment[key as keyof CommercialAppointment] !== value,
          ),
        ) as Partial<CommercialAppointment>;
        if (!Object.keys(changed).length) return false;
        if (!appointment.version) return false;
        const now = new Date().toISOString();
        setAppointments((items) =>
          items.map((item) =>
            item.id === appointmentId
              ? { ...item, ...changed, id: item.id, updatedAt: now }
              : item,
          ),
        );
        if (appointment.activityId && appointment.customerId) {
          const activityStatus =
            changed.status === "completed"
              ? "Completata"
              : changed.status === "cancelled" || changed.status === "no_show"
                ? "Annullata"
                : changed.status === "scheduled"
                  ? "Da fare"
                  : undefined;
          setCustomers((items) =>
            items.map((customer) =>
              customer.id !== appointment.customerId
                ? customer
                : {
                    ...customer,
                    activities: (customer.activities ?? []).map((activity) =>
                      activity.id !== appointment.activityId
                        ? activity
                        : {
                            ...activity,
                            title: changed.title ?? activity.title,
                            dueAt: changed.startsAt ?? activity.dueAt,
                            dueDate:
                              changed.startsAt?.slice(0, 10) ??
                              activity.dueDate,
                            assigneeId:
                              changed.assigneeId ?? activity.assigneeId,
                            status: activityStatus ?? activity.status,
                            completedAt:
                              activityStatus === "Completata"
                                ? now
                                : activityStatus === "Da fare"
                                  ? undefined
                                  : activity.completedAt,
                            updatedAt: now,
                          },
                    ),
                  },
            ),
          );
        }
        const nextStatus = changed.status ?? appointment.status;
        void commercialApi
          .updateActivity(appointment.activityId || appointment.id, {
            version: appointment.version,
            ...(changed.title !== undefined ? { title: changed.title } : {}),
            ...(changed.notes !== undefined
              ? { description: changed.notes || null }
              : {}),
            ...(changed.startsAt !== undefined
              ? { due_at: changed.startsAt }
              : {}),
            ...(changed.assigneeId !== undefined
              ? { assigned_to: changed.assigneeId }
              : {}),
            ...(changed.status !== undefined
              ? {
                  status:
                    nextStatus === "completed"
                      ? "completed"
                      : nextStatus === "cancelled" || nextStatus === "no_show"
                        ? "cancelled"
                        : "todo",
                  completed_at: nextStatus === "completed" ? now : null,
                }
              : {}),
            metadata: {
              ends_at: changed.endsAt ?? appointment.endsAt,
              appointment_status: nextStatus,
            },
          })
          .then((saved) => {
            setAppointments((items) =>
              items.map((item) =>
                item.id === appointmentId
                  ? {
                      ...item,
                      version: saved.version,
                      updatedAt: dateValue(saved.updated_at, item.updatedAt),
                    }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setAppointments((items) =>
              items.map((item) =>
                item.id === appointmentId ? appointment : item,
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Impossibile aggiornare l’appuntamento",
            );
          });
        return true;
      },
      archiveAppointment(appointmentId) {
        const appointment = appointments.find(
          (item) => item.id === appointmentId,
        );
        const lead =
          appointment && leads.find((item) => item.id === appointment.leadId);
        if (!appointment || !lead || !canEditLead(identity.currentUser, lead))
          return false;
        if (!appointment.version) return false;
        setAppointments((items) =>
          items.map((item) =>
            item.id === appointmentId
              ? {
                  ...item,
                  archivedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
        void commercialApi
          .archive(
            "activity",
            appointment.activityId || appointment.id,
            appointment.version,
            "Archiviazione appuntamento commerciale",
          )
          .then((response) => {
            setAppointments((items) =>
              items.map((item) =>
                item.id === appointmentId
                  ? {
                      ...item,
                      version:
                        numericValue(response.item.version) || item.version,
                    }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setAppointments((items) =>
              items.map((item) =>
                item.id === appointmentId ? appointment : item,
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Impossibile archiviare l’appuntamento",
            );
          });
        return true;
      },
      deleteAppointment(appointmentId) {
        const appointment = appointments.find(
          (item) => item.id === appointmentId,
        );
        const lead =
          appointment && leads.find((item) => item.id === appointment.leadId);
        if (!appointment || !lead || !canEditLead(identity.currentUser, lead))
          return false;
        if (!appointment.version) return false;
        const previousAppointments = appointments;
        const previousCustomers = customers;
        setAppointments((items) =>
          items.filter((item) => item.id !== appointmentId),
        );
        if (appointment.activityId && appointment.customerId)
          setCustomers((items) =>
            items.map((customer) =>
              customer.id !== appointment.customerId
                ? customer
                : {
                    ...customer,
                    activities: (customer.activities ?? []).filter(
                      (activity) => activity.id !== appointment.activityId,
                    ),
                  },
            ),
          );
        void commercialApi
          .archive(
            "activity",
            appointment.activityId || appointment.id,
            appointment.version,
            "Rimozione appuntamento commerciale",
          )
          .catch((error) => {
            setAppointments(previousAppointments);
            setCustomers(previousCustomers);
            toast.error(
              error instanceof Error
                ? error.message
                : "Impossibile rimuovere l’appuntamento",
            );
          });
        return true;
      },
      async updateRankingConfig(role, metrics) {
        if (
          !identity.hasCapability("canManageRoles") ||
          !metrics.length ||
          metrics.some(
            (metric) =>
              !Number.isFinite(metric.weight) ||
              metric.weight < 0 ||
              metric.weight > 100,
          ) ||
          metrics.every((metric) => metric.weight === 0)
        )
          return false;
        const current = rankingConfigs.find((item) => item.role === role);
        if (!current) return false;
        try {
          const saved = await performanceApi.updateRankingConfig(role, metrics, current.optimisticVersion || 1);
          setRankingConfigs((items) => [...items.filter((item) => item.role !== role), saved]);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare la classifica",
          );
          return false;
        }
      },
      async saveRankingSnapshot(snapshot) {
        if (!identity.hasCapability("canManageRoles")) return false;
        const existing = rankingSnapshots
          .filter(
            (item) =>
              item.period === snapshot.period && item.role === snapshot.role,
          )
          .sort((left, right) =>
            right.computedAt.localeCompare(left.computedAt),
          )[0];
        const recalculationReason =
          snapshot.recalculationReason?.trim() ||
          existing?.revocationReason?.trim();
        if (
          (existing && existing.status !== "revoked") ||
          (existing?.status === "revoked" && !recalculationReason)
        )
          return false;
        try {
          const saved = existing
            ? await performanceApi.recalculateRanking(existing, recalculationReason || "Ricalcolo motivato")
            : await performanceApi.consolidateRanking(snapshot.period, snapshot.role, snapshot.recalculationReason);
          setRankingSnapshots((items) => [...items, saved]);
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Impossibile consolidare la classifica");
          return false;
        }
      },
      async deleteRankingSnapshot(snapshotId, reason) {
        const snapshot = rankingSnapshots.find(
          (item) => item.id === snapshotId,
        );
        if (
          !identity.hasCapability("canManageRoles") ||
          !snapshot ||
          snapshot.status === "revoked" ||
          !reason?.trim()
        )
          return false;
        try {
          const saved = await performanceApi.revokeRanking(snapshotId, reason.trim());
          setRankingSnapshots((items) => items.map((item) => item.id === snapshotId ? { ...item, ...saved, status: "revoked" } : item));
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile revocare lo snapshot",
          );
          return false;
        }
      },
      async addService(service) {
        if (!identity.hasCapability("canManageCatalog")) return null;
        try {
          const saved = await commerceApi.createService(service);
          setServices((items) => [
            ...items.filter((item) => item.id !== saved.id),
            saved,
          ]);
          return saved.id;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile creare il servizio",
          );
          return null;
        }
      },
      async updateService(serviceId, updates) {
        const current = services.find((item) => item.id === serviceId);
        if (!current || !identity.hasCapability("canManageCatalog"))
          return false;
        try {
          const saved = await commerceApi.updateService(serviceId, {
            ...updates,
            version: current.version,
          });
          setServices((items) =>
            items.map((item) => (item.id === serviceId ? saved : item)),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare il servizio",
          );
          return false;
        }
      },
      async archiveService(serviceId) {
        const current = services.find((item) => item.id === serviceId);
        if (!current || !identity.hasCapability("canManageCatalog"))
          return false;
        try {
          await commerceApi.archiveService(serviceId, current.version);
          setServices((items) =>
            items.map((item) =>
              item.id === serviceId
                ? {
                    ...item,
                    version: item.version + 1,
                    status: "inactive",
                    archivedAt: new Date().toISOString(),
                  }
                : item,
            ),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile archiviare il servizio",
          );
          return false;
        }
      },
      async addSale(input) {
        if (!identity.hasCapability("canManageOwnSales")) return null;
        try {
          const saved = await commerceApi.createSale(input);
          setSales((items) => [
            ...items.filter((item) => item.id !== saved.id),
            saved,
          ]);
          return saved.id;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile creare la vendita",
          );
          return null;
        }
      },
      async updateSale(saleId, updates) {
        const current = sales.find((item) => item.id === saleId);
        if (!current || !identity.hasCapability("canManageOwnSales"))
          return false;
        try {
          const saved = await commerceApi.updateSale(saleId, {
            ...updates,
            version: current.version,
          });
          setSales((items) =>
            items.map((item) => (item.id === saleId ? saved : item)),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare la vendita",
          );
          return false;
        }
      },
      async archiveSale(saleId) {
        const current = sales.find((item) => item.id === saleId);
        if (!current || !identity.hasCapability("canManageOwnSales"))
          return false;
        try {
          await commerceApi.archiveSale(saleId, current.version);
          setSales((items) => items.filter((item) => item.id !== saleId));
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile archiviare la vendita",
          );
          return false;
        }
      },
      async addOrder(input) {
        if (!identity.hasCapability("canManageOwnOrders")) return null;
        try {
          const saved = await commerceApi.createOrder(
            input,
            input.idempotencyKey,
          );
          setOrders((items) => [
            ...items.filter((item) => item.id !== saved.id),
            saved,
          ]);
          if (saved.saleId) {
            setSales((items) =>
              items.map((item) =>
                item.id === saved.saleId
                  ? { ...item, orderId: saved.id }
                  : item,
              ),
            );
          }
          return saved.id;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile creare l’ordine",
          );
          return null;
        }
      },
      async updateOrder(orderId, updates) {
        const current = orders.find((item) => item.id === orderId);
        if (!current || !identity.hasCapability("canManageOwnOrders"))
          return false;
        try {
          const saved = await commerceApi.updateOrder(orderId, {
            version: current.version,
            administrativeStatus: updates.administrativeStatus,
            dueDate: updates.dueDate,
            notes: updates.notes,
            cancellationReason: (
              updates as Partial<CommercialOrder> & {
                cancellationReason?: string;
              }
            ).cancellationReason,
          });
          setOrders((items) =>
            items.map((item) => (item.id === orderId ? saved : item)),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare l’ordine",
          );
          return false;
        }
      },
      async archiveOrder(orderId) {
        const current = orders.find((item) => item.id === orderId);
        if (!current || !identity.hasCapability("canManageOwnOrders"))
          return false;
        try {
          await commerceApi.archiveOrder(orderId, current.version);
          setOrders((items) =>
            items.map((item) =>
              item.id === orderId
                ? {
                    ...item,
                    version: item.version + 1,
                    archivedAt: new Date().toISOString(),
                  }
                : item,
            ),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile archiviare l’ordine",
          );
          return false;
        }
      },
      async addPayment(input) {
        if (!identity.hasCapability("canManagePayments")) {
          return {
            ok: false,
            code: "NOT_AUTHORIZED",
            message: "Operazione non autorizzata.",
          };
        }
        try {
          const status =
            input.status === "Confermato"
              ? "confirmed"
              : input.status === "Fallito"
                ? "failed"
                : input.status === "Annullato"
                  ? "cancelled"
                  : "pending";
          const result =
            input.type === "Rimborso"
              ? await commerceApi.createRefund({
                  originalPaymentId: input.originalPaymentId,
                  amount: input.amount,
                  date: input.date,
                  effectiveDate: input.effectiveDate,
                  method: input.method,
                  reference: input.reference,
                  status,
                  refundReason: input.refundReason,
                  notes: input.notes,
                })
              : await commerceApi.createPayment({
                  orderId: input.orderId,
                  amount: input.amount,
                  date: input.date,
                  effectiveDate: input.effectiveDate,
                  method: input.method,
                  reference: input.reference,
                  status,
                  notes: input.notes,
                });
          await reloadCommerceState();
          const id = "refund" in result ? result.refund.id : result.payment.id;
          return { ok: true, id };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Impossibile registrare il movimento";
          const lower = message.toLowerCase();
          return {
            ok: false,
            code: lower.includes("duplic")
              ? "DUPLICATE_REFERENCE"
              : lower.includes("rimbor")
                ? "INVALID_REFUND"
                : lower.includes("import")
                  ? "INVALID_AMOUNT"
                  : "NOT_FOUND",
            message,
          };
        }
      },
      async updatePayment(paymentId, updates) {
        const current = payments.find((item) => item.id === paymentId);
        if (!current || !identity.hasCapability("canManagePayments"))
          return false;
        try {
          await commerceApi.updatePayment(paymentId, {
            version: current.version,
            status:
              updates.status === "Confermato"
                ? "confirmed"
                : updates.status === "Fallito"
                  ? "failed"
                  : updates.status === "Annullato"
                    ? "cancelled"
                    : "pending",
            date: updates.date,
            effectiveDate: updates.effectiveDate,
            method: updates.method,
            notes: updates.notes,
          });
          await reloadCommerceState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare il pagamento",
          );
          return false;
        }
      },
      async archivePayment(paymentId) {
        const current = payments.find((item) => item.id === paymentId);
        if (!current || !identity.hasCapability("canManagePayments"))
          return false;
        try {
          await commerceApi.archivePayment(paymentId, current.version);
          await reloadCommerceState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile archiviare il pagamento",
          );
          return false;
        }
      },
      async generateOrderProject(orderId) {
        if (!identity.hasCapability("canManageOwnOrders")) {
          return { ok: false, message: "Operazione non autorizzata." };
        }
        try {
          const result = await commerceApi.generateProject(orderId);
          await reloadCommerceState();
          await reloadDeliveryProject(result.projectId);
          return result;
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "Generazione progetto non riuscita",
          };
        }
      },
      updateCommerceSettings(updates) {
        if (
          !identity.hasCapability("canManageCommerceRules") ||
          !hasMeaningfulChanges(commerceSettings, updates)
        )
          return false;
        setCommerceSettings((current) => ({ ...current, ...updates }));
        return true;
      },
      async generateContract(orderId) {
        const commercialOrder = orders.find((item) => item.id === orderId);
        const allowed =
          commercialOrder &&
          identity.hasCapability("canManageOwnContracts") &&
          (identity.hasCapability("canViewAllLeads") ||
            commercialOrder.salespersonId === identity.currentUser.id);
        if (!commercialOrder || !allowed)
          return {
            ok: false,
            message: "Ordine non trovato o contratto non autorizzato.",
          };
        const existing = contracts.find(
          (contract) =>
            contract.orderId === orderId &&
            contract.status !== "Sostituito" &&
            !contract.archivedAt,
        );
        if (existing)
          return { ok: true as const, id: existing.id, existing: true };
        const customer = customers.find(
          (item) => item.id === commercialOrder.customerId,
        );
        if (!customer)
          return { ok: false, message: "Cliente dell’ordine non disponibile." };
        try {
          const result = await documentRevenueApi.generateContract({
            orderId,
            title: `Contratto ${commercialOrder.code} · ${customer.profile.company}`,
            signatoryName:
              [customer.profile.firstName, customer.profile.lastName]
                .filter(Boolean)
                .join(" ") || customer.profile.company,
          });
          await reloadDocumentRevenueState();
          return { ok: true as const, ...result };
        } catch (error) {
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Impossibile preparare il contratto",
          };
        }
      },
      async updateContract(contractId, updates) {
        const contract = contracts.find((item) => item.id === contractId);
        if (
          !contract ||
          !identity.hasCapability("canManageOwnContracts") ||
          (!identity.hasCapability("canViewAllLeads") &&
            contract.salespersonId !== identity.currentUser.id)
        )
          return false;
        const allowedUpdates: Partial<CommercialContract> = {
          title: updates.title ?? contract.title,
          signatoryName: updates.signatoryName ?? contract.signatoryName,
          signatureDueAt: updates.signatureDueAt,
          documentName: updates.documentName,
          documentReference: updates.documentReference,
          notes: updates.notes,
          visibility: updates.visibility ?? contract.visibility,
        };
        if (!hasMeaningfulChanges(contract, allowedUpdates)) return false;
        try {
          await documentRevenueApi.updateContract(contractId, {
            version: contract.recordVersion,
            ...allowedUpdates,
          });
          await reloadDocumentRevenueState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare il contratto",
          );
          return false;
        }
      },
      async sendContract(contractId, input) {
        const contract = contracts.find((item) => item.id === contractId);
        if (
          !contract ||
          contract.archivedAt ||
          ["Firmato", "Sostituito", "Archiviato"].includes(contract.status) ||
          !identity.hasCapability("canManageOwnContracts") ||
          (!identity.hasCapability("canViewAllLeads") &&
            contract.salespersonId !== identity.currentUser.id)
        )
          return {
            ok: false,
            message: "Contratto non disponibile o operazione non autorizzata.",
          };
        try {
          const result = await documentRevenueApi.sendContract(
            contractId,
            input,
          );
          await reloadDocumentRevenueState();
          return { ok: true as const, attemptId: result.attemptId };
        } catch (error) {
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Impossibile registrare l’invio del contratto",
          };
        }
      },
      async markContractSigned(contractId, _signedAt) {
        void _signedAt;
        const contract = contracts.find((item) => item.id === contractId);
        if (
          !contract ||
          contract.status === "Firmato" ||
          contract.status === "Sostituito" ||
          contract.replacedById ||
          contract.archivedAt ||
          !identity.hasCapability("canManageOwnContracts") ||
          (!identity.hasCapability("canViewAllLeads") &&
            contract.salespersonId !== identity.currentUser.id)
        )
          return false;
        try {
          await documentRevenueApi.signContract(contractId, {
            method: "internal_record",
            signatoryName: contract.signatoryName,
          });
          await reloadDocumentRevenueState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile registrare la firma interna",
          );
          return false;
        }
      },
      async createContractVersion(contractId) {
        const contract = contracts.find((item) => item.id === contractId);
        if (
          !contract ||
          contract.archivedAt ||
          !identity.hasCapability("canManageOwnContracts") ||
          (!identity.hasCapability("canViewAllLeads") &&
            contract.salespersonId !== identity.currentUser.id)
        )
          return {
            ok: false,
            message: "Contratto non disponibile o operazione non autorizzata.",
          };
        try {
          const result = await documentRevenueApi.contractVersion(contractId);
          await reloadDocumentRevenueState();
          return {
            ok: true as const,
            id: result.id,
            existing: result.existing,
          };
        } catch (error) {
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Impossibile creare la versione contratto",
          };
        }
      },
      async archiveContract(contractId) {
        const contract = contracts.find((item) => item.id === contractId);
        if (
          !contract ||
          contract.archivedAt ||
          !identity.hasCapability("canManageOwnContracts") ||
          (!identity.hasCapability("canViewAllLeads") &&
            contract.salespersonId !== identity.currentUser.id)
        )
          return false;
        try {
          await documentRevenueApi.archiveContract(
            contractId,
            contract.recordVersion || 1,
          );
          await reloadDocumentRevenueState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile archiviare il contratto",
          );
          return false;
        }
      },
      async activateRenewal(orderId, itemId) {
        const commercialOrder = orders.find((item) => item.id === orderId);
        const orderItem = commercialOrder?.items.find(
          (item) => item.id === itemId,
        );
        if (
          !commercialOrder ||
          !orderItem?.planId ||
          !orderItem.renewalPrice ||
          !orderItem.recurrence ||
          !identity.hasCapability("canManageOwnRenewals") ||
          (!identity.hasCapability("canViewAllLeads") &&
            commercialOrder.salespersonId !== identity.currentUser.id)
        )
          return {
            ok: false,
            message:
              "Riga ricorrente non disponibile o operazione non autorizzata.",
          };
        const existing = renewals.find(
          (renewal) =>
            renewal.sourceOrderId === orderId &&
            renewal.planId === orderItem.planId &&
            !renewal.archivedAt,
        );
        if (existing)
          return { ok: true as const, id: existing.id, existing: true };
        try {
          const result = await documentRevenueApi.activateRenewal(
            orderId,
            itemId,
          );
          await Promise.all([
            reloadDocumentRevenueState(),
            reloadCommerceState(),
          ]);
          return { ok: true as const, ...result };
        } catch (error) {
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Impossibile attivare il rinnovo",
          };
        }
      },
      async updateRenewal(renewalId, updates) {
        const renewal = renewals.find((item) => item.id === renewalId);
        if (
          !renewal ||
          !identity.hasCapability("canManageOwnRenewals") ||
          (!identity.hasCapability("canViewAllLeads") &&
            renewal.salespersonId !== identity.currentUser.id)
        )
          return false;
        const allowed: Partial<CommercialRenewal> = {
          nextDueAt: updates.nextDueAt ?? renewal.nextDueAt,
          mode: updates.mode ?? renewal.mode,
          ownerId: updates.ownerId ?? renewal.ownerId,
          status: updates.status ?? renewal.status,
        };
        if (!hasMeaningfulChanges(renewal, allowed)) return false;
        try {
          await documentRevenueApi.updateRenewal(renewalId, {
            version: renewal.recordVersion,
            ...allowed,
          });
          await reloadDocumentRevenueState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare il rinnovo",
          );
          return false;
        }
      },
      async sendRenewalReminder(renewalId) {
        const renewal = renewals.find((item) => item.id === renewalId);
        if (
          !renewal ||
          !identity.hasCapability("canManageOwnRenewals") ||
          (!identity.hasCapability("canViewAllLeads") &&
            renewal.salespersonId !== identity.currentUser.id)
        )
          return {
            ok: false,
            message: "Rinnovo non disponibile o operazione non autorizzata.",
          };
        try {
          const result = await documentRevenueApi.remindRenewal(renewalId);
          await reloadDocumentRevenueState();
          return { ok: true as const, ...result };
        } catch (error) {
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Impossibile registrare il promemoria",
          };
        }
      },
      async generateRenewalOrder(renewalId) {
        const renewal = renewals.find((item) => item.id === renewalId);
        if (!renewal || !identity.hasCapability("canManageOwnRenewals")) {
          return {
            ok: false as const,
            message: "Rinnovo non disponibile o operazione non autorizzata.",
          };
        }
        try {
          const result = await documentRevenueApi.renewalOrder(renewalId);
          await Promise.all([
            reloadDocumentRevenueState(),
            reloadCommerceState(),
          ]);
          return { ok: true as const, ...result };
        } catch (error) {
          return {
            ok: false as const,
            message:
              error instanceof Error
                ? error.message
                : "Impossibile generare l’ordine di rinnovo",
          };
        }
      },
      async archiveRenewal(renewalId) {
        const renewal = renewals.find((item) => item.id === renewalId);
        if (
          !renewal ||
          renewal.archivedAt ||
          !identity.hasCapability("canManageOwnRenewals") ||
          (!identity.hasCapability("canViewAllLeads") &&
            renewal.salespersonId !== identity.currentUser.id)
        )
          return false;
        try {
          await documentRevenueApi.archiveRenewal(
            renewalId,
            renewal.recordVersion || 1,
          );
          await reloadDocumentRevenueState();
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile archiviare il rinnovo",
          );
          return false;
        }
      },
      workspaceStatus,
      workspaceError,
      secondaryStatus,
      secondaryError,
      retryWorkspace,
      retrySecondary,
      hasHydrated,
      async transitionLeadStatus({ leadId, fromStatus, toStatus, options }) {
        const lead = leads.find((item) => item.id === leadId);
        if (
          !lead ||
          !canEditLead(identity.currentUser, lead) ||
          (lead.stage === toStatus &&
            (toStatus !== "won" || lead.convertedClientId))
        )
          return;

        if (toStatus === "won") {
          return this.convertLeadToClient({
            leadId,
            createOnboardingActivity: options?.createOnboardingActivity ?? true,
          });
        }

        const previousStage = lead.stage;
        const previousLabel =
          pipelineStages.find((stage) => stage.id === previousStage)?.label ??
          fromStatus;
        const nextLabel =
          pipelineStages.find((stage) => stage.id === toStatus)?.label ??
          toStatus;
        if (!lead.version)
          throw new Error("Versione lead non disponibile: ricarica la pagina");
        const response = await commercialApi.transitionOpportunity(leadId, {
          stage: toStatus,
          version: lead.version,
          reason: options?.reason,
          note: options?.note,
        });
        setLeads((items) =>
          items.map((item) =>
            item.id === leadId
              ? {
                  ...item,
                  stage: toStatus,
                  status: toStatus,
                  version: response.item.version,
                  lastContact: dateValue(response.item.updated_at),
                }
              : item,
          ),
        );
        setOrder((current) => ({
          ...current,
          [previousStage]: current[previousStage].filter((id) => id !== leadId),
          [toStatus]: [
            ...current[toStatus].filter((id) => id !== leadId),
            leadId,
          ],
        }));
        void previousLabel;
        void nextLabel;
      },
      async moveLead(leadId, nextStage, options) {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead) return;
        await this.transitionLeadStatus({
          leadId,
          fromStatus: lead.stage,
          toStatus: nextStage,
          options,
        });
      },
      async convertLeadToClient({
        leadId,
        createOnboardingActivity,
        existingClientId,
      }) {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead) throw new Error("Lead non trovato");
        if (!canEditLead(identity.currentUser, lead))
          throw new Error("Operazione non autorizzata per questo lead");
        if (
          lead.convertedClientId &&
          customers.some((customer) => customer.id === lead.convertedClientId)
        )
          return { status: "existing", clientId: lead.convertedClientId };
        if (!lead.version)
          throw new Error("Versione lead non disponibile: ricarica la pagina");
        const conversion = await commercialApi.convertOpportunity(leadId, {
          version: lead.version,
          createOnboardingActivity,
          existingCompanyId: existingClientId,
        });
        const clientId = conversion.clientId;
        const convertedAt = dateValue(conversion.opportunity.converted_at);
        const aggregate = await commercialApi.customerAggregate(clientId);
        const onboardingServer = aggregate.activities.find(
          (activity) => activity.type === "onboarding",
        );
        const onboardingActivity = onboardingServer
          ? normalizeActivity(
              {
                id: onboardingServer.id,
                version: onboardingServer.version,
                title: onboardingServer.title,
                description: onboardingServer.description || "",
                dueAt: dateValue(onboardingServer.due_at),
                assigneeId: onboardingServer.assigned_to || lead.assigneeId,
              },
              lead,
              true,
            )
          : undefined;
        const convertedLead = {
          ...lead,
          stage: "won" as const,
          status: "won" as const,
          probability: 100,
          nextAction:
            onboardingActivity?.title ?? "Nessuna attività pianificata",
          nextActionAt: onboardingActivity?.dueAt ?? convertedAt,
          convertedClientId: clientId,
          convertedAt,
          version: conversion.opportunity.version,
        };
        setLeads((items) =>
          items.map((item) => (item.id === leadId ? convertedLead : item)),
        );
        setOrder((current) => ({
          ...current,
          [lead.stage]: current[lead.stage].filter((id) => id !== leadId),
          won: [...current.won.filter((id) => id !== leadId), leadId],
        }));
        const serverCustomer: CommercialCustomer = {
          id: clientId,
          version: aggregate.company.version,
          leadId,
          sourceLeadId: leadId,
          sourceDealId: leadId,
          profile: convertedLead,
          createdAt: dateValue(aggregate.company.created_at, convertedAt),
          status: "Da avviare",
          onboardingActivity,
          contacts: aggregate.contacts.map((contact) => ({
            id: contact.id,
            version: contact.version,
            name: [contact.first_name, contact.last_name]
              .filter(Boolean)
              .join(" "),
            role: contact.role_title || undefined,
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            createdAt: dateValue(contact.created_at),
            updatedAt: dateValue(
              contact.updated_at,
              dateValue(contact.created_at),
            ),
          })),
          primaryContactId: aggregate.contacts.find(
            (contact) => contact.is_primary,
          )?.id,
        };
        setCustomers((items) => [
          ...items.filter((item) => item.id !== clientId),
          serverCustomer,
        ]);
        return { status: conversion.status, clientId };
      },
      reorderLead(stage, leadIds) {
        const editableIds = new Set(
          leads
            .filter(
              (lead) =>
                lead.stage === stage && canEditLead(identity.currentUser, lead),
            )
            .map((lead) => lead.id),
        );
        const currentVisible = (order[stage] ?? []).filter((id) =>
          editableIds.has(id),
        );
        if (
          leadIds.length !== currentVisible.length ||
          new Set(leadIds).size !== leadIds.length ||
          leadIds.some((id) => !editableIds.has(id))
        )
          return;
        const previousOrder = order[stage] ?? [];
        let index = 0;
        setOrder((current) => ({
          ...current,
          [stage]: current[stage].map((id) =>
            editableIds.has(id) ? leadIds[index++] : id,
          ),
        }));
        void commercialApi.reorderPipeline(stage, leadIds).catch((error) => {
          setOrder((current) => ({ ...current, [stage]: previousOrder }));
          toast.error(
            error instanceof Error
              ? error.message
              : "Riordino pipeline non riuscito",
          );
        });
      },
      exportLeadsToContacts(leadIds) {
        const uniqueIds = Array.from(new Set(leadIds)).sort();
        const selected = uniqueIds
          .map((id) => leads.find((lead) => lead.id === id))
          .filter((lead): lead is CommercialLead => Boolean(lead));
        if (
          !selected.length ||
          selected.length !== uniqueIds.length ||
          selected.some((lead) => !canViewLead(identity.currentUser, lead)) ||
          !identity.currentUser.roles.some(
            (role) => role === "administrator" || role === "commercial",
          )
        )
          return {
            ok: false,
            message: "Nessun lead esportabile nel perimetro autorizzato.",
          };
        const lockKey = uniqueIds.join("|");
        const locked = contactsExportLocks.current.get(lockKey);
        if (locked)
          return {
            ok: true,
            ...locked,
            existing: true,
            leads: selected.map((lead) => ({
              ...lead,
              exportedToContactsAt: locked.exportedAt,
              exportedToContactsBy: identity.currentUser.id,
              exportBatchId: locked.batchId,
            })),
          };
        const alreadyBatch = selected.every(
          (lead) =>
            lead.exportBatchId &&
            lead.exportBatchId === selected[0].exportBatchId,
        );
        if (alreadyBatch) {
          const result = {
            batchId: selected[0].exportBatchId!,
            exportedAt: selected[0].exportedToContactsAt!,
          };
          contactsExportLocks.current.set(lockKey, result);
          return { ok: true, ...result, existing: true, leads: selected };
        }
        const exportedAt = new Date().toISOString();
        const batchId = `contacts-${exportedAt.slice(0, 10)}-${crypto.randomUUID()}`;
        contactsExportLocks.current.set(lockKey, { batchId, exportedAt });
        setLeads((items) =>
          items.map((lead) =>
            uniqueIds.includes(lead.id)
              ? {
                  ...lead,
                  exportedToContactsAt: exportedAt,
                  exportedToContactsBy: identity.currentUser.id,
                  exportBatchId: batchId,
                }
              : lead,
          ),
        );
        setTimelineEvents((items) => [
          ...selected.map((lead): CommercialTimelineEvent => ({
            id: `contacts-export:${batchId}:${lead.id}`,
            leadId: lead.id,
            kind: "status",
            title: "Esportato in Google Contatti",
            detail: `Batch ${batchId} preparato per ${lead.firstName} ${lead.lastName}.`,
            date: exportedAt,
            author: identity.currentUser.name,
          })),
          ...items,
        ]);
        return {
          ok: true,
          batchId,
          exportedAt,
          existing: false,
          leads: selected.map((lead) => ({
            ...lead,
            exportedToContactsAt: exportedAt,
            exportedToContactsBy: identity.currentUser.id,
            exportBatchId: batchId,
          })),
        };
      },
      async updateLead(leadId, updates, options) {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead || !canEditLead(identity.currentUser, lead)) return false;
        const authorizedUpdates = identity.hasCapability("canAssignLeads")
          ? updates
          : { ...updates, assigneeId: lead.assigneeId, owner: lead.owner };
        if (!hasMeaningfulChanges(lead, authorizedUpdates)) return true;
        const campaignChanged =
          authorizedUpdates.campaignId !== undefined &&
          authorizedUpdates.campaignId !== lead.campaignId;
        if (!lead.version) {
          toast.error("Versione lead non disponibile: ricarica la pagina");
          return false;
        }
        try {
          const updated = await commercialApi.updateOpportunity(leadId, {
            ...opportunityPayload(authorizedUpdates),
            version: lead.version,
          });
          const finalItem = campaignChanged
            ? (
                await commercialApi.updateAttribution(leadId, {
                  version: updated.version,
                  campaignId: authorizedUpdates.campaignId || null,
                })
              ).item
            : updated;
          const persistedUpdates: Partial<CommercialLead> = {
            ...(authorizedUpdates.opportunityName !== undefined
              ? { opportunityName: authorizedUpdates.opportunityName }
              : {}),
            ...(authorizedUpdates.source !== undefined
              ? { source: authorizedUpdates.source }
              : {}),
            ...(authorizedUpdates.service !== undefined
              ? {
                  service: authorizedUpdates.service,
                  services: authorizedUpdates.service ? [authorizedUpdates.service] : [],
                }
              : {}),
            ...(authorizedUpdates.value !== undefined
              ? { value: authorizedUpdates.value }
              : {}),
            ...(authorizedUpdates.probability !== undefined
              ? { probability: authorizedUpdates.probability }
              : {}),
            ...(authorizedUpdates.assigneeId !== undefined
              ? {
                  assigneeId: authorizedUpdates.assigneeId,
                  owner: authorizedUpdates.owner ?? lead.owner,
                }
              : {}),
            ...(authorizedUpdates.nextAction !== undefined
              ? { nextAction: authorizedUpdates.nextAction }
              : {}),
            ...(authorizedUpdates.nextActionAt !== undefined
              ? { nextActionAt: authorizedUpdates.nextActionAt }
              : {}),
            ...(campaignChanged
              ? { campaignId: authorizedUpdates.campaignId }
              : {}),
          };
          setLeads((items) =>
            items.map((item) =>
              item.id === leadId
                ? {
                    ...item,
                    ...persistedUpdates,
                    version: finalItem.version,
                    lastContact: dateValue(finalItem.updated_at),
                  }
                : item,
            ),
          );
          setCustomers((items) =>
            items.map((customer) =>
              customer.sourceLeadId === leadId
                ? {
                    ...customer,
                    profile: { ...customer.profile, ...persistedUpdates },
                  }
                : customer,
            ),
          );
          void options;
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Aggiornamento non riuscito",
          );
          return false;
        }
      },
      archiveLead(leadId, reason) {
        const lead = leads.find((item) => item.id === leadId);
        if (
          !lead ||
          lead.archivedAt ||
          leadArchiveLocks.current.has(leadId) ||
          !canEditLead(identity.currentUser, lead)
        )
          return false;
        leadArchiveLocks.current.add(leadId);
        if (!lead.version) return false;
        void commercialApi
          .archive("lead", leadId, lead.version, reason)
          .then((response) => {
            const now = dateValue(response.item.deleted_at);
            setLeads((items) =>
              items.map((item) =>
                item.id === leadId
                  ? {
                      ...item,
                      version: response.item.version,
                      archivedAt: now,
                      archivedBy: identity.currentUser.id,
                      archivedReason: reason?.trim() || "Archiviazione manuale",
                    }
                  : item,
              ),
            );
            setOrder(
              (current) =>
                Object.fromEntries(
                  Object.entries(current).map(([stage, ids]) => [
                    stage,
                    ids.filter((id) => id !== leadId),
                  ]),
                ) as Record<PipelineStage, string[]>,
            );
          })
          .catch((error) =>
            toast.error(
              error instanceof Error
                ? error.message
                : "Archiviazione non riuscita",
            ),
          )
          .finally(() => leadArchiveLocks.current.delete(leadId));
        return true;
      },
      updateCustomer(clientId, updates) {
        const current = customers.find((item) => item.id === clientId);
        if (!current?.version) return;
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId ? { ...item, ...updates } : item,
          ),
        );
        void commercialApi
          .updateCompany(clientId, {
            version: current.version,
            ...(updates.status !== undefined ? { status: updates.status } : {}),
            ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
          })
          .then((company) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id === clientId
                  ? { ...item, version: company.version }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) => (item.id === clientId ? current : item)),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Aggiornamento cliente non riuscito",
            );
          });
      },
      async updateCustomerLogo(clientId, logoUrl) {
        const customer = customers.find((item) => item.id === clientId);
        const valid =
          !logoUrl ||
          (/^data:image\/(?:png|jpeg|webp);base64,/.test(logoUrl) &&
            logoUrl.length <= 385_000);
        if (
          !customer ||
          !valid ||
          customer.logoUrl === logoUrl ||
          !canManageCustomerBranding(
            identity.currentUser,
            customer,
            permissionScope,
          )
        )
          return false;
        if (!customer.version) return false;
        try {
          const company = await commercialApi.updateCompany(clientId, {
            version: customer.version,
            logo_url: logoUrl || null,
          });
          setCustomers((items) =>
            items.map((item) =>
              item.id === clientId
                ? {
                    ...item,
                    version: company.version,
                    logoUrl: company.logo_url || undefined,
                    logoUpdatedAt: dateValue(company.updated_at),
                    logoUpdatedBy: identity.currentUser.id,
                  }
                : item,
            ),
          );
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Logo cliente non salvato",
          );
          return false;
        }
      },
      updateCustomerProfile(clientId, updates, customerUpdates) {
        const customer = customers.find((item) => item.id === clientId);
        if (
          !customer ||
          (!hasMeaningfulChanges(customer.profile, updates) &&
            !hasMeaningfulChanges(customer, customerUpdates ?? {}))
        )
          return false;
        if (!customer.version) return false;
        const profile = { ...customer.profile, ...updates };
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? { ...item, ...customerUpdates, profile }
              : item,
          ),
        );
        setLeads((items) =>
          items.map((item) =>
            item.id === customer.sourceLeadId ? { ...item, ...updates } : item,
          ),
        );
        void commercialApi
          .updateCompany(clientId, {
            version: customer.version,
            name: profile.company,
            email: profile.email || null,
            phone: profile.phone || null,
            vat_number: profile.vatNumber || null,
            fiscal_code: profile.taxCode || null,
            address: profile.location || null,
            owner_user_id: profile.assigneeId || null,
            status: customerUpdates?.status ?? customer.status,
            notes: customerUpdates?.notes ?? customer.notes ?? null,
          })
          .then((company) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id === clientId
                  ? { ...item, version: company.version }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) => (item.id === clientId ? customer : item)),
            );
            setLeads((items) =>
              items.map((item) =>
                item.id === customer.sourceLeadId ? customer.profile : item,
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Anagrafica cliente non salvata",
            );
          });
        return true;
      },
      updateCustomerStatus(clientId, status) {
        const customer = customers.find((item) => item.id === clientId);
        if (!customer || customer.status === status) return;
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId ? { ...item, status } : item,
          ),
        );
        if (!customer.version) return;
        void commercialApi
          .updateCompany(clientId, { version: customer.version, status })
          .then((company) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id === clientId
                  ? { ...item, version: company.version }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) => (item.id === clientId ? customer : item)),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Stato cliente non salvato",
            );
          });
      },
      async createCustomer(input) {
        const company = await commercialApi.createCompany({
          name: input.company,
          email: input.email || null,
          phone: input.phone || null,
          vat_number: input.vatNumber || null,
          fiscal_code: input.taxCode || null,
          address: input.location || null,
          status: input.status,
          notes: input.notes || null,
          owner_user_id: input.assigneeId || null,
        });
        if (input.firstName || input.email || input.phone)
          await commercialApi.createContact({
            company_id: company.id,
            first_name: input.firstName || input.company,
            last_name: input.lastName || null,
            email: input.email || null,
            phone: input.phone || null,
            is_primary: true,
          });
        const now = dateValue(company.created_at);
        const profile: CommercialLead = {
          id: company.id,
          firstName: input.firstName,
          lastName: input.lastName,
          company: company.name,
          email: input.email,
          phone: input.phone,
          vatNumber: input.vatNumber,
          taxCode: input.taxCode,
          location: input.location,
          source: "Manuale",
          service: input.service || "",
          stage: "won",
          status: "won",
          value: 0,
          probability: 100,
          assigneeId: input.assigneeId,
          owner: input.owner,
          createdAt: now,
          lastContact: now,
          nextAction: "",
          nextActionAt: "",
          daysInStage: 0,
        };
        const record: CommercialCustomer = {
          id: company.id,
          version: company.version,
          leadId: profile.id,
          sourceLeadId: profile.id,
          sourceDealId: profile.id,
          profile,
          createdAt: now,
          status: input.status,
          notes: input.notes,
        };
        setCustomers((items) => [...items, record]);
        return company.id;
      },
      archiveCustomer(clientId) {
        const customer = customers.find((item) => item.id === clientId);
        if (!customer || customer.archivedAt || !customer.version) return false;
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? { ...item, archivedAt: new Date().toISOString() }
              : item,
          ),
        );
        void commercialApi
          .archive("customer", clientId, customer.version)
          .then((response) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id === clientId
                  ? {
                      ...item,
                      version: response.item.version,
                      archivedAt: dateValue(response.item.deleted_at),
                    }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) => (item.id === clientId ? customer : item)),
            );
            toast.error(
              error instanceof Error ? error.message : "Cliente non archiviato",
            );
          });
        return true;
      },
      addCustomerActivity(clientId, activity) {
        const customer = customers.find((item) => item.id === clientId);
        if (!customer) return null;
        if (activity.projectId) {
          const projectId = activity.projectId;
          return deliveryApi
            .createTask(projectId, {
              title: activity.title,
              description: activity.description,
              ...(activity.phaseId ? { phase_id: activity.phaseId } : {}),
              assignee_id: activity.assigneeId,
              collaborator_ids: activity.collaboratorIds ?? [],
              status:
                activity.status === "Completata"
                  ? "done"
                  : activity.status === "In corso"
                    ? "in_progress"
                    : activity.status === "Bloccata"
                      ? "blocked"
                      : "backlog",
              priority:
                activity.priority === "Urgente"
                  ? "urgent"
                  : activity.priority === "Alta"
                    ? "high"
                    : activity.priority === "Bassa"
                      ? "low"
                      : "medium",
              ...(activity.dueAt ? { due_at: activity.dueAt } : {}),
              estimated_minutes: activity.estimatedMinutes ?? 0,
              ...(activity.recurrence && activity.recurrence !== "Nessuna"
                ? {
                    recurrence_rule: {
                      frequency:
                        activity.recurrence === "Settimanale"
                          ? "weekly"
                          : activity.recurrence === "Mensile" ||
                              activity.recurrence === "Trimestrale"
                            ? "monthly"
                            : "annual",
                      interval: activity.recurrence === "Trimestrale" ? 3 : 1,
                    },
                  }
                : {}),
            })
            .then(async (result) => {
              await reloadDeliveryProject(projectId);
              return result.item.id;
            })
            .catch((error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Impossibile creare l’attività progetto",
              );
              return null;
            });
        }
        const now = new Date().toISOString();
        const { phaseId, ...activityInput } = activity;
        const record = normalizeActivity(
          {
            ...activityInput,
            id: `optimistic:${crypto.randomUUID()}`,
            leadId: activity.leadId ?? customer.sourceLeadId,
            phaseId,
            dueAt: activity.dueAt,
          },
          { assigneeId: customer.profile.assigneeId, createdAt: now },
        );
        const nextCustomer = {
          ...customer,
          activities: [...(customer.activities ?? []), record],
        };
        setCustomers((items) =>
          items.map((item) => (item.id === clientId ? nextCustomer : item)),
        );
        let phaseEvents: CommercialTimelineEvent[] = [];
        if (record.projectId) {
          const project = projects.find((item) => item.id === record.projectId);
          if (project) {
            const source = {
              ...project,
              activityIds: Array.from(
                new Set([...project.activityIds, record.id]),
              ),
              phases: phaseId
                ? project.phases.map((phase) =>
                    phase.id === phaseId
                      ? {
                          ...phase,
                          activityIds: Array.from(
                            new Set([...phase.activityIds, record.id]),
                          ),
                        }
                      : phase,
                  )
                : project.phases,
            };
            const synced = synchronizeProjectPhases(source, nextCustomer, now);
            phaseEvents = synced.changes.map(({ phase, previousStatus }) => ({
              id: crypto.randomUUID(),
              leadId: customer.sourceLeadId,
              kind: "status" as const,
              title:
                phase.status === "completed"
                  ? "Fase completata"
                  : phase.status === "in_progress"
                    ? "Fase avviata"
                    : "Fase riportata da avviare",
              detail: `${phase.name} · ${project.name}${previousStatus === "completed" && phase.status === "in_progress" ? " · riaperta automaticamente" : ""}`,
              date: now,
              author: identity.currentUser.name,
            }));
            setProjects((items) =>
              items.map((item) =>
                item.id === project.id
                  ? { ...source, phases: synced.phases, updatedAt: now }
                  : item,
              ),
            );
          }
        }
        if (record.projectId)
          setTimelineEvents((items) => [...phaseEvents, ...items]);
        void createActivityOnServer(customer, record)
          .then((saved) => {
            if (!saved || typeof saved !== "object" || !("id" in saved)) return;
            const savedRecord = saved as Record<string, unknown> & {
              id: string;
            };
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      activities: item.activities?.map((activity) =>
                        activity.id === record.id
                          ? {
                              ...activity,
                              id: savedRecord.id,
                              version:
                                numericValue(savedRecord.version) ||
                                activity.version,
                              createdAt: dateValue(
                                savedRecord.created_at,
                                activity.createdAt,
                              ),
                              updatedAt: dateValue(
                                savedRecord.updated_at,
                                activity.updatedAt,
                              ),
                            }
                          : activity,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) => (item.id === clientId ? customer : item)),
            );
            setProjects((items) =>
              items.map((item) =>
                item.activityIds.includes(record.id)
                  ? {
                      ...item,
                      activityIds: item.activityIds.filter(
                        (id) => id !== record.id,
                      ),
                      phases: item.phases.map((phase) => ({
                        ...phase,
                        activityIds: phase.activityIds.filter(
                          (id) => id !== record.id,
                        ),
                      })),
                    }
                  : item,
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Impossibile creare l’attività",
            );
          });
        return record.id;
      },
      addLeadActivity(leadId, activity) {
        const lead = leads.find(
          (item) => item.id === leadId && !item.archivedAt,
        );
        if (!lead || !canEditLead(identity.currentUser, lead)) return null;
        const now = new Date().toISOString();
        const record = normalizeActivity(
          {
            ...activity,
            id: `optimistic:${crypto.randomUUID()}`,
            leadId,
            projectId: undefined,
            phaseId: undefined,
            dueAt: activity.dueAt,
          },
          { assigneeId: lead.assigneeId, createdAt: now },
        );
        setLeadActivities((items) => [...items, record]);
        void commercialApi
          .createActivity({
            opportunity_id: leadId,
            type:
              activity.type === "Chiamata"
                ? "call"
                : activity.type === "Riunione"
                  ? "meeting"
                  : activity.type === "Email"
                    ? "email"
                    : "activity",
            title: record.title,
            description: record.description,
            due_at: record.dueAt || null,
            completed_at: record.completedAt || null,
            assigned_to: record.assigneeId || null,
          })
          .then((saved) => {
            setLeadActivities((items) =>
              items.map((item) =>
                item.id === record.id
                  ? {
                      ...item,
                      id: saved.id,
                      version: saved.version,
                      createdAt: dateValue(saved.created_at, item.createdAt),
                      updatedAt: dateValue(saved.updated_at, item.updatedAt),
                    }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setLeadActivities((items) =>
              items.filter((item) => item.id !== record.id),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Attività lead non salvata",
            );
          });
        return record.id;
      },
      archiveLeadActivity(leadId, activityId) {
        const lead = leads.find(
          (item) => item.id === leadId && !item.archivedAt,
        );
        const activity = leadActivities.find(
          (item) =>
            item.id === activityId &&
            item.leadId === leadId &&
            !item.archivedAt,
        );
        if (
          !lead ||
          !activity ||
          !activity.version ||
          !canEditLead(identity.currentUser, lead)
        )
          return false;
        const now = new Date().toISOString();
        setLeadActivities((items) =>
          items.map((item) =>
            item.id === activityId
              ? { ...item, archivedAt: now, updatedAt: now }
              : item,
          ),
        );
        void commercialApi
          .archive("activity", activityId, activity.version)
          .then((response) => {
            setLeadActivities((items) =>
              items.map((item) =>
                item.id === activityId
                  ? {
                      ...item,
                      version: response.item.version,
                      archivedAt: dateValue(response.item.deleted_at),
                    }
                  : item,
              ),
            );
          })
          .catch((error) => {
            setLeadActivities((items) =>
              items.map((item) => (item.id === activityId ? activity : item)),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Attività non archiviata",
            );
          });
        return true;
      },
      updateCustomerActivity(clientId, activityId, updates) {
        const customer = customers.find((item) => item.id === clientId);
        const matchesActivity = (item: CustomerActivity) =>
          item.id === activityId || item.activityId === activityId;
        const activity = customer
          ? getCanonicalCustomerActivities(customer).find(matchesActivity)
          : undefined;
        const project = activity?.projectId
          ? projects.find((item) => item.id === activity.projectId)
          : undefined;
        if (!customer || !activity) {
          toast.error("Impossibile aggiornare l’attività: record non trovato.");
          return false;
        }
        const safeUpdates = getWorkflowSafeActivityUpdates(activity, updates);
        const afterStatus = safeUpdates.status ?? activity.status;
        if (
          !canManageActivity(
            identity.currentUser,
            activity,
            customer,
            project,
          ) ||
          !hasMeaningfulChanges(activity, safeUpdates)
        )
          return false;
        if (project) {
          return (async () => {
            try {
              let version = activity.version ?? 1;
              const detailUpdates: Record<string, unknown> = { version };
              if (safeUpdates.title !== undefined)
                detailUpdates.title = safeUpdates.title;
              if (safeUpdates.description !== undefined)
                detailUpdates.description = safeUpdates.description;
              if (safeUpdates.phaseId !== undefined)
                detailUpdates.phase_id = safeUpdates.phaseId;
              if (safeUpdates.assigneeId !== undefined)
                detailUpdates.assignee_id = safeUpdates.assigneeId;
              if (safeUpdates.collaboratorIds !== undefined)
                detailUpdates.collaborator_ids = safeUpdates.collaboratorIds;
              if (safeUpdates.priority !== undefined)
                detailUpdates.priority =
                  safeUpdates.priority === "Urgente"
                    ? "urgent"
                    : safeUpdates.priority === "Alta"
                      ? "high"
                      : safeUpdates.priority === "Bassa"
                        ? "low"
                        : "medium";
              if (safeUpdates.dueAt !== undefined) {
                detailUpdates.due_at = safeUpdates.dueAt;
                detailUpdates.reason =
                  "Scadenza aggiornata dall’interfaccia attività";
              }
              if (safeUpdates.estimatedMinutes !== undefined)
                detailUpdates.estimated_minutes = safeUpdates.estimatedMinutes;
              if (Object.keys(detailUpdates).length > 1) {
                const result = await deliveryApi.updateTask(
                  project.id,
                  activity.id,
                  detailUpdates,
                );
                version = Number(
                  (result.item as Record<string, unknown>).version ??
                    version + 1,
                );
              }
              if (
                safeUpdates.status !== undefined &&
                safeUpdates.status !== activity.status
              ) {
                const status =
                  safeUpdates.status === "Completata"
                    ? "done"
                    : safeUpdates.status === "In corso"
                      ? "in_progress"
                      : safeUpdates.status === "Bloccata" ||
                          safeUpdates.status === "In attesa cliente"
                        ? "blocked"
                        : "backlog";
                await deliveryApi.transitionTask(project.id, activity.id, {
                  version,
                  status,
                  ...(activity.status === "Completata" || status === "blocked"
                    ? {
                        reason:
                          status === "blocked"
                            ? "Attività bloccata dall’interfaccia"
                            : "Riapertura richiesta dall’interfaccia attività",
                      }
                    : {}),
                });
              }
              await reloadDeliveryProject(project.id);
              return true;
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Impossibile aggiornare l’attività progetto",
              );
              return false;
            }
          })();
        }
        const now = new Date().toISOString();
        const changed = Object.keys(safeUpdates).filter(
          (key) =>
            JSON.stringify(safeUpdates[key as keyof CustomerActivity]) !==
            JSON.stringify(activity[key as keyof CustomerActivity]),
        );
        const title =
          safeUpdates.status === "Completata"
            ? "Attività completata"
            : safeUpdates.status && activity.status === "Completata"
              ? "Attività riaperta"
              : changed.length > 1
                ? "Attività modificata"
                : "Attività aggiornata";
        const detail = safeUpdates.status
          ? `Stato modificato da ${activity.status} a ${safeUpdates.status}.`
          : "Dettagli attività modificati.";
        const nextCustomer = {
          ...customer,
          activities: (customer.activities ?? []).map((entry) =>
            matchesActivity(entry)
              ? {
                  ...entry,
                  ...safeUpdates,
                  status: afterStatus,
                  completedAt:
                    afterStatus === "Completata"
                      ? (safeUpdates.completedAt ?? now)
                      : undefined,
                  updatedAt: now,
                }
              : entry,
          ),
          onboardingActivity:
            customer.onboardingActivity &&
            matchesActivity(customer.onboardingActivity)
              ? {
                  ...customer.onboardingActivity,
                  ...safeUpdates,
                  status: afterStatus,
                  completedAt:
                    afterStatus === "Completata"
                      ? (safeUpdates.completedAt ?? now)
                      : undefined,
                  updatedAt: now,
                }
              : customer.onboardingActivity,
        };
        const projectUpdates = projects
          .filter((item) => item.clientId === clientId)
          .map((item) => ({
            project: item,
            synced: synchronizeProjectPhases(item, nextCustomer, now),
          }));
        setCustomers((items) =>
          items.map((item) => (item.id === clientId ? nextCustomer : item)),
        );
        setProjects((items) =>
          items.map((item) => {
            const update = projectUpdates.find(
              (entry) => entry.project.id === item.id,
            );
            return update
              ? {
                  ...item,
                  phases: update.synced.phases,
                  updatedAt: update.synced.changes.length
                    ? now
                    : item.updatedAt,
                }
              : item;
          }),
        );
        void updateActivityOnServer(customer, activity, {
          ...safeUpdates,
          status: afterStatus,
        })
          .then((saved) => {
            if (activity.projectId || !saved || typeof saved !== "object")
              return;
            const server = saved as Record<string, unknown>;
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      activities: item.activities?.map((entry) =>
                        matchesActivity(entry)
                          ? {
                              ...entry,
                              version:
                                numericValue(server.version) || entry.version,
                              updatedAt: dateValue(
                                server.updated_at,
                                entry.updatedAt,
                              ),
                            }
                          : entry,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) => (item.id === clientId ? customer : item)),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Impossibile aggiornare l’attività",
            );
          });
        const phaseEvents = projectUpdates.flatMap(
          ({ project: linkedProject, synced }) =>
            synced.changes.map(({ phase, previousStatus }) => ({
              id: crypto.randomUUID(),
              leadId: customer.sourceLeadId,
              kind: "status" as const,
              title:
                phase.status === "completed"
                  ? "Fase completata"
                  : phase.status === "in_progress"
                    ? "Fase avviata"
                    : "Fase riportata da avviare",
              detail: `${phase.name} · ${linkedProject.name}${previousStatus === "completed" && phase.status === "in_progress" ? " · riaperta automaticamente" : ""}`,
              date: now,
              author: identity.currentUser.name,
            })),
        );
        if (activity.projectId)
          setTimelineEvents((items) => [...phaseEvents, ...items]);
        void title;
        void detail;
        return true;
      },
      setCustomerActivityStatus(clientId, activityId, status) {
        return this.updateCustomerActivity(clientId, activityId, {
          status,
          completedAt:
            status === "Completata" ? new Date().toISOString() : undefined,
        });
      },
      moveCustomerActivity(clientId, activityId, status, orderedVisibleIds) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId || item.activityId === activityId,
          );
        const project = activity?.projectId
          ? projects.find((item) => item.id === activity.projectId)
          : undefined;
        if (
          !customer ||
          !activity ||
          !canManageActivity(identity.currentUser, activity, customer, project)
        )
          return false;
        if (project) {
          return (async () => {
            try {
              const nextStatus =
                status === "Completata"
                  ? "done"
                  : status === "In corso"
                    ? "in_progress"
                    : status === "Bloccata" || status === "In attesa cliente"
                      ? "blocked"
                      : "backlog";
              const orderedActivities = orderedVisibleIds.flatMap(
                (id, index) => {
                  const candidate = getCanonicalCustomerActivities(
                    customer,
                  ).find(
                    (item) => item.id === id && item.projectId === project.id,
                  );
                  return candidate
                    ? [
                        {
                          id: candidate.id,
                          version: candidate.version ?? 1,
                          order: (index + 1) * 1000,
                        },
                      ]
                    : [];
                },
              );
              if (!orderedActivities.some((item) => item.id === activity.id))
                orderedActivities.push({
                  id: activity.id,
                  version: activity.version ?? 1,
                  order: (orderedActivities.length + 1) * 1000,
                });
              applyDeliveryWorkspace(
                await deliveryApi.reorderTasks(project.id, {
                  moved_task_id: activity.id,
                  status: nextStatus,
                  items: orderedActivities,
                  ...(activity.status === "Completata" ||
                  nextStatus === "blocked"
                    ? {
                        reason:
                          nextStatus === "blocked"
                            ? "Spostamento in colonna bloccata"
                            : "Riapertura da kanban",
                      }
                    : {}),
                }),
              );
              return true;
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Spostamento attività progetto non riuscito",
              );
              return false;
            }
          })();
        }
        const previousCustomers = customers;
        const previousProjects = projects;
        const uniqueIds = Array.from(new Set(orderedVisibleIds));
        if (
          !uniqueIds.includes(activity.id) ||
          uniqueIds.length !== orderedVisibleIds.length
        )
          return false;
        const authorizedById = new Map(
          customers.flatMap((entry) =>
            getCanonicalCustomerActivities(entry)
              .filter((candidate) =>
                canManageActivity(
                  identity.currentUser,
                  candidate,
                  entry,
                  candidate.projectId
                    ? projects.find((item) => item.id === candidate.projectId)
                    : undefined,
                ),
              )
              .map((candidate) => [candidate.id, candidate] as const),
          ),
        );
        if (uniqueIds.some((id) => !authorizedById.has(id))) return false;
        const currentOrder = [...authorizedById.values()]
          .filter(
            (item) => item.status === status && uniqueIds.includes(item.id),
          )
          .sort(
            (left, right) =>
              (left.kanbanOrder ?? 0) - (right.kanbanOrder ?? 0) ||
              left.id.localeCompare(right.id),
          )
          .map((item) => item.id);
        const signature = `${status}:${uniqueIds.join("|")}`;
        if (
          activityMoveLocks.current.get(activity.id) === signature ||
          (activity.status === status &&
            currentOrder.join("|") === uniqueIds.join("|"))
        )
          return false;
        activityMoveLocks.current.set(activity.id, signature);
        queueMicrotask(() => {
          if (activityMoveLocks.current.get(activity.id) === signature)
            activityMoveLocks.current.delete(activity.id);
        });
        const now = new Date().toISOString();
        const orderById = new Map(
          uniqueIds.map((id, index) => [id, index + 1]),
        );
        const updateEntry = (entry: CustomerActivity) => {
          const canonicalId = entry.id || entry.activityId;
          if (!canonicalId || !orderById.has(canonicalId)) return entry;
          const moved = canonicalId === activity.id;
          const changedStatus = moved && entry.status !== status;
          return {
            ...entry,
            status: moved ? status : entry.status,
            completedAt: moved
              ? status === "Completata"
                ? (entry.completedAt ?? now)
                : undefined
              : entry.completedAt,
            kanbanOrder: orderById.get(canonicalId)! * 1000,
            workStatus:
              moved && status === "Completata" && entry.projectId
                ? ("Completato dal collaboratore" as const)
                : moved &&
                    status !== "Completata" &&
                    entry.workStatus &&
                    entry.workStatus !== "Modifiche richieste"
                  ? ("In lavorazione" as const)
                  : entry.workStatus,
            submittedAt: changedStatus ? undefined : entry.submittedAt,
            submittedBy: changedStatus ? undefined : entry.submittedBy,
            approval: changedStatus ? undefined : entry.approval,
            publishedAt: changedStatus ? undefined : entry.publishedAt,
            publishedBy: changedStatus ? undefined : entry.publishedBy,
            clientVisibleAt: changedStatus ? undefined : entry.clientVisibleAt,
            updatedAt: now,
          };
        };
        const nextCustomers = customers.map((entry) => ({
          ...entry,
          activities: entry.activities?.map(updateEntry),
          onboardingActivity: entry.onboardingActivity
            ? updateEntry(entry.onboardingActivity)
            : undefined,
        }));
        const nextCustomer = nextCustomers.find(
          (entry) => entry.id === clientId,
        )!;
        const projectUpdates = projects
          .filter((item) => item.clientId === clientId)
          .map((item) => ({
            id: item.id,
            synced: synchronizeProjectPhases(item, nextCustomer, now),
          }));
        setCustomers(nextCustomers);
        setProjects((items) =>
          items.map((item) => {
            const update = projectUpdates.find((entry) => entry.id === item.id);
            return update
              ? {
                  ...item,
                  phases: update.synced.phases,
                  updatedAt: update.synced.changes.length
                    ? now
                    : item.updatedAt,
                }
              : item;
          }),
        );
        if (!activity.projectId) {
          const serverStatus =
            status === "Completata"
              ? "completed"
              : status === "In corso"
                ? "in_progress"
                : status === "In attesa cliente" || status === "Bloccata"
                  ? "waiting_client"
                  : status === "Annullata"
                    ? "cancelled"
                    : "todo";
          const serverItems = uniqueIds.flatMap((id, index) => {
            const candidate = authorizedById.get(id);
            return candidate && !candidate.projectId && candidate.version
              ? [{ id, version: candidate.version, order: (index + 1) * 1000 }]
              : [];
          });
          void commercialApi
            .reorderActivities(activity.id, serverStatus, serverItems)
            .then((response) => {
              const savedById = new Map(
                response.items.map((item) => [item.id, item]),
              );
              setCustomers((items) =>
                items.map((entry) => ({
                  ...entry,
                  activities: entry.activities?.map((candidate) => {
                    const saved = savedById.get(candidate.id);
                    return saved
                      ? {
                          ...candidate,
                          version:
                            numericValue(saved.version) || candidate.version,
                          kanbanOrder: numericValue(saved.kanban_order),
                          updatedAt: dateValue(
                            saved.updated_at,
                            candidate.updatedAt,
                          ),
                        }
                      : candidate;
                  }),
                })),
              );
            })
            .catch((error) => {
              setCustomers(previousCustomers);
              setProjects(previousProjects);
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Impossibile riordinare l’attività",
              );
            });
        } else {
          setTimelineEvents((items) => [
            {
              id: crypto.randomUUID(),
              leadId: customer.sourceLeadId,
              activityId: activity.id,
              kind: "status",
              title:
                activity.status === status
                  ? "Attività riordinata"
                  : status === "Completata"
                    ? "Attività completata"
                    : activity.status === "Completata"
                      ? "Attività riaperta"
                      : "Attività spostata",
              detail:
                activity.status === status
                  ? `Nuova posizione nella colonna ${status}.`
                  : `Stato modificato da ${activity.status} a ${status}.`,
              date: now,
              author: identity.currentUser.name,
            },
            ...items,
          ]);
        }
        return true;
      },
      async submitCustomerActivityWork(clientId, activityId) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        const project = activity?.projectId
          ? projects.find((item) => item.id === activity.projectId)
          : undefined;
        if (!activity || !project || activity.status !== "Completata")
          return false;
        try {
          await deliveryApi.submitQa(
            project.id,
            project.version ?? 1,
            activity.id,
          );
          await reloadDeliveryProject(project.id);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Invio QA non riuscito",
          );
          return false;
        }
      },
      async approveCustomerActivityWork(clientId, activityId, input) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        const project = activity?.projectId
          ? projects.find((item) => item.id === activity.projectId)
          : undefined;
        if (
          !activity ||
          !project ||
          !input.note.trim() ||
          !input.checklist.length ||
          input.checklist.some((item) => !item.checked)
        )
          return false;
        try {
          await deliveryApi.approveQa(
            project.id,
            project.version ?? 1,
            activity.id,
            input.note.trim(),
            input.overrideReason?.trim(),
          );
          await reloadDeliveryProject(project.id);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Approvazione QA non riuscita",
          );
          return false;
        }
      },
      async requestCustomerActivityChanges(clientId, activityId, note) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        const project = activity?.projectId
          ? projects.find((item) => item.id === activity.projectId)
          : undefined;
        if (!activity || !project || !note.trim()) return false;
        try {
          await deliveryApi.requestChanges(
            project.id,
            project.version ?? 1,
            activity.id,
            note.trim(),
          );
          await reloadDeliveryProject(project.id);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Richiesta modifiche non riuscita",
          );
          return false;
        }
      },
      async markCustomerActivityReadyForClient(clientId, activityId) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        const project = activity?.projectId
          ? projects.find((item) => item.id === activity.projectId)
          : undefined;
        if (!activity || !project) return false;
        try {
          const workspace = await deliveryApi.transitionProject(project.id, {
            version: project.version ?? 1,
            status: "ready_client",
          });
          applyDeliveryWorkspace(workspace);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Transizione cliente non riuscita",
          );
          return false;
        }
      },
      async publishCustomerActivityWork(clientId, activityId) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        const project = activity?.projectId
          ? projects.find((item) => item.id === activity.projectId)
          : undefined;
        if (!activity || !project) return false;
        try {
          const workspace = await deliveryApi.transitionProject(project.id, {
            version: project.version ?? 1,
            status: "ready_publish",
          });
          applyDeliveryWorkspace(workspace);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Preparazione pubblicazione non riuscita",
          );
          return false;
        }
      },
      async completeCustomerActivity(clientId, activityId) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        if (!activity?.projectId)
          return this.setCustomerActivityStatus(
            clientId,
            activityId,
            "Completata",
          );
        try {
          await deliveryApi.transitionTask(activity.projectId, activity.id, {
            version: activity.version ?? 1,
            status: "done",
          });
          await reloadDeliveryProject(activity.projectId);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Completamento attività non riuscito",
          );
          return false;
        }
      },
      async reopenCustomerActivity(clientId, activityId) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        if (!activity?.projectId)
          return this.setCustomerActivityStatus(
            clientId,
            activityId,
            "Da fare",
          );
        try {
          await deliveryApi.transitionTask(activity.projectId, activity.id, {
            version: activity.version ?? 1,
            status: "in_progress",
            reason: "Riapertura richiesta dall’interfaccia progetto",
          });
          await reloadDeliveryProject(activity.projectId);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Riapertura attività non riuscita",
          );
          return false;
        }
      },
      duplicateCustomerActivity(clientId, activityId) {
        const customer = customers.find((item) => item.id === clientId);
        const activity = [
          ...(customer?.activities ?? []),
          ...(customer?.onboardingActivity
            ? [customer.onboardingActivity]
            : []),
        ].find((item) => item.id === activityId);
        if (activity)
          this.addCustomerActivity(clientId, {
            ...activity,
            title: `${activity.title} (copia)`,
            dueAt: activity.dueAt,
          });
      },
      deleteCustomerActivity(clientId, activityId) {
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId || item.activityId === activityId,
          );
        if (activity?.projectId) {
          const projectId = activity.projectId;
          return deliveryApi
            .archiveTask(
              projectId,
              activity.id,
              activity.version ?? 1,
              "Archiviazione richiesta dall’interfaccia attività",
            )
            .then(async () => {
              await reloadDeliveryProject(projectId);
            })
            .catch((error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Impossibile archiviare l’attività progetto",
              );
            });
        }
        if (
          !customer ||
          !activity ||
          customer.onboardingActivity?.id === activity.id ||
          customer.onboardingActivity?.activityId === activityId
        )
          return;
        const now = new Date().toISOString();
        const nextCustomer = {
          ...customer,
          activities: (customer.activities ?? []).map((item) =>
            item.id === activity.id || item.activityId === activityId
              ? { ...item, archivedAt: now, updatedAt: now }
              : item,
          ),
        };
        const projectUpdates = projects
          .filter((project) => project.clientId === clientId)
          .map((project) => ({
            project,
            synced: synchronizeProjectPhases(project, nextCustomer, now),
          }));
        setCustomers((items) =>
          items.map((item) => (item.id === clientId ? nextCustomer : item)),
        );
        setProjects((items) =>
          items.map((project) => {
            const update = projectUpdates.find(
              (entry) => entry.project.id === project.id,
            );
            return update
              ? { ...project, phases: update.synced.phases, updatedAt: now }
              : project;
          }),
        );
        const phaseEvents = projectUpdates.flatMap(({ project, synced }) =>
          synced.changes.map(({ phase }) => ({
            id: crypto.randomUUID(),
            leadId: customer.sourceLeadId,
            kind: "status" as const,
            title:
              phase.status === "not_started"
                ? "Fase riportata da avviare"
                : phase.status === "completed"
                  ? "Fase completata"
                  : "Fase avviata",
            detail: `${phase.name} · ${project.name}`,
            date: now,
            author: identity.currentUser.name,
          })),
        );
        setTimelineEvents((items) => [
          ...phaseEvents,
          {
            id: crypto.randomUUID(),
            leadId: customer.sourceLeadId,
            activityId: activity.id,
            kind: "status",
            title: "Attività archiviata",
            detail:
              "Attività rimossa dalle viste operative senza eliminare lo storico.",
            date: now,
            author: identity.currentUser.name,
          },
          ...items,
        ]);
        void deleteActivityOnServer(activity).catch((error) => {
          setCustomers((items) =>
            items.map((item) => (item.id === clientId ? customer : item)),
          );
          toast.error(
            error instanceof Error
              ? error.message
              : "Impossibile archiviare l’attività",
          );
        });
      },
      generateNextCustomerActivityRecurrence(clientId, activityId) {
        const lockKey = `${clientId}:${activityId}`;
        const lockedId = recurrenceGenerationLocks.current.get(lockKey);
        if (lockedId) return lockedId;
        const customer = customers.find((item) => item.id === clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId || item.activityId === activityId,
          );
        if (!customer || !activity || activity.recurrence === "Nessuna")
          return null;
        if (activity.projectId) {
          const projectId = activity.projectId;
          return deliveryApi
            .generateTaskRecurrence(
              projectId,
              activity.id,
              activity.version ?? 1,
            )
            .then(async (result) => {
              await reloadDeliveryProject(projectId);
              return result.item.id;
            })
            .catch((error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Generazione ricorrenza progetto non riuscita",
              );
              return null;
            });
        }
        const alreadyGenerated =
          activity.nextRecurrenceId &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activity.nextRecurrenceId,
          );
        if (alreadyGenerated) {
          recurrenceGenerationLocks.current.set(lockKey, alreadyGenerated.id);
          return alreadyGenerated.id;
        }
        const existing = getCanonicalCustomerActivities(customer).find(
          (item) => item.recurrenceOriginId === activity.id,
        );
        if (existing) {
          recurrenceGenerationLocks.current.set(lockKey, existing.id);
          this.updateCustomerActivity(clientId, activity.id, {
            nextRecurrenceId: existing.id,
          });
          return existing.id;
        }
        const nextDueAt = nextRecurrenceDate(
          activity.dueAt || activity.dueDate,
          activity.recurrence,
        );
        if (!nextDueAt) return null;
        const now = new Date().toISOString();
        const nextId = crypto.randomUUID();
        const nextActivity = normalizeActivity(
          {
            ...activity,
            id: nextId,
            activityId: undefined,
            title: activity.title,
            status: "Da fare",
            completedAt: undefined,
            dueAt: nextDueAt,
            dueDate: nextDueAt.slice(0, 10),
            recurrenceOriginId: activity.id,
            nextRecurrenceId: undefined,
            origin: "ricorrenza",
            archivedAt: undefined,
            createdAt: now,
            updatedAt: now,
            createdBy: identity.currentUser.name,
          },
          customer.profile,
        );
        const nextCustomer = {
          ...customer,
          activities: [
            ...(customer.activities ?? []).map((item) =>
              item.id === activity.id || item.activityId === activityId
                ? { ...item, nextRecurrenceId: nextId, updatedAt: now }
                : item,
            ),
            nextActivity,
          ],
        };
        recurrenceGenerationLocks.current.set(lockKey, nextId);
        setCustomers((items) =>
          items.map((item) => (item.id === clientId ? nextCustomer : item)),
        );
        if (nextActivity.projectId) {
          const project = projects.find(
            (item) => item.id === nextActivity.projectId,
          );
          if (project) {
            const source = {
              ...project,
              activityIds: Array.from(
                new Set([...project.activityIds, nextId]),
              ),
              phases: project.phases.map((phase) =>
                phase.id === nextActivity.phaseId
                  ? {
                      ...phase,
                      activityIds: Array.from(
                        new Set([...phase.activityIds, nextId]),
                      ),
                    }
                  : phase,
              ),
            };
            const synced = synchronizeProjectPhases(source, nextCustomer, now);
            setProjects((items) =>
              items.map((item) =>
                item.id === project.id
                  ? { ...source, phases: synced.phases, updatedAt: now }
                  : item,
              ),
            );
          }
        }
        setTimelineEvents((items) => [
          {
            id: `activity-recurrence-${nextId}`,
            leadId: customer.sourceLeadId,
            activityId: nextId,
            kind: "status",
            title: "Ricorrenza generata",
            detail: `${nextActivity.title} · prossima scadenza ${nextActivity.dueDate}.`,
            date: now,
            author: identity.currentUser.name,
          },
          ...items.filter(
            (event) => event.id !== `activity-recurrence-${nextId}`,
          ),
        ]);
        void createActivityOnServer(customer, nextActivity)
          .then((saved) => {
            if (!saved || typeof saved !== "object" || !("id" in saved)) return;
            const savedRecord = saved as Record<string, unknown> & { id: string };
            recurrenceGenerationLocks.current.set(lockKey, savedRecord.id);
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      activities: item.activities?.map((candidate) =>
                        candidate.id === nextId
                          ? {
                              ...candidate,
                              id: savedRecord.id,
                              version: numericValue(savedRecord.version) || candidate.version,
                              createdAt: dateValue(savedRecord.created_at, candidate.createdAt),
                              updatedAt: dateValue(savedRecord.updated_at, candidate.updatedAt),
                            }
                          : candidate.nextRecurrenceId === nextId
                            ? { ...candidate, nextRecurrenceId: savedRecord.id }
                            : candidate,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            recurrenceGenerationLocks.current.delete(lockKey);
            setCustomers((items) =>
              items.map((item) => (item.id === clientId ? customer : item)),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Generazione ricorrenza non riuscita",
            );
          });
        return nextId;
      },
      async addLead(lead) {
        if (!identity.hasCapability("canCreateLeads"))
          throw new Error("Operazione non autorizzata");
        const authorizedRecord = identity.hasCapability("canAssignLeads")
          ? lead
          : {
              ...lead,
              assigneeId: identity.currentUserId,
              owner: identity.currentUser.name,
            };
        const created = await commercialApi.createLead({
          companyName: authorizedRecord.company,
          title: authorizedRecord.opportunityName || authorizedRecord.company,
          firstName: authorizedRecord.firstName || undefined,
          lastName: authorizedRecord.lastName || undefined,
          email: authorizedRecord.email || undefined,
          phone: authorizedRecord.phone || undefined,
          serviceType: authorizedRecord.service || undefined,
          source: authorizedRecord.source || undefined,
          value: authorizedRecord.value,
          probability: authorizedRecord.probability,
          stage: authorizedRecord.stage,
          assignedTo: authorizedRecord.assigneeId || undefined,
          nextAction: authorizedRecord.nextAction || undefined,
          nextActionAt: authorizedRecord.nextActionAt || undefined,
          campaignId: authorizedRecord.campaignId || undefined,
        });
        const record = mapOpportunity(created.item, authorizedRecord.owner);
        setLeads((items) => [...items, record]);
        setOrder((current) => ({
          ...current,
          new: [...current.new, record.id],
        }));
      },
      addCustomerContact(clientId, contact) {
        const customer = customers.find((item) => item.id === clientId);
        if (!customer) return null;
        const now = new Date().toISOString();
        const record = {
          ...contact,
          id: `optimistic:${crypto.randomUUID()}`,
          createdAt: now,
          updatedAt: now,
        };
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  contacts: [...(item.contacts ?? []), record],
                  primaryContactId: item.primaryContactId ?? record.id,
                }
              : item,
          ),
        );
        const [firstName, ...lastName] = contact.name.trim().split(/\s+/);
        void commercialApi
          .createContact({
            company_id: clientId,
            first_name: firstName || contact.name,
            last_name: lastName.join(" ") || null,
            role_title: contact.role || null,
            email: contact.email || null,
            phone: contact.phone || null,
            is_primary: !customer.primaryContactId,
          })
          .then((saved) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      primaryContactId:
                        item.primaryContactId === record.id
                          ? saved.id
                          : item.primaryContactId,
                      contacts: item.contacts?.map((entry) =>
                        entry.id === record.id
                          ? {
                              ...entry,
                              id: saved.id,
                              version: saved.version,
                              createdAt: dateValue(
                                saved.created_at,
                                entry.createdAt,
                              ),
                              updatedAt: dateValue(
                                saved.updated_at,
                                entry.updatedAt,
                              ),
                            }
                          : entry,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      contacts: item.contacts?.filter(
                        (entry) => entry.id !== record.id,
                      ),
                      primaryContactId:
                        item.primaryContactId === record.id
                          ? undefined
                          : item.primaryContactId,
                    },
              ),
            );
            toast.error(
              error instanceof Error ? error.message : "Contatto non salvato",
            );
          });
        return record.id;
      },
      updateCustomerContact(clientId, contactId, updates) {
        const customer = customers.find((item) => item.id === clientId);
        const current = customer?.contacts?.find(
          (item) => item.id === contactId,
        );
        if (!customer || !current?.version) return false;
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  contacts: item.contacts?.map((item) =>
                    item.id === contactId
                      ? {
                          ...item,
                          ...updates,
                          updatedAt: new Date().toISOString(),
                        }
                      : item,
                  ),
                }
              : item,
          ),
        );
        const name = (updates.name ?? current.name).trim().split(/\s+/);
        void commercialApi
          .updateContact(contactId, {
            version: current.version,
            ...(updates.name !== undefined
              ? {
                  first_name: name[0] || current.name,
                  last_name: name.slice(1).join(" ") || null,
                }
              : {}),
            ...(updates.role !== undefined
              ? { role_title: updates.role || null }
              : {}),
            ...(updates.email !== undefined
              ? { email: updates.email || null }
              : {}),
            ...(updates.phone !== undefined
              ? { phone: updates.phone || null }
              : {}),
          })
          .then((saved) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      contacts: item.contacts?.map((entry) =>
                        entry.id === contactId
                          ? {
                              ...entry,
                              version: saved.version,
                              updatedAt: dateValue(saved.updated_at),
                            }
                          : entry,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      contacts: item.contacts?.map((entry) =>
                        entry.id === contactId ? current : entry,
                      ),
                    },
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Contatto non aggiornato",
            );
          });
        return true;
      },
      removeCustomerContact(clientId, contactId) {
        const customer = customers.find((item) => item.id === clientId);
        const current = customer?.contacts?.find(
          (item) => item.id === contactId,
        );
        if (!customer || !current?.version) return false;
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  contacts: item.contacts?.map((item) =>
                    item.id === contactId
                      ? { ...item, archivedAt: new Date().toISOString() }
                      : item,
                  ),
                  primaryContactId:
                    item.primaryContactId === contactId
                      ? undefined
                      : item.primaryContactId,
                }
              : item,
          ),
        );
        void commercialApi
          .archive("contact", contactId, current.version)
          .then((response) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      contacts: item.contacts?.map((entry) =>
                        entry.id === contactId
                          ? {
                              ...entry,
                              version: response.item.version,
                              archivedAt: dateValue(response.item.deleted_at),
                            }
                          : entry,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      contacts: item.contacts?.map((entry) =>
                        entry.id === contactId ? current : entry,
                      ),
                      primaryContactId: customer.primaryContactId,
                    },
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Contatto non archiviato",
            );
          });
        return true;
      },
      setPrimaryCustomerContact(clientId, contactId) {
        const customer = customers.find((item) => item.id === clientId);
        if (
          !customer ||
          (contactId &&
            !customer.contacts?.some(
              (item) => item.id === contactId && !item.archivedAt,
            ))
        )
          return false;
        const contact = customer.contacts?.find(
          (item) => item.id === contactId,
        );
        if (!contactId || !contact?.version) return false;
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? { ...item, primaryContactId: contactId }
              : item,
          ),
        );
        void commercialApi
          .setPrimaryContact(clientId, contactId, contact.version)
          .then((response) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      primaryContactId: contactId,
                      contacts: item.contacts?.map((entry) =>
                        entry.id === contactId
                          ? { ...entry, version: response.item.version }
                          : entry,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) => (item.id === clientId ? customer : item)),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Contatto principale non salvato",
            );
          });
        return true;
      },
      addCustomerCommunication(clientId, input) {
        const customer = customers.find((item) => item.id === clientId);
        if (!customer) return null;
        const now = new Date().toISOString();
        const record: CustomerCommunication = {
          ...input,
          id: `optimistic:${crypto.randomUUID()}`,
          leadId: input.leadId ?? customer.sourceLeadId,
          createdAt: now,
          updatedAt: now,
        };
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  communications: [...(item.communications ?? []), record],
                }
              : item,
          ),
        );
        void commercialApi
          .createCommunication(clientId, {
            channel: record.channel.toLowerCase(),
            title: record.title,
            body: record.body,
            occurredAt: record.occurredAt,
            leadId: record.leadId,
          })
          .then(({ item: saved }) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      communications: item.communications?.map((entry) =>
                        entry.id === record.id
                          ? {
                              ...entry,
                              id: saved.id,
                              version: saved.version,
                              createdAt: dateValue(
                                saved.created_at,
                                entry.createdAt,
                              ),
                              updatedAt: dateValue(
                                saved.updated_at,
                                entry.updatedAt,
                              ),
                            }
                          : entry,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      communications: item.communications?.filter(
                        (entry) => entry.id !== record.id,
                      ),
                    },
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Comunicazione non salvata",
            );
          });
        return record.id;
      },
      updateCustomerCommunication(clientId, communicationId, updates) {
        const customer = customers.find((item) => item.id === clientId);
        const current = customer?.communications?.find(
          (item) => item.id === communicationId && !item.archivedAt,
        );
        if (!customer || !current?.version) return false;
        const now = new Date().toISOString();
        const next = { ...current, ...updates, updatedAt: now };
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  communications: item.communications?.map((entry) =>
                    entry.id === communicationId ? next : entry,
                  ),
                }
              : item,
          ),
        );
        void commercialApi
          .updateCommunication(clientId, communicationId, current.version, {
            channel: next.channel.toLowerCase(),
            title: next.title,
            body: next.body,
            occurred_at: next.occurredAt,
          })
          .then(({ item: saved }) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      communications: item.communications?.map((entry) =>
                        entry.id === communicationId
                          ? {
                              ...entry,
                              version: saved.version,
                              updatedAt: dateValue(saved.updated_at),
                            }
                          : entry,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      communications: item.communications?.map((entry) =>
                        entry.id === communicationId ? current : entry,
                      ),
                    },
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Comunicazione non aggiornata",
            );
          });
        return true;
      },
      removeCustomerCommunication(clientId, communicationId) {
        const customer = customers.find((item) => item.id === clientId);
        const current = customer?.communications?.find(
          (item) => item.id === communicationId && !item.archivedAt,
        );
        if (!customer || !current?.version) return false;
        const now = new Date().toISOString();
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  communications: item.communications?.map((entry) =>
                    entry.id === communicationId
                      ? { ...entry, archivedAt: now, updatedAt: now }
                      : entry,
                  ),
                }
              : item,
          ),
        );
        void commercialApi
          .archive("communication", communicationId, current.version)
          .then((response) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      communications: item.communications?.map((entry) =>
                        entry.id === communicationId
                          ? {
                              ...entry,
                              version: response.item.version,
                              archivedAt: dateValue(response.item.deleted_at),
                              updatedAt: dateValue(response.item.updated_at),
                            }
                          : entry,
                      ),
                    },
              ),
            );
          })
          .catch((error) => {
            setCustomers((items) =>
              items.map((item) =>
                item.id !== clientId
                  ? item
                  : {
                      ...item,
                      communications: item.communications?.map((entry) =>
                        entry.id === communicationId ? current : entry,
                      ),
                    },
              ),
            );
            toast.error(
              error instanceof Error
                ? error.message
                : "Comunicazione non archiviata",
            );
          });
        return true;
      },
      addCustomerDocument(clientId, input) {
        const customer = customers.find((item) => item.id === clientId);
        if (
          !customer ||
          !identity.hasCapability("canEditCustomers") ||
          !canViewCustomer(identity.currentUser, customer, permissionScope)
        )
          return null;
        const now = new Date().toISOString();
        const record: CustomerDocument = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? { ...item, documents: [...(item.documents ?? []), record] }
              : item,
          ),
        );
        appendAuditChanges(
          "document",
          record.id,
          {},
          { name: record.name, status: record.status },
          "manual",
        );
        setTimelineEvents((items) => [
          {
            id: `document-created:${record.id}`,
            leadId: customer.sourceLeadId,
            kind: "status",
            title: `Documento ${record.status.toLowerCase()}`,
            detail: record.name,
            date: now,
            author: identity.currentUser.name,
          },
          ...items,
        ]);
        return record.id;
      },
      updateCustomerDocument(clientId, documentId, updates) {
        const customer = customers.find((item) => item.id === clientId);
        const current = customer?.documents?.find(
          (item) => item.id === documentId && !item.archivedAt,
        );
        if (
          !customer ||
          !current ||
          !identity.hasCapability("canEditCustomers") ||
          !canViewCustomer(identity.currentUser, customer, permissionScope) ||
          !hasMeaningfulChanges(current, updates)
        )
          return false;
        const now = new Date().toISOString();
        const next = { ...current, ...updates, id: current.id, updatedAt: now };
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  documents: item.documents?.map((entry) =>
                    entry.id === documentId ? next : entry,
                  ),
                }
              : item,
          ),
        );
        appendAuditChanges("document", documentId, current, updates, "manual");
        const changedStatus =
          updates.status && updates.status !== current.status;
        setTimelineEvents((items) => [
          {
            id: changedStatus
              ? `document-status:${documentId}:${current.status}:${updates.status}`
              : `document-updated:${documentId}:${now}`,
            leadId: customer.sourceLeadId,
            kind: "status",
            title: changedStatus
              ? `Documento ${updates.status!.toLowerCase()}`
              : "Documento aggiornato",
            detail: changedStatus
              ? `${next.name} · ${current.status} → ${updates.status}`
              : next.name,
            date: now,
            author: identity.currentUser.name,
          },
          ...items,
        ]);
        return true;
      },
      removeCustomerDocument(clientId, documentId) {
        const customer = customers.find((item) => item.id === clientId);
        const current = customer?.documents?.find(
          (item) => item.id === documentId && !item.archivedAt,
        );
        if (
          !customer ||
          !current ||
          !identity.hasCapability("canEditCustomers") ||
          !canViewCustomer(identity.currentUser, customer, permissionScope)
        )
          return false;
        const now = new Date().toISOString();
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  documents: item.documents?.map((entry) =>
                    entry.id === documentId
                      ? { ...entry, archivedAt: now, updatedAt: now }
                      : entry,
                  ),
                }
              : item,
          ),
        );
        appendAuditChanges(
          "document",
          documentId,
          current,
          { status: "Archiviato", archivedAt: now },
          "manual",
        );
        setTimelineEvents((items) => [
          {
            id: `document-archived:${documentId}`,
            leadId: customer.sourceLeadId,
            kind: "status",
            title: "Documento archiviato",
            detail: current.name,
            date: now,
            author: identity.currentUser.name,
          },
          ...items,
        ]);
        return true;
      },
      async startCustomerOnboarding(clientId) {
        const customer = customers.find((item) => item.id === clientId);
        if (!customer) return null;
        const existing = projects.find(
          (project) =>
            project.clientId === clientId && project.status !== "cancelled",
        );
        if (existing) return existing.id;
        const due = (days: number) =>
          new Date(Date.now() + days * 86_400_000).toISOString();
        try {
          const workspace = await deliveryApi.createProject({
            company_id: clientId,
            lead_id: customer.sourceLeadId,
            source_event_id: `onboarding:${clientId}`,
            name: `${customer.profile.company} · ${customer.profile.service}`,
            description:
              "Progetto creato dalla procedura guidata di onboarding.",
            type: "other",
            status: "onboarding",
            priority: "high",
            project_manager_id: customer.profile.assigneeId,
            start_date: new Date().toISOString(),
            phases: [
              {
                key: "onboarding",
                title: "Onboarding",
                description: "Raccolta dati, kick-off e piano operativo.",
                sort_order: 0,
                weight: 1,
                responsible_user_id: customer.profile.assigneeId,
              },
            ],
            tasks: [
              {
                key: "brief",
                phase_key: "onboarding",
                title: "Raccolta brief operativo",
                description: "Checklist iniziale onboarding.",
                status: "backlog",
                priority: "high",
                assignee_id: customer.profile.assigneeId,
                due_at: due(2),
              },
              {
                key: "materials",
                phase_key: "onboarding",
                title: "Raccolta materiali",
                description: "Checklist iniziale onboarding.",
                status: "backlog",
                priority: "high",
                assignee_id: customer.profile.assigneeId,
                due_at: due(4),
              },
              {
                key: "plan",
                phase_key: "onboarding",
                title: "Conferma piano operativo",
                description: "Checklist iniziale onboarding.",
                status: "backlog",
                priority: "high",
                assignee_id: customer.profile.assigneeId,
                due_at: due(7),
              },
            ],
            dependencies: [
              { predecessor_key: "brief", successor_key: "materials" },
              { predecessor_key: "materials", successor_key: "plan" },
            ],
          });
          const project = applyDeliveryWorkspace(workspace);
          return project.id;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Avvio onboarding non riuscito",
          );
          return null;
        }
      },
      async startProjectTime(projectId, activityId) {
        try {
          const result = await deliveryApi.startTimer(projectId, activityId);
          const item = result.item as unknown as DeliveryWorkspace["project"];
          await reloadDeliveryProject(projectId);
          return {
            ok: true,
            sessionId: item.id,
            existing: result.unchanged === true,
          };
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "Avvio timer non riuscito",
          };
        }
      },
      async stopProjectTime(sessionId, description) {
        const session = timeSessions.find(
          (item) => item.id === sessionId && !item.archivedAt,
        );
        if (!session)
          return { ok: false, message: "Sessione timer non trovata." };
        try {
          const result = await deliveryApi.stopTimer(
            sessionId,
            session.version ?? 1,
            description,
          );
          const item = result.item as unknown as Record<string, unknown>;
          await reloadDeliveryProject(session.projectId);
          return {
            ok: true,
            durationMinutes: Math.ceil(Number(item.duration_seconds ?? 0) / 60),
            existing: result.unchanged === true,
          };
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "Arresto timer non riuscito",
          };
        }
      },
      async archiveProjectTime(sessionId) {
        const session = timeSessions.find(
          (item) => item.id === sessionId && !item.archivedAt,
        );
        if (!session) return false;
        try {
          await deliveryApi.archiveTimer(
            session.id,
            session.version ?? 1,
            "Archiviazione richiesta dall’interfaccia Delivery",
          );
          await reloadDeliveryProject(session.projectId);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Archiviazione timer non riuscita",
          );
          return false;
        }
      },
      async setProjectQaItem(projectId, itemId, completed) {
        try {
          const workspace = await deliveryApi.workspace(projectId);
          const item = workspace.qa.find((entry) => entry.id === itemId);
          if (!item) return false;
          await deliveryApi.updateQa(
            projectId,
            itemId,
            Number(item.version ?? 1),
            completed,
          );
          await reloadDeliveryProject(projectId);
          return true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Aggiornamento QA non riuscito",
          );
          return false;
        }
      },
      async publishProjectClientUpdate(projectId) {
        const project = projects.find((item) => item.id === projectId);
        if (!project) return { ok: false, message: "Progetto non trovato." };
        try {
          const result = await deliveryApi.publish(
            projectId,
            project.version ?? 1,
          );
          await reloadDeliveryProject(projectId);
          return { ok: true, existing: result.unchanged === true };
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "Pubblicazione non riuscita",
          };
        }
      },
      async deliverProject(projectId) {
        const project = projects.find((item) => item.id === projectId);
        if (!project) return { ok: false, message: "Progetto non trovato." };
        try {
          const result = await deliveryApi.deliver(
            projectId,
            project.version ?? 1,
          );
          await reloadDeliveryProject(projectId);
          return { ok: true, existing: result.unchanged === true };
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error ? error.message : "Consegna non riuscita",
          };
        }
      },
      updateCustomerCare(clientId, care) {
        const customer = customers.find((item) => item.id === clientId);
        if (!customer) return false;
        const status =
          care.mode === "Assistenza"
            ? "Assistenza"
            : care.mode === "Rinnovo"
              ? "Rinnovo"
              : customer.deliveredAt
                ? "Consegnato"
                : customer.status;
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId ? { ...item, care, status } : item,
          ),
        );
        return true;
      },
      ensureCustomerCareActivity(clientId, careOverride) {
        const customer = customers.find((item) => item.id === clientId);
        const care = careOverride ?? customer?.care;
        if (!customer || !care?.nextDueAt || care.mode === "Nessuna")
          return null;
        const title = `${care.mode}: ${customer.profile.company}`;
        const dueDate = care.nextDueAt.slice(0, 10);
        const existing = getCanonicalCustomerActivities(customer).find(
          (activity) =>
            activity.title === title && activity.dueDate === dueDate,
        );
        if (existing) return existing.id;
        const id = this.addCustomerActivity(clientId, {
          title,
          description: `Scadenza ${care.mode.toLowerCase()} cliente.`,
          type: "Attività",
          status: "Da fare",
          priority: "Media",
          assigneeId: care.assigneeId,
          dueAt: care.nextDueAt,
        });
        if (typeof id !== "string") return null;
        setCustomers((items) =>
          items.map((item) =>
            item.id === clientId
              ? {
                  ...item,
                  care: { ...care, lastGeneratedDueAt: care.nextDueAt },
                }
              : item,
          ),
        );
        return id;
      },
      async mergeDuplicateRecords({ primaryId, secondaryId, fields }) {
        if (!identity.hasCapability("canMergeDuplicates"))
          return {
            ok: false as const,
            code: "FORBIDDEN",
            message: "L'account corrente non può fondere record duplicati.",
          };
        const primaryLead = leads.find((item) => item.id === primaryId);
        const secondaryLead = leads.find((item) => item.id === secondaryId);
        const primaryCustomer = customers.find((item) => item.id === primaryId);
        const secondaryCustomer = customers.find(
          (item) => item.id === secondaryId,
        );
        if (!primaryId || primaryId === secondaryId)
          return {
            ok: false as const,
            code: "SAME_ID",
            message: "Non è possibile fondere un record con se stesso.",
          };
        if (!fields)
          return {
            ok: false as const,
            code: "MISSING_FIELDS",
            message:
              "I valori selezionati per la fusione non sono disponibili.",
          };
        if (
          (!primaryLead && !primaryCustomer) ||
          (!secondaryLead && !secondaryCustomer)
        )
          return {
            ok: false as const,
            code: "RECORD_NOT_FOUND",
            message: `Record non trovato: principale ${primaryId}, secondario ${secondaryId}.`,
          };
        if (
          primaryLead?.archivedAt ||
          primaryCustomer?.archivedAt ||
          secondaryLead?.archivedAt ||
          secondaryCustomer?.archivedAt
        )
          return {
            ok: false as const,
            code: "ARCHIVED_RECORD",
            message: "Non è possibile fondere record già archiviati.",
          };
        const primaryCanonicalLeadId =
          primaryLead?.id ?? primaryCustomer!.sourceLeadId;
        const secondaryCanonicalLeadId =
          secondaryLead?.id ?? secondaryCustomer!.sourceLeadId;
        if (primaryCanonicalLeadId === secondaryCanonicalLeadId)
          return {
            ok: false as const,
            code: "SAME_CANONICAL_RECORD",
            message:
              "I record selezionati appartengono già alla stessa anagrafica.",
          };
        const now = new Date().toISOString();
        const primaryClient =
          primaryCustomer ??
          customers.find(
            (item) =>
              item.sourceLeadId === primaryCanonicalLeadId && !item.archivedAt,
          );
        const secondaryClient =
          secondaryCustomer ??
          customers.find(
            (item) =>
              item.sourceLeadId === secondaryCanonicalLeadId &&
              !item.archivedAt,
          );
        const baseProfile = primaryLead ?? primaryCustomer!.profile;
        const nextProfile = {
          ...baseProfile,
          ...fields,
          stage: fields.stage ?? baseProfile.stage,
          status: fields.status ?? baseProfile.status,
        };
        const transferredActivities = secondaryClient
          ? getCanonicalCustomerActivities(secondaryClient)
          : [];
        const transferredContacts = secondaryClient?.contacts ?? [];
        const transferredCommunications = secondaryClient?.communications ?? [];
        const transferredDocuments = secondaryClient?.documents ?? [];
        const nextCustomers = customers.map((customer) => {
          if (primaryClient && customer.id === primaryClient.id)
            return {
              ...customer,
              profile: { ...customer.profile, ...nextProfile },
              sourceLeadId: primaryCanonicalLeadId,
              sourceDealId: primaryCanonicalLeadId,
              activities: uniqueById([
                ...getCanonicalCustomerActivities(customer),
                ...transferredActivities,
              ]),
              contacts: uniqueById([
                ...(customer.contacts ?? []),
                ...transferredContacts,
              ]),
              communications: uniqueById([
                ...(customer.communications ?? []),
                ...transferredCommunications,
              ]),
              documents: uniqueById([
                ...(customer.documents ?? []),
                ...transferredDocuments,
              ]),
              updatedAt: now,
            };
          if (
            secondaryClient &&
            customer.id === secondaryClient.id &&
            customer.id !== primaryClient?.id
          )
            return {
              ...customer,
              archivedAt: now,
              mergedIntoId: primaryClient?.id ?? primaryCanonicalLeadId,
              activities: [],
              contacts: [],
              communications: [],
              documents: [],
            };
          return customer;
        });
        const nextLeads = leads.map((lead) => {
          if (lead.id === primaryCanonicalLeadId)
            return { ...lead, ...nextProfile };
          if (
            lead.id === secondaryCanonicalLeadId &&
            lead.id !== primaryCanonicalLeadId
          )
            return { ...lead, archivedAt: now, mergedIntoId: primaryId };
          return lead;
        });
        const nextProjects = projects.map((project) => {
          if (
            secondaryClient &&
            project.clientId === secondaryClient.id &&
            primaryClient &&
            secondaryClient.id !== primaryClient.id
          )
            return {
              ...project,
              clientId: primaryClient.id,
              sourceLeadId: primaryCanonicalLeadId,
              activityIds: Array.from(new Set(project.activityIds)),
              phases: project.phases.map((phase) => ({
                ...phase,
                activityIds: Array.from(new Set(phase.activityIds)),
              })),
              updatedAt: now,
            };
          return project.sourceLeadId === secondaryCanonicalLeadId
            ? {
                ...project,
                sourceLeadId: primaryCanonicalLeadId,
                updatedAt: now,
              }
            : project;
        });
        const nextLeadActivities = leadActivities.map((activity) =>
          activity.leadId === secondaryCanonicalLeadId
            ? { ...activity, leadId: primaryCanonicalLeadId, updatedAt: now }
            : activity,
        );
        const existingTimeline = timelineEvents.map((event) =>
          event.leadId === secondaryCanonicalLeadId
            ? { ...event, leadId: primaryCanonicalLeadId }
            : event,
        );
        const nextTimeline = uniqueById(existingTimeline);
        const nextOrder = Object.fromEntries(
          Object.entries(order).map(([stage, ids]) => [
            stage,
            ids.filter((id) => id !== secondaryCanonicalLeadId),
          ]),
        ) as Record<PipelineStage, string[]>;
        const nextIgnoredDuplicatePairs = ignoredDuplicatePairs.filter(
          (pair) =>
            !pair.split("::").includes(primaryId) &&
            !pair.split("::").includes(secondaryId),
        );
        const nextAppointments = appointments.map((appointment) =>
          appointment.leadId === secondaryCanonicalLeadId
            ? {
                ...appointment,
                leadId: primaryCanonicalLeadId,
                customerId:
                  appointment.customerId === secondaryClient?.id
                    ? primaryClient?.id
                    : appointment.customerId,
                updatedAt: now,
              }
            : appointment,
        );
        try {
          const primaryVersion =
            primaryLead?.version ?? primaryCustomer?.version;
          const secondaryVersion =
            secondaryLead?.version ?? secondaryCustomer?.version;
          if (!primaryVersion || !secondaryVersion)
            throw new Error(
              "Versione duplicati non disponibile: ricarica l’analisi",
            );
          const merged = await commercialApi.mergeDuplicates({
            primaryId,
            secondaryId,
            primaryVersion,
            secondaryVersion,
            fields,
          });
          if (primaryLead)
            nextLeads.splice(
              nextLeads.findIndex((item) => item.id === primaryCanonicalLeadId),
              1,
              {
                ...nextLeads.find(
                  (item) => item.id === primaryCanonicalLeadId,
                )!,
                version: merged.item.version,
              },
            );
          if (primaryCustomer)
            nextCustomers.splice(
              nextCustomers.findIndex((item) => item.id === primaryCustomer.id),
              1,
              {
                ...nextCustomers.find(
                  (item) => item.id === primaryCustomer.id,
                )!,
                version: merged.item.version,
              },
            );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            ok: false as const,
            code: "PERSISTENCE_FAILED",
            message: `Impossibile completare la fusione: ${message}`,
          };
        }
        setLeads(nextLeads);
        setLeadActivities(nextLeadActivities);
        setCustomers(nextCustomers);
        setProjects(nextProjects);
        setTimelineEvents(nextTimeline);
        setOrder(nextOrder);
        setAppointments(nextAppointments);
        setIgnoredDuplicatePairs(nextIgnoredDuplicatePairs);
        const result = {
          ok: true as const,
          primaryId,
          secondaryId,
          href: primaryCustomer
            ? `/dashboard/clienti/${primaryId}`
            : `/dashboard/commercial/leads/${primaryCanonicalLeadId}`,
        };
        return result;
      },
      async createProject(project) {
        const customer = customers.find((item) => item.id === project.clientId);
        if (!customer) throw new Error("Cliente non trovato");
        try {
          let workspace = await deliveryApi.createProject({
            company_id: project.clientId,
            ...(project.sourceLeadId ? { lead_id: project.sourceLeadId } : {}),
            ...(project.orderId ? { order_id: project.orderId } : {}),
            name: project.name,
            description: project.description,
            type: project.type,
            status: project.status,
            priority: project.priority,
            project_manager_id: project.ownerId,
            ...(project.startDate ? { start_date: project.startDate } : {}),
            ...(project.dueDate ? { due_date: project.dueDate } : {}),
          });
          const projectId = workspace.project.id;
          applyDeliveryWorkspace(workspace);
          const supervisors = new Set(project.supervisorIds ?? []);
          const members = Array.from(
            new Set([...project.memberIds, ...supervisors]),
          ).filter((id) => id !== project.ownerId);
          for (const userId of members) {
            await deliveryApi.upsertMember(projectId, {
              user_id: userId,
              role: supervisors.has(userId) ? "supervisor" : "member",
            });
          }
          for (const phase of project.phases ?? []) {
            await deliveryApi.createPhase(projectId, {
              title: phase.name,
              description: phase.description,
              weight: phase.weight ?? 1,
              sort_order: phase.order,
              ...(phase.startDate ? { planned_start_at: phase.startDate } : {}),
              ...(phase.dueDate ? { planned_due_at: phase.dueDate } : {}),
            });
          }
          workspace = await deliveryApi.workspace(projectId);
          applyDeliveryWorkspace(workspace);
          return projectId;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Creazione progetto non riuscita",
          );
          throw error;
        }
      },
      async updateProject(projectId, updates) {
        try {
          let workspace = await deliveryApi.workspace(projectId);
          let current = mapDeliveryProject(workspace);
          const body: Record<string, unknown> = {
            version: current.version ?? 1,
          };
          if (updates.name !== undefined) body.name = updates.name;
          if (updates.description !== undefined)
            body.description = updates.description;
          if (updates.type !== undefined) body.type = updates.type;
          if (updates.priority !== undefined) body.priority = updates.priority;
          if (updates.clientId !== undefined)
            body.company_id = updates.clientId;
          if (updates.ownerId !== undefined)
            body.project_manager_id = updates.ownerId;
          if (updates.startDate !== undefined)
            body.start_date = updates.startDate;
          if (updates.dueDate !== undefined) body.due_date = updates.dueDate;
          if (Object.keys(body).length > 1) {
            workspace = await deliveryApi.updateProject(projectId, body);
            current = applyDeliveryWorkspace(workspace);
          }
          if (
            updates.status !== undefined &&
            updates.status !== current.status
          ) {
            workspace = await deliveryApi.transitionProject(projectId, {
              version: current.version ?? 1,
              status: updates.status,
              ...([
                "blocked",
                "changes_requested",
                "suspended",
                "cancelled",
              ].includes(updates.status)
                ? { reason: "Transizione richiesta dall’interfaccia progetto" }
                : {}),
            });
            current = applyDeliveryWorkspace(workspace);
          }
          const supervisors = new Set(
            updates.supervisorIds ?? current.supervisorIds ?? [],
          );
          const requestedMembers = updates.memberIds ?? current.memberIds;
          const ownerId = updates.ownerId ?? current.ownerId;
          const desiredMembers = new Set(
            [...requestedMembers, ...supervisors, ownerId].filter(Boolean),
          );
          for (const userId of desiredMembers) {
            await deliveryApi.upsertMember(projectId, {
              user_id: userId,
              role:
                userId === ownerId
                  ? "project_manager"
                  : supervisors.has(userId)
                    ? "supervisor"
                    : "member",
            });
          }
          workspace = await deliveryApi.workspace(projectId);
          for (const member of workspace.members) {
            const userId = String(member.user_id ?? "");
            if (userId && !desiredMembers.has(userId)) {
              await deliveryApi.removeMember(
                projectId,
                member.id,
                Number(member.version ?? 1),
                "Rimozione richiesta dall’interfaccia progetto",
              );
            }
          }
          await reloadDeliveryProject(projectId);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Aggiornamento progetto non riuscito",
          );
        }
      },
      async archiveProject(projectId) {
        const project = projects.find((item) => item.id === projectId);
        if (!project) return;
        try {
          await deliveryApi.archiveProject(
            projectId,
            project.version ?? 1,
            "Archiviazione richiesta dall’interfaccia progetto",
          );
          setProjects((items) => items.filter((item) => item.id !== projectId));
          setTimeSessions((items) =>
            items.filter((item) => item.projectId !== projectId),
          );
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Archiviazione progetto non riuscita",
          );
        }
      },
      async addProjectPhase(projectId, phase) {
        try {
          const result = await deliveryApi.createPhase(projectId, {
            title: phase.name,
            description: phase.description,
            weight: phase.weight ?? 1,
            sort_order:
              projects.find((item) => item.id === projectId)?.phases.length ??
              0,
            ...(phase.startDate ? { planned_start_at: phase.startDate } : {}),
            ...(phase.dueDate ? { planned_due_at: phase.dueDate } : {}),
          });
          await reloadDeliveryProject(projectId);
          return result.item.id;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Creazione fase non riuscita",
          );
          return null;
        }
      },
      async updateProjectPhase(projectId, phaseId, updates) {
        const phase = projects
          .find((item) => item.id === projectId)
          ?.phases.find((item) => item.id === phaseId);
        if (!phase) return;
        try {
          await deliveryApi.updatePhase(projectId, phaseId, {
            version: phase.version ?? 1,
            ...(updates.name !== undefined ? { title: updates.name } : {}),
            ...(updates.description !== undefined
              ? { description: updates.description }
              : {}),
            ...(updates.weight !== undefined ? { weight: updates.weight } : {}),
            ...(updates.order !== undefined
              ? { sort_order: updates.order }
              : {}),
            ...(updates.startDate !== undefined
              ? { planned_start_at: updates.startDate }
              : {}),
            ...(updates.dueDate !== undefined
              ? { planned_due_at: updates.dueDate }
              : {}),
            ...(updates.status !== undefined
              ? {
                  status:
                    updates.status === "not_started"
                      ? "pending"
                      : updates.status,
                }
              : {}),
          });
          await reloadDeliveryProject(projectId);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Aggiornamento fase non riuscito",
          );
        }
      },
      async deleteProjectPhase(projectId, phaseId) {
        const phase = projects
          .find((item) => item.id === projectId)
          ?.phases.find((item) => item.id === phaseId);
        if (!phase) return;
        try {
          await deliveryApi.deletePhase(
            projectId,
            phaseId,
            phase.version ?? 1,
            "Archiviazione fase richiesta dall’interfaccia progetto",
          );
          await reloadDeliveryProject(projectId);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Archiviazione fase non riuscita",
          );
        }
      },
      async reorderProjectPhases(projectId, phaseIds) {
        const project = projects.find((item) => item.id === projectId);
        if (!project) return;
        try {
          applyDeliveryWorkspace(
            await deliveryApi.reorderPhases(
              projectId,
              project.version ?? 1,
              phaseIds,
            ),
          );
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Riordino fasi non riuscito",
          );
        }
      },
      async setProjectPhaseStatus(projectId, phaseId, status) {
        const phase = projects
          .find((item) => item.id === projectId)
          ?.phases.find((item) => item.id === phaseId);
        if (!phase) return;
        try {
          await deliveryApi.updatePhase(projectId, phaseId, {
            version: phase.version ?? 1,
            status: status === "not_started" ? "pending" : status,
          });
          await reloadDeliveryProject(projectId);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Transizione fase non riuscita",
          );
        }
      },
      async linkActivityToProjectPhase(projectId, phaseId, activityIds) {
        const customer = customers.find(
          (item) =>
            item.id ===
            projects.find((project) => project.id === projectId)?.clientId,
        );
        if (!customer) return;
        try {
          for (const activityId of activityIds) {
            const activity = getCanonicalCustomerActivities(customer).find(
              (item) => item.id === activityId,
            );
            if (activity)
              await deliveryApi.linkActivity(
                projectId,
                activityId,
                activity.version ?? 1,
                phaseId,
              );
          }
          await reloadDeliveryProject(projectId);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Collegamento attività alla fase non riuscito",
          );
        }
      },
      async unlinkActivityFromProjectPhase(projectId, _phaseId, activityId) {
        const customer = customers.find(
          (item) =>
            item.id ===
            projects.find((project) => project.id === projectId)?.clientId,
        );
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        if (!activity) return;
        try {
          await deliveryApi.linkActivity(
            projectId,
            activityId,
            activity.version ?? 1,
          );
          await reloadDeliveryProject(projectId);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Scollegamento attività dalla fase non riuscito",
          );
        }
      },
      getProjectsByClientId(clientId) {
        return projects.filter((item) => item.clientId === clientId);
      },
      async linkActivityToProject(projectId, activityId) {
        const project = projects.find((item) => item.id === projectId);
        const customer =
          project && customers.find((item) => item.id === project.clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        if (!activity) return;
        try {
          await deliveryApi.linkActivity(
            projectId,
            activityId,
            activity.version ?? 1,
          );
          await reloadDeliveryProject(projectId);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Collegamento attività non riuscito",
          );
        }
      },
      async unlinkActivityFromProject(projectId, activityId) {
        const project = projects.find((item) => item.id === projectId);
        const customer =
          project && customers.find((item) => item.id === project.clientId);
        const activity =
          customer &&
          getCanonicalCustomerActivities(customer).find(
            (item) => item.id === activityId,
          );
        if (!activity) return;
        try {
          await deliveryApi.unlinkActivity(
            projectId,
            activityId,
            activity.version ?? 1,
          );
          await reloadDeliveryProject(projectId);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Scollegamento attività non riuscito",
          );
        }
      },
    }),
    [
      appendAuditChanges,
      applyDeliveryWorkspace,
      appointments,
      archivedRecords,
      automationRules,
      automationRuns,
      campaigns,
      canAccessRecord,
      comments,
      commerceSettings,
      contracts,
      customers,
      duplicatesLastAnalyzedAt,
      goals,
      hasHydrated,
      identity,
      ignoredDuplicatePairs,
      invoices,
      leadActivities,
      leads,
      order,
      orders,
      payments,
      permissionScope,
      pointPolicy,
      projects,
      quotes,
      rankingConfigs,
      rankingSnapshots,
      renewals,
      retrySecondary,
      retryWorkspace,
      reloadCommerceState,
      reloadDocumentRevenueState,
      reloadDeliveryProject,
      sales,
      secondaryError,
      secondaryStatus,
      services,
      setCustomers,
      setDuplicatesLastAnalyzedAt,
      setIgnoredDuplicatePairs,
      setLeadActivities,
      setLeads,
      setOrder,
      timelineEvents,
      timeSessions,
      visibleAppointments,
      visibleAuditEvents,
      visibleAutomationNotifications,
      visibleAutomationRules,
      visibleAutomationRuns,
      visibleCampaigns,
      visibleComments,
      visibleContracts,
      visibleCustomers,
      visibleInvoices,
      visibleLeadActivities,
      visibleLeads,
      visibleOrder,
      visibleOrders,
      visiblePayments,
      visiblePointLedger,
      visibleProjects,
      visibleQuotes,
      visibleRankingSnapshots,
      visibleRenewals,
      visibleSales,
      visibleServices,
      visibleTimeSessions,
      visibleTimelineEvents,
      workspaceError,
      workspaceStatus,
    ],
  );

  return (
    <CommercialLeadsContext.Provider value={value}>
      {children}
    </CommercialLeadsContext.Provider>
  );
}

export function useCommercialLeads() {
  const store = useContext(CommercialLeadsContext);
  if (!store)
    throw new Error(
      "useCommercialLeads must be used within CommercialLeadsProvider",
    );
  return store;
}

export function useOptionalCommercialLeads() {
  return useContext(CommercialLeadsContext);
}

/** Accesso completo riservato ai flussi che devono confrontare record trasversali (Duplicati). */
export function useCommercialLeadsAll() {
  const store = useCommercialLeads();
  return {
    ...store,
    leads: store.allLeads,
    customers: store.allCustomers,
    projects: store.allProjects,
  };
}
