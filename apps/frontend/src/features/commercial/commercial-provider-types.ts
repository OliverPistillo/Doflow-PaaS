import type { ProductionProjectStatus } from "@/features/commercial/commercial-production";
import type {
  CommerceSettings,
  CommercialContract,
  CommercialOrder,
  CommercialOrderItem,
  CommercialPayment,
  CommercialRenewal,
  CommercialSale,
  CommercialService,
} from "@/features/commercial/commercial-commerce";
import type {
  CollaborationRecordType,
  CommercialAuditEvent,
  CommercialComment,
  CommentAttachment,
  PointLedgerEntry,
  PointPolicy,
} from "@/features/commercial/commercial-collaboration";
import type { CommercialCampaign } from "@/features/commercial/commercial-campaigns";
import type {
  CommercialInvoice,
  CommercialQuote,
} from "@/features/commercial/commercial-documents";
import type {
  AutomationNotification,
  AutomationRun,
  CommercialAutomationRule,
} from "@/features/commercial/commercial-automations";
import type {
  CommercialLead,
  PipelineStage,
} from "@/features/commercial/types";
import type { CustomerDocumentStatus } from "@/features/commercial/document-status";

export type CommercialTimelineEvent = {
  id: string;
  leadId: string;
  activityId?: string;
  appointmentId?: string;
  saleId?: string;
  orderId?: string;
  paymentId?: string;
  contractId?: string;
  renewalId?: string;
  customerId?: string;
  kind: "status";
  title: string;
  detail: string;
  date: string;
  author: string;
};

export type CommercialCustomer = {
  id: string;
  version?: number;
  leadId: string;
  sourceLeadId: string;
  sourceDealId: string;
  profile: CommercialLead;
  createdAt: string;
  status:
    | "Da avviare"
    | "Onboarding"
    | "In corso"
    | "Consegnato"
    | "Assistenza"
    | "Rinnovo"
    | "Attivo"
    | "In attesa cliente"
    | "Sospeso"
    | "Completato";
  onboardingActivity?: CustomerActivity;
  activities?: CustomerActivity[];
  contacts?: CustomerContact[];
  communications?: CustomerCommunication[];
  documents?: CustomerDocument[];
  primaryContactId?: string;
  notes?: string;
  deliveredAt?: string;
  care?: CustomerCare;
  finance?: CustomerFinance;
  archivedAt?: string;
  mergedIntoId?: string;
  logoUrl?: string;
  logoUpdatedAt?: string;
  logoUpdatedBy?: string;
};

export type CustomerContact = {
  id: string;
  version?: number;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  vatNumber?: string;
  taxCode?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  mergedIntoId?: string;
};
export type CustomerCommunication = {
  id: string;
  version?: number;
  channel: "WhatsApp" | "Email" | "Chiamata" | "Nota";
  title: string;
  body: string;
  occurredAt: string;
  projectId?: string;
  leadId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};
export type CustomerDocument = {
  id: string;
  name: string;
  status: CustomerDocumentStatus;
  notes?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};
export type CustomerCare = {
  mode: "Nessuna" | "Assistenza" | "Rinnovo";
  nextDueAt?: string;
  assigneeId: string;
  recurrenceMonths?: number;
  lastGeneratedDueAt?: string;
};
export type CustomerFinance = {
  total: number;
  deposit: number;
  paid: number;
  invoiced: number;
};
export const commercialGoalMetrics = [
  "revenue",
  "won_leads",
  "new_clients",
  "completed_projects",
  "completed_activities",
  "on_time_deliveries",
  "resolved_bugs",
  "renewals",
] as const;
export type CommercialGoal = {
  id: string;
  title: string;
  description: string;
  targetType: "company" | "role" | "user";
  targetId?: string;
  metric: (typeof commercialGoalMetrics)[number];
  targetValue: number;
  unit: "number" | "currency" | "percentage";
  startsAt: string;
  endsAt: string;
  status: "active" | "completed" | "paused" | "archived";
  responsibleId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
export type RankingRole =
  | "commercial"
  | "developer"
  | "project_manager"
  | "support";
export type RankingMetric =
  | "gross_collected"
  | "net_collected"
  | "paid_sales"
  | "new_paying_customers"
  | "lead_to_payment_conversion"
  | "average_collected_ticket"
  | "refunds"
  | "completed_followups"
  | "approved_technical_work"
  | "resolved_bugs"
  | "on_time_activities"
  | "qa_passed"
  | "estimate_accuracy"
  | "approved_projects"
  | "delivered_projects"
  | "on_time_projects"
  | "project_delays"
  | "reopened_work"
  | "support_completed"
  | "renewals_completed";
export type RankingConfig = {
  role: RankingRole;
  metrics: Array<{ metric: RankingMetric; weight: number }>;
  formulaVersion?: number;
  optimisticVersion?: number;
};
export type RankingSnapshot = {
  id: string;
  period: string;
  role: RankingRole;
  winnerUserId: string;
  tiedUserIds: string[];
  scores: Array<{
    userId: string;
    score: number;
    metrics: Partial<Record<RankingMetric, number>>;
  }>;
  computedAt: string;
  formulaVersion?: number;
  status?: "consolidated" | "revoked";
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  supersedesId?: string;
  recalculationReason?: string;
};
export type CommercialAppointment = {
  id: string;
  version?: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  leadId: string;
  customerId?: string;
  assigneeId: string;
  activityId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export const customerActivityTypes = [
  "Attività",
  "Onboarding",
  "Follow-up",
  "Chiamata",
  "Riunione",
  "Email",
  "WhatsApp",
  "Documento",
  "Approvazione cliente",
  "Sviluppo",
  "Bug",
  "QA/Test",
  "Contenuto",
  "Consegna",
  "Assistenza",
  "Rinnovo",
] as const;
export const customerActivityStatuses = [
  "Da fare",
  "In corso",
  "In attesa cliente",
  "Bloccata",
  "Completata",
  "Annullata",
] as const;
export const customerActivityPriorities = [
  "Bassa",
  "Media",
  "Alta",
  "Urgente",
] as const;
export const customerActivityRecurrences = [
  "Nessuna",
  "Settimanale",
  "Mensile",
  "Trimestrale",
  "Annuale",
] as const;
export type CustomerActivity = {
  id: string;
  version?: number;
  activityId?: string;
  title: string;
  description: string;
  type: (typeof customerActivityTypes)[number];
  status: (typeof customerActivityStatuses)[number];
  priority: (typeof customerActivityPriorities)[number];
  assigneeId: string;
  collaboratorIds: string[];
  leadId?: string;
  projectId?: string;
  phaseId?: string;
  startAt?: string;
  dueAt: string;
  dueDate: string;
  originalDueAt?: string;
  dueDateHistory?: Array<{
    previousDueAt: string;
    nextDueAt: string;
    changedAt: string;
    changedBy: string;
    reason: string;
  }>;
  dueTime?: string;
  recurrence: (typeof customerActivityRecurrences)[number];
  recurrenceOriginId?: string;
  nextRecurrenceId?: string;
  dependencyIds: string[];
  blockedReason?: string;
  notes?: string;
  technicalCategory?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
  origin:
    | "conversione cliente"
    | "manuale"
    | "onboarding"
    | "assistenza"
    | "rinnovo"
    | "ricorrenza";
  attachments?: string[];
  estimatedMinutes?: number;
  weight?: number;
  visibility?: "internal" | "client";
  clientVisibleAt?: string;
  checklist?: Array<{
    id: string;
    label: string;
    completedAt?: string;
    completedBy?: string;
  }>;
  kanbanOrder?: number;
  workStatus?:
    | "In lavorazione"
    | "Completato dal collaboratore"
    | "In attesa di approvazione"
    | "Modifiche richieste"
    | "Approvato internamente"
    | "Pronto per il cliente"
    | "Pubblicato al cliente";
  workVersion?: number;
  submittedAt?: string;
  submittedBy?: string;
  approval?: {
    version: number;
    approvedAt: string;
    approvedBy: string;
    note: string;
    checklist: Array<{ id: string; label: string; checked: boolean }>;
    overrideReason?: string;
  };
  changesRequestedAt?: string;
  changesRequestedBy?: string;
  changesRequestNote?: string;
  publishedAt?: string;
  publishedBy?: string;
};

export type LeadConversionResult = {
  status: "created" | "existing";
  clientId: string;
};
export type CommercialProjectPhase = {
  id: string;
  version?: number;
  name: string;
  description?: string;
  status: "not_started" | "in_progress" | "completed";
  order: number;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  activityIds: string[];
  createdAt: string;
  updatedAt: string;
  estimatedMinutes?: number;
  weight?: number;
  role?: "developer" | "project_manager";
  dependencyIds?: string[];
  visibility?: "internal" | "client";
  milestone?: boolean;
};
export type ProjectQaItem = {
  id: string;
  label: string;
  required: boolean;
  completedAt?: string;
  completedBy?: string;
};
export type CommercialProject = {
  id: string;
  version?: number;
  clientId: string;
  sourceLeadId?: string;
  orderId?: string;
  serviceId?: string;
  templateName?: string;
  contractId?: string;
  renewalId?: string;
  name: string;
  service: string;
  type:
    | "website"
    | "ecommerce"
    | "landing"
    | "branding"
    | "marketing"
    | "maintenance"
    | "consulting"
    | "software"
    | "saas"
    | "other";
  status:
    | ProductionProjectStatus
    | "waiting_client"
    | "review"
    | "completed"
    | "archived";
  priority: "low" | "medium" | "high" | "urgent";
  ownerId: string;
  memberIds: string[];
  supervisorIds?: string[];
  description: string;
  startDate?: string;
  dueDate?: string;
  agreedValue: number;
  activityIds: string[];
  phases: CommercialProjectPhase[];
  qaChecklist?: ProjectQaItem[];
  clientUpdatePublishedAt?: string;
  clientUpdatePublishedBy?: string;
  clientUpdateVersion?: number;
  clientVisibleData?: { progress: number; publishedActivityIds: string[] };
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  completedAt?: string;
  deliveredAt?: string;
  deliveredBy?: string;
  progress?: number;
  archivedAt?: string;
};
export type ProjectTimeSession = {
  id: string;
  version?: number;
  projectId: string;
  activityId?: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  status: "active" | "completed";
  description?: string;
  manual: boolean;
  correctedAt?: string;
  archivedAt?: string;
};

type MoveOptions = { reason?: string; note?: string };
type LeadStatusTransition = {
  leadId: string;
  fromStatus: PipelineStage;
  toStatus: PipelineStage;
  options?: MoveOptions & { createOnboardingActivity?: boolean };
};
export type MergeDuplicateRecordsInput = {
  primaryId: string;
  secondaryId: string;
  fields: Partial<
    Pick<
      CommercialLead,
      | "firstName"
      | "lastName"
      | "company"
      | "email"
      | "phone"
      | "source"
      | "assigneeId"
      | "owner"
      | "stage"
      | "status"
      | "value"
      | "vatNumber"
      | "taxCode"
      | "service"
      | "opportunityName"
      | "location"
      | "nextAction"
      | "nextActionAt"
    >
  >;
};
export type NotificationUserState = {
  notificationId: string;
  readAt?: string;
  dismissedAt?: string;
};
export type ArchivedRecordType =
  | "lead"
  | "customer"
  | "activity"
  | "project"
  | "contact"
  | "contract"
  | "document"
  | "order"
  | "service";
export type ArchivedRecord = {
  id: string;
  type: ArchivedRecordType;
  label: string;
  archivedAt: string;
  archivedBy?: string;
  reason?: string;
  mergedIntoId?: string;
  primaryHref?: string;
  restorable: boolean;
};

export type WorkspaceReadinessStatus = "loading" | "ready" | "error";

export type WorkspaceReadinessError = {
  status?: number;
  message: string;
};

export type CommercialLeadsStore = {
  leads: CommercialLead[];
  leadActivities: CustomerActivity[];
  customers: CommercialCustomer[];
  projects: CommercialProject[];
  allLeads: CommercialLead[];
  allCustomers: CommercialCustomer[];
  allProjects: CommercialProject[];
  timelineEvents: CommercialTimelineEvent[];
  goals: CommercialGoal[];
  appointments: CommercialAppointment[];
  rankingConfigs: RankingConfig[];
  rankingSnapshots: RankingSnapshot[];
  services: CommercialService[];
  sales: CommercialSale[];
  orders: CommercialOrder[];
  payments: CommercialPayment[];
  contracts: CommercialContract[];
  renewals: CommercialRenewal[];
  campaigns: CommercialCampaign[];
  quotes: CommercialQuote[];
  invoices: CommercialInvoice[];
  automationRules: CommercialAutomationRule[];
  automationRuns: AutomationRun[];
  automationNotifications: AutomationNotification[];
  commerceSettings: CommerceSettings;
  timeSessions: ProjectTimeSession[];
  order: Record<PipelineStage, string[]>;
  auditEvents: CommercialAuditEvent[];
  comments: CommercialComment[];
  pointLedger: PointLedgerEntry[];
  pointPolicy: PointPolicy;
  ignoredDuplicatePairs: string[];
  duplicatesLastAnalyzedAt?: string;
  archivedRecords: ArchivedRecord[];
  restoreArchivedRecord: (type: ArchivedRecordType, id: string) => Promise<boolean>;
  ignoreDuplicatePair: (leftId: string, rightId: string) => void;
  restoreDuplicatePair: (leftId: string, rightId: string) => void;
  markDuplicatesAnalyzed: () => void;
  recordAuditEvent: (
    input: Omit<
      CommercialAuditEvent,
      "id" | "authorId" | "authorName" | "authorAvatarUrl" | "createdAt"
    > & { idempotencyKey?: string },
  ) => string | null;
  addComment: (input: {
    recordType: CollaborationRecordType;
    recordId: string;
    text: string;
    parentCommentId?: string;
    mentionUserIds?: string[];
    attachments?: CommentAttachment[];
  }) => Promise<string | null>;
  loadComments: (
    recordType: CollaborationRecordType,
    recordId: string,
  ) => Promise<void>;
  updateComment: (
    commentId: string,
    text: string,
    mentionUserIds?: string[],
  ) => Promise<boolean>;
  deleteComment: (commentId: string) => Promise<boolean>;
  resolveComment: (commentId: string, resolved: boolean) => Promise<boolean>;
  toggleCommentReaction: (commentId: string, emoji: string) => Promise<boolean>;
  addPointEntry: (
    input: Omit<PointLedgerEntry, "id" | "createdBy">,
  ) => Promise<string | null>;
  updatePointPolicy: (updates: Partial<PointPolicy>, reason?: string) => Promise<boolean>;
  addCampaign: (
    campaign: Omit<CommercialCampaign, "id" | "createdAt" | "updatedAt">,
  ) => string | null;
  updateCampaign: (
    campaignId: string,
    updates: Partial<CommercialCampaign>,
  ) => boolean;
  archiveCampaign: (campaignId: string) => boolean;
  addQuote: (
    quote: Omit<
      CommercialQuote,
      | "id"
      | "code"
      | "version"
      | "subtotal"
      | "vatAmount"
      | "total"
      | "createdAt"
      | "updatedAt"
    >,
  ) => Promise<string | null>;
  updateQuote: (quoteId: string, updates: Partial<CommercialQuote>) => Promise<boolean>;
  createQuoteVersion: (
    quoteId: string,
  ) => Promise<{ ok: true; id: string; existing: boolean } | { ok: false; message: string }>;
  addInvoice: (
    invoice: Omit<
      CommercialInvoice,
      | "id"
      | "code"
      | "taxableAmount"
      | "vatAmount"
      | "total"
      | "createdAt"
      | "updatedAt"
    >,
  ) => Promise<string | null>;
  updateInvoice: (
    invoiceId: string,
    updates: Partial<CommercialInvoice>,
  ) => Promise<boolean>;
  createCreditNote: (
    invoiceId: string,
    amount: number,
    notes: string,
  ) => Promise<{ ok: true; id: string } | { ok: false; message: string }>;
  addAutomationRule: (
    rule: Omit<CommercialAutomationRule, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string | null>;
  updateAutomationRule: (
    ruleId: string,
    updates: Partial<CommercialAutomationRule>,
  ) => Promise<boolean>;
  runAutomationRule: (
    ruleId: string,
    retryOfId?: string,
  ) => Promise<
    | { ok: true; runId: string; existing: boolean }
    | { ok: false; message: string }>;
  addGoal: (
    goal: Omit<CommercialGoal, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string | null>;
  updateGoal: (goalId: string, updates: Partial<CommercialGoal>) => Promise<boolean>;
  archiveGoal: (goalId: string) => Promise<boolean>;
  addAppointment: (
    appointment: Omit<CommercialAppointment, "id" | "createdAt" | "updatedAt">,
  ) => string | null;
  updateAppointment: (
    appointmentId: string,
    updates: Partial<CommercialAppointment>,
  ) => boolean;
  archiveAppointment: (appointmentId: string) => boolean;
  deleteAppointment: (appointmentId: string) => boolean;
  updateRankingConfig: (
    role: RankingRole,
    metrics: RankingConfig["metrics"],
  ) => Promise<boolean>;
  saveRankingSnapshot: (snapshot: RankingSnapshot) => Promise<boolean>;
  deleteRankingSnapshot: (snapshotId: string, reason?: string) => Promise<boolean>;
  addService: (
    service: Omit<CommercialService, "id" | "version" | "createdAt" | "updatedAt">,
  ) => Promise<string | null>;
  updateService: (
    serviceId: string,
    updates: Partial<CommercialService>,
  ) => Promise<boolean>;
  archiveService: (serviceId: string) => Promise<boolean>;
  addSale: (
    sale: Omit<
      CommercialSale,
      "id" | "version" | "createdAt" | "updatedAt" | "customerId"
    > & { customerId?: string },
  ) => Promise<string | null>;
  updateSale: (saleId: string, updates: Partial<CommercialSale>) => Promise<boolean>;
  archiveSale: (saleId: string) => Promise<boolean>;
  addOrder: (
    order: Omit<
      CommercialOrder,
      "id" | "version" | "code" | "total" | "items" | "createdAt" | "updatedAt"
    > & { items: Array<Pick<CommercialOrderItem, "serviceId" | "quantity"> & Partial<CommercialOrderItem>> },
  ) => Promise<string | null>;
  updateOrder: (
    orderId: string,
    updates: Omit<Partial<CommercialOrder>, "items"> & { items?: Array<Pick<CommercialOrderItem, "serviceId" | "quantity"> & Partial<CommercialOrderItem>> },
  ) => Promise<boolean>;
  archiveOrder: (orderId: string) => Promise<boolean>;
  addPayment: (
    payment: Omit<CommercialPayment, "id" | "version" | "createdAt" | "updatedAt">,
  ) => Promise<
    | { ok: true; id: string }
    | {
        ok: false;
        code:
          | "NOT_AUTHORIZED"
          | "NOT_FOUND"
          | "DUPLICATE_REFERENCE"
          | "INVALID_REFUND"
          | "INVALID_AMOUNT";
        message: string;
      }>;
  updatePayment: (
    paymentId: string,
    updates: Partial<CommercialPayment>,
  ) => Promise<boolean>;
  archivePayment: (paymentId: string) => Promise<boolean>;
  generateOrderProject: (
    orderId: string,
  ) => Promise<
    | { ok: true; projectId: string; existing: boolean }
    | { ok: false; message: string }>;
  updateCommerceSettings: (updates: Partial<CommerceSettings>) => boolean;
  generateContract: (
    orderId: string,
  ) => Promise<
    | { ok: true; id: string; existing: boolean }
    | { ok: false; message: string }>;
  updateContract: (
    contractId: string,
    updates: Partial<CommercialContract>,
  ) => Promise<boolean>;
  sendContract: (
    contractId: string,
    input: {
      method: CommercialContract["sendHistory"][number]["method"];
      kind: "invio" | "reinvio" | "promemoria";
      note?: string;
    },
  ) => Promise<{ ok: true; attemptId: string } | { ok: false; message: string }>;
  markContractSigned: (contractId: string, signedAt?: string) => Promise<boolean>;
  createContractVersion: (
    contractId: string,
  ) => Promise<
    | { ok: true; id: string; existing: boolean }
    | { ok: false; message: string }>;
  archiveContract: (contractId: string) => Promise<boolean>;
  activateRenewal: (
    orderId: string,
    itemId: string,
  ) => Promise<
    | { ok: true; id: string; existing: boolean }
    | { ok: false; message: string }>;
  updateRenewal: (
    renewalId: string,
    updates: Partial<CommercialRenewal>,
  ) => Promise<boolean>;
  sendRenewalReminder: (
    renewalId: string,
  ) => Promise<
    | { ok: true; activityId: string; existing: boolean }
    | { ok: false; message: string }>;
  generateRenewalOrder: (
    renewalId: string,
  ) => Promise<
    | { ok: true; orderId: string; activityId: string; existing: boolean }
    | { ok: false; message: string }>;
  archiveRenewal: (renewalId: string) => Promise<boolean>;
  startProjectTime: (
    projectId: string,
    activityId?: string,
  ) => Promise<
    | { ok: true; sessionId: string; existing: boolean }
    | { ok: false; message: string }>;
  stopProjectTime: (
    sessionId: string,
    description?: string,
  ) => Promise<
    | { ok: true; durationMinutes: number; existing: boolean }
    | { ok: false; message: string }>;
  archiveProjectTime: (sessionId: string) => Promise<boolean>;
  setProjectQaItem: (
    projectId: string,
    itemId: string,
    completed: boolean,
  ) => Promise<boolean>;
  publishProjectClientUpdate: (
    projectId: string,
  ) => Promise<{ ok: true; existing: boolean } | { ok: false; message: string }>;
  deliverProject: (
    projectId: string,
  ) => Promise<{ ok: true; existing: boolean } | { ok: false; message: string }>;
  exportLeadsToContacts: (
    leadIds: string[],
  ) =>
    | {
        ok: true;
        batchId: string;
        exportedAt: string;
        existing: boolean;
        leads: CommercialLead[];
      }
    | { ok: false; message: string };
  transitionLeadStatus: (
    transition: LeadStatusTransition,
  ) => Promise<LeadConversionResult | void>;
  moveLead: (
    leadId: string,
    nextStage: PipelineStage,
    options?: MoveOptions,
  ) => Promise<void>;
  convertLeadToClient: (options: {
    leadId: string;
    createOnboardingActivity: boolean;
    existingClientId?: string;
  }) => Promise<LeadConversionResult>;
  reorderLead: (stage: PipelineStage, leadIds: string[]) => void;
  updateLead: (
    leadId: string,
    updates: Partial<CommercialLead>,
    options?: { silentTimeline?: boolean },
  ) => void;
  archiveLead: (leadId: string, reason?: string) => boolean;
  updateCustomer: (
    clientId: string,
    updates: Partial<CommercialCustomer>,
  ) => void;
  updateCustomerLogo: (clientId: string, logoUrl?: string) => Promise<boolean>;
  updateCustomerProfile: (
    clientId: string,
    updates: Partial<CommercialLead>,
    customerUpdates?: Partial<Pick<CommercialCustomer, "notes" | "status">>,
  ) => boolean;
  updateCustomerStatus: (
    clientId: string,
    status: CommercialCustomer["status"],
  ) => void;
  createCustomer: (input: {
    company: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    vatNumber?: string;
    taxCode?: string;
    location?: string;
    service?: string;
    status: CommercialCustomer["status"];
    assigneeId: string;
    owner: string;
    notes?: string;
  }) => Promise<string>;
  archiveCustomer: (clientId: string) => boolean;
  addCustomerActivity: (
    clientId: string,
    activity: Omit<
      CustomerActivity,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "createdBy"
      | "origin"
      | "dueDate"
      | "collaboratorIds"
      | "recurrence"
      | "dependencyIds"
    > &
      Partial<
        Pick<
          CustomerActivity,
          | "createdBy"
          | "origin"
          | "dueDate"
          | "collaboratorIds"
          | "recurrence"
          | "dependencyIds"
        >
      > & { phaseId?: string },
  ) => string | null | Promise<string | null>;
  addLeadActivity: (
    leadId: string,
    activity: Omit<
      CustomerActivity,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "createdBy"
      | "origin"
      | "leadId"
      | "dueDate"
      | "collaboratorIds"
      | "recurrence"
      | "dependencyIds"
    > &
      Partial<
        Pick<
          CustomerActivity,
          | "createdBy"
          | "origin"
          | "dueDate"
          | "collaboratorIds"
          | "recurrence"
          | "dependencyIds"
        >
      >,
  ) => string | null;
  archiveLeadActivity: (leadId: string, activityId: string) => boolean;
  updateCustomerActivity: (
    clientId: string,
    activityId: string,
    updates: Partial<CustomerActivity>,
  ) => boolean | Promise<boolean>;
  setCustomerActivityStatus: (
    clientId: string,
    activityId: string,
    status: CustomerActivity["status"],
  ) => boolean | Promise<boolean>;
  moveCustomerActivity: (
    clientId: string,
    activityId: string,
    status: CustomerActivity["status"],
    orderedVisibleIds: string[],
  ) => boolean | Promise<boolean>;
  submitCustomerActivityWork: (clientId: string, activityId: string) => Promise<boolean>;
  approveCustomerActivityWork: (
    clientId: string,
    activityId: string,
    input: {
      note: string;
      checklist: Array<{ id: string; label: string; checked: boolean }>;
      overrideReason?: string;
    },
  ) => Promise<boolean>;
  requestCustomerActivityChanges: (
    clientId: string,
    activityId: string,
    note: string,
  ) => Promise<boolean>;
  markCustomerActivityReadyForClient: (
    clientId: string,
    activityId: string,
  ) => Promise<boolean>;
  publishCustomerActivityWork: (
    clientId: string,
    activityId: string,
  ) => Promise<boolean>;
  completeCustomerActivity: (clientId: string, activityId: string) => boolean | Promise<boolean>;
  reopenCustomerActivity: (clientId: string, activityId: string) => boolean | Promise<boolean>;
  duplicateCustomerActivity: (clientId: string, activityId: string) => void;
  deleteCustomerActivity: (clientId: string, activityId: string) => void | Promise<void>;
  generateNextCustomerActivityRecurrence: (
    clientId: string,
    activityId: string,
  ) => string | null | Promise<string | null>;
  addLead: (lead: CommercialLead) => Promise<void>;
  addCustomerContact: (
    clientId: string,
    contact: Omit<CustomerContact, "id" | "createdAt" | "updatedAt">,
  ) => string | null;
  updateCustomerContact: (
    clientId: string,
    contactId: string,
    updates: Partial<CustomerContact>,
  ) => boolean;
  removeCustomerContact: (clientId: string, contactId: string) => boolean;
  setPrimaryCustomerContact: (clientId: string, contactId?: string) => boolean;
  addCustomerCommunication: (
    clientId: string,
    input: Omit<CustomerCommunication, "id" | "createdAt" | "updatedAt">,
  ) => string | null;
  updateCustomerCommunication: (
    clientId: string,
    communicationId: string,
    updates: Partial<CustomerCommunication>,
  ) => boolean;
  removeCustomerCommunication: (
    clientId: string,
    communicationId: string,
  ) => boolean;
  addCustomerDocument: (
    clientId: string,
    input: Omit<CustomerDocument, "id" | "createdAt" | "updatedAt">,
  ) => string | null;
  updateCustomerDocument: (
    clientId: string,
    documentId: string,
    updates: Partial<CustomerDocument>,
  ) => boolean;
  removeCustomerDocument: (clientId: string, documentId: string) => boolean;
  startCustomerOnboarding: (clientId: string) => Promise<string | null>;
  updateCustomerCare: (clientId: string, care: CustomerCare) => boolean;
  ensureCustomerCareActivity: (
    clientId: string,
    careOverride?: CustomerCare,
  ) => string | null;
  mergeDuplicateRecords: (
    input: MergeDuplicateRecordsInput,
  ) => Promise<
    | { ok: true; primaryId: string; secondaryId: string; href: string }
    | { ok: false; code: string; message: string }
  >;
  createProject: (
    project: Omit<
      CommercialProject,
      "id" | "createdAt" | "updatedAt" | "createdBy" | "phases"
    > & { phases?: CommercialProjectPhase[] },
  ) => Promise<string>;
  updateProject: (
    projectId: string,
    updates: Partial<CommercialProject>,
  ) => Promise<void>;
  archiveProject: (projectId: string) => Promise<void>;
  addProjectPhase: (
    projectId: string,
    phase: Omit<
      CommercialProjectPhase,
      "id" | "order" | "createdAt" | "updatedAt" | "completedAt" | "activityIds"
    > &
      Partial<Pick<CommercialProjectPhase, "activityIds" | "status">>,
  ) => Promise<string | null>;
  updateProjectPhase: (
    projectId: string,
    phaseId: string,
    updates: Partial<CommercialProjectPhase>,
  ) => Promise<void>;
  deleteProjectPhase: (projectId: string, phaseId: string) => Promise<void>;
  reorderProjectPhases: (projectId: string, phaseIds: string[]) => Promise<void>;
  setProjectPhaseStatus: (
    projectId: string,
    phaseId: string,
    status: CommercialProjectPhase["status"],
  ) => Promise<void>;
  linkActivityToProjectPhase: (
    projectId: string,
    phaseId: string,
    activityIds: string[],
  ) => Promise<void>;
  unlinkActivityFromProjectPhase: (
    projectId: string,
    phaseId: string,
    activityId: string,
  ) => Promise<void>;
  getProjectsByClientId: (clientId: string) => CommercialProject[];
  linkActivityToProject: (projectId: string, activityId: string) => Promise<void>;
  unlinkActivityFromProject: (projectId: string, activityId: string) => Promise<void>;
  workspaceStatus: WorkspaceReadinessStatus;
  workspaceError: WorkspaceReadinessError | null;
  secondaryStatus: WorkspaceReadinessStatus;
  secondaryError: WorkspaceReadinessError | null;
  retryWorkspace: () => void;
  retrySecondary: () => void;
  hasHydrated: boolean;
};
