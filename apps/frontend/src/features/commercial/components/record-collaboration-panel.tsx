"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AtSign,
  Check,
  CornerDownRight,
  History,
  MessageCircle,
  Paperclip,
  Pencil,
  RotateCcw,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  CollaborationRecordType,
  CommercialComment,
  CommentAttachment,
} from "@/features/commercial/commercial-collaboration";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import { DocumentStatusBadge } from "@/features/commercial/document-status";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { formatItalianDateTime } from "@/lib/date";
import { archiveDocument, uploadDocument } from "@/lib/tenant-documents-api";
import { collaborationApi } from "@/lib/tenant-collaboration-api";

type Props = {
  recordType: CollaborationRecordType;
  recordId: string;
  label: string;
  compact?: boolean;
};

export function RecordCollaborationPanel({
  recordType,
  recordId,
  label,
  compact,
}: Props) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const searchParams = useSearchParams();
  const deepLinkOpen =
    searchParams.get("collaboration") === `${recordType}:${recordId}`;
  const deepLinkCommentId = deepLinkOpen ? searchParams.get("commentId") : null;
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<CommentAttachment[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [filter, setFilter] = useState<
    "all" | "record" | "attachments" | "resolved"
  >("record");
  const inputRef = useRef<HTMLInputElement>(null);
  const submitBusyRef = useRef(false);
  const loadCommentsRef = useRef(store.loadComments);
  const comments = useMemo(
    () =>
      store.comments.filter(
        (comment) =>
          comment.recordType === recordType && comment.recordId === recordId,
      ),
    [recordId, recordType, store.comments],
  );
  const history = useMemo(
    () =>
      store.auditEvents
        .filter(
          (event) =>
            event.recordType === recordType && event.recordId === recordId,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [recordId, recordType, store.auditEvents],
  );
  const allowedUserIds = useMemo(() => {
    const ids = new Set([identity.currentUserId]);
    identity.users
      .filter((user) => user.roles.includes("administrator"))
      .forEach((user) => ids.add(user.id));
    const lead = store.leads.find((item) => item.id === recordId);
    if (lead) ids.add(lead.assigneeId);
    const customer = store.customers.find((item) => item.id === recordId);
    if (customer) ids.add(customer.profile.assigneeId);
    const activity = [
      ...store.leadActivities,
      ...store.customers.flatMap((item) => [
        ...(item.activities ?? []),
        ...(item.onboardingActivity ? [item.onboardingActivity] : []),
      ]),
    ].find((item) => item.id === recordId);
    if (activity) {
      ids.add(activity.assigneeId);
      activity.collaboratorIds.forEach((id) => ids.add(id));
    }
    const project = store.projects.find(
      (item) => item.id === recordId || item.id === activity?.projectId,
    );
    if (project)
      [
        project.ownerId,
        ...project.memberIds,
        ...(project.supervisorIds ?? []),
      ].forEach((id) => ids.add(id));
    return ids;
  }, [
    identity.currentUserId,
    identity.users,
    recordId,
    store.customers,
    store.leadActivities,
    store.leads,
    store.projects,
  ]);
  const mentionUsers = identity.users.filter((user) =>
    allowedUserIds.has(user.id),
  );
  useEffect(() => {
    loadCommentsRef.current = store.loadComments;
  }, [store.loadComments]);
  useEffect(() => {
    void loadCommentsRef.current(recordType, recordId).catch(() => undefined);
  }, [recordId, recordType]);
  useEffect(() => {
    if (!deepLinkCommentId) return;
    const frame = window.requestAnimationFrame(() =>
      document
        .getElementById(`comment-${deepLinkCommentId}`)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [deepLinkCommentId]);
  const attach = async (file?: File) => {
    if (!file) return;
    if (file.size > 5_000_000) {
      toast.error("L’allegato non può superare 5 MB");
      return;
    }
    setAttachmentBusy(true);
    try {
      const entityType = (
        {
          lead: "opportunity",
          customer: "company",
          activity: "task",
          project: "project",
          quote: "quote",
          contract: "contract",
          order: "order",
          payment: "payment",
          invoice: "invoice",
          renewal: "renewal",
          document: "document",
          builder: "site_proposal",
        } as Record<string, string>
      )[recordType];
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      form.append("category", "generic");
      form.append("visibility", "internal");
      form.append("relation_type", "attachment");
      form.append(
        "metadata",
        JSON.stringify({ collaborationPending: true, recordType, recordId }),
      );
      if (entityType) {
        form.append("entity_type", entityType);
        form.append("entity_id", recordId);
      }
      const document = await uploadDocument(form);
      setAttachments((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          name: document.original_filename,
          mimeType: document.mime_type || "application/octet-stream",
          size: Number(document.size_bytes || file.size),
          reference: `document:${document.id}`,
        },
      ]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Allegato non caricato",
      );
    } finally {
      setAttachmentBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const removeAttachment = (attachment: CommentAttachment) => {
    setAttachments((items) =>
      items.filter((item) => item.id !== attachment.id),
    );
    const documentId = attachment.reference?.startsWith("document:")
      ? attachment.reference.slice("document:".length)
      : "";
    if (documentId) void archiveDocument(documentId).catch(() => undefined);
  };
  const resetComposer = () => {
    setText("");
    setMentions([]);
    setAttachments([]);
    setReplyTo(undefined);
    setEditingId(undefined);
  };
  const submit = async () => {
    if (submitBusyRef.current) return;
    submitBusyRef.current = true;
    setSubmitBusy(true);
    try {
      if (editingId) {
        if (await store.updateComment(editingId, text, mentions)) {
          toast.success("Commento aggiornato");
          resetComposer();
        }
        return;
      }
      const id = await store.addComment({
        recordType,
        recordId,
        text,
        parentCommentId: replyTo,
        mentionUserIds: mentions,
        attachments,
      });
      if (!id) return toast.error("Commento non salvato");
      toast.success(replyTo ? "Risposta pubblicata" : "Commento pubblicato");
      resetComposer();
    } finally {
      submitBusyRef.current = false;
      setSubmitBusy(false);
    }
  };
  const visible = comments.filter((comment) =>
    filter === "resolved"
      ? Boolean(comment.resolvedAt)
      : filter === "attachments"
        ? comment.attachments.length > 0
        : true,
  );
  return (
    <Sheet defaultOpen={deepLinkOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Apri collaborazione per ${label}`}
        >
          <MessageCircle />
          {compact
            ? comments.filter((item) => !item.deletedAt).length
            : `Commenti ${comments.filter((item) => !item.deletedAt).length || ""}`}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>Attività e collaborazione</SheetTitle>
          <SheetDescription className="truncate">{label}</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="comments" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-5 mt-3 grid grid-cols-2">
            <TabsTrigger value="comments">
              <MessageCircle />
              Commenti
            </TabsTrigger>
            <TabsTrigger value="history">
              <History />
              Revisioni
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="comments"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex gap-1 overflow-x-auto px-5 py-2">
              {(
                [
                  ["record", "Commenti del record"],
                  ["all", "Tutti"],
                  ["attachments", "Con allegati"],
                  ["resolved", "Risolti"],
                ] as const
              ).map(([id, title]) => (
                <Button
                  key={id}
                  size="sm"
                  variant={filter === id ? "secondary" : "ghost"}
                  onClick={() => setFilter(id)}
                >
                  {title}
                </Button>
              ))}
            </div>
            <ScrollArea className="min-h-0 flex-1 px-5">
              <div className="space-y-3 py-2">
                {visible
                  .filter((item) => !item.parentCommentId)
                  .map((comment) => (
                    <CommentThread
                      key={comment.id}
                      comment={comment}
                      replies={visible.filter(
                        (item) => item.parentCommentId === comment.id,
                      )}
                      highlightedId={deepLinkCommentId ?? undefined}
                      onReply={(id) => {
                        setReplyTo(id);
                        setEditingId(undefined);
                        setText("");
                      }}
                      onEdit={(item) => {
                        setEditingId(item.id);
                        setReplyTo(undefined);
                        setText(item.text);
                        setMentions(item.mentionUserIds);
                      }}
                    />
                  ))}
                {!visible.length && (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nessun commento per questo filtro.
                  </p>
                )}
              </div>
            </ScrollArea>
            <div className="shrink-0 border-t bg-background p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {editingId
                    ? "Modifica commento"
                    : replyTo
                      ? "Risposta al commento"
                      : "Nuovo commento"}
                </span>
                {(editingId || replyTo) && (
                  <Button size="xs" variant="ghost" onClick={resetComposer}>
                    <X />
                    Annulla
                  </Button>
                )}
              </div>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Scrivi un commento o menziona un collega…"
                className="min-h-20"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      <AtSign />
                      Menziona{mentions.length ? ` ${mentions.length}` : ""}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 space-y-2">
                    <p className="text-sm font-medium">
                      Collaboratori autorizzati
                    </p>
                    {mentionUsers.map((user) => (
                      <Label
                        key={user.id}
                        className="flex items-center gap-2 rounded p-1.5 hover:bg-muted"
                      >
                        <Checkbox
                          checked={mentions.includes(user.id)}
                          onCheckedChange={(checked) =>
                            setMentions((items) =>
                              checked
                                ? [...items, user.id]
                                : items.filter((id) => id !== user.id),
                            )
                          }
                        />
                        {user.name}
                      </Label>
                    ))}
                  </PopoverContent>
                </Popover>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => void attach(event.target.files?.[0])}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={attachmentBusy}
                  onClick={() => inputRef.current?.click()}
                >
                  <Paperclip />
                  {attachmentBusy ? "Caricamento…" : "Allegato"}
                </Button>
                <div className="min-w-0 flex-1" />{" "}
                <Button
                  size="sm"
                  disabled={!text.trim() || attachmentBusy || submitBusy}
                  onClick={() => void submit()}
                >
                  <Send />
                  {submitBusy ? "Salvataggio…" : editingId ? "Salva" : "Pubblica"}
                </Button>
              </div>
              {attachments.map((attachment) => (
                <Badge
                  key={attachment.id}
                  variant="secondary"
                  className="mt-2 mr-1"
                >
                  <Paperclip />
                  {attachment.name}
                  <button
                    aria-label={`Rimuovi ${attachment.name}`}
                    onClick={() => removeAttachment(attachment)}
                  >
                    <X />
                  </button>
                </Badge>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="history" className="min-h-0 flex-1">
            <ScrollArea className="h-full px-5">
              <div className="space-y-3 py-4">
                {history.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3">
                    <div className="flex gap-3">
                      <Avatar>
                        <AvatarImage src={event.authorAvatarUrl} />
                        <AvatarFallback>
                          {event.authorName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium">
                          {event.recordType === "document" &&
                          event.field === "status" ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <span>Stato:</span>
                              <DocumentStatusBadge
                                status={event.previousValue ?? "—"}
                              />
                              <span aria-hidden>→</span>
                              <DocumentStatusBadge
                                status={event.nextValue ?? "—"}
                              />
                            </span>
                          ) : event.field ? (
                            `${event.field}: ${event.previousValue ?? "—"} → ${event.nextValue ?? "—"}`
                          ) : (
                            event.action
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {event.authorName} ·{" "}
                          {formatItalianDateTime(event.createdAt)} ·{" "}
                          {event.origin}
                        </p>
                        {event.reason && (
                          <p className="mt-1 text-sm">Motivo: {event.reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!history.length && (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nessuna revisione strutturata registrata.
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function CommentThread({
  comment,
  replies,
  highlightedId,
  onReply,
  onEdit,
}: {
  comment: CommercialComment;
  replies: CommercialComment[];
  highlightedId?: string;
  onReply: (id: string) => void;
  onEdit: (comment: CommercialComment) => void;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const openAttachment = async (attachmentId: string) => {
    try {
      const access = await collaborationApi.attachmentAccess(attachmentId);
      window.location.assign(access.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Allegato non disponibile");
    }
  };
  const render = (item: CommercialComment, nested = false) => (
    <div
      id={`comment-${item.id}`}
      key={item.id}
      className={`${nested ? "ml-7 border-l pl-3" : "rounded-lg border p-3"} ${item.id === highlightedId ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
    >
      <div className="flex items-start gap-2">
        <Avatar size="sm">
          <AvatarImage
            src={
              identity.users.find((user) => user.id === item.authorId)
                ?.avatarUrl
            }
          />
          <AvatarFallback>
            {identity.users
              .find((user) => user.id === item.authorId)
              ?.name.slice(0, 2)
              .toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <b className="text-sm">
              {identity.users.find((user) => user.id === item.authorId)?.name ??
                "Utente"}
            </b>
            {item.resolvedAt && (
              <Badge variant="secondary">
                <Check />
                Risolto
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatItalianDateTime(item.createdAt)}
            </span>
          </div>
          {item.deletedAt ? (
            <p className="text-sm italic text-muted-foreground">
              Commento eliminato
            </p>
          ) : (
            <>
              <p className="mt-1 whitespace-pre-wrap text-sm">{item.text}</p>
              {item.attachments.map((attachment) => {
                return attachment.id ? (
                  <Badge
                    key={attachment.id}
                    variant="outline"
                    className="mt-2 mr-1"
                  >
                    <button type="button" onClick={() => void openAttachment(attachment.id)}>
                      <Paperclip />
                      {attachment.name}
                    </button>
                  </Badge>
                ) : (
                  <Badge
                    key={attachment.id}
                    variant="outline"
                    className="mt-2 mr-1"
                  >
                    <Paperclip />
                    {attachment.name}
                  </Badge>
                );
              })}
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onReply(item.id)}
                >
                  <CornerDownRight />
                  Rispondi
                </Button>
                {item.authorId === identity.currentUserId ||
                identity.currentUser.roles.includes("administrator") ? (
                  <>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => onEdit(item)}
                    >
                      <Pencil />
                      Modifica
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => void store.deleteComment(item.id)}
                    >
                      <Trash2 />
                      Elimina
                    </Button>
                  </>
                ) : null}
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => void store.resolveComment(item.id, !item.resolvedAt)}
                >
                  {item.resolvedAt ? <RotateCcw /> : <Check />}
                  {item.resolvedAt ? "Riapri" : "Risolvi"}
                </Button>
                {["👍", "❤️", "🎉"].map((emoji) => (
                  <Button
                    key={emoji}
                    size="xs"
                    variant={
                      item.reactions.some(
                        (reaction) =>
                          reaction.emoji === emoji &&
                          reaction.userIds.includes(identity.currentUserId),
                      )
                        ? "secondary"
                        : "ghost"
                    }
                    onClick={() => void store.toggleCommentReaction(item.id, emoji)}
                  >
                    <Smile className="sr-only" />
                    {emoji}
                    {item.reactions.find((reaction) => reaction.emoji === emoji)
                      ?.userIds.length || ""}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      {render(comment)}
      {replies.map((reply) => render(reply, true))}
    </div>
  );
}
