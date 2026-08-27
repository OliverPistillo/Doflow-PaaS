"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import type { CustomerCommunication } from "@/features/commercial/commercial-provider-types"
import {
  emptyInboxFilters,
  type InboxChannel,
  type InboxConversation,
  type InboxFilters,
  type InboxRecordLink,
  type InboxSnapshot,
} from "@/features/inbox/customer-inbox"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { backendContractsApi } from "@/lib/tenant-backend-contracts-api"

type InboxResult = { ok: boolean; message?: string; id?: string; existing?: boolean }
type InboxContextValue = InboxSnapshot & {
  connected: boolean
  unreadCount: number
  unreadFor: (conversationId: string) => number
  refresh: () => Promise<void>
  send: (input: { conversationId: string; text: string; channel: InboxChannel; internal?: boolean; clientId?: string; replyToMessageId?: string; scheduledAt?: string }) => Promise<InboxResult>
  updateConversation: (conversationId: string, updates: Partial<Pick<InboxConversation, "status" | "priority" | "assignedToId" | "supervisorId" | "collaboratorIds" | "dueAt" | "category" | "tags" | "linkedRecords" | "candidateMatches">> & { archive?: boolean }) => Promise<InboxResult>
  markRead: (conversationId: string, persist?: boolean) => Promise<boolean>
  saveDraft: (conversationId: string, text: string) => Promise<boolean>
  setFilters: (filters: InboxFilters) => Promise<boolean>
  createDemoInbound: (input: { contactName: string; company?: string; email?: string; phone?: string; channel: InboxChannel; text: string; assignedToId?: string; linkedRecords?: InboxRecordLink[]; candidateMatches?: InboxConversation["candidateMatches"]; clientId?: string }) => Promise<InboxResult>
}

const emptySnapshot: InboxSnapshot = { conversations: [], messages: [], receipts: [], drafts: {}, filters: emptyInboxFilters, transport: "server-postgresql", productionReady: true }
const InboxContext = createContext<InboxContextValue | null>(null)

function channelOf(value?: CustomerCommunication["channel"]): InboxChannel {
  if (value === "WhatsApp") return "whatsapp"
  if (value === "Email") return "email"
  if (value === "Chiamata") return "call"
  return "support"
}

function communicationChannel(value: InboxChannel, internal?: boolean): CustomerCommunication["channel"] {
  if (internal) return "Nota"
  if (value === "whatsapp") return "WhatsApp"
  if (value === "email") return "Email"
  if (value === "call") return "Chiamata"
  return "Nota"
}

export function CustomerInboxProvider({ children }: { children: React.ReactNode }) {
  const identity = useDoflowIdentity()
  const commercial = useCommercialLeads()
  const [snapshot, setSnapshot] = useState<InboxSnapshot>(emptySnapshot)
  const [connected, setConnected] = useState(false)

  const refresh = useCallback(async () => {
    let authority: Record<string, unknown> = {}
    try { authority = await backendContractsApi.inbox.state() } catch { authority = {} }
    const stateRows = Array.isArray(authority.conversations) ? authority.conversations as Record<string, unknown>[] : []
    const stateByCompany = new Map(stateRows.map((row) => [String(row.company_id || ""), row]))
    const conversations: InboxConversation[] = commercial.customers
      .filter((customer) => !customer.archivedAt && !customer.mergedIntoId)
      .map((customer) => {
        const persisted = stateByCompany.get(customer.id)
        const communications = (customer.communications ?? []).filter((item) => !item.archivedAt)
        const latest = [...communications].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0]
        const contactName = `${customer.profile.firstName} ${customer.profile.lastName}`.trim() || customer.profile.company
        const linked: InboxRecordLink = { type: "customer", id: customer.id, title: customer.profile.company || contactName, href: `/dashboard/clienti/${customer.id}` }
        const status = customer.status === "In attesa cliente"
          ? "In attesa cliente" as const
          : ["Consegnato", "Completato"].includes(customer.status)
            ? "Risolta" as const
            : "In lavorazione" as const
        return {
          id: customer.id,
          contactName,
          company: customer.profile.company || undefined,
          email: customer.profile.email || undefined,
          phone: customer.profile.phone || undefined,
          channel: channelOf(latest?.channel),
          status: (persisted?.status as InboxConversation["status"] | undefined) ?? status,
          priority: (persisted?.priority as InboxConversation["priority"] | undefined) ?? "Normale" as const,
          assignedToId: String(persisted?.assigned_to_id || customer.profile.assigneeId || "") || undefined,
          supervisorId: persisted?.supervisor_id ? String(persisted.supervisor_id) : undefined,
          collaboratorIds: [],
          dueAt: persisted?.due_at ? String(persisted.due_at) : customer.profile.nextActionAt || undefined,
          slaMinutes: 0,
          tags: Array.isArray(persisted?.tags) ? persisted.tags.map(String) : [],
          category: persisted?.category ? String(persisted.category) : undefined,
          linkedRecords: Array.isArray(persisted?.linked_records) && persisted.linked_records.length ? persisted.linked_records as InboxRecordLink[] : [linked],
          candidateMatches: Array.isArray(persisted?.candidate_matches) ? persisted.candidate_matches as InboxConversation["candidateMatches"] : [],
          createdAt: customer.createdAt,
          updatedAt: latest?.updatedAt ?? customer.createdAt,
          lastMessageAt: latest?.occurredAt ?? customer.createdAt,
          optimisticVersion: Number(persisted?.optimistic_version ?? 0),
        }
      })
    const messages = commercial.customers.flatMap((customer) =>
      (customer.communications ?? []).filter((item) => !item.archivedAt).map((item) => ({
        id: item.id,
        clientId: item.id,
        conversationId: customer.id,
        direction: item.direction ?? (item.channel === "Nota" ? "internal" as const : "outgoing" as const),
        channel: channelOf(item.channel),
        authorId: item.direction === "incoming" ? undefined : identity.currentUserId,
        sender: item.direction === "incoming" ? customer.profile.company || `${customer.profile.firstName} ${customer.profile.lastName}`.trim() : identity.currentUser.name,
        text: item.body,
        attachments: [],
        status: item.status === "external_opened" ? "external_opened" as const : "recorded" as const,
        createdAt: item.occurredAt,
      })),
    )
    const drafts = Object.fromEntries((Array.isArray(authority.drafts) ? authority.drafts as Record<string, unknown>[] : []).map((row) => [String(row.company_id || ""), String(row.body || "")]))
    const receipts = (Array.isArray(authority.receipts) ? authority.receipts as Record<string, unknown>[] : []).map((row) => ({ conversationId: String(row.company_id || ""), userId: identity.currentUserId, readAt: String(row.read_at || "") }))
    const filters = authority.filters && typeof authority.filters === "object" ? authority.filters as InboxFilters : emptyInboxFilters
    setSnapshot((current) => ({ ...current, conversations, messages, drafts, receipts, filters }))
    setConnected(commercial.hasHydrated && commercial.workspaceStatus === "ready")
  }, [commercial.customers, commercial.hasHydrated, commercial.workspaceStatus, identity.currentUser.name, identity.currentUserId])

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer) }, [refresh])

  const send: InboxContextValue["send"] = useCallback(async (input) => {
    if (!input.internal) return { ok: false, message: "Canale esterno non collegato: nessun invio è stato registrato" }
    if (input.scheduledAt) {
      try { const id = crypto.randomUUID(); await backendContractsApi.inbox.schedule(input.conversationId, { id, text: input.text, channel: communicationChannel(input.channel, true), internal: true, scheduledAt: input.scheduledAt }); await refresh(); return { ok: true, id } }
      catch (cause) { return { ok: false, message: cause instanceof Error ? cause.message : "Pianificazione non riuscita" } }
    }
    const customer = commercial.customers.find((item) => item.id === input.conversationId)
    if (!customer) return { ok: false, message: "Cliente non trovato" }
    const id = commercial.addCustomerCommunication(customer.id, {
      channel: communicationChannel(input.channel, true),
      title: "Nota Inbox",
      body: input.text,
      direction: "internal",
      status: "recorded",
      occurredAt: new Date().toISOString(),
      leadId: customer.sourceLeadId,
    })
    if (!id) return { ok: false, message: "Nota non registrata" }
    await refresh()
    return { ok: true, id }
  }, [commercial, refresh])
  const updateConversation: InboxContextValue["updateConversation"] = useCallback(async (conversationId, updates) => {
    const current = snapshot.conversations.find((item) => item.id === conversationId) as (InboxConversation & { optimisticVersion?: number }) | undefined
    try { await backendContractsApi.inbox.update(conversationId, { ...updates, optimisticVersion: current?.optimisticVersion ?? 0 } as Record<string, unknown>); await refresh(); return { ok: true, id: conversationId } }
    catch (cause) { return { ok: false, message: cause instanceof Error ? cause.message : "Conversazione non aggiornata" } }
  }, [refresh, snapshot.conversations])
  const markRead = useCallback(async (conversationId: string, persist = false) => {
    const readAt = new Date().toISOString()
    setSnapshot((current) => ({ ...current, receipts: [...current.receipts.filter((item) => !(item.conversationId === conversationId && item.userId === identity.currentUserId)), { conversationId, userId: identity.currentUserId, readAt }] }))
    if (!persist) return true
    try { await backendContractsApi.inbox.read(conversationId); return true } catch { return false }
  }, [identity.currentUserId])
  const saveDraft = useCallback(async (conversationId: string, text: string) => {
    setSnapshot((current) => ({ ...current, drafts: { ...current.drafts, [conversationId]: text } }))
    try { await backendContractsApi.inbox.draft(conversationId, text); return true } catch { return false }
  }, [])
  const setFilters = useCallback(async (filters: InboxFilters) => {
    setSnapshot((current) => ({ ...current, filters }))
    try { await backendContractsApi.inbox.filters(filters as unknown as Record<string, unknown>); return true } catch { return false }
  }, [])
  const createDemoInbound = useCallback(async (): Promise<InboxResult> => ({ ok: false, message: "Modalità demo rimossa" }), [])
  const unreadFor = useCallback(() => 0, [])
  const value = useMemo<InboxContextValue>(() => ({
    ...snapshot,
    connected,
    unreadCount: 0,
    unreadFor,
    refresh,
    send,
    updateConversation,
    markRead,
    saveDraft,
    setFilters,
    createDemoInbound,
  }), [connected, createDemoInbound, markRead, refresh, saveDraft, send, setFilters, snapshot, unreadFor, updateConversation])
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useCustomerInbox() {
  const value = useContext(InboxContext)
  if (!value) throw new Error("useCustomerInbox deve essere usato dentro CustomerInboxProvider")
  return value
}
