"use client";

import * as React from "react";
import Link from "next/link";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type Viewport,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Check, Loader2, MessageCircle, Plus, RefreshCw, Save, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useOptionalTenantAccess } from "@/contexts/TenantAccessContext";
import { useOptionalDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import {
  featureMutationKey,
  flowboardApi,
  type Flowboard,
  type FlowboardComment,
  type FlowboardNodeData,
} from "@/lib/tenant-feature-api";
import { teamApi, type TeamMember } from "@/lib/tenant-team-api";

type BoardNode = Node<FlowboardNodeData>;

function asBoardNode(node: Flowboard["nodes"][number]): BoardNode {
  return {
    ...node,
    type: node.type || "default",
    className: "rounded-xl border bg-card text-card-foreground shadow-sm",
  };
}

function asApiNode(node: BoardNode): Flowboard["nodes"][number] {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  };
}

function asApiEdge(edge: Edge): Flowboard["edges"][number] {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    label: typeof edge.label === "string" ? edge.label : undefined,
  };
}

export function FlowboardEditor({ boardId }: { boardId: string }) {
  const { resolvedTheme } = useTheme();
  const tenantAccess = useOptionalTenantAccess();
  const doflowIdentity = useOptionalDoflowIdentity();
  const [board, setBoard] = React.useState<Flowboard>();
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [viewport, setViewport] = React.useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [selectedNodeId, setSelectedNodeId] = React.useState<string>();
  const [comments, setComments] = React.useState<FlowboardComment[]>([]);
  const [comment, setComment] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [error, setError] = React.useState("");
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareDraft, setShareDraft] = React.useState<Array<{ userId: string; permission: "view" | "edit" }>>([]);
  const [sharing, setSharing] = React.useState(false);

  const canUpdateBoard = doflowIdentity
    ? doflowIdentity.hasCapability("canEditProject") || doflowIdentity.hasCapability("canManageProjects")
    : Boolean(tenantAccess?.canUpdate("projects"));
  const canCreateComment = doflowIdentity
    ? doflowIdentity.hasCapability("canCreateComments")
    : Boolean(tenantAccess?.canCreate("projects"));
  const canEdit = Boolean(board && board.role !== "viewer" && canUpdateBoard);
  const canShare = Boolean(board?.role === "owner" && canUpdateBoard);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextBoard, commentPage] = await Promise.all([
        flowboardApi.get(boardId),
        flowboardApi.comments(boardId).catch(() => ({ items: [] })),
      ]);
      setBoard(nextBoard);
      setNodes((nextBoard.nodes || []).map(asBoardNode));
      setEdges((nextBoard.edges || []) as Edge[]);
      setViewport(nextBoard.viewport || { x: 0, y: 0, zoom: 1 });
      setComments(commentPage.items);
      setShareDraft(nextBoard.collaborators || []);
      if (nextBoard.role === "owner" && canUpdateBoard) {
        const team = await teamApi.members({ limit: 100 }).catch(() => ({ items: [] }));
        setTeamMembers(team.items || []);
      } else {
        setTeamMembers([]);
      }
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Flowboard non disponibile.");
    } finally {
      setLoading(false);
    }
  }, [boardId, canUpdateBoard, setEdges, setNodes]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = React.useCallback(async () => {
    if (!board || !canEdit || saving) return;
    setSaving(true);
    try {
      const updated = await flowboardApi.save(board.id, {
        nodes: nodes.map(asApiNode),
        edges: edges.map(asApiEdge),
        viewport,
        revision: board.revision,
      });
      setBoard({ ...updated, role: board.role });
      setDirty(false);
      toast.success("Flowboard salvato.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  }, [board, canEdit, edges, nodes, saving, viewport]);

  React.useEffect(() => {
    if (!dirty || !canEdit) return;
    const timer = window.setTimeout(() => void save(), 1400);
    return () => window.clearTimeout(timer);
  }, [canEdit, dirty, edges, nodes, save, viewport]);

  const addNode = () => {
    if (!canEdit) return;
    const id = featureMutationKey("node");
    setNodes((current) => [...current, {
      id,
      position: { x: 80 + current.length * 24, y: 80 + current.length * 24 },
      data: { label: "Nuovo elemento", description: "" },
      className: "rounded-xl border bg-card text-card-foreground shadow-sm",
    }]);
    setSelectedNodeId(id);
    setDirty(true);
  };

  const onConnect = React.useCallback((connection: Connection) => {
    if (!canEdit) return;
    setEdges((current) => addEdge({
      ...connection,
      id: featureMutationKey("edge"),
      type: "smoothstep",
    }, current));
    setDirty(true);
  }, [canEdit, setEdges]);

  const updateSelectedNode = (patch: Partial<FlowboardNodeData>) => {
    if (!selectedNodeId || !canEdit) return;
    setNodes((current) => current.map((node) => node.id === selectedNodeId
      ? { ...node, data: { ...node.data, ...patch } }
      : node));
    setDirty(true);
  };

  const sendComment = async () => {
    if (!canCreateComment || !comment.trim()) return;
    try {
      const item = await flowboardApi.comment(boardId, {
        body: comment.trim(),
        targetType: selectedNodeId ? "node" : "board",
        targetId: selectedNodeId,
      });
      setComments((current) => [...current, item]);
      setComment("");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Commento non inviato.");
    }
  };

  const saveSharing = async () => {
    if (!board || !canShare) return;
    setSharing(true);
    try {
      await flowboardApi.update(board.id, { collaborators: shareDraft, revision: board.revision });
      setShareOpen(false);
      await load();
      toast.success("Condivisione Flowboard aggiornata.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Condivisione non aggiornata.");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return <main className="space-y-4 p-4 md:p-6"><Skeleton className="h-10 w-72" /><Skeleton className="h-[70dvh] rounded-2xl" /></main>;
  }

  if (!board || error) {
    return (
      <main className="grid min-h-[60dvh] place-items-center p-6 text-center">
        <div>
          <p role="alert" className="text-sm text-destructive">{error || "Flowboard non trovato."}</p>
          <Button asChild variant="outline" className="mt-4"><Link href="/dashboard/flowboard">Torna ai Flowboard</Link></Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] w-full flex-col gap-3 p-3 md:p-5">
      <header className="flex flex-wrap items-center gap-2">
        <Button asChild size="icon" variant="ghost"><Link href="/dashboard/flowboard" aria-label="Torna ai Flowboard"><ArrowLeft /></Link></Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{board.name}</h1>
          <p className="text-xs text-muted-foreground">{canEdit ? "Modifica condivisa" : "Sola lettura"}</p>
        </div>
        <Badge variant={dirty ? "secondary" : "outline"}>
          {dirty ? "Modifiche da salvare" : <><Check className="mr-1 size-3" />Salvato</>}
        </Badge>
        <Button type="button" variant="outline" onClick={() => void load()} aria-label="Ricarica Flowboard"><RefreshCw /></Button>
        {canShare ? <Button type="button" variant="outline" onClick={() => setShareOpen(true)}><Users />Condividi</Button> : null}
        {canEdit ? <Button type="button" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Save />}
          Salva
        </Button> : null}
      </header>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="min-h-[62dvh] overflow-hidden">
          <CardContent className="relative h-[62dvh] p-0 md:h-[72dvh]">
            {canEdit ? (
              <Button type="button" className="absolute left-3 top-3 z-10" size="sm" onClick={addNode}>
                <Plus />Nodo
              </Button>
            ) : null}
            <ReactFlow
              colorMode={resolvedTheme === "dark" ? "dark" : "light"}
              nodes={nodes}
              edges={edges}
              onNodesChange={(changes) => {
                onNodesChange(changes);
                if (changes.some((change) => change.type !== "select")) setDirty(true);
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
                if (changes.some((change) => change.type !== "select")) setDirty(true);
              }}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(undefined)}
              onMoveEnd={(_, nextViewport) => {
                setViewport(nextViewport);
                setDirty(true);
              }}
              defaultViewport={viewport}
              nodesDraggable={canEdit}
              nodesConnectable={canEdit}
              elementsSelectable
              fitView={!board.viewport}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls showInteractive={canEdit} />
              <MiniMap pannable zoomable nodeClassName="fill-primary/20 stroke-primary" />
            </ReactFlow>
          </CardContent>
        </Card>

        <div className="grid min-h-0 gap-3 md:grid-cols-2 xl:grid-cols-1">
          <Card>
            <CardHeader><CardTitle className="text-base">Proprietà</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {selectedNode ? (
                <>
                  <Input
                    value={String(selectedNode.data.label || "")}
                    onChange={(event) => updateSelectedNode({ label: event.target.value })}
                    disabled={!canEdit}
                    aria-label="Titolo nodo"
                  />
                  <Textarea
                    value={String(selectedNode.data.description || "")}
                    onChange={(event) => updateSelectedNode({ description: event.target.value })}
                    disabled={!canEdit}
                    placeholder="Descrizione"
                  />
                </>
              ) : <p className="text-sm text-muted-foreground">Seleziona un nodo per modificarne i dettagli.</p>}
            </CardContent>
          </Card>

          <Card className="min-h-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="size-4" />Commenti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScrollArea className="h-48 pr-3">
                <div className="space-y-2">
                  {!comments.length ? <p className="text-sm text-muted-foreground">Nessun commento.</p> : null}
                  {comments.map((item) => (
                    <div key={item.id} className="rounded-xl border bg-card p-2 text-card-foreground">
                      <p className="text-xs font-medium">{item.authorName || "Membro del team"}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {canCreateComment ? (
                <div className="space-y-2">
                  <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={selectedNodeId ? "Commenta il nodo…" : "Commenta il board…"} />
                  <Button type="button" size="sm" className="w-full" disabled={!comment.trim()} onClick={() => void sendComment()}>
                    Invia commento
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Condividi Flowboard</DialogTitle><DialogDescription>Solo membri attivi del tenant. La verifica definitiva avviene sul backend.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {teamMembers.filter((member) => member.user_id && member.user_id !== board.ownerId).map((member) => {
              const userId = String(member.user_id);
              const selected = shareDraft.find((item) => item.userId === userId);
              return <div key={member.id} className="flex items-center gap-3 rounded-xl border p-3"><Checkbox aria-label={`Condividi con ${member.display_name}`} checked={Boolean(selected)} onCheckedChange={(checked) => setShareDraft((current) => checked ? [...current.filter((item) => item.userId !== userId), { userId, permission: "view" }] : current.filter((item) => item.userId !== userId))} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.display_name}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></div>{selected ? <Select value={selected.permission} onValueChange={(permission) => setShareDraft((current) => current.map((item) => item.userId === userId ? { ...item, permission: permission as "view" | "edit" } : item))}><SelectTrigger className="w-28" aria-label={`Permesso ${member.display_name}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="view">Lettura</SelectItem><SelectItem value="edit">Modifica</SelectItem></SelectContent></Select> : null}</div>;
            })}
            {!teamMembers.some((member) => member.user_id && member.user_id !== board.ownerId) ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Nessun altro membro attivo disponibile.</p> : null}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setShareOpen(false)}>Annulla</Button><Button type="button" disabled={sharing} onClick={() => void saveSharing()}>{sharing ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Users />}Salva condivisione</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
