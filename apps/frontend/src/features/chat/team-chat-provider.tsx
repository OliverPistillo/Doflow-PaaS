"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { LocalVideoTrack } from "livekit-client"
import { toast } from "sonner"

import type {
  ChatConversation,
  ChatConversationKind,
  ChatLinkedRecord,
  ChatMessage,
  ChatMessageMedia,
  ChatNotificationPreference,
  ChatSnapshot,
  TeamCall,
  TeamCallMode,
} from "@/features/chat/team-chat"
import { chatConversationKinds, LIVEKIT_UI_ENABLED } from "@/features/chat/team-chat"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider"
import {
  collaborationApi,
  type CollaborationConversation,
  type CollaborationMessage,
} from "@/lib/tenant-feature-api"

type Result = { ok: boolean; message?: string; id?: string; existing?: boolean }
export type TeamCallConnection = "idle" | "connecting" | "connected" | "reconnecting" | "failed"
type ChatContextValue = ChatSnapshot & {
  connected: boolean
  unreadCount: number
  unreadFor: (conversationId: string) => number
  createConversation: (input: { kind: ChatConversationKind; title: string; participantIds: string[]; linkedRecord?: ChatLinkedRecord; description?: string; channelMode?: "text" | "voice" | "mixed"; visibility?: "public" | "private" | "role" | "project" | "temporary" }) => Promise<Result>
  sendMessage: (input: { conversationId: string; text: string; clientId?: string; replyToMessageId?: string; linkedRecord?: ChatLinkedRecord; urgent?: boolean; media?: ChatMessageMedia }) => Promise<Result>
  setReaction: (messageId: string, emoji: string, active: boolean) => Promise<Result>
  markRead: (conversationId: string, messageIds?: string[]) => Promise<boolean>
  editMessage: (messageId: string, text: string) => Promise<Result>
  deleteMessage: (messageId: string) => Promise<Result>
  setPreference: (conversationId: string, mode: ChatNotificationPreference, mutedUntil?: string, pinned?: boolean) => Promise<boolean>
  currentCall?: TeamCall
  callConnection: TeamCallConnection
  participantIds: string[]
  microphoneEnabled: boolean
  cameraEnabled: boolean
  screenShareEnabled: boolean
  localScreenShareTrack?: LocalVideoTrack
  startCall: (conversationId: string, mode: TeamCallMode, clientId?: string) => Promise<Result>
  joinCall: (callId: string, options?: { microphone?: boolean; camera?: boolean; audioDeviceId?: string; videoDeviceId?: string }) => Promise<Result>
  leaveCall: () => Promise<boolean>
  endCall: () => Promise<boolean>
  toggleMicrophone: () => Promise<boolean>
  toggleCamera: () => Promise<boolean>
  toggleScreenShare: () => Promise<boolean>
}

const empty: ChatSnapshot = {
  conversations: [],
  messages: [],
  reactions: [],
  receipts: [],
  calls: [],
  callAudit: [],
  livekitConfigured: false,
  transport: "server",
  productionReady: true,
}
const ChatContext = createContext<ChatContextValue | null>(null)

function conversationKind(value?: string): ChatConversationKind {
  return chatConversationKinds.includes(value as ChatConversationKind)
    ? value as ChatConversationKind
    : "team"
}

function mapConversation(value: CollaborationConversation, currentUserId: string): ChatConversation {
  const participantIds = (value.participants ?? []).map((item) => item.userId).filter(Boolean)
  const now = value.updatedAt ?? value.createdAt ?? new Date(0).toISOString()
  return {
    id: value.id,
    kind: conversationKind(value.kind),
    title: value.title,
    participantIds,
    createdBy: participantIds[0] ?? currentUserId,
    createdAt: value.createdAt ?? now,
    updatedAt: now,
    pinnedByUserIds: [],
    notificationPreferences: {},
  }
}

function mediaFromMetadata(value: CollaborationMessage["attachmentMetadata"]): ChatMessageMedia | undefined {
  const candidates = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : []
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    const item = candidate as Record<string, unknown>
    if (!(["gif", "sticker"] as const).includes(item.type as "gif" | "sticker")) continue
    const assetId = String(item.assetId ?? item.asset_id ?? "")
    const alt = String(item.alt ?? "")
    if (!assetId || !alt) continue
    return {
      type: item.type as "gif" | "sticker",
      provider: "doflow-internal",
      assetId,
      pack: typeof item.pack === "string" ? item.pack : undefined,
      url: typeof item.url === "string" ? item.url : undefined,
      alt,
      caption: typeof item.caption === "string" ? item.caption : undefined,
      moderation: "approved",
    }
  }
}

function mapMessage(value: CollaborationMessage): ChatMessage {
  return {
    id: value.id,
    clientId: value.id,
    conversationId: value.conversationId,
    authorId: value.authorId,
    text: value.body,
    mentionUserIds: value.mentionUserIds ?? [],
    replyToMessageId: value.parentMessageId ?? undefined,
    attachments: [],
    media: mediaFromMetadata(value.attachmentMetadata),
    createdAt: value.createdAt,
    updatedAt: value.editedAt ?? value.createdAt,
    deletedAt: value.deletedAt ?? undefined,
  }
}

function operationError(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

function timestamp(value?: string) {
  const parsed = Date.parse(value ?? "")
  return Number.isFinite(parsed) ? parsed : 0
}

export function TeamChatProvider({ children }: { children: React.ReactNode }) {
  const identity = useDoflowIdentity()
  const presence = useDoflowPresence()
  const [snapshot, setSnapshot] = useState<ChatSnapshot>(empty)
  const [connected, setConnected] = useState(false)
  const knownMessageIds = useRef<Set<string> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const page = await collaborationApi.conversations({ limit: 200 })
      const messagePages = await Promise.all(
        page.items.map(async (conversation) => {
          try {
            return await collaborationApi.messages(conversation.id, { limit: 500 })
          } catch {
            return { items: [] }
          }
        }),
      )
      const conversations = page.items
        .map((item) => mapConversation(item, identity.currentUserId))
        .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt))
      const serverMessages = messagePages.flatMap((page) => page.items)
      const messages = serverMessages
        .map(mapMessage)
        .sort((left, right) => timestamp(left.createdAt) - timestamp(right.createdAt) || left.id.localeCompare(right.id))
      const reactions = serverMessages.flatMap((message) =>
        (message.reactions ?? []).map((reaction) => ({
          messageId: message.id,
          emoji: reaction.emoji,
          userIds: reaction.userIds ?? [],
        })),
      )
      const receipts = serverMessages.flatMap((message) =>
        (message.receipts ?? []).map((receipt) => ({
          messageId: message.id,
          userId: receipt.userId,
          deliveredAt: receipt.deliveredAt ?? undefined,
          readAt: receipt.readAt ?? undefined,
        })),
      )
      if (knownMessageIds.current) {
        for (const message of messages) {
          if (knownMessageIds.current.has(message.id) || message.authorId === identity.currentUserId) continue
          if (!presence.quietNotifications || message.urgent) {
            const author = identity.users.find((item) => item.id === message.authorId)?.name ?? "Team"
            toast.info(`${author}: ${message.text.slice(0, 80) || "Nuovo messaggio"}`)
          }
        }
      }
      knownMessageIds.current = new Set(messages.map((message) => message.id))
      setSnapshot({
        conversations,
        messages,
        reactions,
        receipts,
        calls: [],
        callAudit: [],
        livekitConfigured: false,
        transport: "server",
        productionReady: true,
      })
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [identity.currentUserId, identity.users, presence.quietNotifications])

  useEffect(() => {
    knownMessageIds.current = null
    const initial = window.setTimeout(() => void refresh(), 0)
    const poll = window.setInterval(() => void refresh(), 10_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(poll)
    }
  }, [identity.currentUserId, refresh])

  const createConversation: ChatContextValue["createConversation"] = useCallback(async (input) => {
    try {
      const saved = await collaborationApi.createConversation({
        title: input.title,
        kind: input.kind,
        participantIds: input.participantIds,
      })
      await refresh()
      return { ok: true, id: saved.id }
    } catch (cause) {
      return { ok: false, message: operationError(cause, "Conversazione non creata") }
    }
  }, [refresh])

  const sendMessage: ChatContextValue["sendMessage"] = useCallback(async (input) => {
    try {
      const saved = await collaborationApi.sendMessage(
        input.conversationId,
        {
          body: input.text,
          parentMessageId: input.replyToMessageId,
          mentionUserIds: identity.users
            .filter((user) => input.text.toLocaleLowerCase("it-IT").includes(`@${user.name.toLocaleLowerCase("it-IT")}`))
            .map((user) => user.id),
          attachmentMetadata: input.media ? [input.media as unknown as Record<string, unknown>] : undefined,
        },
        input.clientId,
      )
      await refresh()
      return { ok: true, id: saved.id }
    } catch (cause) {
      return { ok: false, message: operationError(cause, "Messaggio non inviato") }
    }
  }, [identity.users, refresh])

  const messageConversationId = useCallback(
    (messageId: string) => snapshot.messages.find((item) => item.id === messageId)?.conversationId,
    [snapshot.messages],
  )
  const setReaction = useCallback(async (messageId: string, emoji: string, active: boolean): Promise<Result> => {
    const conversationId = messageConversationId(messageId)
    if (!conversationId) return { ok: false, message: "Messaggio non trovato" }
    try {
      await collaborationApi.react(conversationId, messageId, emoji, active)
      await refresh()
      return { ok: true, id: messageId }
    } catch (cause) {
      return { ok: false, message: operationError(cause, "Reazione non salvata") }
    }
  }, [messageConversationId, refresh])
  const markRead = useCallback(async (conversationId: string, messageIds?: string[]) => {
    const ids = messageIds ?? snapshot.messages.filter((item) => item.conversationId === conversationId).map((item) => item.id)
    try {
      await Promise.all(ids.map((messageId) => collaborationApi.read(conversationId, messageId)))
      await refresh()
      return true
    } catch {
      return false
    }
  }, [refresh, snapshot.messages])
  const editMessage = useCallback(async (messageId: string, text: string): Promise<Result> => {
    const conversationId = messageConversationId(messageId)
    if (!conversationId) return { ok: false, message: "Messaggio non trovato" }
    try {
      await collaborationApi.updateMessage(conversationId, messageId, { body: text })
      await refresh()
      return { ok: true, id: messageId }
    } catch (cause) {
      return { ok: false, message: operationError(cause, "Messaggio non aggiornato") }
    }
  }, [messageConversationId, refresh])
  const deleteMessage = useCallback(async (messageId: string): Promise<Result> => {
    const conversationId = messageConversationId(messageId)
    if (!conversationId) return { ok: false, message: "Messaggio non trovato" }
    try {
      await collaborationApi.deleteMessage(conversationId, messageId)
      await refresh()
      return { ok: true, id: messageId }
    } catch (cause) {
      return { ok: false, message: operationError(cause, "Messaggio non eliminato") }
    }
  }, [messageConversationId, refresh])

  const unavailableCall = useCallback(async (): Promise<Result> => ({
    ok: false,
    message: LIVEKIT_UI_ENABLED ? "Chiamate non disponibili" : "Chiamate disattivate",
  }), [])
  const unavailableToggle = useCallback(async () => false, [])
  const setPreference = useCallback(async () => false, [])
  const unreadFor = useCallback((conversationId: string) => snapshot.messages.filter((message) =>
    message.conversationId === conversationId
    && message.authorId !== identity.currentUserId
    && !message.deletedAt
    && !snapshot.receipts.find((receipt) => receipt.messageId === message.id && receipt.userId === identity.currentUserId)?.readAt,
  ).length, [identity.currentUserId, snapshot.messages, snapshot.receipts])
  const unreadCount = useMemo(
    () => snapshot.conversations.reduce((total, conversation) => total + unreadFor(conversation.id), 0),
    [snapshot.conversations, unreadFor],
  )
  const value = useMemo<ChatContextValue>(() => ({
    ...snapshot,
    livekitConfigured: false,
    connected,
    unreadCount,
    unreadFor,
    createConversation,
    sendMessage,
    setReaction,
    markRead,
    editMessage,
    deleteMessage,
    setPreference,
    currentCall: undefined,
    callConnection: "idle",
    participantIds: [],
    microphoneEnabled: false,
    cameraEnabled: false,
    screenShareEnabled: false,
    localScreenShareTrack: undefined,
    startCall: unavailableCall,
    joinCall: unavailableCall,
    leaveCall: unavailableToggle,
    endCall: unavailableToggle,
    toggleMicrophone: unavailableToggle,
    toggleCamera: unavailableToggle,
    toggleScreenShare: unavailableToggle,
  }), [connected, createConversation, deleteMessage, editMessage, markRead, sendMessage, setPreference, setReaction, snapshot, unavailableCall, unavailableToggle, unreadCount, unreadFor])
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useTeamChat() {
  const value = useContext(ChatContext)
  if (!value) throw new Error("useTeamChat deve essere usato dentro TeamChatProvider")
  return value
}
