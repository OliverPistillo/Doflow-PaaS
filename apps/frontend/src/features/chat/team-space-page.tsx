"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  CameraOff,
  Cast,
  Hash,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PanelRight,
  PhoneOff,
  Search,
  Send,
  Signal,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TeamSpaceConversationActions } from "@/features/chat/team-space-call-ui";
import {
  EmojiTool,
  MediaTools,
  MessageMedia,
  MessageReactions,
  MessageText,
} from "@/features/chat/chat-rich-content";
import type { ChatConversation, ChatMessage } from "@/features/chat/team-chat";
import {
  TEAM_CHAT_ID,
  chatConversationTitle,
  chatReceiptStatus,
} from "@/features/chat/team-chat";
import { useTeamChat } from "@/features/chat/team-chat-provider";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider";
import { PresenceIndicator } from "@/features/identity/presence-indicator";
import { roleLabels } from "@/features/identity/permissions";
import type { LocalVideoTrack } from "livekit-client";

const clock = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "";
function compactCallEvents(messages: ChatMessage[], preserveId?: string) {
  const callEvent = (message?: ChatMessage) =>
    Boolean(message && /^(video)?chiamata\b/i.test(message.text));
  return messages.filter(
    (message, index) =>
      message.id === preserveId ||
      !callEvent(message) ||
      !callEvent(messages[index + 1]),
  );
}

function ChannelButton({
  conversation,
  selected,
  onSelect,
}: {
  conversation: ChatConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  const chat = useTeamChat();
  const call = chat.calls.find(
    (item) =>
      item.conversationId === conversation.id &&
      !["ended", "failed"].includes(item.status),
  );
  return (
    <button
      type="button"
      data-active={selected}
      onClick={onSelect}
      className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <Hash className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {chatConversationTitle(conversation)}
      </span>
      {chat.unreadFor(conversation.id) > 0 ? (
        <Badge className="h-5 min-w-5 px-1.5 text-[10px]">
          {chat.unreadFor(conversation.id)}
        </Badge>
      ) : call ? (
        <span
          className="size-2 rounded-full bg-emerald-500"
          aria-label="Chiamata attiva"
        />
      ) : null}
    </button>
  );
}

function Channels({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const chat = useTeamChat();
  const identity = useDoflowIdentity();
  const presence = useDoflowPresence();
  const channels = chat.conversations.filter(
    (item) =>
      !item.archivedAt &&
      item.participantIds.includes(identity.currentUserId),
  );
  return (
    <div data-team-space-channels className="flex h-full min-h-0 flex-col bg-muted/25">
      <div className="shrink-0 border-b p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Users className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">DoFlow</p>
            <p className="truncate text-xs text-muted-foreground">
              Messaggi e canali
            </p>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conversazioni
        </p>
        <div className="space-y-0.5">
          {channels.map((item) => (
            <ChannelButton
              key={item.id}
              conversation={item}
              selected={selectedId === item.id}
              onSelect={() => onSelect(item.id)}
            />
          ))}
        </div>
        {!channels.length ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Nessuna conversazione autorizzata.
          </p>
        ) : null}
      </div>
      <div className="shrink-0 border-t p-3">
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar
            userId={identity.currentUserId}
            name={identity.currentUser.name}
            className="size-8"
          />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">
              {identity.currentUser.name}
            </b>
            <PresenceIndicator
              status={presence.current.status}
              showDot={false}
              showLabel
            />
          </span>
        </div>
      </div>
    </div>
  );
}

function Messages({ conversation }: { conversation: ChatConversation }) {
  const chat = useTeamChat();
  const identity = useDoflowIdentity();
  const search = useSearchParams();
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<ChatMessage>();
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const linkedId = search.get("message");
  const messages = compactCallEvents(
    chat.messages.filter(
      (message) => message.conversationId === conversation.id,
    ),
    linkedId ?? undefined,
  );
  const activeCall = chat.calls.find(
    (call) =>
      call.conversationId === conversation.id &&
      !["ended", "failed"].includes(call.status),
  );
  useEffect(() => {
    const unread = messages
      .filter(
        (message) =>
          message.authorId !== identity.currentUserId &&
          !chat.receipts.find(
            (receipt) =>
              receipt.messageId === message.id &&
              receipt.userId === identity.currentUserId,
          )?.readAt,
      )
      .map((message) => message.id);
    if (unread.length) void chat.markRead(conversation.id, unread);
  }, [chat, conversation.id, identity.currentUserId, messages]);
  useEffect(() => {
    if (linkedId)
      document
        .getElementById(`team-message-${linkedId}`)
        ?.scrollIntoView({ block: "center" });
    else bottom.current?.scrollIntoView({ block: "end" });
  }, [linkedId, messages.length]);
  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    const result = await chat.sendMessage({
      conversationId: conversation.id,
      text: draft,
      replyToMessageId: reply?.id,
      clientId: crypto.randomUUID(),
    });
    setSending(false);
    if (!result.ok) return toast.error(result.message);
    setDraft("");
    setReply(undefined);
  };
  const sendMedia = async (
    media: Parameters<typeof chat.sendMessage>[0]["media"],
  ) => {
    if (!media || sending) return;
    setSending(true);
    const result = await chat.sendMessage({
      conversationId: conversation.id,
      text: media.caption ?? "",
      media,
      replyToMessageId: reply?.id,
      clientId: crypto.randomUUID(),
    });
    setSending(false);
    if (!result.ok) return toast.error(result.message);
    setReply(undefined);
  };
  const insertEmoji = (value: string) => {
    const target = editor.current;
    const start = target?.selectionStart ?? draft.length;
    const end = target?.selectionEnd ?? start;
    setDraft(`${draft.slice(0, start)}${value}${draft.slice(end)}`);
    requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(start + value.length, start + value.length);
    });
  };
  const emptyCopy = conversation.title
    .toLocaleLowerCase("it-IT")
    .includes("commercial")
    ? "Condividi lead, clienti e opportunità"
    : conversation.title.toLocaleLowerCase("it-IT").includes("produzione")
      ? "Coordina progetti, revisioni e consegne"
      : conversation.title.toLocaleLowerCase("it-IT").includes("support")
        ? "Gestisci ticket e interventi con il team"
        : "Parla con tutto il team";
  return (
    <div data-team-space-messages className="flex min-h-0 flex-1 flex-col">
      <div
        data-team-space-message-list
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
        aria-live="polite"
      >
        {activeCall ? (
          <article className="mb-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="relative grid size-10 place-items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/10 motion-reduce:animate-none" />
                <Volume2 className="relative size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Chiamata in corso</p>
                <p className="text-xs text-muted-foreground">
                  {conversation.title} · {activeCall.connectedUserIds.length}{" "}
                  collegati ·{" "}
                  {activeCall.mode === "video" ? "audio e video" : "solo audio"}
                </p>
              </div>
              <TeamSpaceConversationActions
                conversation={conversation}
                showLabels
              />
            </div>
          </article>
        ) : null}
        {messages.length ? (
          <div className="space-y-1">
            {messages.map((message) => {
              const mine = message.authorId === identity.currentUserId;
              const author = identity.users.find(
                (user) => user.id === message.authorId,
              );
              const parent = messages.find(
                (item) => item.id === message.replyToMessageId,
              );
              return (
                <article
                  id={`team-message-${message.id}`}
                  key={message.id}
                  className={`group flex gap-3 rounded-lg p-2 ${linkedId === message.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/50"}`}
                >
                  <UserAvatar
                    userId={message.authorId}
                    name={author?.name}
                    className="size-8"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <b className="truncate text-sm">
                        {author?.name ?? "Utente"}
                      </b>
                      <time className="shrink-0 text-[11px] text-muted-foreground">
                        {clock(message.createdAt)}
                      </time>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="ml-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={() => setReply(message)}
                      >
                        Rispondi
                      </Button>
                    </div>
                    {parent ? (
                      <p className="mt-1 truncate border-l-2 pl-2 text-xs text-muted-foreground">
                        {parent.text || "Messaggio eliminato"}
                      </p>
                    ) : null}
                    <MessageText
                      className={`mt-1 whitespace-pre-wrap break-words text-sm ${message.deletedAt ? "italic text-muted-foreground" : ""}`}
                      text={
                        message.deletedAt ? "Messaggio eliminato" : message.text
                      }
                    />
                    {!message.deletedAt && message.media ? (
                      <MessageMedia media={message.media} />
                    ) : null}
                    {!message.deletedAt ? (
                      <MessageReactions message={message} />
                    ) : null}
                    {mine ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {chatReceiptStatus(message, chat.receipts)}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
            <div ref={bottom} />
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center text-center">
            <div className="max-w-sm rounded-2xl border bg-gradient-to-b from-primary/5 to-transparent p-6">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="size-6" />
              </span>
              <p className="mt-3 font-semibold">Inizia da qui</p>
              <p className="mt-1 text-sm text-muted-foreground">{emptyCopy}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => editor.current?.focus()}
                >
                  Scrivi un messaggio
                </Button>
                <TeamSpaceConversationActions
                  conversation={conversation}
                  showLabels
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Condividi una pratica o un progetto quando serve.
              </p>
            </div>
          </div>
        )}
      </div>
      <div data-team-space-composer className="shrink-0 border-t bg-background p-3 sm:p-4">
        {reply ? (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate">
              Risposta a {reply.text}
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setReply(undefined)}
              aria-label="Annulla risposta"
            >
              <X />
            </Button>
          </div>
        ) : null}
        <div className="flex min-w-0 items-end gap-2">
          <Textarea
            ref={editor}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={`Messaggio in #${conversation.title}`}
            aria-label={`Messaggio in ${conversation.title}`}
            className="max-h-32 min-h-11 resize-none"
          />
          <Button
            size="icon"
            disabled={!draft.trim() || sending}
            onClick={() => void send()}
            aria-label="Invia messaggio"
          >
            <Send />
          </Button>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <EmojiTool onSelect={insertEmoji} />
          <MediaTools onSend={(media) => void sendMedia(media)} />
          <span className="ml-auto text-[10px] text-muted-foreground">
            Contenuti interni moderati
          </span>
        </div>
      </div>
    </div>
  );
}

function Participants({
  conversation,
  callIds,
}: {
  conversation: ChatConversation;
  callIds?: string[];
}) {
  const chat = useTeamChat();
  const identity = useDoflowIdentity();
  const presence = useDoflowPresence();
  const [query, setQuery] = useState("");
  const ids = conversation.participantIds.filter((id) =>
    identity.users.some((user) => user.id === id),
  );
  const visible = ids.filter((id) =>
    identity.users
      .find((user) => user.id === id)
      ?.name.toLocaleLowerCase("it-IT")
      .includes(query.trim().toLocaleLowerCase("it-IT")),
  );
  const online = ids.filter(
    (id) => presence.presenceFor(id).status !== "offline",
  ).length;
  const groups = [
    ["In chiamata", visible.filter((id) => callIds?.includes(id))],
    [
      "Online",
      visible.filter(
        (id) =>
          !callIds?.includes(id) &&
          presence.presenceFor(id).status === "online",
      ),
    ],
    [
      "Occupati",
      visible.filter(
        (id) =>
          !callIds?.includes(id) &&
          ["busy", "do_not_disturb", "in_call", "in_meeting"].includes(
            presence.presenceFor(id).status,
          ),
      ),
    ],
    [
      "Offline",
      visible.filter(
        (id) =>
          !callIds?.includes(id) &&
          ["offline", "away"].includes(presence.presenceFor(id).status),
      ),
    ],
  ] as const;
  return (
    <section
      id="team-space-participants"
      data-team-space-participants
      className="flex h-full min-h-0 flex-col"
      aria-label="Partecipanti"
    >
      <header className="shrink-0 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Partecipanti</h2>
          <Badge variant="secondary">
            {ids.length} · {online} online
          </Badge>
        </div>
        {ids.length > 6 ? (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca partecipante…"
              aria-label="Cerca partecipante"
              className="h-9 pl-8"
            />
          </div>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.map(([label, group]) =>
          group.length ? (
            <section key={label} className="mb-3 last:mb-0">
              <h3 className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label} · {group.length}
              </h3>
              {group.map((id) => {
                const user = identity.users.find((item) => item.id === id)!;
                const record = presence.presenceFor(id);
                const inCall = Boolean(callIds?.includes(id));
                const own = id === identity.currentUserId;
                return (
                  <div
                    key={id}
                    className={`group flex min-w-0 items-center gap-2 rounded-lg p-2 hover:bg-muted ${inCall && id === identity.currentUserId && chat.callConnection === "connected" ? "ring-1 ring-emerald-500/30" : ""}`}
                  >
                    <UserAvatar
                      userId={id}
                      name={user.name}
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{user.name}</b>
                      <span
                        className="block truncate text-[11px] text-muted-foreground"
                        title={user.roles
                          .map((role) => roleLabels[role])
                          .join(" · ")}
                      >
                        {roleLabels[user.roles[0]]}
                      </span>
                      <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                        <PresenceIndicator
                          status={record.status}
                          showDot={false}
                          showLabel
                        />
                        {inCall ? (
                          <>
                            {own && chat.microphoneEnabled ? (
                              <Mic className="size-3 text-emerald-600" />
                            ) : (
                              <MicOff className="size-3" />
                            )}
                            {own && chat.screenShareEnabled ? (
                              <MonitorUp className="size-3 text-sky-600" />
                            ) : null}
                            {own && chat.cameraEnabled ? (
                              <Camera className="size-3 text-violet-600" />
                            ) : null}
                          </>
                        ) : null}
                      </span>
                    </div>
                    {id !== identity.currentUserId ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Azioni per ${user.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              toast.info(
                                `Apri Chat per contattare ${user.name}`,
                              )
                            }
                          >
                            Apri chat privata
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              toast.info(`Profilo di ${user.name}`)
                            }
                          >
                            Visualizza profilo
                          </DropdownMenuItem>
                          {identity.currentUser.roles.includes(
                            "administrator",
                          ) ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                toast.info(`Assegna un’attività a ${user.name}`)
                              }
                            >
                              Assegna attività
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ) : null,
        )}
        {!visible.length ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Nessun partecipante trovato.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function CallStage({
  conversation,
  onPanel,
}: {
  conversation: ChatConversation;
  onPanel: (panel: "chat" | "participants") => void;
}) {
  const chat = useTeamChat();
  const identity = useDoflowIdentity();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const duration = useMemo(() => {
    const start = chat.currentCall?.startedAt;
    if (!start) return "00:00";
    const seconds = Math.max(0, Math.floor((now - Date.parse(start)) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }, [chat.currentCall?.startedAt, now]);
  const canEnd =
    chat.currentCall?.createdBy === identity.currentUserId ||
    identity.currentUser.roles.includes("administrator") ||
    conversation.memberRoles?.[identity.currentUserId] === "moderator";
  const toggleShare = async () => {
    try {
      const active = await chat.toggleScreenShare();
      toast.success(
        active ? "Stai condividendo una scheda" : "Condivisione terminata",
      );
    } catch {
      toast.error("Condivisione schermo annullata o non disponibile");
    }
  };
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="flex min-w-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Volume2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{conversation.title}</h1>
          <p className="text-xs text-muted-foreground">
            {duration} · {chat.participantIds.length} partecipanti
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          <Signal className="mr-1 size-3" />
          {chat.callConnection === "connected"
            ? "Connessione buona"
            : chat.callConnection === "reconnecting"
              ? "Riconnessione…"
              : "Connessione…"}
        </Badge>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-3 pb-24 sm:p-5 sm:pb-24">
        {chat.screenShareEnabled && chat.localScreenShareTrack ? (
          <div className="flex h-full min-h-72 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex min-w-0 items-center gap-2 border-b border-border px-4 py-3">
              <MonitorUp className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="min-w-0 truncate font-medium">
                {identity.currentUser.name} sta condividendo
              </span>
              <Badge variant="outline" className="ml-auto shrink-0">
                Anteprima locale
              </Badge>
            </div>
            <div className="min-h-0 flex-1 bg-neutral-950/95 p-2">
              <LocalScreenSharePreview track={chat.localScreenShareTrack} />
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-64 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {chat.participantIds.map((id) => {
              const user = identity.users.find((item) => item.id === id);
              const own = id === identity.currentUserId;
              return (
                <div
                  key={id}
                  className="relative flex min-h-44 flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <UserAvatar
                    userId={id}
                    name={user?.name}
                    className="size-20"
                  />
                  <p className="mt-3 font-medium">
                    {user?.name ?? id}
                    {own ? " (tu)" : ""}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {own && chat.microphoneEnabled ? (
                      <Mic className="size-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <MicOff className="size-3" />
                    )}
                    {own && chat.microphoneEnabled
                      ? "Microfono attivo"
                      : "Microfono disattivato"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-3">
        <div className="flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-card/95 p-2 text-foreground shadow-2xl backdrop-blur">
          <Control
            active={chat.microphoneEnabled}
            destructive={!chat.microphoneEnabled}
            label={chat.microphoneEnabled ? "Microfono" : "Microfono spento"}
            onClick={() => void chat.toggleMicrophone()}
            icon={chat.microphoneEnabled ? <Mic /> : <MicOff />}
          />
          <Control
            active={chat.cameraEnabled}
            label="Videocamera"
            onClick={() => void chat.toggleCamera()}
            icon={chat.cameraEnabled ? <Camera /> : <CameraOff />}
          />
          <Control
            active={chat.screenShareEnabled}
            shared={chat.screenShareEnabled}
            label="Condividi"
            onClick={() => void toggleShare()}
            icon={<Cast />}
          />
          <Control
            label="Chat"
            onClick={() => onPanel("chat")}
            icon={<MessageCircle />}
          />
          <Control
            label="Partecipanti"
            onClick={() => onPanel("participants")}
            icon={<Users />}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-11 shrink-0 flex-col gap-0.5 px-3"
              >
                <MoreHorizontal className="size-4" />
                <span className="text-[10px]">Altro</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onSelect={() =>
                  toast.info("Scorciatoie: M microfono · V videocamera")
                }
              >
                Scorciatoie tastiera
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            className="h-11 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void chat.leaveCall()}
          >
            <PhoneOff />
            Esci
          </Button>
          {canEnd && (
            <Button
              variant="destructive"
              className="h-11 shrink-0"
              onClick={() => setConfirmEnd(true)}
            >
              <PhoneOff />
              Termina per tutti
            </Button>
          )}
        </div>
      </div>
      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminare la chiamata per tutti?</DialogTitle>
            <DialogDescription>
              Tutti i partecipanti verranno disconnessi dal canale{" "}
              {conversation.title}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmEnd(false);
                void chat.endCall();
              }}
            >
              Termina per tutti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LocalScreenSharePreview({ track }: { track: LocalVideoTrack }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    track.attach(video);
    return () => {
      track.detach(video);
    };
  }, [track]);
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="h-full w-full rounded-lg object-contain"
      aria-label="Anteprima della tua condivisione schermo"
    />
  );
}

function Control({
  label,
  icon,
  active,
  destructive,
  shared,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  destructive?: boolean;
  shared?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          onClick={onClick}
          aria-pressed={active}
          aria-label={label}
          className={`h-11 shrink-0 flex-col gap-0.5 px-3 ${destructive ? "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" : shared ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400" : active ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-foreground hover:bg-muted hover:text-foreground"}`}
        >
          {icon}
          <span className="text-[10px]">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TeamSpacePage() {
  const chat = useTeamChat();
  const identity = useDoflowIdentity();
  const search = useSearchParams();
  const [selectedId, setSelectedId] = useState(
    search.get("channel") ?? TEAM_CHAT_ID,
  );
  const [callView, setCallView] = useState(search.get("view") === "call");
  const [mobileChannels, setMobileChannels] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [panel, setPanel] = useState<"chat" | "participants">("participants");
  const [rightOpen, setRightOpen] = useState(
    identity.personalPreferences.teamSpaceParticipantsOpen,
  );
  const selected =
    chat.conversations.find((item) => item.id === selectedId) ??
    chat.conversations[0];
  const inSelectedCall = chat.currentCall?.conversationId === selected?.id;
  const select = (id: string) => {
    setSelectedId(id);
    setCallView(false);
    setMobileChannels(false);
    window.history.replaceState(
      null,
      "",
      `/dashboard/team-space?channel=${encodeURIComponent(id)}`,
    );
  };
  useEffect(() => {
    identity.setPersonalPreferences({ teamSpaceParticipantsOpen: rightOpen });
    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-controls="team-space-participants"], button[aria-label="Apri Chat o Partecipanti"]',
    );
    if (button) {
      const expanded = window.innerWidth < 1280 ? mobilePanel : rightOpen;
      button.setAttribute(
        "aria-label",
        expanded ? "Nascondi partecipanti" : "Mostra partecipanti",
      );
      button.setAttribute(
        "title",
        expanded ? "Nascondi partecipanti" : "Mostra partecipanti",
      );
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute("aria-controls", "team-space-participants");
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (window.innerWidth < 1280 && mobilePanel) setMobilePanel(false);
      else if (window.innerWidth >= 1280 && rightOpen) setRightOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [identity, mobilePanel, rightOpen, selected?.id]);
  if (!selected)
    return (
      <main className="grid min-h-[calc(100dvh-4rem)] place-items-center p-6">
        <div className="text-center">
          <Users className="mx-auto mb-3 size-9 text-muted-foreground" />
          <h1 className="font-semibold">Team Space</h1>
          <p className="text-sm text-muted-foreground">
            Caricamento canali autorizzati…
          </p>
        </div>
      </main>
    );
  const side = <Channels selectedId={selected.id} onSelect={select} />;
  const right = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b p-2">
        <Button
          size="sm"
          variant={panel === "participants" ? "secondary" : "ghost"}
          onClick={() => setPanel("participants")}
        >
          <Users />
          Partecipanti
        </Button>
        {inSelectedCall ? (
          <Button
            size="sm"
            variant={panel === "chat" ? "secondary" : "ghost"}
            onClick={() => setPanel("chat")}
          >
            <MessageCircle />
            Chat
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {panel === "chat" && inSelectedCall ? (
          <Messages conversation={selected} />
        ) : (
          <div className="h-full overflow-y-auto">
            <Participants
              conversation={selected}
              callIds={chat.participantIds}
            />
          </div>
        )}
      </div>
    </div>
  );
  const toggleParticipants = () => {
    if (window.innerWidth < 1280) setMobilePanel(true);
    else setRightOpen((value) => !value);
  };
  return (
    <main className="min-w-0 p-2 sm:p-4" data-flow-tour="flow-team-space-call">
      <div
        data-team-space-surface
        className={`mx-auto grid h-[calc(100dvh-5rem)] min-h-[560px] max-w-[1600px] grid-cols-1 overflow-hidden rounded-xl border bg-background shadow-sm lg:grid-cols-[240px_minmax(0,1fr)] ${rightOpen ? "xl:grid-cols-[240px_minmax(0,1fr)_280px]" : "xl:grid-cols-[240px_minmax(0,1fr)]"}`}
      >
        <aside className="hidden min-h-0 border-r lg:block">{side}</aside>
        <section data-team-space-conversation className="flex min-h-0 min-w-0 flex-col">
          <header className="flex min-w-0 shrink-0 items-center gap-2 border-b bg-gradient-to-r from-primary/5 to-transparent px-3 py-2">
            <Button
              size="icon-sm"
              variant="ghost"
              className="lg:hidden"
              onClick={() => setMobileChannels(true)}
              aria-label="Apri conversazioni"
            >
              <Menu />
            </Button>
            <Hash className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">
                {chatConversationTitle(selected)}
              </b>
              <span className="block truncate text-xs text-muted-foreground">
                {selected.description ?? "Conversazione condivisa del team"}
              </span>
            </div>
            {inSelectedCall ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCallView((value) => !value)}
              >
                {callView ? <MessageCircle /> : <Volume2 />}
                {callView ? "Chat" : "Chiamata"}
              </Button>
            ) : (
              <TeamSpaceConversationActions
                conversation={selected}
                showLabels
                onConnected={() => setCallView(true)}
              />
            )}
            <Button
              size="icon-sm"
              variant={rightOpen ? "secondary" : "ghost"}
              onClick={toggleParticipants}
              aria-label={
                rightOpen ? "Nascondi partecipanti" : "Mostra partecipanti"
              }
              aria-expanded={rightOpen}
              aria-controls="team-space-participants"
            >
              <PanelRight />
            </Button>
          </header>
          {callView && inSelectedCall ? (
            <CallStage
              conversation={selected}
              onPanel={(next) => {
                setPanel(next);
                if (window.innerWidth < 1280) setMobilePanel(true);
                else setRightOpen(true);
              }}
            />
          ) : (
            <Messages conversation={selected} />
          )}
        </section>
        {rightOpen && (
              <aside className="hidden min-h-0 w-[280px] border-l xl:block">
            {right}
          </aside>
        )}
      </div>
      <Sheet open={mobileChannels} onOpenChange={setMobileChannels}>
        <SheetContent side="left" className="w-[min(320px,90vw)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversazioni Team Space</SheetTitle>
            <SheetDescription>
              Seleziona una conversazione del team.
            </SheetDescription>
          </SheetHeader>
          {side}
        </SheetContent>
      </Sheet>
      <Sheet open={mobilePanel} onOpenChange={setMobilePanel}>
        <SheetContent className="w-full p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>
              {panel === "chat" ? "Chat" : "Partecipanti"}
            </SheetTitle>
            <SheetDescription>
              Pannello del canale {chatConversationTitle(selected)}.
            </SheetDescription>
          </SheetHeader>
          {right}
        </SheetContent>
      </Sheet>
    </main>
  );
}
