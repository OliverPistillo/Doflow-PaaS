"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  BellOff,
  CalendarPlus,
  Check,
  CornerDownRight,
  Expand,
  Filter as FilterIcon,
  FolderKanban,
  Hash,
  Link2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user-avatar";
import { ActivityFormDialog } from "@/features/commercial/components/activity-form-dialog";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import { useTeamChat } from "@/features/chat/team-chat-provider";
import {
  EmojiTool,
  MediaTools,
  MessageMedia,
  MessageReactions,
  MessageText,
} from "@/features/chat/chat-rich-content";
import {
  chatConversationTitle,
  chatReceiptStatus,
  TEAM_CHAT_ID,
  type ChatConversation,
  type ChatLinkedRecord,
  type ChatMessage,
  type ChatNotificationPreference,
} from "@/features/chat/team-chat";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider";
import { PresenceIndicator } from "@/features/identity/presence-indicator";
import { FlowEmptyState } from "@/features/flow/flow-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Filter = "all" | "unread";
type SecondaryFilter = "all" | "direct" | "channels" | "records";
type NewConversationKind = "choose" | "direct" | "channel" | "record";
type Props = { open?: boolean; onOpenChange?: (open: boolean) => void };
const filterLabels: Record<Filter, string> = {
  all: "Tutte",
  unread: "Non lette",
};
const secondaryFilterLabels: Record<SecondaryFilter, string> = {
  all: "Tutti i tipi",
  direct: "Messaggi diretti",
  channels: "Canali",
  records: "Clienti e progetti",
};

function time(value?: string) {
  return value
    ? new Intl.DateTimeFormat("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "";
}
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

export function TeamChatMenu({ open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
    if (value) setCompact(false);
  };
  const chat = useTeamChat();
  const linkedConversationId = useSearchParams().get("chat") ?? undefined;
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button
                data-topbar-action="chat"
                variant="ghost"
                className="relative inline-flex h-9 shrink-0 items-center gap-1.5 px-2"
                aria-label={`Apri Team Space${chat.unreadCount ? `, ${chat.unreadCount} non letti` : ""}`}
              >
                <MessageCircle className="size-4" />
                {chat.unreadCount > 0 && (
                  <span className="inline-flex h-[18px] min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-semibold text-white">
                    {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent>Team Space</TooltipContent>
        </Tooltip>
        <TeamChatDrawer
          open={open}
          initialConversationId={linkedConversationId}
          onOpenChange={setOpen}
          onCompact={() => {
            setOpen(false);
            setCompact(true);
          }}
        />
      </Sheet>
      {compact && (
        <CompactChat
          onExpand={() => {
            setCompact(false);
            setOpen(true);
          }}
          onClose={() => setCompact(false)}
        />
      )}
    </>
  );
}

function TeamChatDrawer({
  open,
  initialConversationId,
  onOpenChange,
  onCompact,
}: {
  open: boolean;
  initialConversationId?: string;
  onOpenChange: (open: boolean) => void;
  onCompact: () => void;
}) {
  const chat = useTeamChat();
  const identity = useDoflowIdentity();
  const store = useCommercialLeads();
  const nextRouter = useRouter();
  const router = {
    push: (href: string) => {
      onOpenChange(false);
      nextRouter.push(href);
    },
  };
  const linkedMessageId = useSearchParams().get("message") ?? undefined;
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialConversationId,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [secondaryFilter, setSecondaryFilter] =
    useState<SecondaryFilter>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newKind, setNewKind] = useState<NewConversationKind>("choose");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupUsers, setGroupUsers] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage>();
  const [link, setLink] = useState<ChatLinkedRecord>();
  const [activityOpen, setActivityOpen] = useState(false);
  const selected = chat.conversations.find((item) => item.id === selectedId);
  const allSelectedMessages = chat.messages.filter(
    (item) => item.conversationId === selectedId,
  );
  const messages = compactCallEvents(allSelectedMessages, linkedMessageId);
  const unreadMessageIds = messages
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
  const unreadMessageKey = unreadMessageIds.join("|");
  const markRead = chat.markRead;
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const records = useMemo<ChatLinkedRecord[]>(
    () => [
      ...store.leads.map((item) => ({
        type: "lead" as const,
        id: item.id,
        title: item.company,
        href: `/dashboard/commercial/leads/${item.id}`,
      })),
      ...store.customers.map((item) => ({
        type: "customer" as const,
        id: item.id,
        title: item.profile.company,
        href: `/dashboard/clienti/${item.id}`,
      })),
      ...store.projects.map((item) => ({
        type: "project" as const,
        id: item.id,
        title: item.name,
        href: `/dashboard/progetti/${item.id}`,
      })),
      ...store.supportTickets.map((item) => ({
        type: "support" as const,
        id: item.id,
        title: `${item.code} · ${item.title}`,
        href: `/dashboard/supporto?ticket=${item.id}`,
      })),
      ...store.contracts.map((item) => ({
        type: "contract" as const,
        id: item.id,
        title: item.code,
        href: `/dashboard/contratti?contract=${item.id}`,
      })),
      ...store.renewals.map((item) => ({
        type: "renewal" as const,
        id: item.id,
        title: item.planName,
        href: `/dashboard/rinnovi?renewal=${item.id}`,
      })),
      ...store.appointments.map((item) => ({
        type: "appointment" as const,
        id: item.id,
        title: item.title,
        href: `/dashboard/calendario?event=${item.id}`,
      })),
    ],
    [
      store.appointments,
      store.contracts,
      store.customers,
      store.leads,
      store.projects,
      store.renewals,
      store.supportTickets,
    ],
  );
  useEffect(() => {
    if (!open || !selectedId || !unreadMessageKey) return;
    const timer = window.setTimeout(() => {
      void markRead(selectedId, unreadMessageKey.split("|"));
      bottomRef.current?.scrollIntoView({ block: "end" });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [markRead, open, selectedId, unreadMessageKey]);
  useEffect(() => {
    const index = messages.findIndex(
      (message) => message.id === linkedMessageId,
    );
    if (!open || index < 0) return;
    document
      .querySelector("[aria-live='polite']")
      ?.querySelectorAll("article")
      [index]?.scrollIntoView({ block: "center" });
  }, [linkedMessageId, messages, open]);
  const lastMessage = (id: string) =>
    [...chat.messages].reverse().find((item) => item.conversationId === id);
  const normalizedQuery = query.trim().toLocaleLowerCase("it-IT");
  const conversations = chat.conversations
    .filter((item) => {
      const match = `${item.title} ${lastMessage(item.id)?.text ?? ""}`
        .toLocaleLowerCase("it-IT")
        .includes(normalizedQuery);
      if (!match || item.archivedAt) return false;
      if (filter === "unread" && chat.unreadFor(item.id) === 0) return false;
      if (secondaryFilter === "direct") return item.kind === "direct";
      if (secondaryFilter === "channels")
        return item.kind === "group" || item.kind === "team";
      if (secondaryFilter === "records")
        return item.kind === "customer" || item.kind === "project";
      return true;
    })
    .sort(
      (a, b) =>
        Number(b.pinnedByUserIds.includes(identity.currentUserId)) -
          Number(a.pinnedByUserIds.includes(identity.currentUserId)) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const users = identity.users.filter(
    (user) => user.id !== identity.currentUserId,
  );
  const openDirect = async (userId: string) => {
    const user = identity.users.find((item) => item.id === userId);
    if (!user) return;
    const result = await chat.createConversation({
      kind: "direct",
      title: user.name,
      participantIds: [userId],
    });
    if (!result.ok) return toast.error(result.message);
    closeNew();
    setSelectedId(result.id);
  };
  const submit = async () => {
    if (!selected) return;
    const text = drafts[selected.id] ?? "";
    if (!text.trim() && !link) return;
    const clientId = crypto.randomUUID();
    const result = await chat.sendMessage({
      conversationId: selected.id,
      text,
      clientId,
      replyToMessageId: replyTo?.id,
      linkedRecord: link,
    });
    if (!result.ok) return toast.error(result.message);
    setDrafts((current) => ({ ...current, [selected.id]: "" }));
    setReplyTo(undefined);
    setLink(undefined);
  };
  const sendMedia = async (
    media: Parameters<typeof chat.sendMessage>[0]["media"],
  ) => {
    if (!selected || !media) return;
    const result = await chat.sendMessage({
      conversationId: selected.id,
      text: media.caption ?? "",
      media,
      clientId: crypto.randomUUID(),
      replyToMessageId: replyTo?.id,
    });
    if (!result.ok) return toast.error(result.message);
    setReplyTo(undefined);
  };
  const insertEmoji = (value: string) => {
    if (!selected) return;
    const text = drafts[selected.id] ?? "";
    const target = composerRef.current;
    const start = target?.selectionStart ?? text.length;
    const end = target?.selectionEnd ?? start;
    setDrafts((current) => ({
      ...current,
      [selected.id]: `${text.slice(0, start)}${value}${text.slice(end)}`,
    }));
    requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(start + value.length, start + value.length);
    });
  };
  const closeNew = () => {
    setNewOpen(false);
    setNewKind("choose");
    setGroupTitle("");
    setGroupUsers([]);
  };
  const createGroup = async () => {
    const result = await chat.createConversation({
      kind: "group",
      title: groupTitle,
      participantIds: groupUsers,
      channelMode: "mixed",
    });
    if (!result.ok) return toast.error(result.message);
    closeNew();
    setSelectedId(result.id);
  };
  const createProjectChat = async (record: ChatLinkedRecord) => {
    const project = store.projects.find((item) => item.id === record.id);
    if (!project) return;
    const result = await chat.createConversation({
      kind: "project",
      title: record.title,
      participantIds: [
        project.ownerId,
        ...project.memberIds,
        ...(project.supervisorIds ?? []),
      ],
      linkedRecord: record,
    });
    if (!result.ok) return toast.error(result.message);
    setSelectedId(result.id);
  };
  const createRecordChat = async (record: ChatLinkedRecord) => {
    if (record.type === "project") {
      await createProjectChat(record);
      closeNew();
      return;
    }
    const customer = store.customers.find((item) => item.id === record.id);
    if (!customer) return;
    const result = await chat.createConversation({
      kind: "customer",
      title: record.title,
      participantIds: [customer.profile.assigneeId].filter(Boolean),
      linkedRecord: record,
      channelMode: "mixed",
    });
    if (!result.ok) return toast.error(result.message);
    closeNew();
    setSelectedId(result.id);
  };
  const linkedDefaults = selected?.linkedRecord ?? link;
  const selectedTitle =
    selected?.kind === "direct"
      ? (identity.users.find(
          (user) =>
            selected.participantIds.includes(user.id) &&
            user.id !== identity.currentUserId,
        )?.name ?? selected.title)
      : selected
        ? chatConversationTitle(selected)
        : undefined;
  return (
    <SheetContent
      showCloseButton={false}
      className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]"
    >
      <SheetHeader className="shrink-0 border-b p-3 text-left">
        <div className="flex min-w-0 items-center gap-2">
          {selected && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Torna alle conversazioni"
              onClick={() => setSelectedId(undefined)}
            >
              <ArrowLeft />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">
              {selectedTitle ?? "Parla con il team"}
            </SheetTitle>
            <SheetDescription className="truncate">
              {selected
                ? `${messages.length} messaggi · ${chat.connected ? "connesso" : "riconnessione…"}`
                : `Messaggi e canali · ${chat.connected ? "connesso" : "riconnessione…"}`}
            </SheetDescription>
          </div>
          {selected && <ConversationPreferences conversation={selected} />}
          {selected && (
            <Button
              size="icon-sm"
              variant="ghost"
              asChild
              aria-label="Apri la stessa conversazione in Team Space"
            >
              <Link
                href={`/dashboard/team-space?channel=${encodeURIComponent(selected.id)}${linkedMessageId ? `&message=${encodeURIComponent(linkedMessageId)}` : ""}`}
                onClick={() => onOpenChange(false)}
              >
                <Expand />
              </Link>
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            className="hidden sm:inline-flex"
            aria-label="Riduci Team Space"
            onClick={onCompact}
          >
            <Minimize2 />
          </Button>
          <SheetClose asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Chiudi Team Space"
            >
              <X />
            </Button>
          </SheetClose>
        </div>
      </SheetHeader>
      {selected ? (
        <>
          <div
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
            aria-live="polite"
          >
            {messages.length ? (
              <div className="space-y-3">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    allMessages={messages}
                    onReply={setReplyTo}
                    onEdit={(text) => void chat.editMessage(message.id, text)}
                    onDelete={() => void chat.deleteMessage(message.id)}
                    onActivity={() => {
                      setLink(message.linkedRecord);
                      setActivityOpen(true);
                    }}
                    onAppointment={() =>
                      router.push(
                        `/dashboard/calendario?create=appointment${message.linkedRecord ? `&record=${message.linkedRecord.type}:${message.linkedRecord.id}` : ""}`,
                      )
                    }
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            ) : (
              <EmptyChat />
            )}
          </div>
          <div className="shrink-0 border-t bg-background p-3">
            {replyTo && (
              <div className="mb-2 flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
                <CornerDownRight className="size-3" />
                <span className="min-w-0 flex-1 truncate">
                  Risposta a {replyTo.text}
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setReplyTo(undefined)}
                >
                  <X />
                </Button>
              </div>
            )}
            {link && (
              <div className="mb-2 flex items-center gap-2 rounded-md border p-2 text-xs">
                <Link2 className="size-3" />
                <span className="min-w-0 flex-1 truncate">{link.title}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setLink(undefined)}
                >
                  <X />
                </Button>
              </div>
            )}
            <Textarea
              ref={composerRef}
              aria-label="Scrivi un messaggio"
              value={drafts[selected.id] ?? ""}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [selected.id]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={`Messaggio a ${selected.title}…`}
              className="min-h-16 resize-none"
            />
            <div className="mt-2 flex items-center gap-1">
              <EmojiTool onSelect={insertEmoji} />
              <MediaTools onSend={(media) => void sendMedia(media)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Collega record"
                  >
                    <Link2 />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-72 w-72 overflow-y-auto"
                >
                  {records.map((record) => (
                    <DropdownMenuItem
                      key={`${record.type}:${record.id}`}
                      onSelect={() => setLink(record)}
                    >
                      {record.type} · {record.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Allega file"
                onClick={() => toast.info("Storage allegati non configurato")}
              >
                <Paperclip />
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={() => void submit()}
                disabled={!(drafts[selected.id]?.trim() || link)}
              >
                <Send />
                Invia
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Cerca chat"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca conversazioni…"
                className="pl-8"
              />
            </div>
            <Button
              size="icon"
              onClick={() => {
                setNewKind("choose");
                setNewOpen(true);
              }}
              aria-label="Nuova conversazione"
            >
              <Plus />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {(Object.keys(filterLabels) as Filter[]).map((item) => (
              <Button
                key={item}
                size="sm"
                className="flex-1"
                variant={filter === item ? "default" : "outline"}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {filterLabels[item]}
                {item === "unread" && chat.unreadCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {chat.unreadCount}
                  </Badge>
                ) : null}
              </Button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant={secondaryFilter === "all" ? "outline" : "secondary"}
                  aria-label="Filtri conversazioni"
                >
                  <FilterIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(secondaryFilterLabels) as SecondaryFilter[]).map(
                  (item) => (
                    <DropdownMenuItem
                      key={item}
                      onSelect={() => setSecondaryFilter(item)}
                    >
                      <Check
                        className={
                          secondaryFilter === item ? "opacity-100" : "opacity-0"
                        }
                      />
                      {secondaryFilterLabels[item]}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {secondaryFilter !== "all" ? (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">
                {secondaryFilterLabels[secondaryFilter]}
              </Badge>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setSecondaryFilter("all")}
              >
                Rimuovi filtro
              </Button>
            </div>
          ) : null}
          <TeamNow
            onOpenDirect={openDirect}
            onMention={(_userId, name) => {
              setSelectedId(TEAM_CHAT_ID);
              setDrafts((current) => ({
                ...current,
                [TEAM_CHAT_ID]: `${current[TEAM_CHAT_ID] ?? ""}@${name} `,
              }));
            }}
            onAssign={(userId) => {
              setActivityOpen(true);
              toast.info(
                `Nuova attività per ${identity.users.find((user) => user.id === userId)?.name ?? "collaboratore"}`,
              );
            }}
          />
          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conversazioni
              </h3>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setNewKind("choose");
                  setNewOpen(true);
                }}
              >
                <Plus />
                Nuova
              </Button>
            </div>
            {conversations.length ? (
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    message={lastMessage(conversation.id)}
                    unread={chat.unreadFor(conversation.id)}
                    onOpen={() => setSelectedId(conversation.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyChat
                onTeam={
                  filter === "all" && secondaryFilter === "all"
                    ? () => setSelectedId(TEAM_CHAT_ID)
                    : undefined
                }
                onNew={() => {
                  setNewKind("choose");
                  setNewOpen(true);
                }}
              />
            )}
          </section>
        </div>
      )}
      <Dialog
        open={newOpen}
        onOpenChange={(value) => (value ? setNewOpen(true) : closeNew())}
      >
        <DialogContent className="max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {newKind === "choose"
                ? "Nuova conversazione"
                : newKind === "direct"
                  ? "Messaggio diretto"
                  : newKind === "channel"
                    ? "Nuovo canale"
                    : "Cliente o progetto"}
            </DialogTitle>
          </DialogHeader>
          {newKind === "choose" ? (
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-4 text-left"
                onClick={() => setNewKind("direct")}
              >
                <UserRound className="size-5" />
                <span>
                  <b className="block">Messaggio diretto</b>
                  <span className="text-xs text-muted-foreground">
                    Parla con una persona del team
                  </span>
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-4 text-left"
                onClick={() => setNewKind("channel")}
              >
                <Hash className="size-5" />
                <span>
                  <b className="block">Canale</b>
                  <span className="text-xs text-muted-foreground">
                    Conversazione condivisa con il team
                  </span>
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto justify-start gap-3 p-4 text-left"
                onClick={() => setNewKind("record")}
              >
                <FolderKanban className="size-5" />
                <span>
                  <b className="block">Cliente o progetto</b>
                  <span className="text-xs text-muted-foreground">
                    Crea una conversazione collegata al lavoro
                  </span>
                </span>
              </Button>
            </div>
          ) : null}
          {newKind === "direct" ? (
            <div className="space-y-2">
              {users.map((user) => (
                <Button
                  key={user.id}
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 p-2"
                  onClick={() => void openDirect(user.id)}
                >
                  <UserAvatar
                    userId={user.id}
                    name={user.name}
                    className="size-9"
                  />
                  <span className="min-w-0 text-left">
                    <b className="block truncate">{user.name}</b>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          ) : null}
          {newKind === "channel" ? (
            <>
              <Label>
                Nome canale
                <Input
                  value={groupTitle}
                  onChange={(event) => setGroupTitle(event.target.value)}
                  placeholder="Es. Lancio progetto"
                />
              </Label>
              <div className="space-y-2">
                {users.map((user) => (
                  <Label
                    key={user.id}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <Checkbox
                      checked={groupUsers.includes(user.id)}
                      onCheckedChange={(checked) =>
                        setGroupUsers((current) =>
                          checked
                            ? [...current, user.id]
                            : current.filter((id) => id !== user.id),
                        )
                      }
                    />
                    <UserAvatar
                      userId={user.id}
                      name={user.name}
                      className="size-7"
                    />
                    {user.name}
                  </Label>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeNew}>
                  Annulla
                </Button>
                <Button
                  disabled={!groupTitle.trim() || !groupUsers.length}
                  onClick={() => void createGroup()}
                >
                  Crea canale
                </Button>
              </DialogFooter>
            </>
          ) : null}
          {newKind === "record" ? (
            <div className="space-y-2">
              {records
                .filter(
                  (record) =>
                    record.type === "customer" || record.type === "project",
                )
                .map((record) => (
                  <Button
                    key={`${record.type}:${record.id}`}
                    variant="ghost"
                    className="h-auto w-full justify-start gap-3 p-3 text-left"
                    onClick={() => void createRecordChat(record)}
                  >
                    {record.type === "customer" ? (
                      <Users className="size-5" />
                    ) : (
                      <FolderKanban className="size-5" />
                    )}
                    <span className="min-w-0">
                      <b className="block truncate">{record.title}</b>
                      <span className="text-xs capitalize text-muted-foreground">
                        {record.type === "customer" ? "Cliente" : "Progetto"}
                      </span>
                    </span>
                  </Button>
                ))}
            </div>
          ) : null}
          {newKind !== "choose" ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => setNewKind("choose")}
            >
              <ArrowLeft />
              Indietro
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
      <ActivityFormDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        defaultLeadId={
          linkedDefaults?.type === "lead" ? linkedDefaults.id : undefined
        }
        defaultClientId={
          linkedDefaults?.type === "customer" ? linkedDefaults.id : undefined
        }
        defaultProjectId={
          linkedDefaults?.type === "project" ? linkedDefaults.id : undefined
        }
      />
    </SheetContent>
  );
}

function TeamNow({
  onOpenDirect,
  onMention,
  onAssign,
}: {
  onOpenDirect: (userId: string) => Promise<unknown>;
  onMention: (userId: string, name: string) => void;
  onAssign: (userId: string) => void;
}) {
  const identity = useDoflowIdentity();
  const presence = useDoflowPresence();
  const router = useRouter();
  const activeStatuses = new Set([
    "online",
    "busy",
    "do_not_disturb",
    "in_call",
    "in_meeting",
  ]);
  const activeUsers = identity.users.filter(
    (user) =>
      user.id !== identity.currentUserId &&
      activeStatuses.has(presence.presenceFor(user.id).status),
  );
  const visibleUsers = activeUsers.slice(0, 3);
  const extraUsers = activeUsers.slice(3);
  const userRow = (user: (typeof identity.users)[number], compact = false) => {
    const record = presence.presenceFor(user.id);
    return (
      <div
        key={user.id}
        className={`group flex min-w-0 items-center gap-2 rounded-lg ${compact ? "p-1.5" : "border bg-card p-2"}`}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void onOpenDirect(user.id)}
          aria-label={`Apri chat con ${user.name}`}
        >
          <UserAvatar userId={user.id} name={user.name} className="size-8" />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">{user.name}</b>
            <span className="flex min-w-0 items-center gap-1">
              <PresenceIndicator
                status={record.status}
                showDot={false}
                showLabel
              />
            </span>
          </span>
        </button>
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
            <DropdownMenuItem onSelect={() => void onOpenDirect(user.id)}>
              <MessageCircle />
              Messaggio
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                router.push(
                  `/dashboard/impostazioni?section=team&user=${encodeURIComponent(user.id)}`,
                )
              }
            >
              <UserRound />
              Profilo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMention(user.id, user.name)}>
              <AtSign />
              Menziona
            </DropdownMenuItem>
            {identity.currentUser.roles.includes("administrator") ||
            identity.currentUser.roles.includes("project_manager") ? (
              <DropdownMenuItem onSelect={() => onAssign(user.id)}>
                <Check />
                Assegna attività
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };
  if (!activeUsers.length) return null;
  return (
    <section className="mt-4 space-y-2" aria-label="Team ora">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Team ora
        </h3>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {activeUsers.length} attivi
        </Badge>
      </div>
      {visibleUsers.length ? (
        <div className="grid gap-1.5">
          {visibleUsers.map((user) => userRow(user))}
        </div>
      ) : null}
      {extraUsers.length ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="w-full">
              +{extraUsers.length} altri attivi
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <div className="max-h-64 overflow-y-auto">
              {extraUsers.map((user) => userRow(user, true))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </section>
  );
}

function ConversationRow({
  conversation,
  message,
  unread,
  onOpen,
}: {
  conversation: ChatConversation;
  message?: ChatMessage;
  unread: number;
  onOpen: () => void;
}) {
  const identity = useDoflowIdentity();
  const presence = useDoflowPresence();
  const otherId =
    conversation.kind === "direct"
      ? conversation.participantIds.find((id) => id !== identity.currentUserId)
      : undefined;
  const title = otherId
    ? (identity.users.find((user) => user.id === otherId)?.name ??
      conversation.title)
    : chatConversationTitle(conversation);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {otherId ? (
        <UserAvatar userId={otherId} className="size-9" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-500/10 text-violet-600">
          <Users className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <b className="truncate text-sm">{title}</b>
          {conversation.pinnedByUserIds.includes(identity.currentUserId) && (
            <Pin className="size-3 text-muted-foreground" />
          )}
          {otherId && (
            <PresenceIndicator
              status={presence.presenceFor(otherId).status}
              showDot={false}
              showLabel
            />
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {message?.deletedAt
            ? "Messaggio eliminato"
            : message?.text || "Inizia una conversazione"}
        </span>
      </span>
      <span className="text-[11px] text-muted-foreground">
        {time(message?.createdAt)}
      </span>
      {unread > 0 && <Badge>{unread}</Badge>}
      {conversation.notificationPreferences[identity.currentUserId]?.mode ===
        "muted" && <BellOff className="size-3 text-muted-foreground" />}
    </button>
  );
}

function ConversationPreferences({
  conversation,
}: {
  conversation: ChatConversation;
}) {
  const chat = useTeamChat();
  const identity = useDoflowIdentity();
  const preference =
    conversation.notificationPreferences[identity.currentUserId]?.mode ?? "all";
  const pinned = conversation.pinnedByUserIds.includes(identity.currentUserId);
  const update = (mode: ChatNotificationPreference, mutedUntil?: string) =>
    void chat.setPreference(conversation.id, mode, mutedUntil);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Preferenze conversazione"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => update("all")}>
          <Check
            className={preference === "all" ? "opacity-100" : "opacity-0"}
          />
          Tutte le notifiche
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => update("mentions")}>
          <Check
            className={preference === "mentions" ? "opacity-100" : "opacity-0"}
          />
          Solo menzioni
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => update("muted")}>
          <BellOff />
          Silenziata
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            update("muted", new Date(Date.now() + 60 * 60_000).toISOString())
          }
        >
          <BellOff />
          Silenzia 1 ora
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(8, 0, 0, 0);
            update("muted", tomorrow.toISOString());
          }}
        >
          <BellOff />
          Silenzia fino a domani
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            void chat.setPreference(
              conversation.id,
              preference,
              undefined,
              !pinned,
            )
          }
        >
          <Pin />
          {pinned ? "Rimuovi dai fissati" : "Fissa conversazione"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MessageBubble({
  message,
  allMessages,
  onReply,
  onEdit,
  onDelete,
  onActivity,
  onAppointment,
}: {
  message: ChatMessage;
  allMessages: ChatMessage[];
  onReply: (message: ChatMessage) => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
  onActivity: () => void;
  onAppointment: () => void;
}) {
  const identity = useDoflowIdentity();
  const chat = useTeamChat();
  const mine = message.authorId === identity.currentUserId;
  const author = identity.users.find((item) => item.id === message.authorId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message.text);
  const parent = allMessages.find(
    (item) => item.id === message.replyToMessageId,
  );
  return (
    <article className={`group flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <UserAvatar
        userId={message.authorId}
        name={author?.name}
        className="size-7"
      />
      <div
        className={`min-w-0 max-w-[82%] rounded-xl border p-2.5 ${mine ? "bg-violet-600 text-white" : "bg-muted/60"}`}
      >
        <div className="flex items-center gap-2 text-[11px]">
          <b>{author?.name ?? "Utente"}</b>
          <time className={mine ? "text-white/70" : "text-muted-foreground"}>
            {time(message.createdAt)}
          </time>
          {message.updatedAt !== message.createdAt && (
            <span className={mine ? "text-white/70" : "text-muted-foreground"}>
              modificato
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                className={`ml-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ${mine ? "hover:bg-white/15" : ""}`}
                aria-label="Azioni messaggio"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "end" : "start"}>
              <DropdownMenuItem onSelect={() => onReply(message)}>
                <CornerDownRight />
                Rispondi
              </DropdownMenuItem>
              {mine && !message.deletedAt && (
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil />
                  Modifica
                </DropdownMenuItem>
              )}
              {(mine || identity.currentUser.roles.includes("administrator")) &&
                !message.deletedAt && (
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2 />
                    Elimina
                  </DropdownMenuItem>
                )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onActivity}>
                <Check />
                Crea attività
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAppointment}>
                <CalendarPlus />
                Crea appuntamento
              </DropdownMenuItem>
              {message.linkedRecord && (
                <DropdownMenuItem asChild>
                  <Link href={message.linkedRecord.href}>
                    <Link2 />
                    Apri record
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() =>
                  void navigator.clipboard
                    .writeText(
                      `${location.origin}/dashboard?chat=${message.conversationId}&message=${message.id}`,
                    )
                    .then(() => toast.success("Link copiato"))
                }
              >
                <Link2 />
                Copia link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {parent && (
          <p
            className={`mt-1 truncate border-l-2 pl-2 text-xs ${mine ? "border-white/50 text-white/75" : "border-muted-foreground/30 text-muted-foreground"}`}
          >
            {parent.text}
          </p>
        )}
        {message.deletedAt ? (
          <p className="mt-1 text-sm italic opacity-70">Messaggio eliminato</p>
        ) : editing ? (
          <div className="mt-2">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-14 bg-background text-foreground"
            />
            <div className="mt-1 flex justify-end gap-1">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Annulla
              </Button>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  onEdit(text);
                  setEditing(false);
                }}
              >
                Salva
              </Button>
            </div>
          </div>
        ) : (
          <MessageText
            className="mt-1 whitespace-pre-wrap break-words text-sm"
            text={message.text}
          />
        )}{" "}
        {!message.deletedAt && message.media ? (
          <MessageMedia media={message.media} />
        ) : null}
        {!message.deletedAt ? <MessageReactions message={message} /> : null}
        {message.linkedRecord && (
          <Link
            href={message.linkedRecord.href}
            className={`mt-2 flex items-center gap-2 rounded-md border p-2 text-xs ${mine ? "border-white/30" : "bg-background"}`}
          >
            <Link2 className="size-3" />
            <span className="truncate">{message.linkedRecord.title}</span>
          </Link>
        )}
        {mine && (
          <p className="mt-1 text-right text-[10px] opacity-70">
            {chatReceiptStatus(message, chat.receipts)}
          </p>
        )}
      </div>
    </article>
  );
}

function EmptyChat({
  onTeam,
  onNew,
}: { onTeam?: () => void; onNew?: () => void } = {}) {
  return (
    <div className="px-3 py-8">
      <FlowEmptyState
        assetId="flow-empty-chat"
        title="Parla con il team"
        message="Apri un messaggio diretto, un canale oppure una conversazione collegata a un cliente o progetto."
        primaryAction={
          onNew
            ? { label: "Nuova conversazione", onClick: onNew }
            : onTeam
              ? { label: "Apri Generale", onClick: onTeam }
              : undefined
        }
        secondaryAction={
          onNew && onTeam
            ? { label: "Apri Generale", onClick: onTeam }
            : undefined
        }
      />
    </div>
  );
}

function CompactChat({
  onExpand,
  onClose,
}: {
  onExpand: () => void;
  onClose: () => void;
}) {
  const chat = useTeamChat();
  return (
    <aside
      className="fixed bottom-4 right-4 z-50 hidden w-80 overflow-hidden rounded-xl border bg-background shadow-xl sm:block"
      aria-label="Team Space compatto"
    >
      <div className="flex items-center gap-2 border-b p-2.5">
        <MessageCircle className="size-4 text-violet-600" />
        <b className="min-w-0 flex-1 truncate">Team Space</b>
        {chat.unreadCount > 0 && <Badge>{chat.unreadCount}</Badge>}
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onExpand}
          aria-label="Espandi Team Space"
        >
          <Expand />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onClose}
          aria-label="Chiudi Team Space compatto"
        >
          <X />
        </Button>
      </div>
      <button
        type="button"
        className="w-full p-4 text-left text-sm text-muted-foreground hover:bg-muted"
        onClick={onExpand}
      >
        {chat.currentCall
          ? "Chiamata in corso"
          : chat.unreadCount
            ? `${chat.unreadCount} messaggi non letti`
            : "Apri Team Space"}
      </button>
    </aside>
  );
}
