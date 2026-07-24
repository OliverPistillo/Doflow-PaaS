"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, ShieldAlert, ToggleLeft, ToggleRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import {
  listNotificationRules,
  runNotificationRule,
  runNotificationRules,
  updateNotificationRule,
  type NotificationRule,
  type NotificationRuleRunResult,
} from "@/lib/tenant-notifications-api";
import { categoryLabel, formatDateTime, priorityClass, priorityLabel } from "./notifications-utils";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Errore nella gestione regole notifiche";
}

function runKey(row: NotificationRuleRunResult): string {
  return row.ruleKey || row.rule_key || "regola";
}

function runCreated(row: NotificationRuleRunResult): number {
  return Number(row.notificationsCreated ?? row.notifications_created ?? 0);
}

export function NotificationRulesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [results, setResults] = useState<NotificationRuleRunResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listNotificationRules();
      setRules(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      const message = errorMessage(err);
      setError(message.includes("403") || message.toLowerCase().includes("permess")
        ? "Non hai permessi per gestire le regole."
        : message);
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRule = async (rule: NotificationRule) => {
    setBusyKey(rule.key);
    try {
      await updateNotificationRule(rule.key, { is_enabled: !rule.is_enabled });
      toast({ title: rule.is_enabled ? "Regola disabilitata" : "Regola abilitata" });
      await load();
    } catch (err) {
      toast({
        title: "Non hai permessi per gestire le regole.",
        description: errorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const runOne = async (rule: NotificationRule) => {
    setBusyKey(rule.key);
    try {
      const data = await runNotificationRule(rule.key);
      setResults(data.results || []);
      toast({ title: "Regola eseguita", description: `${data.notificationsCreated || 0} notifiche create.` });
      await load();
    } catch (err) {
      toast({
        title: "Non hai permessi per eseguire questa regola.",
        description: errorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const runAll = async () => {
    setBusyKey("__all__");
    try {
      const data = await runNotificationRules();
      setResults(data.results || []);
      toast({ title: "Regole eseguite", description: `${data.notificationsCreated || 0} notifiche create.` });
      await load();
    } catch (err) {
      toast({
        title: "Non hai permessi per gestire le regole.",
        description: errorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Regole notifiche"
        description="Automazioni interne che generano notifiche da CRM, preventivi, briefing, progetti e finance dove autorizzato."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Aggiorna
            </Button>
            <Button size="sm" onClick={runAll} disabled={busyKey !== null || isLoading}>
              {busyKey === "__all__" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Esegui tutte
            </Button>
          </>
        }
      />

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="flex items-start gap-3 p-5">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">{error}</p>
              <p className="text-sm text-muted-foreground">Il backend resta la fonte di verità per i permessi.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {isLoading ? (
          <div className="flex min-h-[24vh] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
            Caricamento regole...
          </div>
        ) : rules.length === 0 && !error ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nessuna regola configurata.
            </CardContent>
          </Card>
        ) : rules.map((rule) => (
          <Card key={rule.key}>
            <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{rule.name}</h3>
                  <Badge variant="outline">{categoryLabel(rule.category)}</Badge>
                  <Badge variant="outline" className={priorityClass(rule.severity)}>{priorityLabel(rule.severity)}</Badge>
                  <Badge variant={rule.is_enabled ? "default" : "outline"}>
                    {rule.is_enabled ? "Attiva" : "Disattiva"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{rule.description || rule.key}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{rule.key}</span>
                  <span>·</span>
                  <span>Ultimo run: {formatDateTime(rule.last_run_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleRule(rule)} disabled={busyKey !== null}>
                  {rule.is_enabled ? <ToggleRight className="mr-2 h-4 w-4" /> : <ToggleLeft className="mr-2 h-4 w-4" />}
                  {rule.is_enabled ? "Disabilita" : "Abilita"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => runOne(rule)} disabled={busyKey !== null || !rule.is_enabled}>
                  {busyKey === rule.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Esegui
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ultimo risultato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((row) => (
              <div key={`${runKey(row)}-${row.status}`} className="flex flex-wrap items-center justify-between gap-2 rounded-nav bg-muted/40 px-3 py-2 text-sm">
                <span className="font-mono">{runKey(row)}</span>
                <span className="text-muted-foreground">{row.status}</span>
                <span className="tabular-nums">{runCreated(row)} notifiche</span>
                {(row.errorMessage || row.error_message) ? (
                  <span className="basis-full text-xs text-destructive">{row.errorMessage || row.error_message}</span>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
