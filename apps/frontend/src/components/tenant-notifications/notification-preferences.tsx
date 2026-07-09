"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/tenant-notifications-api";
import { cn } from "@/lib/utils";

const PRIORITIES = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Errore nel salvataggio preferenze";
}

function csvToArray(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function NotificationPreferencesPage() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [mutedTypesText, setMutedTypesText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutedPriorities = useMemo(() => preferences?.muted_priorities || [], [preferences]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getNotificationPreferences();
      setPreferences({
        ...data,
        muted_types: data.muted_types || [],
        muted_priorities: data.muted_priorities || [],
        daily_digest_enabled: data.daily_digest_enabled !== false,
        digest_time: data.digest_time || "08:30",
      });
      setMutedTypesText((data.muted_types || []).join(", "));
    } catch (err) {
      setError(errorMessage(err));
      setPreferences(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePriority = (priority: string) => {
    if (!preferences) return;
    const next = mutedPriorities.includes(priority)
      ? mutedPriorities.filter((item) => item !== priority)
      : [...mutedPriorities, priority];
    setPreferences({ ...preferences, muted_priorities: next });
  };

  const save = async () => {
    if (!preferences) return;
    setIsSaving(true);
    try {
      const data = await updateNotificationPreferences({
        daily_digest_enabled: preferences.daily_digest_enabled,
        digest_time: preferences.digest_time || "08:30",
        muted_priorities: preferences.muted_priorities || [],
        muted_types: csvToArray(mutedTypesText),
      });
      setPreferences({
        ...data,
        muted_types: data.muted_types || [],
        muted_priorities: data.muted_priorities || [],
      });
      setMutedTypesText((data.muted_types || []).join(", "));
      toast({ title: "Preferenze salvate" });
    } catch (err) {
      toast({
        title: "Preferenze non salvate",
        description: errorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Preferenze notifiche"
        description="Imposta digest giornaliero e mute personali. Le preferenze non inviano email o messaggi esterni."
        actions={
          <Button size="sm" onClick={save} disabled={isSaving || !preferences}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salva preferenze
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex min-h-[24vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          Caricamento preferenze...
        </div>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : preferences ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Digest giornaliero</CardTitle>
              <CardDescription>Generato internamente e visibile nella pagina Digest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-nav border border-border p-4">
                <div>
                  <Label className="text-sm font-semibold">Digest attivo</Label>
                  <p className="text-sm text-muted-foreground">Disattiva solo la tua preferenza personale.</p>
                </div>
                <Switch
                  checked={preferences.daily_digest_enabled}
                  onCheckedChange={(checked) => setPreferences({ ...preferences, daily_digest_enabled: checked })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="digest_time">Orario digest</Label>
                <Input
                  id="digest_time"
                  type="time"
                  value={preferences.digest_time || "08:30"}
                  onChange={(event) => setPreferences({ ...preferences, digest_time: event.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mute priorità</CardTitle>
              <CardDescription>Nascondi priorità meno utili dal tuo flusso personale, se il backend le applica.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {PRIORITIES.map((priority) => {
                const muted = mutedPriorities.includes(priority.value);
                return (
                  <Button
                    key={priority.value}
                    type="button"
                    variant={muted ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePriority(priority.value)}
                    className={cn(muted && "bg-muted text-muted-foreground hover:bg-muted")}
                  >
                    {muted ? "Muted: " : ""}{priority.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Mute tipi notifica</CardTitle>
              <CardDescription>
                Inserisci type tecnici separati da virgola, per esempio task_due_today, quote_draft_stale_14_days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={4}
                value={mutedTypesText}
                onChange={(event) => setMutedTypesText(event.target.value)}
                placeholder="task_due_today, quote_draft_stale_14_days"
              />
              <div className="flex flex-wrap gap-2">
                {csvToArray(mutedTypesText).length === 0 ? (
                  <Badge variant="outline" className="text-muted-foreground">Nessun type silenziato</Badge>
                ) : csvToArray(mutedTypesText).map((type) => (
                  <Badge key={type} variant="outline" className="font-mono">{type}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}
