import { apiFetch } from "@/lib/api";

export type CursorPage<T> = {
  items: T[];
  nextCursor?: string | null;
  total?: number;
  limit?: number;
  offset?: number;
  configured?: boolean;
};

type QueryValue = string | number | boolean | null | undefined;

function query(params?: Record<string, QueryValue>) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? "?" + text : "";
}

function pageFrom<T>(raw: unknown): CursorPage<T> {
  if (Array.isArray(raw)) return { items: raw as T[] };
  const outer = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const nested = outer.data && typeof outer.data === "object" && !Array.isArray(outer.data)
    ? outer.data as Record<string, unknown>
    : outer;
  const items = Array.isArray(nested.items)
    ? nested.items as T[]
    : Array.isArray(nested.results)
      ? nested.results as T[]
      : Array.isArray(nested.releases)
        ? nested.releases as T[]
      : Array.isArray(outer.data)
        ? outer.data as T[]
        : [];
  return {
    items,
    nextCursor: typeof nested.nextCursor === "string" || nested.nextCursor === null
      ? nested.nextCursor as string | null
      : typeof nested.next_cursor === "string" || nested.next_cursor === null
        ? nested.next_cursor as string | null
        : undefined,
    total: typeof nested.total === "number" ? nested.total : undefined,
    limit: typeof nested.limit === "number" ? nested.limit : undefined,
    offset: typeof nested.offset === "number" ? nested.offset : undefined,
    configured: typeof nested.configured === "boolean" ? nested.configured : undefined,
  };
}

function mutationOptions(method: "POST" | "PATCH" | "DELETE", body?: unknown, idempotencyKey?: string): RequestInit {
  return {
    method,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function featureMutationKey(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return prefix + ":" + random;
}

export type CollaborationParticipant = {
  id?: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  role?: string;
};

export type CollaborationReaction = {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
  userIds?: string[];
};

export type CollaborationReceipt = {
  userId: string;
  readAt?: string | null;
  deliveredAt?: string | null;
};

export type CollaborationMessage = {
  id: string;
  conversationId: string;
  authorId: string;
  authorName?: string;
  body: string;
  parentMessageId?: string | null;
  mentionUserIds?: string[];
  reactions?: CollaborationReaction[];
  receipts?: CollaborationReceipt[];
  attachmentMetadata?: Array<Record<string, unknown>> | Record<string, unknown> | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
};

export type CollaborationConversation = {
  id: string;
  title: string;
  kind?: string;
  participants?: CollaborationParticipant[];
  lastMessage?: CollaborationMessage | null;
  unreadCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CollaborationPresence = {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  status: "online" | "away" | "busy" | "offline" | string;
  activity?: string | null;
  lastSeenAt?: string | null;
};

export type CollaborationCallStatus = {
  enabled: boolean;
  reason?: string;
  supportsVideo?: boolean;
  supportsScreenShare?: boolean;
};

export type CollaborationCallAccess = {
  callId: string;
  roomName: string;
  token: string;
  serverUrl: string;
  mode?: "voice" | "video";
  canPublish?: boolean;
};

function normalizeReactionList(value: unknown): CollaborationReaction[] {
  if (!Array.isArray(value)) return [];
  const grouped = new Map<string, string[]>();
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const emoji = String(row.emoji || "");
    if (!emoji) return;
    const userId = String(row.userId || row.user_id || "");
    grouped.set(emoji, [...(grouped.get(emoji) || []), ...(userId ? [userId] : [])]);
  });
  return Array.from(grouped.entries()).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length || 1,
    userIds,
  }));
}

function normalizeMessage(value: unknown): CollaborationMessage {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    id: String(row.id || ""),
    conversationId: String(row.conversationId || row.conversation_id || ""),
    authorId: String(row.authorId || row.author_id || ""),
    authorName: typeof row.authorName === "string" ? row.authorName : undefined,
    body: String(row.body || ""),
    parentMessageId: row.parentMessageId || row.parent_message_id
      ? String(row.parentMessageId || row.parent_message_id)
      : undefined,
    mentionUserIds: Array.isArray(row.mentionUserIds)
      ? row.mentionUserIds.map(String)
      : Array.isArray(row.mention_user_ids)
        ? row.mention_user_ids.map(String)
        : [],
    reactions: normalizeReactionList(row.reactions),
    receipts: Array.isArray(row.receipts) ? row.receipts.map((value) => {
      const receipt = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      return {
        userId: String(receipt.userId || receipt.user_id || ""),
        readAt: receipt.readAt || receipt.read_at ? String(receipt.readAt || receipt.read_at) : undefined,
        deliveredAt: receipt.deliveredAt || receipt.delivered_at ? String(receipt.deliveredAt || receipt.delivered_at) : undefined,
      };
    }) : [],
    attachmentMetadata: (row.attachmentMetadata || row.attachment_metadata || null) as CollaborationMessage["attachmentMetadata"],
    createdAt: String(row.createdAt || row.created_at || new Date(0).toISOString()),
    editedAt: row.editedAt || row.edited_at
      ? String(row.editedAt || row.edited_at)
      : Number(row.optimistic_version || 1) > 1 && row.updated_at
        ? String(row.updated_at)
        : undefined,
    deletedAt: row.deletedAt || row.deleted_at ? String(row.deletedAt || row.deleted_at) : undefined,
  };
}

function normalizeConversation(value: unknown): CollaborationConversation {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const participantIds = row.participantIds ?? row.participant_ids;
  const participants = Array.isArray(row.participants)
    ? row.participants.map((value) => {
      const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      return {
        id: typeof item.id === "string" ? item.id : undefined,
        userId: String(item.userId || item.user_id || ""),
        displayName: typeof item.displayName === "string" ? item.displayName : undefined,
        avatarUrl: typeof item.avatarUrl === "string" ? item.avatarUrl : undefined,
        role: typeof item.role === "string" ? item.role : undefined,
      };
    })
    : Array.isArray(participantIds)
      ? participantIds.map((userId) => ({ userId: String(userId) }))
      : [];
  return {
    id: String(row.id || ""),
    title: String(row.title || "Conversazione"),
    kind: typeof row.kind === "string" ? row.kind : undefined,
    participants,
    lastMessage: row.lastMessage ? normalizeMessage(row.lastMessage) : null,
    unreadCount: Number(row.unreadCount ?? row.unread_count ?? 0),
    createdAt: row.createdAt || row.created_at ? String(row.createdAt || row.created_at) : undefined,
    updatedAt: row.updatedAt || row.updated_at ? String(row.updatedAt || row.updated_at) : undefined,
  };
}

export const collaborationApi = {
  async conversations(params?: { cursor?: string; limit?: number }) {
    const page = pageFrom<unknown>(
      await apiFetch("/tenant/collaboration/conversations" + query(params)),
    );
    return { ...page, items: page.items.map(normalizeConversation) };
  },
  async conversation(id: string) {
    return normalizeConversation(await apiFetch(
      "/tenant/collaboration/conversations/" + encodeURIComponent(id),
    ));
  },
  async createConversation(body: { title: string; kind?: string; participantIds: string[] }) {
    return normalizeConversation(await apiFetch(
      "/tenant/collaboration/conversations",
      mutationOptions("POST", body, featureMutationKey("conversation")),
    ));
  },
  async messages(conversationId: string, params?: { cursor?: string; limit?: number }) {
    const page = pageFrom<unknown>(
      await apiFetch(
        "/tenant/collaboration/conversations/" + encodeURIComponent(conversationId) + "/messages" + query(params),
      ),
    );
    return { ...page, items: page.items.map(normalizeMessage) };
  },
  sendMessage(
    conversationId: string,
    body: {
      body: string;
      parentMessageId?: string;
      mentionUserIds?: string[];
      attachmentMetadata?: Array<Record<string, unknown>>;
    },
    idempotencyKey = featureMutationKey("message"),
  ) {
    return apiFetch(
      "/tenant/collaboration/conversations/" + encodeURIComponent(conversationId) + "/messages",
      mutationOptions("POST", body, idempotencyKey),
    ).then(normalizeMessage);
  },
  updateMessage(conversationId: string, messageId: string, body: { body: string }) {
    return apiFetch(
      "/tenant/collaboration/conversations/" + encodeURIComponent(conversationId)
        + "/messages/" + encodeURIComponent(messageId),
      mutationOptions("PATCH", body, featureMutationKey("message-edit")),
    ).then(normalizeMessage);
  },
  deleteMessage(conversationId: string, messageId: string) {
    return apiFetch<CollaborationMessage>(
      "/tenant/collaboration/conversations/" + encodeURIComponent(conversationId)
        + "/messages/" + encodeURIComponent(messageId),
      mutationOptions("DELETE", undefined, featureMutationKey("message-delete")),
    );
  },
  react(conversationId: string, messageId: string, emoji: string, active: boolean) {
    const base = "/tenant/collaboration/conversations/" + encodeURIComponent(conversationId)
      + "/messages/" + encodeURIComponent(messageId) + "/reactions";
    return apiFetch<{ active?: boolean }>(
      active ? base : base + "/" + encodeURIComponent(emoji),
      mutationOptions(active ? "POST" : "DELETE", active ? { emoji } : undefined, featureMutationKey("reaction")),
    );
  },
  read(conversationId: string, messageId: string) {
    return apiFetch<{ ok?: boolean }>(
      "/tenant/collaboration/conversations/" + encodeURIComponent(conversationId)
        + "/messages/" + encodeURIComponent(messageId) + "/read",
      mutationOptions("POST", {}, featureMutationKey("receipt")),
    );
  },
  revisions(conversationId: string, messageId: string) {
    return apiFetch<{ items: Array<{ id: string; body: string; createdAt: string }> }>(
      "/tenant/collaboration/conversations/" + encodeURIComponent(conversationId)
        + "/messages/" + encodeURIComponent(messageId) + "/revisions",
    );
  },
  async presence() {
    return pageFrom<CollaborationPresence>(await apiFetch("/tenant/collaboration/presence"));
  },
  setPresence(body: { status: string; activity?: string }) {
    return apiFetch<CollaborationPresence>(
      "/tenant/collaboration/presence",
      mutationOptions("POST", body),
    );
  },
  clearPresence() {
    return apiFetch<{ ok?: boolean }>("/tenant/collaboration/presence", mutationOptions("DELETE"));
  },
  async callStatus(): Promise<CollaborationCallStatus> {
    try {
      return await apiFetch<CollaborationCallStatus>("/tenant/collaboration/calls/status");
    } catch {
      return { enabled: false, reason: "feature-disabled" };
    }
  },
  async startCall(conversationId: string, mode: "voice" | "video") {
    const row = await apiFetch<Record<string, unknown>>(
      "/tenant/collaboration/calls/token",
      mutationOptions("POST", { conversationId }, featureMutationKey("call")),
    );
    return {
      callId: String(row.callId || row.call_id || ""),
      roomName: String(row.roomName || row.room || ""),
      token: String(row.token || ""),
      serverUrl: String(row.serverUrl || row.server_url || ""),
      mode,
      canPublish: row.canPublish === undefined && row.can_publish === undefined
        ? true
        : row.canPublish === true || row.can_publish === true,
    } satisfies CollaborationCallAccess;
  },
  endCall(callId: string) {
    return apiFetch<{ ok?: boolean }>(
      "/tenant/collaboration/calls/" + encodeURIComponent(callId),
      mutationOptions("DELETE"),
    );
  },
};

export type FlowboardNodeData = {
  label: string;
  description?: string;
  status?: string;
  linkedRecordType?: string;
  linkedRecordId?: string;
  [key: string]: unknown;
};

export type FlowboardNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: FlowboardNodeData;
};

export type FlowboardEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
};

export type FlowboardSummary = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  ownerId?: string;
  role?: "owner" | "editor" | "viewer" | string;
  nodeCount?: number;
  updatedAt?: string;
};

export type Flowboard = FlowboardSummary & {
  nodes: FlowboardNode[];
  edges: FlowboardEdge[];
  viewport?: { x: number; y: number; zoom: number };
  revision?: number;
  collaborators?: Array<{ userId: string; permission: "view" | "edit" }>;
};

export type FlowboardComment = {
  id: string;
  boardId: string;
  targetType?: "board" | "node" | "edge";
  targetId?: string | null;
  authorId: string;
  authorName?: string;
  body: string;
  parentId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

function normalizeFlowboardComment(value: unknown): FlowboardComment {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    id: String(row.id || ""),
    boardId: String(row.boardId || row.board_id || ""),
    targetType: (row.targetType || row.target_type || "board") as FlowboardComment["targetType"],
    targetId: row.targetId || row.target_id ? String(row.targetId || row.target_id) : undefined,
    authorId: String(row.authorId || row.author_user_id || ""),
    authorName: typeof row.authorName === "string" ? row.authorName : undefined,
    body: String(row.body || ""),
    parentId: row.parentId || row.parent_comment_id ? String(row.parentId || row.parent_comment_id) : undefined,
    resolvedAt: row.resolvedAt || row.resolved_at ? String(row.resolvedAt || row.resolved_at) : undefined,
    createdAt: String(row.createdAt || row.created_at || new Date(0).toISOString()),
  };
}

function normalizeFlowboard(value: unknown): Flowboard {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const nodes = Array.isArray(row.nodes) ? row.nodes as FlowboardNode[] : [];
  const edges = Array.isArray(row.edges) ? row.edges as FlowboardEdge[] : [];
  const owner = row.owner === true;
  const canEdit = row.canEdit === true || row.can_edit === true;
  return {
    id: String(row.id || ""),
    name: String(row.name || "Flowboard"),
    description: typeof row.description === "string" ? row.description : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    ownerId: row.ownerId || row.owner_user_id ? String(row.ownerId || row.owner_user_id) : undefined,
    role: String(row.role || row.permission || (owner ? "owner" : canEdit ? "editor" : "viewer")),
    nodeCount: nodes.length,
    updatedAt: row.updatedAt || row.updated_at ? String(row.updatedAt || row.updated_at) : undefined,
    nodes,
    edges,
    viewport: row.viewport && typeof row.viewport === "object"
      ? row.viewport as Flowboard["viewport"]
      : { x: 0, y: 0, zoom: 1 },
    revision: Number(row.revision ?? row.optimisticVersion ?? row.optimistic_version ?? 1),
    collaborators: Array.isArray(row.collaborators)
      ? row.collaborators.flatMap((value) => {
          if (!value || typeof value !== "object") return [];
          const item = value as Record<string, unknown>;
          const userId = String(item.userId || item.user_id || "");
          if (!userId) return [];
          return [{ userId, permission: item.permission === "edit" ? "edit" as const : "view" as const }];
        })
      : [],
    ...("comments" in row ? { comments: Array.isArray(row.comments) ? row.comments.map(normalizeFlowboardComment) : [] } : {}),
  } as Flowboard;
}

export const flowboardApi = {
  async list(params?: { cursor?: string; limit?: number; status?: string }) {
    const page = pageFrom<unknown>(await apiFetch("/tenant/flowboards" + query(params)));
    return { ...page, items: page.items.map(normalizeFlowboard) };
  },
  async create(body: { name: string; description?: string; templateId?: string }) {
    return normalizeFlowboard(await apiFetch("/tenant/flowboards", mutationOptions("POST", body, featureMutationKey("flowboard"))));
  },
  async get(id: string) {
    return normalizeFlowboard(await apiFetch("/tenant/flowboards/" + encodeURIComponent(id)));
  },
  async save(id: string, body: Pick<Flowboard, "nodes" | "edges" | "viewport"> & { revision?: number }) {
    return normalizeFlowboard(await apiFetch(
      "/tenant/flowboards/" + encodeURIComponent(id) + "/save",
      mutationOptions("POST", {
        nodes: body.nodes,
        edges: body.edges,
        viewport: body.viewport,
        optimisticVersion: body.revision,
      }, featureMutationKey("flowboard-save")),
    ));
  },
  async update(id: string, body: { name?: string; description?: string; status?: string; collaborators?: Array<{ userId: string; permission: "view" | "edit" }>; revision?: number }) {
    return normalizeFlowboard(await apiFetch(
      "/tenant/flowboards/" + encodeURIComponent(id),
      mutationOptions("PATCH", { ...body, optimisticVersion: body.revision }, featureMutationKey("flowboard-update")),
    ));
  },
  archive(id: string) {
    return apiFetch<Flowboard>(
      "/tenant/flowboards/" + encodeURIComponent(id) + "/archive",
      mutationOptions("PATCH", {}),
    );
  },
  async comments(id: string) {
    const raw = await apiFetch<Record<string, unknown>>("/tenant/flowboards/" + encodeURIComponent(id));
    return {
      items: Array.isArray(raw.comments) ? raw.comments.map(normalizeFlowboardComment) : [],
    } satisfies CursorPage<FlowboardComment>;
  },
  async comment(id: string, body: { body: string; targetType?: string; targetId?: string; parentId?: string }) {
    return normalizeFlowboardComment(await apiFetch(
      "/tenant/flowboards/" + encodeURIComponent(id) + "/comments",
      mutationOptions("POST", {
        ...body,
        parentCommentId: body.parentId,
      }, featureMutationKey("flowboard-comment")),
    ));
  },
};

export type BonusWallet = {
  availablePoints: number;
  provisionalPoints?: number;
  reservedPoints?: number;
  euroValueCents?: number;
  minimumRequestPoints?: number;
};

export type BonusLedgerEntry = {
  id: string;
  points: number;
  bucket?: string;
  reason: string;
  status?: string;
  occurredAt: string;
};

export type BonusRequest = {
  id: string;
  userId?: string;
  periodId?: string | null;
  points: number;
  reason: string;
  status: string;
  createdAt: string;
  decidedAt?: string | null;
  decisionReason?: string | null;
};

export type BonusPeriod = {
  id: string;
  label: string;
  startsAt?: string;
  endsAt?: string;
  status: string;
};

export type BonusPolicy = {
  id?: string;
  name?: string;
  version?: number;
  pointEuroCents?: number;
  minimumRequestPoints?: number;
  reservePoints?: number;
  monthlyCapPoints?: number;
  collectedEuroPerPoint?: number;
};

export type BonusDashboard = {
  wallet: BonusWallet;
  ledger: BonusLedgerEntry[];
  requests: BonusRequest[];
  periods: BonusPeriod[];
  pendingRequests: BonusRequest[];
  policy?: BonusPolicy;
  canManage: boolean;
  currentUserId?: string;
};

function normalizeBonusRequest(value: unknown): BonusRequest {
  const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    id: String(item.id || ""),
    userId: item.userId || item.user_id ? String(item.userId || item.user_id) : undefined,
    periodId: item.periodId || item.period_id ? String(item.periodId || item.period_id) : undefined,
    points: Number(item.points || 0),
    reason: String(item.reason || ""),
    status: String(item.status || "pending"),
    createdAt: String(item.createdAt || item.created_at || new Date(0).toISOString()),
    decidedAt: item.decidedAt || item.decided_at ? String(item.decidedAt || item.decided_at) : undefined,
    decisionReason: item.decisionReason || item.decision_reason
      ? String(item.decisionReason || item.decision_reason)
      : undefined,
  };
}

function normalizeBonusDashboard(value: unknown): BonusDashboard {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const walletRow = (row.wallet && typeof row.wallet === "object" ? row.wallet : {}) as Record<string, unknown>;
  const policyRow = (row.policy && typeof row.policy === "object" ? row.policy : {}) as Record<string, unknown>;
  const rules = (policyRow.rules && typeof policyRow.rules === "object" ? policyRow.rules : {}) as Record<string, unknown>;
  const ledger = Array.isArray(row.ledger) ? row.ledger : [];
  const requests = Array.isArray(row.requests) ? row.requests : [];
  const pendingRequests = Array.isArray(row.pendingRequests)
    ? row.pendingRequests
    : Array.isArray(row.pending_requests)
      ? row.pending_requests
      : [];
  const periods = Array.isArray(row.periods) ? row.periods : [];
  const pointEuroCents = Number(rules.pointEuroCents ?? rules.point_euro_cents ?? 0);
  const balance = Number(walletRow.availablePoints ?? walletRow.available_points ?? walletRow.balance ?? 0);
  const normalizedLedger = ledger.map((value) => {
    const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return {
      id: String(item.id || ""),
      points: Number(item.points ?? item.amount ?? 0),
      bucket: String(item.bucket || item.entryType || item.entry_type || "consolidated"),
      reason: String(item.reason || "Movimento Bonus"),
      status: String(item.status || item.entryType || item.entry_type || "registered"),
      occurredAt: String(item.occurredAt || item.occurred_at || item.created_at || new Date(0).toISOString()),
    } satisfies BonusLedgerEntry;
  });
  const normalizedRequests = requests.map(normalizeBonusRequest);
  const provisionalPoints = normalizedLedger
    .filter((entry) => entry.bucket === "provisional")
    .reduce((total, entry) => total + entry.points, 0);
  const reservedPoints = normalizedRequests
    .filter((request) => request.status === "pending")
    .reduce((total, request) => total + request.points, 0);
  return {
    wallet: {
      availablePoints: balance,
      provisionalPoints: Number(walletRow.provisionalPoints ?? walletRow.provisional_points ?? provisionalPoints),
      reservedPoints: Number(walletRow.reservedPoints ?? walletRow.reserved_points ?? reservedPoints),
      euroValueCents: Number(walletRow.euroValueCents ?? walletRow.euro_value_cents ?? balance * pointEuroCents),
      minimumRequestPoints: Number(rules.minimumRequestPoints ?? rules.minimum_request_points ?? 0),
    },
    ledger: normalizedLedger,
    requests: normalizedRequests,
    pendingRequests: pendingRequests.map(normalizeBonusRequest),
    periods: periods.map((value) => {
      const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      return {
        id: String(item.id || ""),
        label: String(item.label || "Periodo Bonus"),
        startsAt: item.startsAt || item.starts_at ? String(item.startsAt || item.starts_at) : undefined,
        endsAt: item.endsAt || item.ends_at ? String(item.endsAt || item.ends_at) : undefined,
        status: String(item.status || "open"),
      };
    }),
    policy: {
      id: policyRow.id ? String(policyRow.id) : undefined,
      name: policyRow.name ? String(policyRow.name) : undefined,
      version: Number(policyRow.currentVersion ?? policyRow.current_version ?? policyRow.version ?? 0),
      pointEuroCents,
      minimumRequestPoints: Number(rules.minimumRequestPoints ?? rules.minimum_request_points ?? 0),
      reservePoints: Number(rules.reservePoints ?? rules.reserve_points ?? 0),
      monthlyCapPoints: Number(rules.monthlyCapPoints ?? rules.monthly_cap_points ?? 0),
      collectedEuroPerPoint: Number(rules.collectedEuroPerPoint ?? rules.collected_euro_per_point ?? 0),
    },
    canManage: row.canManage === true || row.can_manage === true,
    currentUserId: row.currentUserId || row.current_user_id
      ? String(row.currentUserId || row.current_user_id)
      : undefined,
  };
}

export const bonusApi = {
  async dashboard() {
    return normalizeBonusDashboard(await apiFetch("/tenant/bonus"));
  },
  request(points: number, reason: string) {
    return apiFetch<BonusRequest>(
      "/tenant/bonus/requests",
      mutationOptions("POST", { points, reason }, featureMutationKey("bonus-request")),
    );
  },
  decide(requestId: string, decision: "approve" | "reject", reason: string) {
    return apiFetch<BonusRequest>(
      "/tenant/bonus/requests/" + encodeURIComponent(requestId) + "/" + decision,
      mutationOptions("POST", { reason }, featureMutationKey("bonus-decision")),
    );
  },
  adjustment(userId: string, points: number, reason: string) {
    return apiFetch<BonusLedgerEntry>(
      "/tenant/bonus/adjustments",
      mutationOptions("POST", { userId, points, reason }, featureMutationKey("bonus-adjustment")),
    );
  },
  policy(name: string, rules: Record<string, number>, reason: string) {
    return apiFetch<BonusPolicy>(
      "/tenant/bonus/policies/versions",
      mutationOptions("POST", { name, rules, reason }, featureMutationKey("bonus-policy")),
    );
  },
  consolidate(periodId: string, reason: string) {
    return apiFetch<{ periodId: string; status: string; consolidatedEntries: number; alreadyConsolidated?: boolean }>(
      "/tenant/bonus/periods/consolidate",
      mutationOptions("POST", { periodId, reason }, featureMutationKey("bonus-period")),
    );
  },
};

export type FlowPreferences = {
  onboardingStatus?: "not_started" | "in_progress" | "completed" | "dismissed" | string;
  activeTourId?: string | null;
  tourStep?: number;
  completedTourIds?: string[];
  dismissedTourIds?: string[];
  suggestionsEnabled?: boolean;
  animationsEnabled?: boolean;
  reducedMotion?: boolean;
  illustratedEmptyStates?: boolean;
  contextualAssistant?: boolean;
  seenReleaseVersion?: string | null;
};

export const preferencesApi = {
  async get() {
    const raw = await apiFetch<Record<string, unknown>>("/tenant/preferences");
    return normalizePreferences(raw.preferences || raw);
  },
  async update(body: Partial<FlowPreferences>) {
    const payload: Record<string, unknown> = {
      ...body,
      ...(body.completedTourIds ? { completedTours: body.completedTourIds } : {}),
      ...(body.dismissedTourIds ? { dismissedModules: body.dismissedTourIds } : {}),
      ...(body.contextualAssistant !== undefined ? { contextualMascotEnabled: body.contextualAssistant } : {}),
    };
    delete payload.completedTourIds;
    delete payload.dismissedTourIds;
    delete payload.contextualAssistant;
    if (payload.activeTourId === null) payload.activeTourId = "none";
    const raw = await apiFetch<Record<string, unknown>>("/tenant/preferences", mutationOptions("PATCH", payload));
    return normalizePreferences(raw.after || raw.preferences || raw);
  },
};

function normalizePreferences(value: unknown): FlowPreferences {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    onboardingStatus: typeof row.onboardingStatus === "string" ? row.onboardingStatus : undefined,
    activeTourId: typeof row.activeTourId === "string" && row.activeTourId !== "none" ? row.activeTourId : null,
    tourStep: Number(row.tourStep || 0),
    completedTourIds: Array.isArray(row.completedTourIds)
      ? row.completedTourIds.map(String)
      : Array.isArray(row.completedTours)
        ? row.completedTours.map(String)
        : [],
    dismissedTourIds: Array.isArray(row.dismissedTourIds)
      ? row.dismissedTourIds.map(String)
      : Array.isArray(row.dismissedModules)
        ? row.dismissedModules.map(String)
        : [],
    suggestionsEnabled: row.suggestionsEnabled !== false,
    animationsEnabled: row.animationsEnabled !== false,
    reducedMotion: row.reducedMotion === true,
    illustratedEmptyStates: row.illustratedEmptyStates !== false,
    contextualAssistant: row.contextualAssistant !== false && row.contextualMascotEnabled !== false,
    seenReleaseVersion: row.seenReleaseVersion === undefined && row.seenNewsVersion === undefined
      ? undefined
      : String(row.seenReleaseVersion ?? row.seenNewsVersion),
  };
}

export type AppRelease = {
  id: string;
  version: string;
  title: string;
  summary?: string;
  category?: string;
  publishedAt?: string;
  read?: boolean;
  features?: string[];
  improvements?: string[];
  fixes?: string[];
  notices?: string[];
};

export const releasesApi = {
  async list(params?: { cursor?: string; limit?: number; unread?: boolean }) {
    const page = pageFrom<Record<string, unknown>>(await apiFetch("/tenant/releases" + query(params)));
    return {
      ...page,
      items: page.items.map((row) => ({
        id: String(row.id || ""),
        version: String(row.version || ""),
        title: String(row.title || "Aggiornamento"),
        summary: String(row.summary || row.content || ""),
        category: typeof row.category === "string" ? row.category : undefined,
        publishedAt: row.publishedAt || row.published_at ? String(row.publishedAt || row.published_at) : undefined,
        read: row.read === true,
        features: Array.isArray(row.features) ? row.features.map(String) : undefined,
        improvements: Array.isArray(row.improvements) ? row.improvements.map(String) : undefined,
        fixes: Array.isArray(row.fixes) ? row.fixes.map(String) : undefined,
        notices: Array.isArray(row.notices) ? row.notices.map(String) : undefined,
      })),
    };
  },
  read(id: string) {
    return apiFetch<{ ok?: boolean }>(
      "/tenant/releases/" + encodeURIComponent(id) + "/read",
      mutationOptions("POST", {}),
    );
  },
};

export type CompanyIntelligenceProviderState = {
  provider: string;
  configured: boolean;
  status?: string;
  message?: string;
};

export type CompanyIntelligenceReport = {
  id: string;
  companyName?: string;
  requestedUrl: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  summary?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: string;
  country?: string;
  city?: string;
  linkedinUrl?: string;
  shortDescription?: string;
  techStack?: string[];
  fundingStage?: string;
  totalFunding?: string;
  fundingEvents?: Array<{
    id?: string;
    date?: string;
    amount?: number;
    currency?: string;
    series?: string;
    investors?: string[];
  }>;
  people?: Array<{
    id?: string;
    name: string;
    title?: string;
    seniority?: string;
    linkedinUrl?: string;
    city?: string;
    country?: string;
  }>;
  notFoundInApollo?: boolean;
  scores?: Record<string, number>;
  findings?: Array<{
    id?: string;
    title: string;
    description?: string;
    evidenceKind?: string;
    sourceUrl?: string;
    confidence?: number;
  }>;
  opportunities?: Array<{ title: string; description?: string; priority?: string }>;
  providers?: CompanyIntelligenceProviderState[];
  error?: string | null;
};

export const companyIntelligenceApi = {
  async list(params?: { cursor?: string; limit?: number }) {
    const page = pageFrom<unknown>(await apiFetch("/tenant/company-intelligence" + query(params)));
    return { ...page, items: page.items.map(normalizeCompanyReport) };
  },
  async analyze(body: { requestedUrl: string; companyName?: string; leadId?: string; customerId?: string; deep?: boolean }) {
    const raw = await apiFetch<Record<string, unknown>>(
      "/tenant/company-intelligence",
      mutationOptions("POST", {
        domain: body.requestedUrl,
        companyName: body.companyName,
        leadId: body.leadId,
        customerId: body.customerId,
        deep: body.deep,
      }, featureMutationKey("company-analysis")),
    );
    if (raw.report === null && raw.configured === false) return null;
    return normalizeCompanyReport(raw.report && typeof raw.report === "object" && "id" in raw.report
      ? raw.report
      : raw);
  },
  async report(id: string) {
    return normalizeCompanyReport(await apiFetch(
      "/tenant/company-intelligence/" + encodeURIComponent(id),
    ));
  },
};

function normalizeCompanyReport(value: unknown): CompanyIntelligenceReport {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const report = (row.report && typeof row.report === "object" ? row.report : {}) as Record<string, unknown>;
  const domain = String(row.domain || row.requestedUrl || row.requested_url || "");
  const provider = String(row.provider || "provider");
  const providerConfigured = row.providerConfigured === true || row.provider_configured === true;
  const strings = (input: unknown) => Array.isArray(input)
    ? input.map(String).map((item) => item.trim()).filter(Boolean)
    : undefined;
  const people = Array.isArray(report.people)
    ? report.people.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const person = value as Record<string, unknown>;
      const name = String(person.name || "").trim();
      if (!name) return [];
      return [{
        id: person.id ? String(person.id) : undefined,
        name,
        title: person.title ? String(person.title) : undefined,
        seniority: person.seniority ? String(person.seniority) : undefined,
        linkedinUrl: person.linkedinUrl || person.linkedin_url ? String(person.linkedinUrl || person.linkedin_url) : undefined,
        city: person.city ? String(person.city) : undefined,
        country: person.country ? String(person.country) : undefined,
      }];
    })
    : undefined;
  const fundingEvents = Array.isArray(report.fundingEvents)
    ? report.fundingEvents.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const event = value as Record<string, unknown>;
      return [{
        id: event.id ? String(event.id) : undefined,
        date: event.date ? String(event.date) : undefined,
        amount: typeof event.amount === "number" ? event.amount : undefined,
        currency: event.currency ? String(event.currency) : undefined,
        series: event.series ? String(event.series) : undefined,
        investors: strings(event.investors),
      }];
    })
    : undefined;
  return {
    id: String(row.id || ""),
    companyName: String(row.companyName || row.company_name || report.name || domain),
    requestedUrl: domain.startsWith("http") ? domain : "https://" + domain,
    status: String(row.status || "unknown"),
    createdAt: String(row.createdAt || row.created_at || new Date(0).toISOString()),
    completedAt: row.completedAt || row.completed_at ? String(row.completedAt || row.completed_at) : undefined,
    summary: typeof report.summary === "string"
      ? report.summary
      : typeof row.summary === "string"
        ? row.summary
        : undefined,
    industry: report.industry ? String(report.industry) : undefined,
    employeeCount: typeof report.employeeCount === "number" ? report.employeeCount : undefined,
    annualRevenue: report.annualRevenue ? String(report.annualRevenue) : undefined,
    country: report.country ? String(report.country) : undefined,
    city: report.city ? String(report.city) : undefined,
    linkedinUrl: report.linkedinUrl ? String(report.linkedinUrl) : undefined,
    shortDescription: report.shortDescription ? String(report.shortDescription) : undefined,
    techStack: strings(report.techStack),
    fundingStage: report.fundingStage ? String(report.fundingStage) : undefined,
    totalFunding: report.totalFunding ? String(report.totalFunding) : undefined,
    fundingEvents,
    people,
    notFoundInApollo: report.notFoundInApollo === true,
    scores: report.scores && typeof report.scores === "object"
      ? report.scores as Record<string, number>
      : row.scores && typeof row.scores === "object"
        ? row.scores as Record<string, number>
        : undefined,
    findings: Array.isArray(report.findings)
      ? report.findings as CompanyIntelligenceReport["findings"]
      : Array.isArray(row.findings)
        ? row.findings as CompanyIntelligenceReport["findings"]
        : undefined,
    opportunities: Array.isArray(report.opportunities)
      ? report.opportunities as CompanyIntelligenceReport["opportunities"]
      : undefined,
    providers: [{ provider, configured: providerConfigured, status: providerConfigured ? "ready" : "provider_unconfigured" }],
    error: row.error || row.error_code ? String(row.error || row.error_code) : undefined,
  };
}
