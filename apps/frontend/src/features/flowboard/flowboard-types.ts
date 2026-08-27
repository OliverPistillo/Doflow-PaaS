import type { Edge, Node, Viewport } from "@xyflow/react"

export const flowboardNodeKinds = ["project", "phase", "activity", "lead", "customer", "appointment", "deadline", "person", "milestone", "note", "text", "link", "container"] as const
export type FlowboardNodeKind = (typeof flowboardNodeKinds)[number]
export const flowboardRelations = ["depends_on", "blocks", "links", "precedes", "free"] as const
export type FlowboardRelation = (typeof flowboardRelations)[number]
export type FlowboardMode = "free" | "roadmap"
export type FlowboardStatus = "Bozza" | "Attiva" | "Completata" | "Archiviata"
export type FlowboardRecordType = "project" | "phase" | "activity" | "lead" | "customer" | "appointment" | "deadline" | "person"
export type FlowboardRecordRef = { type: FlowboardRecordType; id: string; parentId?: string }
export type FlowboardNodeData = {
  kind: FlowboardNodeKind
  label: string
  description?: string
  color?: string
  icon?: string
  record?: FlowboardRecordRef
  locked?: boolean
  layer?: number
  status?: string
  priority?: string
  assigneeId?: string
  dueAt?: string
  progress?: number
  href?: string
  containerId?: string
}
export type FlowboardNode = Node<FlowboardNodeData, "flowboard">
export type FlowboardEdgeData = {
  relation: FlowboardRelation
  label?: string
  synchronizedAt?: string
  dependentActivityId?: string
  dependencyActivityId?: string
}
export type FlowboardEdge = Edge<FlowboardEdgeData>
export type FlowboardCollaborator = { userId: string; permission: "view" | "edit" }
export type Flowboard = {
  id: string
  name: string
  description?: string
  ownerId: string
  collaborators: FlowboardCollaborator[]
  projectId?: string
  status: FlowboardStatus
  mode: FlowboardMode
  nodes: FlowboardNode[]
  edges: FlowboardEdge[]
  viewport: Viewport
  isTemplate?: boolean
  templateKey?: string
  createdAt: string
  updatedAt: string
  savedAt: string
  archivedAt?: string
  deletedAt?: string
  revision?: number
}
export type FlowboardComment = {
  id: string
  boardId: string
  targetType: "board" | "node" | "edge"
  targetId?: string
  authorId: string
  text: string
  mentionUserIds: string[]
  parentId?: string
  createdAt: string
  updatedAt?: string
  deletedAt?: string
  deletedBy?: string
  resolvedAt?: string
  resolvedBy?: string
}
export type FlowboardVersion = { id: string; boardId: string; name: string; createdAt: string; createdBy: string; nodes: FlowboardNode[]; edges: FlowboardEdge[]; viewport: Viewport; mode: FlowboardMode; reason: "manual" | "restore-safety" }
export type FlowboardUserPreferences = { view: "grid" | "list"; owner: string; project: string; status: string; updated: string; tab: "all" | "mine" | "shared" | "templates" | "archived"; search: string }
export type FlowboardSnapshot = { boards: Flowboard[]; comments: FlowboardComment[]; versions: FlowboardVersion[]; preferences: FlowboardUserPreferences; transport: "server"; productionReady: true }

export const defaultFlowboardPreferences: FlowboardUserPreferences = { view: "grid", owner: "all", project: "all", status: "all", updated: "all", tab: "all", search: "" }

export const flowboardNodeLabels: Record<FlowboardNodeKind, string> = { project: "Progetto", phase: "Fase", activity: "Attività", lead: "Lead", customer: "Cliente", appointment: "Appuntamento", deadline: "Scadenza", person: "Persona", milestone: "Milestone", note: "Nota", text: "Testo", link: "Collegamento esterno", container: "Contenitore" }
export const flowboardRelationLabels: Record<FlowboardRelation, string> = { depends_on: "Dipende da", blocks: "Blocca", links: "Collega", precedes: "Precede", free: "Relazione libera" }
