"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderKanban, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { FlowAssistant, FlowEmptyState } from "@/components/flow-experience/flow-experience";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalTenantAccess } from "@/contexts/TenantAccessContext";
import { useOptionalDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { flowboardApi, type FlowboardSummary } from "@/lib/tenant-feature-api";

function dateLabel(value?: string) {
  if (!value) return "Data non disponibile";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Data non disponibile"
    : new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function FlowboardList() {
  const router = useRouter();
  const tenantAccess = useOptionalTenantAccess();
  const doflowIdentity = useOptionalDoflowIdentity();
  const [items, setItems] = React.useState<FlowboardSummary[]>([]);
  const [cursor, setCursor] = React.useState<string | null>();
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const canCreateBoard = doflowIdentity
    ? doflowIdentity.hasCapability("canCreateProject") || doflowIdentity.hasCapability("canManageProjects")
    : Boolean(tenantAccess?.canCreate("projects"));

  const load = React.useCallback(async (nextCursor?: string) => {
    setLoading(true);
    setError("");
    try {
      const page = await flowboardApi.list({ cursor: nextCursor, limit: 24 });
      setItems((current) => nextCursor ? [...current, ...page.items] : page.items);
      setCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Flowboard non disponibili.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const create = async () => {
    if (!canCreateBoard || !name.trim()) return;
    setCreating(true);
    try {
      const board = await flowboardApi.create({ name: name.trim() });
      setName("");
      router.push("/dashboard/flowboard/" + encodeURIComponent(board.id));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Creazione Flowboard non riuscita.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="w-full space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flowboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mappe operative condivise, collegate ai dati autorizzati del tenant.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          {canCreateBoard ? (
            <>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void create();
                }}
                placeholder="Nome nuovo Flowboard"
                className="sm:w-72"
              />
              <Button type="button" disabled={!name.trim() || creating} onClick={() => void create()}>
                {creating ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Plus />}
                Crea
              </Button>
            </>
          ) : null}
          <Button type="button" size="icon" variant="outline" onClick={() => void load()} aria-label="Aggiorna Flowboard">
            <RefreshCw />
          </Button>
          <FlowAssistant context="Flowboard" />
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading && !items.length ? Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-48 rounded-2xl" />
        )) : null}
        {!loading && !items.length && !error ? (
          <Card className="border-dashed sm:col-span-2 xl:col-span-3">
            <CardContent>
              <FlowEmptyState assetId="empty-projects" title="Nessun Flowboard" description="Crea la prima mappa operativa del team." />
            </CardContent>
          </Card>
        ) : null}
        {items.map((board) => (
          <Card key={board.id} className="group flex min-h-48 flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FolderKanban className="size-5" />
                </span>
                <Badge variant="secondary">{board.status || "attivo"}</Badge>
              </div>
              <CardTitle className="pt-2">{board.name}</CardTitle>
              <CardDescription className="line-clamp-2">
                {board.description || "Mappa operativa condivisa"}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto text-xs text-muted-foreground">
              <p>{board.nodeCount || 0} nodi</p>
              <p>Aggiornato: {dateLabel(board.updatedAt)}</p>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href={"/dashboard/flowboard/" + encodeURIComponent(board.id)}>
                  Apri Flowboard
                  <ArrowRight className="size-4 transition-transform motion-reduce:transition-none group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>

      {cursor ? (
        <div className="text-center">
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load(cursor)}>
            {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}
            Carica altri
          </Button>
        </div>
      ) : null}
    </main>
  );
}
