"use client";

import * as React from "react";
import { Circle, RefreshCw, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import {
  collaborationApi,
  type CollaborationPresence,
} from "@/lib/tenant-feature-api";

const statusLabel: Record<string, string> = {
  online: "Disponibile",
  away: "Assente",
  busy: "Occupato",
  offline: "Offline",
};

const statusTone: Record<string, string> = {
  online: "text-emerald-600 dark:text-emerald-400",
  away: "text-amber-600 dark:text-amber-400",
  busy: "text-destructive",
  offline: "text-muted-foreground",
};

export function TeamSpacePresence() {
  const identity = useDoflowIdentity();
  const [items, setItems] = React.useState<CollaborationPresence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await collaborationApi.presence();
      setItems(page.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Presenze non disponibili.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="size-5" />
            Presenze
          </CardTitle>
          <CardDescription>Stato operativo del team nel tenant corrente.</CardDescription>
        </div>
        <Button type="button" size="icon-sm" variant="outline" onClick={() => void load()} aria-label="Aggiorna presenze">
          <RefreshCw className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        )) : null}
        {!loading && error ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {!loading && !error && !items.length ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nessuna presenza disponibile.
          </p>
        ) : null}
        {items.map((person) => (
          <div key={person.userId} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground">
            <Circle className={"size-3 fill-current " + (statusTone[person.status] || statusTone.offline)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{person.displayName || identity.users.find((user) => user.id === person.userId)?.name || "Membro del team"}</p>
              <p className="truncate text-xs text-muted-foreground">{person.activity || "Nessuna attività condivisa"}</p>
            </div>
            <Badge variant="secondary">{statusLabel[person.status] || person.status}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
