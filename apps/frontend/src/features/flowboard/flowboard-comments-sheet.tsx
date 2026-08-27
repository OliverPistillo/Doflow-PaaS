"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CornerDownRight,
  Link2,
  MessageCircle,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { FlowboardComment } from "@/features/flowboard/flowboard-types";
import { useFlowboards } from "@/features/flowboard/flowboard-provider";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

type Target = { type: FlowboardComment["targetType"]; id?: string };

export function FlowboardCommentsSheet({
  boardId,
  open,
  onOpenChange,
  target,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Target;
}) {
  const flowboards = useFlowboards();
  const identity = useDoflowIdentity();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deepLinkedId = searchParams.get("comment");
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [editingText, setEditingText] = useState("");
  const sendLock = useRef<string | undefined>(undefined);

  const boardComments = useMemo(
    () => flowboards.comments.filter((item) => item.boardId === boardId),
    [boardId, flowboards.comments],
  );
  const deepLinked = boardComments.find((item) => item.id === deepLinkedId);
  const effectiveTarget = deepLinked
    ? { type: deepLinked.targetType, id: deepLinked.targetId }
    : target;
  const roots = boardComments
    .filter(
      (item) =>
        !item.parentId &&
        (!effectiveTarget.id ||
          (item.targetType === effectiveTarget.type &&
            item.targetId === effectiveTarget.id)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const replies = (rootId: string) =>
    boardComments
      .filter((item) => item.parentId === rootId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const board = flowboards.boards.find((item) => item.id === boardId);
  const canResolve = Boolean(
    board &&
      (identity.currentUser.roles.includes("administrator") ||
        board.ownerId === identity.currentUserId ||
        board.collaborators.some(
          (item) =>
            item.userId === identity.currentUserId &&
            item.permission === "edit",
        )),
  );

  useEffect(() => {
    if (!open || !deepLinkedId) return;
    const timer = window.setTimeout(
      () =>
        document
          .getElementById(`flowboard-comment-${deepLinkedId}`)
          ?.scrollIntoView({ block: "center" }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [deepLinkedId, open, boardComments.length]);

  const authorName = (comment: FlowboardComment) =>
    identity.users.find((user) => user.id === comment.authorId)?.name ??
    "Utente";
  const canChange = (comment: FlowboardComment) =>
    !comment.deletedAt &&
    (comment.authorId === identity.currentUserId ||
      identity.currentUser.roles.includes("administrator"));
  const setDeepLink = (commentId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("comment", commentId);
    router.replace(`${pathname}?${params.toString()}`);
    toast.success("Link al commento pronto");
  };
  const submit = async () => {
    const value = text.trim();
    if (!value || sendLock.current) return;
    const clientId = crypto.randomUUID();
    sendLock.current = clientId;
    const result = await flowboards.addComment({
      boardId,
      targetType: effectiveTarget.type,
      targetId: effectiveTarget.id,
      text: value,
      parentId: replyingTo,
      clientId,
    });
    if (result.ok) {
      setText("");
      setReplyingTo(undefined);
    }
    sendLock.current = undefined;
  };
  const saveEdit = async (commentId: string) => {
    const value = editingText.trim();
    if (!value || sendLock.current) return;
    const clientId = crypto.randomUUID();
    sendLock.current = clientId;
    const result = await flowboards.editComment(commentId, value, clientId);
    if (result.ok) {
      setEditingId(undefined);
      setEditingText("");
    }
    sendLock.current = undefined;
  };
  const remove = async (commentId: string) => {
    if (
      !window.confirm(
        "Eliminare questo commento? Resterà nello storico come eliminato.",
      )
    )
      return;
    await flowboards.deleteComment(commentId);
  };

  const renderComment = (comment: FlowboardComment, nested = false) => {
    const replyCount = nested ? 0 : replies(comment.id).length;
    return (
      <article
        key={comment.id}
        id={`flowboard-comment-${comment.id}`}
        className={`rounded-lg border p-3 text-sm ${nested ? "ml-5 border-l-2 bg-muted/30" : ""} ${deepLinkedId === comment.id ? "ring-2 ring-primary/50" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{authorName(comment)}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Intl.DateTimeFormat("it-IT", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(comment.createdAt))}
              {comment.updatedAt ? " · modificato" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!nested && (
              <Badge variant={comment.resolvedAt ? "secondary" : "outline"}>
                {comment.resolvedAt
                  ? "Risolto"
                  : `${replyCount} ${replyCount === 1 ? "risposta" : "risposte"}`}
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Copia deep-link"
              onClick={() => setDeepLink(comment.id)}
            >
              <Link2 className="size-3.5" />
            </Button>
          </div>
        </div>
        {editingId === comment.id ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editingText}
              onChange={(event) => setEditingText(event.target.value)}
              aria-label="Modifica commento"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void saveEdit(comment.id)}>
                Salva
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingId(undefined)}
              >
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={`mt-2 whitespace-pre-wrap ${comment.deletedAt ? "italic text-muted-foreground" : ""}`}
          >
            {comment.text}
          </p>
        )}
        {!!comment.mentionUserIds.length && !comment.deletedAt && (
          <div className="mt-2 flex flex-wrap gap-1">
            {comment.mentionUserIds.map((id) => (
              <Badge key={id} variant="secondary" className="text-[10px]">
                @
                {identity.users.find((user) => user.id === id)?.name ??
                  "utente"}
              </Badge>
            ))}
          </div>
        )}
        {!comment.deletedAt && (
          <div className="mt-2 flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setReplyingTo(comment.parentId ?? comment.id);
                setText("");
              }}
            >
              <CornerDownRight className="size-3.5" />
              Rispondi
            </Button>
            {canChange(comment) && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditingText(comment.text);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void remove(comment.id)}
                >
                  <Trash2 className="size-3.5" />
                  Elimina
                </Button>
              </>
            )}
            {!nested && canResolve && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void flowboards.resolveComment(
                    comment.id,
                    !comment.resolvedAt,
                  )
                }
              >
                {comment.resolvedAt ? (
                  <RotateCcw className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {comment.resolvedAt ? "Riapri" : "Risolvi"}
              </Button>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Commenti Flowboard</SheetTitle>
          <SheetDescription>
            Thread condivisi sul backend. Le risposte sono mostrate su un
            solo livello.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4">
          <div className="space-y-3 py-3 pr-2">
            {roots.length ? (
              roots.map((root) => (
                <div key={root.id} className="space-y-2">
                  {renderComment(root)}
                  {replies(root.id).map((reply) => renderComment(reply, true))}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nessun commento in questo thread.
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="shrink-0 space-y-2 border-t p-4">
          {replyingTo && (
            <div className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs">
              <span>
                Risposta a{" "}
                {authorName(
                  boardComments.find((item) => item.id === replyingTo)!,
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReplyingTo(undefined)}
              >
                Annulla
              </Button>
            </div>
          )}
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              replyingTo ? "Scrivi una risposta…" : "Scrivi un commento…"
            }
          />
          <Button
            className="w-full"
            disabled={!text.trim()}
            onClick={() => void submit()}
          >
            <MessageCircle />
            {replyingTo ? "Invia risposta" : "Commenta"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
