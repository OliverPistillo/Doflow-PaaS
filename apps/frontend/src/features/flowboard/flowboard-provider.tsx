"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import type { Flowboard, FlowboardComment, FlowboardMode, FlowboardSnapshot, FlowboardStatus, FlowboardUserPreferences, FlowboardVersion } from "@/features/flowboard/flowboard-types"
import { defaultFlowboardPreferences } from "@/features/flowboard/flowboard-types"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { flowboardApi, type Flowboard as ServerFlowboard, type FlowboardComment as ServerFlowboardComment } from "@/lib/tenant-feature-api"

type Result = { ok: boolean; id?: string; existing?: boolean; message?: string }
type FlowboardContextValue = FlowboardSnapshot & {
  connected: boolean
  refresh: () => Promise<void>
  createBoard: (input: { name: string; templateId?: string; projectId?: string; clientId?: string }) => Promise<Result>
  saveBoard: (boardId: string, input: Pick<Flowboard, "nodes" | "edges" | "viewport"> & { mode: FlowboardMode; clientId?: string }) => Promise<Result>
  updateBoard: (boardId: string, updates: Partial<Pick<Flowboard, "name" | "description" | "status" | "projectId" | "collaborators">> & { archive?: boolean; restore?: boolean; duplicate?: boolean }) => Promise<Result>
  deleteBoard: (boardId: string) => Promise<Result>
  addComment: (input: { boardId: string; targetType: FlowboardComment["targetType"]; targetId?: string; text: string; parentId?: string; clientId?: string }) => Promise<Result>
  editComment: (commentId: string, text: string, clientId?: string) => Promise<Result>
  deleteComment: (commentId: string, clientId?: string) => Promise<Result>
  resolveComment: (commentId: string, resolved: boolean) => Promise<boolean>
  createVersion: (boardId: string, name: string) => Promise<Result>
  restoreVersion: (boardId: string, versionId: string) => Promise<Result>
  setPreferences: (preferences: FlowboardUserPreferences) => Promise<boolean>
}

const empty: FlowboardSnapshot = { boards: [], comments: [], versions: [], preferences: defaultFlowboardPreferences, transport: "server", productionReady: true }
const FlowboardContext = createContext<FlowboardContextValue | null>(null)
const statuses: FlowboardStatus[] = ["Bozza", "Attiva", "Completata", "Archiviata"]

function mapStatus(value?: string): FlowboardStatus {
  return statuses.includes(value as FlowboardStatus) ? value as FlowboardStatus : "Bozza"
}

function mapComment(value: ServerFlowboardComment): FlowboardComment {
  return {
    id: value.id,
    boardId: value.boardId,
    targetType: value.targetType ?? "board",
    targetId: value.targetId ?? undefined,
    authorId: value.authorId,
    text: value.body,
    mentionUserIds: [],
    parentId: value.parentId ?? undefined,
    createdAt: value.createdAt,
    resolvedAt: value.resolvedAt ?? undefined,
  }
}

function mapBoard(value: ServerFlowboard, currentUserId: string): Flowboard {
  const createdAt = value.createdAt ?? value.updatedAt ?? new Date(0).toISOString()
  const updatedAt = value.updatedAt ?? createdAt
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    ownerId: value.ownerId ?? currentUserId,
    collaborators: value.collaborators ?? [],
    projectId: value.projectId,
    status: mapStatus(value.status),
    mode: value.mode ?? "free",
    nodes: value.nodes as unknown as Flowboard["nodes"],
    edges: value.edges as unknown as Flowboard["edges"],
    viewport: value.viewport ?? { x: 0, y: 0, zoom: 1 },
    isTemplate: value.isTemplate,
    templateKey: value.templateKey,
    createdAt,
    updatedAt,
    savedAt: value.savedAt ?? updatedAt,
    archivedAt: value.archivedAt,
    deletedAt: value.deletedAt,
    revision: value.revision,
  }
}

function mapVersions(value: ServerFlowboard): FlowboardVersion[] {
  return (value.versions ?? []).map((item) => ({
    id: item.id,
    boardId: value.id,
    name: item.reason ?? `Versione ${item.version}`,
    createdAt: item.createdAt,
    createdBy: item.createdBy ?? value.ownerId ?? "",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: value.mode ?? "free",
    reason: "manual",
  }))
}

function failure(cause: unknown, fallback: string): Result {
  const message = cause instanceof Error ? cause.message : fallback
  toast.error(message)
  return { ok: false, message }
}

export function FlowboardProvider({ children }: { children: React.ReactNode }) {
  const identity = useDoflowIdentity()
  const [snapshot, setSnapshot] = useState(empty)
  const [connected, setConnected] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const page = await flowboardApi.list({ limit: 200, archived: true })
      const details = await Promise.all(page.items.map(async (item) => {
        try { return await flowboardApi.get(item.id) } catch { return item }
      }))
      setSnapshot((current) => ({
        ...current,
        boards: details.map((item) => mapBoard(item, identity.currentUserId)),
        comments: details.flatMap((item) => (item.comments ?? []).map(mapComment)),
        versions: details.flatMap(mapVersions),
      }))
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [identity.currentUserId])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const poll = window.setInterval(() => void refresh(), 12_000)
    return () => { window.clearTimeout(initial); window.clearInterval(poll) }
  }, [refresh])

  const createBoard: FlowboardContextValue["createBoard"] = useCallback(async (input) => {
    try {
      const saved = await flowboardApi.create({ name: input.name, templateId: input.templateId, projectId: input.projectId })
      await refresh()
      return { ok: true, id: saved.id }
    } catch (cause) { return failure(cause, "Flowboard non creata") }
  }, [refresh])

  const saveBoard: FlowboardContextValue["saveBoard"] = useCallback(async (boardId, input) => {
    const board = snapshot.boards.find((item) => item.id === boardId)
    if (!board) return { ok: false, message: "Flowboard non trovata" }
    try {
      const saved = await flowboardApi.save(boardId, {
        nodes: input.nodes as unknown as ServerFlowboard["nodes"],
        edges: input.edges as unknown as ServerFlowboard["edges"],
        viewport: input.viewport,
        revision: board.revision ?? 1,
      })
      await refresh()
      return { ok: true, id: saved.id }
    } catch (cause) { return failure(cause, "Flowboard non salvata") }
  }, [refresh, snapshot.boards])

  const updateBoard: FlowboardContextValue["updateBoard"] = useCallback(async (boardId, updates) => {
    const board = snapshot.boards.find((item) => item.id === boardId)
    if (!board) return { ok: false, message: "Flowboard non trovata" }
    try {
      if (updates.duplicate) {
        const duplicated = await flowboardApi.duplicate(boardId, { projectId: updates.projectId, revision: board.revision ?? 1 })
        await refresh()
        return { ok: true, id: duplicated.id }
      }
      if (updates.archive) await flowboardApi.archive(boardId)
      else if (updates.restore) await flowboardApi.restore(boardId)
      else await flowboardApi.update(boardId, {
        name: updates.name,
        description: updates.description,
        status: updates.status,
        projectId: updates.projectId,
        collaborators: updates.collaborators,
        revision: board.revision ?? 1,
      })
      await refresh()
      return { ok: true, id: boardId }
    } catch (cause) { return failure(cause, "Flowboard non aggiornata") }
  }, [refresh, snapshot.boards])

  const deleteBoard = useCallback(async (boardId: string) => {
    try { await flowboardApi.remove(boardId); await refresh(); return { ok: true, id: boardId } }
    catch (cause) { return failure(cause, "Flowboard non eliminata") }
  }, [refresh])

  const addComment: FlowboardContextValue["addComment"] = useCallback(async (input) => {
    try {
      const saved = await flowboardApi.comment(input.boardId, { body: input.text, targetType: input.targetType, targetId: input.targetId, parentId: input.parentId })
      await refresh()
      return { ok: true, id: saved.id }
    } catch (cause) { return failure(cause, "Commento non creato") }
  }, [refresh])
  const commentBoardId = useCallback((commentId: string) => snapshot.comments.find((item) => item.id === commentId)?.boardId, [snapshot.comments])
  const editComment = useCallback(async (commentId: string, text: string) => {
    const boardId = commentBoardId(commentId)
    if (!boardId) return { ok: false, message: "Commento non trovato" }
    try { await flowboardApi.updateComment(boardId, commentId, text); await refresh(); return { ok: true, id: commentId } }
    catch (cause) { return failure(cause, "Commento non aggiornato") }
  }, [commentBoardId, refresh])
  const deleteComment = useCallback(async (commentId: string) => {
    const boardId = commentBoardId(commentId)
    if (!boardId) return { ok: false, message: "Commento non trovato" }
    try { await flowboardApi.deleteComment(boardId, commentId); await refresh(); return { ok: true, id: commentId } }
    catch (cause) { return failure(cause, "Commento non eliminato") }
  }, [commentBoardId, refresh])
  const resolveComment = useCallback(async () => false, [])
  const createVersion = useCallback(async (boardId: string, name: string) => {
    try { const saved = await flowboardApi.version(boardId, name); await refresh(); return { ok: true, id: String(saved.id ?? "") } }
    catch (cause) { return failure(cause, "Versione non creata") }
  }, [refresh])
  const restoreVersion = useCallback(async (boardId: string, versionId: string) => {
    const board = snapshot.boards.find((item) => item.id === boardId)
    if (!board) return { ok: false, message: "Flowboard non trovata" }
    try { await flowboardApi.restoreVersion(boardId, versionId, board.revision ?? 1); await refresh(); return { ok: true, id: boardId } }
    catch (cause) { return failure(cause, "Versione non ripristinata") }
  }, [refresh, snapshot.boards])
  const setPreferences = useCallback(async (preferences: FlowboardUserPreferences) => {
    setSnapshot((current) => ({ ...current, preferences }))
    return true
  }, [])
  const value = useMemo<FlowboardContextValue>(() => ({ ...snapshot, connected, refresh, createBoard, saveBoard, updateBoard, deleteBoard, addComment, editComment, deleteComment, resolveComment, createVersion, restoreVersion, setPreferences }), [addComment, connected, createBoard, createVersion, deleteBoard, deleteComment, editComment, refresh, resolveComment, restoreVersion, saveBoard, setPreferences, snapshot, updateBoard])
  return <FlowboardContext.Provider value={value}>{children}</FlowboardContext.Provider>
}

export function useFlowboards() {
  const value = useContext(FlowboardContext)
  if (!value) throw new Error("useFlowboards deve essere usato dentro FlowboardProvider")
  return value
}
