"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  AtSign,
  ChevronLeft,
  CheckCheck,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Pencil,
  RefreshCw,
  Reply,
  Send,
  SmilePlus,
  UsersRound,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { FlowAssetPicker, FlowEmptyState } from "@/components/flow-experience/flow-experience";
import { flowChatAssets, type FlowAsset } from "@/components/flow-experience/flow-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import {
  collaborationApi,
  type CollaborationConversation,
  type CollaborationMessage,
} from "@/lib/tenant-feature-api";

const quickReactions = ["👍", "❤️", "🎉"];
const allowedFlowMessageAssets = new Set(flowChatAssets.map((asset) => asset.src));

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function orderedMessages(items: CollaborationMessage[]) {
  return [...items].sort((left, right) => {
    return new Date(left.createdAt).valueOf() - new Date(right.createdAt).valueOf();
  });
}

function messageAssets(message: CollaborationMessage) {
  const metadata = Array.isArray(message.attachmentMetadata)
    ? message.attachmentMetadata
    : message.attachmentMetadata
      ? [message.attachmentMetadata]
      : [];
  return metadata.filter((item): item is Record<string, unknown> & { url: string } => {
    const source = typeof item.url === "string" ? item.url : typeof item.name === "string" ? item.name : "";
    if (!allowedFlowMessageAssets.has(source)) return false;
    item.url = source;
    return true;
  });
}

export function TeamSpaceCollaboration({ sidebarMode = false }: { sidebarMode?: boolean } = {}) {
  const identity = useDoflowIdentity();
  const searchParams = useSearchParams();
  const linkedChannel = searchParams.get("channel");
  const [conversations, setConversations] = React.useState<CollaborationConversation[]>([]);
  const [fallbackSelectedId, setSelectedId] = React.useState<string | undefined>(linkedChannel ?? undefined);
  const [messages, setMessages] = React.useState<CollaborationMessage[]>([]);
  const [messageCursor, setMessageCursor] = React.useState<string | null>();
  const [loadingConversations, setLoadingConversations] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<CollaborationMessage>();
  const [editingMessage, setEditingMessage] = React.useState<CollaborationMessage>();
  const [mentionIds, setMentionIds] = React.useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = React.useState<FlowAsset>();
  const [showMentions, setShowMentions] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newParticipants, setNewParticipants] = React.useState<string[]>([]);

  const selectedId = linkedChannel && conversations.some((item) => item.id === linkedChannel)
    ? linkedChannel
    : fallbackSelectedId;
  const selected = conversations.find((item) => item.id === selectedId);

  const selectConversation = React.useCallback((conversationId?: string) => {
    setSelectedId(conversationId);
    if (!conversationId) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("tab");
    params.set("channel", conversationId);
    window.history.replaceState(null, "", window.location.pathname + "?" + params.toString());
  }, []);

  const loadConversations = React.useCallback(async () => {
    setLoadingConversations(true);
    setError("");
    try {
      const page = await collaborationApi.conversations({ limit: 50 });
      setConversations((current) => {
        const previousById = new Map(current.map((item) => [item.id, item]));
        return page.items.map((item) => {
          const previous = previousById.get(item.id);
          if (!previous) return item;
          return {
            ...previous,
            ...item,
            participants: item.participants?.length ? item.participants : previous.participants,
            lastMessage: item.lastMessage ?? previous.lastMessage ?? null,
          };
        });
      });
      setSelectedId((current) => current && page.items.some((item) => item.id === current)
        ? current
        : page.items[0]?.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Conversazioni non disponibili.");
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = React.useCallback(async (conversationId: string, cursor?: string) => {
    setLoadingMessages(true);
    setError("");
    try {
      const page = await collaborationApi.messages(conversationId, { cursor, limit: 50 });
      setMessages((current) => orderedMessages(cursor ? [...page.items, ...current] : page.items));
      setMessageCursor(page.nextCursor);
      const latest = orderedMessages(page.items).at(-1);
      if (!cursor && latest && latest.authorId !== identity.currentUserId) {
        void collaborationApi.read(conversationId, latest.id).catch(() => undefined);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Messaggi non disponibili.");
    } finally {
      setLoadingMessages(false);
    }
  }, [identity.currentUserId]);

  const loadConversation = React.useCallback(async (conversationId: string) => {
    try {
      const detail = await collaborationApi.conversation(conversationId);
      setConversations((current) => current.map((item) => (
        item.id === conversationId ? { ...item, ...detail } : item
      )));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dettaglio conversazione non disponibile.");
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConversations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedId) {
        setMessages([]);
        return;
      }
      void Promise.all([
        loadConversation(selectedId),
        loadMessages(selectedId),
      ]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConversation, loadMessages, selectedId]);

  const submitMessage = async () => {
    if (!selectedId || (!draft.trim() && !selectedAsset) || sending) return;
    setSending(true);
    try {
      if (editingMessage) {
        const item = await collaborationApi.updateMessage(selectedId, editingMessage.id, { body: draft.trim() });
        setMessages((current) => orderedMessages(current.map((message) => message.id === item.id ? item : message)));
      } else {
        const item = await collaborationApi.sendMessage(selectedId, {
          body: draft.trim() || selectedAsset?.alt || "Sticker",
          parentMessageId: replyTo?.id,
          mentionUserIds: mentionIds,
          attachmentMetadata: selectedAsset ? [{
            kind: selectedAsset.kind,
            url: selectedAsset.src,
            alt: selectedAsset.alt,
            name: selectedAsset.src,
            mimeType: "image/webp",
            size: 0,
          }] : undefined,
        });
        setMessages((current) => orderedMessages([...current, item]));
      }
      setDraft("");
      setReplyTo(undefined);
      setEditingMessage(undefined);
      setMentionIds([]);
      setSelectedAsset(undefined);
      setShowMentions(false);
      await loadConversations();
      await loadConversation(selectedId);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Invio non riuscito.");
    } finally {
      setSending(false);
    }
  };

  const createConversation = async () => {
    if (!newTitle.trim() || !newParticipants.length) return;
    try {
      const item = await collaborationApi.createConversation({
        title: newTitle.trim(),
        kind: newParticipants.length === 1 ? "direct" : "group",
        participantIds: newParticipants,
      });
      setConversations((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
      selectConversation(item.id);
      setNewTitle("");
      setNewParticipants([]);
      setShowCreate(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Creazione non riuscita.");
    }
  };

  const toggleReaction = async (message: CollaborationMessage, emoji: string) => {
    if (!selectedId) return;
    const existing = message.reactions?.find((item) => item.emoji === emoji);
    const reactedByMe = existing?.reactedByMe || existing?.userIds?.includes(identity.currentUserId);
    try {
      await collaborationApi.react(selectedId, message.id, emoji, !reactedByMe);
      await loadMessages(selectedId);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Reazione non aggiornata.");
    }
  };

  const beginEdit = (message: CollaborationMessage) => {
    setEditingMessage(message);
    setReplyTo(undefined);
    setSelectedAsset(undefined);
    setDraft(message.body);
  };

  const deleteMessage = async (message: CollaborationMessage) => {
    if (!selectedId || !window.confirm("Rimuovere questo messaggio? La cronologia di audit sarà preservata.")) return;
    try {
      await collaborationApi.deleteMessage(selectedId, message.id);
      await loadMessages(selectedId);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Messaggio non rimosso.");
    }
  };

  return (
    <Card className={"overflow-hidden " + (sidebarMode ? "h-[calc(100dvh-5rem)] min-h-[35rem] rounded-xl" : "")}>
      <CardContent className={"grid h-full min-h-[36rem] p-0 " + (sidebarMode ? "grid-cols-1" : "lg:grid-cols-[18rem_minmax(0,1fr)]")}>
        <aside className={(sidebarMode ? "hidden" : "border-r " + (selectedId ? "hidden lg:flex" : "flex")) + " flex-col"}>
          <div className="flex items-center justify-between gap-2 p-3">
            <div>
              <p className="font-semibold">Conversazioni</p>
              <p className="text-xs text-muted-foreground">Messaggi tenant protetti</p>
            </div>
            <div className="flex gap-1">
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => void loadConversations()} aria-label="Aggiorna conversazioni">
                <RefreshCw className="size-4" />
              </Button>
              <Button type="button" size="icon-sm" onClick={() => setShowCreate((value) => !value)} aria-label="Nuova conversazione">
                <MessageSquarePlus className="size-4" />
              </Button>
            </div>
          </div>
          {showCreate ? (
            <div className="space-y-3 border-y bg-muted/30 p-3">
              <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Titolo conversazione" />
              <div className="max-h-36 space-y-2 overflow-y-auto">
                {identity.users.filter((user) => user.id !== identity.currentUserId).map((user) => (
                  <label key={user.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={newParticipants.includes(user.id)}
                      onCheckedChange={(checked) => setNewParticipants((current) => checked
                        ? [...current, user.id]
                        : current.filter((id) => id !== user.id))}
                    />
                    <span className="truncate">{user.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Annulla</Button>
                <Button type="button" size="sm" disabled={!newTitle.trim() || !newParticipants.length} onClick={() => void createConversation()}>
                  Crea
                </Button>
              </div>
            </div>
          ) : null}
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 p-2">
              {loadingConversations ? Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              )) : null}
              {!loadingConversations && !conversations.length ? (
                <FlowEmptyState
                  assetId="empty-chat"
                  title="Nessuna conversazione"
                  description="Crea una chat con un membro autorizzato."
                />
              ) : null}
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className={"flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    + (selectedId === conversation.id ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <UsersRound className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{conversation.title}</span>
                      {conversation.unreadCount ? <Badge className="ml-auto">{conversation.unreadCount}</Badge> : null}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {conversation.lastMessage?.body || "Nessun messaggio"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <section className={"min-w-0 " + (!selectedId && !sidebarMode ? "hidden lg:flex" : "flex") + " flex-col"}>
          {!selected ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-muted-foreground">
              <div>
                <MessageCircle className="mx-auto mb-3 size-10" />
                <p className="text-sm">Seleziona una conversazione.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex min-h-16 items-center gap-2 border-b px-3 sm:px-4">
                <Button type="button" size="icon-sm" variant="ghost" className={sidebarMode ? "hidden" : "lg:hidden"} onClick={() => setSelectedId(undefined)} aria-label="Torna alle conversazioni">
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{selected.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {(selected.participants || []).length} partecipanti
                  </p>
                </div>
              </header>
              {error ? <p role="alert" className="m-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-3 p-3 sm:p-4">
                  {messageCursor ? (
                    <div className="text-center">
                      <Button type="button" size="sm" variant="outline" disabled={loadingMessages} onClick={() => void loadMessages(selected.id, messageCursor)}>
                        Carica messaggi precedenti
                      </Button>
                    </div>
                  ) : null}
                  {loadingMessages && !messages.length ? Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className={"h-20 w-4/5 rounded-xl " + (index % 2 ? "ml-auto" : "")} />
                  )) : null}
                  {messages.map((message) => {
                    const mine = message.authorId === identity.currentUserId;
                    const parent = message.parentMessageId
                      ? messages.find((item) => item.id === message.parentMessageId)
                      : undefined;
                    const readCount = (message.receipts || []).filter((receipt) => {
                      return receipt.userId !== identity.currentUserId && Boolean(receipt.readAt);
                    }).length;
                    return (
                      <article key={message.id} className={"group flex " + (mine ? "justify-end" : "justify-start")}>
                        <div className={"max-w-[88%] rounded-2xl border px-3 py-2 sm:max-w-[72%] "
                          + (mine ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground")}>
                          <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                            <span className="font-medium">{mine ? "Tu" : message.authorName || identity.users.find((user) => user.id === message.authorId)?.name || "Membro del team"}</span>
                            <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                            {message.editedAt ? <span>modificato</span> : null}
                          </div>
                          {parent ? (
                            <div className="mb-2 rounded-lg border border-current/20 px-2 py-1 text-xs opacity-80">
                              <Reply className="mr-1 inline size-3" />
                              {parent.body}
                            </div>
                          ) : null}
                          <p className={"whitespace-pre-wrap break-words text-sm " + (message.deletedAt ? "italic opacity-70" : "")}>
                            {message.deletedAt ? "Messaggio rimosso" : message.body}
                          </p>
                          {!message.deletedAt && messageAssets(message).length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {messageAssets(message).map((asset, index) => (
                                <Image
                                  key={String(asset.url) + index}
                                  src={asset.url}
                                  alt={typeof asset.alt === "string" ? asset.alt : "Asset Flow"}
                                  width={160}
                                  height={160}
                                  className="max-h-36 w-auto rounded-xl object-contain"
                                />
                              ))}
                            </div>
                          ) : null}
                          {message.mentionUserIds?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {message.mentionUserIds.map((id) => (
                                <Badge key={id} variant="secondary">
                                  @{identity.users.find((user) => user.id === id)?.name || "utente"}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {(message.reactions || []).map((reaction) => (
                              <button
                                type="button"
                                key={reaction.emoji}
                                className={"rounded-full border px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                                  + (reaction.reactedByMe ? "bg-accent text-accent-foreground" : "")}
                                onClick={() => void toggleReaction(message, reaction.emoji)}
                                aria-label={"Reazione " + reaction.emoji + ", " + reaction.count}
                              >
                                {reaction.emoji} {reaction.count}
                              </button>
                            ))}
                            <Button type="button" size="icon-sm" variant="ghost" onClick={() => { setReplyTo(message); setEditingMessage(undefined); setDraft(""); }} aria-label="Rispondi">
                              <Reply className="size-3.5" />
                            </Button>
                            {mine && !message.deletedAt ? (
                              <>
                                <Button type="button" size="icon-sm" variant="ghost" onClick={() => beginEdit(message)} aria-label="Modifica messaggio">
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button type="button" size="icon-sm" variant="ghost" onClick={() => void deleteMessage(message)} aria-label="Rimuovi messaggio">
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </>
                            ) : null}
                            {quickReactions.map((emoji) => (
                              <button
                                type="button"
                                key={emoji}
                                className="hidden rounded-full px-1 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:inline-flex group-focus-within:inline-flex"
                                onClick={() => void toggleReaction(message, emoji)}
                                aria-label={"Aggiungi " + emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          {mine && readCount > 0 ? (
                            <p className="mt-1 flex items-center justify-end gap-1 text-[11px] opacity-75">
                              <CheckCheck className="size-3.5" />
                              Letto da {readCount}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </ScrollArea>
              <Separator />
              <div className="space-y-2 p-3">
                {editingMessage ? (
                  <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs">
                    <Pencil className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate">Modifica messaggio</span>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => { setEditingMessage(undefined); setDraft(""); }} aria-label="Annulla modifica">
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
                {replyTo ? (
                  <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs">
                    <Reply className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate">Risposta a: {replyTo.body}</span>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => setReplyTo(undefined)} aria-label="Annulla risposta">
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
                {showMentions ? (
                  <div data-mention-picker="conversation-participants" className="flex flex-wrap gap-2 rounded-xl border bg-popover p-2 text-popover-foreground">
                    {identity.users.filter((user) => (
                      user.id !== identity.currentUserId
                      && (selected.participants || []).some((participant) => participant.userId === user.id)
                    )).map((user) => (
                      <label key={user.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:bg-accent">
                        <Checkbox
                          checked={mentionIds.includes(user.id)}
                          onCheckedChange={(checked) => setMentionIds((current) => checked
                            ? [...current, user.id]
                            : current.filter((id) => id !== user.id))}
                        />
                        {user.name}
                      </label>
                    ))}
                  </div>
                ) : null}
                {selectedAsset ? (
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-2 text-sm">
                    <Image src={selectedAsset.src} alt={selectedAsset.alt} width={40} height={40} className="size-10 object-contain" />
                    <span className="min-w-0 flex-1 truncate">{selectedAsset.alt}</span>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => setSelectedAsset(undefined)} aria-label="Rimuovi asset">
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                  {!editingMessage ? <FlowAssetPicker onSelect={setSelectedAsset} /> : null}
                  {!editingMessage ? (
                    <Button type="button" size="icon" variant="outline" onClick={() => setShowMentions((value) => !value)} aria-label="Menziona membri">
                      <AtSign className="size-4" />
                    </Button>
                  ) : null}
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void submitMessage();
                      }
                    }}
                    placeholder={editingMessage ? "Modifica il messaggio…" : "Scrivi un messaggio…"}
                    className="min-h-11 resize-none"
                  />
                  <Button type="button" size="icon" disabled={sending || (!draft.trim() && !selectedAsset)} onClick={() => void submitMessage()} aria-label="Invia messaggio">
                    {sending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Send className="size-4" />}
                  </Button>
                </div>
                {mentionIds.length ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <SmilePlus className="size-3.5" />
                    {mentionIds.length} menzioni selezionate
                  </p>
                ) : null}
              </div>
            </>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
