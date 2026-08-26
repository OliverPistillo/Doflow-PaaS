"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FlowEmptyState } from "@/components/flow-experience/flow-experience";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listTenantNotifications,
  markTenantNotificationRead,
} from "@/lib/tenant-notifications-api";

type InboxViewItem = {
  id: string;
  subject: string;
  preview: string;
  body: string;
  sender: string;
  channel: string;
  priority?: string;
  unread: boolean;
  createdAt: string;
};

const pageSize = 20;

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function TenantInboxPage() {
  const [items, setItems] = React.useState<InboxViewItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>();
  const [offset, setOffset] = React.useState(0);
  const [total, setTotal] = React.useState<number>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [search, setSearch] = React.useState("");
  const sourceLabel = "Aggiornamenti";

  const selected = items.find((item) => item.id === selectedId);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await listTenantNotifications({
        offset,
        limit: pageSize,
        status: filter === "unread" ? "unread" : undefined,
      });
      const normalized = page.items.map((item) => ({
        id: item.id,
        subject: item.title,
        preview: item.body || "",
        body: item.body || "",
        sender: item.created_by ? "Aggiornamento del team" : "Sistema",
        channel: item.type || "notifica",
        priority: item.priority,
        unread: item.status === "unread" && !item.read_at,
        createdAt: item.created_at,
      }));
      const needle = search.trim().toLocaleLowerCase("it");
      setItems(needle
        ? normalized.filter((item) => (item.subject + " " + item.preview + " " + item.sender).toLocaleLowerCase("it").includes(needle))
        : normalized);
      setTotal(page.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inbox non disponibile.");
    } finally {
      setLoading(false);
    }
  }, [filter, offset, search]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const open = async (item: InboxViewItem) => {
    setSelectedId(item.id);
    if (!item.unread) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry));
    try {
      await markTenantNotificationRead(item.id);
    } catch {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: true } : entry));
    }
  };

  const hasNext = total === undefined ? items.length === pageSize : offset + pageSize < total;

  return (
    <main className="w-full space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sourceLabel} server-backed nel perimetro del tenant corrente.
          </p>
        </div>
        <div className="flex w-full gap-2 lg:w-auto">
          <div className="relative min-w-0 flex-1 lg:w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
              setSelectedId(undefined);
            }} placeholder="Cerca nell’Inbox" className="pl-9" />
          </div>
          <Button type="button" size="icon" variant="outline" onClick={() => void load()} aria-label="Aggiorna Inbox">
            <RefreshCw className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
          </Button>
        </div>
      </header>

      <Tabs value={filter} onValueChange={(value) => {
        setFilter(value === "unread" ? "unread" : "all");
        setOffset(0);
        setSelectedId(undefined);
      }}>
        <TabsList>
          <TabsTrigger value="all">Tutti</TabsTrigger>
          <TabsTrigger value="unread">Non letti</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="grid min-h-[34rem] p-0 lg:grid-cols-[minmax(17rem,23rem)_minmax(0,1fr)]">
          <section className={(selected ? "hidden lg:block " : "") + "border-r"}>
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
              </div>
            ) : null}
            {!loading && !items.length ? (
              <FlowEmptyState
                assetId={search ? "empty-search" : "empty-notifications"}
                title="Nessun elemento"
                description="Non risultano messaggi per questo filtro."
              />
            ) : null}
            <div className="divide-y">
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => void open(item)}
                  className={"flex w-full gap-3 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring "
                    + (selectedId === item.id ? "bg-accent text-accent-foreground" : "hover:bg-muted/60")}
                >
                  <span className={"mt-1 grid size-8 shrink-0 place-items-center rounded-full "
                    + (item.unread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {item.unread ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={"truncate text-sm " + (item.unread ? "font-semibold" : "font-medium")}>{item.sender}</span>
                      <time className="ml-auto shrink-0 text-[11px] text-muted-foreground" dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time>
                    </span>
                    <span className="mt-1 block truncate text-sm">{item.subject}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{item.preview}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section
            data-inbox-pane="detail"
            className={(selected ? "flex " : "hidden lg:flex ") + "min-w-0 flex-col"}
          >
            {selected ? (
              <>
                <header className="flex items-start gap-2 border-b p-4">
                  <Button type="button" size="icon-sm" variant="ghost" className="lg:hidden" onClick={() => setSelectedId(undefined)} aria-label="Torna alla lista">
                    <ChevronLeft />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{selected.subject}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{selected.sender}</span>
                      <Badge variant="secondary">{selected.channel}</Badge>
                      {selected.priority ? <Badge variant="outline">{selected.priority}</Badge> : null}
                      <time dateTime={selected.createdAt}>{dateLabel(selected.createdAt)}</time>
                    </div>
                  </div>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                  <p className="whitespace-pre-wrap text-sm leading-7">{selected.body || selected.preview}</p>
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center text-muted-foreground">
                <div>
                  <MailOpen className="mx-auto mb-3 size-10" />
                  <p className="text-sm">Seleziona un elemento per leggerlo.</p>
                </div>
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <footer className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {total === undefined ? items.length + " elementi" : Math.min(offset + 1, total) + "–" + Math.min(offset + pageSize, total) + " di " + total}
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>
            <ChevronLeft />Precedente
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!hasNext || loading} onClick={() => setOffset((value) => value + pageSize)}>
            {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}
            Successiva<ChevronRight />
          </Button>
        </div>
      </footer>
    </main>
  );
}
