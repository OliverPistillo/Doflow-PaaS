"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import {
  generateNotificationDigest,
  getTodayNotificationDigest,
  listNotificationDigests,
  type NotificationDigest,
} from "@/lib/tenant-notifications-api";
import { formatDate, formatDateTime, statusClass, statusLabel } from "./notifications-utils";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Errore nel caricamento digest";
}

function renderSummary(summary: NotificationDigest["summary"]) {
  if (!summary || (Array.isArray(summary) && summary.length === 0)) {
    return <p className="text-sm text-muted-foreground">Nessun elemento critico nel digest.</p>;
  }

  if (Array.isArray(summary)) {
    return (
      <ul className="space-y-1 text-sm text-muted-foreground">
        {summary.map((item, index) => (
          <li key={index}>• {typeof item === "object" ? JSON.stringify(item) : String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof summary === "object") {
    const entries = Object.entries(summary);
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground">Nessun elemento critico nel digest.</p>;
    }
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-nav border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground">{key.replace(/_/g, " ")}</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">{String(summary)}</p>;
}

function DigestCard({ digest, title }: { digest: NotificationDigest; title?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">{title || digest.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(digest.digest_date)} · creato {formatDateTime(digest.created_at)}
            </p>
          </div>
          <Badge variant="outline" className={statusClass(digest.status)}>
            {statusLabel(digest.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>{renderSummary(digest.summary)}</CardContent>
    </Card>
  );
}

export function NotificationDigestPage() {
  const { toast } = useToast();
  const [today, setToday] = useState<NotificationDigest | null>(null);
  const [digests, setDigests] = useState<NotificationDigest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [todayDigest, history] = await Promise.all([
        getTodayNotificationDigest(),
        listNotificationDigests(),
      ]);
      setToday(todayDigest);
      setDigests(Array.isArray(history.items) ? history.items : []);
    } catch (err) {
      setError(errorMessage(err));
      setToday(null);
      setDigests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setIsGenerating(true);
    try {
      await generateNotificationDigest();
      toast({ title: "Digest generato" });
      await load();
    } catch (err) {
      toast({
        title: "Digest non generato",
        description: errorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Digest notifiche"
        description="Riepilogo giornaliero interno salvato in DB. Nessuna email viene inviata."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Aggiorna
            </Button>
            <Button size="sm" onClick={generate} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Genera digest
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[24vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          Caricamento digest...
        </div>
      ) : (
        <>
          {today ? (
            <DigestCard digest={today} title="Digest di oggi" />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-start gap-3 p-6">
                <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-foreground">Nessun digest generato oggi</p>
                  <p className="text-sm text-muted-foreground">Puoi generarlo manualmente con il bottone in alto.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Storico digest</h2>
            {digests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nessun digest storico disponibile.
                </CardContent>
              </Card>
            ) : (
              digests.map((digest) => <DigestCard key={digest.id} digest={digest} />)
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}
