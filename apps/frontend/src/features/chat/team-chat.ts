export const chatConversationKinds = ["direct", "team", "group", "customer", "project", "support"] as const
export type ChatConversationKind = (typeof chatConversationKinds)[number]
export type ChatNotificationPreference = "all" | "mentions" | "muted"
export type TeamSpaceChannelMode = "text" | "voice" | "mixed"
export type TeamSpaceChannelVisibility = "public" | "private" | "role" | "project" | "temporary"
export type TeamSpaceMemberRole = "owner" | "moderator" | "member" | "view_only"
export type TeamCallMode = "voice" | "video"
export type TeamCallStatus = "waiting" | "active" | "ended" | "failed"
export type ChatRecordType = "lead" | "customer" | "activity" | "project" | "support" | "contract" | "renewal" | "appointment" | "inbox" | "flowboard"

export type ChatLinkedRecord = { type: ChatRecordType; id: string; title: string; href: string }
export type ChatAttachment = { id: string; name: string; mimeType: string; size: number; status: "unavailable" }
export type ChatMessageMedia = {
  type: "gif" | "sticker"
  provider: "doflow-internal"
  assetId: string
  pack?: string
  url?: string
  alt: string
  caption?: string
  moderation: "approved"
}
export type ChatReaction = { messageId: string; emoji: string; userIds: string[] }
export type ChatConversation = {
  id: string
  kind: ChatConversationKind
  title: string
  participantIds: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
  linkedRecord?: ChatLinkedRecord
  pinnedByUserIds: string[]
  notificationPreferences: Record<string, { mode: ChatNotificationPreference; mutedUntil?: string }>
  description?: string
  channelMode?: TeamSpaceChannelMode
  visibility?: TeamSpaceChannelVisibility
  memberRoles?: Record<string, TeamSpaceMemberRole>
  color?: string
  icon?: string
  archivedAt?: string
}
export type ChatMessage = {
  id: string
  clientId: string
  conversationId: string
  authorId: string
  text: string
  mentionUserIds: string[]
  replyToMessageId?: string
  linkedRecord?: ChatLinkedRecord
  attachments: ChatAttachment[]
  media?: ChatMessageMedia
  urgent?: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string
}
export type ChatReceipt = { messageId: string; userId: string; deliveredAt?: string; readAt?: string }
export type TeamCall = {
  id: string
  clientId: string
  conversationId: string
  mode: TeamCallMode
  status: TeamCallStatus
  createdBy: string
  invitedUserIds: string[]
  connectedUserIds: string[]
  createdAt: string
  startedAt?: string
  endedAt?: string
  endedBy?: string
}
export type TeamCallAudit = { id: string; callId: string; actorId: string; action: "started" | "joined" | "left" | "ended"; createdAt: string }
export type ChatSnapshot = { conversations: ChatConversation[]; messages: ChatMessage[]; reactions: ChatReaction[]; receipts: ChatReceipt[]; calls: TeamCall[]; callAudit: TeamCallAudit[]; livekitConfigured: boolean; transport: "server"; productionReady: true }

export const TEAM_CHAT_ID = "team-doflow"
export const LIVEKIT_UI_ENABLED = process.env.NEXT_PUBLIC_LIVEKIT_ENABLED === "true"

export function chatConversationTitle(conversation: Pick<ChatConversation, "title">) {
  return conversation.title.trim().toLocaleLowerCase("it-IT") === "sviluppo" ? "Produzione" : conversation.title
}

export function chatReceiptStatus(message: ChatMessage, receipts: ChatReceipt[]) {
  const targets = receipts.filter((receipt) => receipt.messageId === message.id && receipt.userId !== message.authorId)
  if (targets.length && targets.every((receipt) => receipt.readAt)) return "Letto"
  if (targets.length && targets.every((receipt) => receipt.deliveredAt)) return "Consegnato"
  return "Inviato"
}

export function extractMentionUserIds(text: string, users: Array<{ id: string; name: string }>) {
  const normalized = text.toLocaleLowerCase("it-IT")
  return users.filter((user) => normalized.includes(`@${user.name.toLocaleLowerCase("it-IT")}`)).map((user) => user.id)
}
