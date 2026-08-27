"use client";

import { useState } from "react";
import { Cable, CirclePlay, Plus, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  automationActions,
  automationLabels,
  automationTriggers,
  integrationAdapters,
  type AutomationAction,
  type AutomationTrigger,
} from "@/features/commercial/commercial-automations";
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial";

export function CommercialAutomationsPage() {
  const { store, identity } = useAuthorizedCommercial();
  const manage = identity.hasCapability("canManageAutomations");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("follow_up_lead");
  const [action, setAction] = useState<AutomationAction>("create_notification");
  const [recipientId, setRecipientId] = useState(identity.currentUser.id);
  const [message, setMessage] = useState("");
  const resetForm = () => {
    setName("");
    setTrigger("follow_up_lead");
    setAction("create_notification");
    setRecipientId(identity.currentUser.id);
    setMessage("");
  };
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) resetForm();
  };
  const create = () => {
    const id = store.addAutomationRule({
      name,
      trigger,
      conditions: "Valutazione manuale locale",
      recipientId,
      action,
      message,
      enabled: true,
    });
    if (!id) return toast.error("Controlla i campi dell’automazione.");
    toast.success("Automazione creata");
    changeOpen(false);
  };
  const run = async (id: string, retryOfId?: string) => {
    const result = await store.runAutomationRule(id, retryOfId);
    if (result.ok)
      toast.success(
        result.existing
          ? "Esecuzione già registrata: nessun duplicato"
          : "Automazione eseguita",
      );
    else toast.error(result.message);
  };
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Motore locale controllato
          </p>
          <h1 className="text-2xl font-semibold">Automazioni</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nessun job in background: le regole vengono eseguite soltanto con
            “Esegui ora”.
          </p>
        </div>
        {manage && (
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Nuova automazione
          </Button>
        )}
      </header>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Regole configurate</CardTitle>
            <CardDescription>
              Trigger, condizioni, destinatario, azione e chiave idempotente
              persistenti.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {store.automationRules.map((rule) => (
              <div key={rule.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant={rule.enabled ? "secondary" : "outline"}>
                        {rule.enabled ? "Attiva" : "Disattiva"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {automationLabels[rule.trigger]} →{" "}
                      {automationLabels[rule.action]} ·{" "}
                      {
                        identity.users.find(
                          (user) => user.id === rule.recipientId,
                        )?.name
                      }
                    </p>
                    <p className="mt-2 text-sm">{rule.message}</p>
                    {rule.lastRunAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Ultima esecuzione:{" "}
                        {new Date(rule.lastRunAt).toLocaleString("it-IT")}
                      </p>
                    )}
                  </div>
                  {manage && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-pressed={rule.enabled}
                        onClick={() =>
                          store.updateAutomationRule(rule.id, {
                            enabled: !rule.enabled,
                          })
                        }
                      >
                        {rule.enabled ? "Disattiva" : "Attiva"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!rule.enabled}
                        onClick={() => run(rule.id)}
                      >
                        <CirclePlay />
                        Esegui ora
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!store.automationRules.length && (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Zap className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  Nessuna regola configurata
                </p>
                <p className="text-xs text-muted-foreground">
                  Il sistema non inventa automazioni o esecuzioni dimostrative.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Log esecuzioni</CardTitle>
            <CardDescription>
              Esiti e retry manuali verificabili.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {store.automationRuns.slice(0, 10).map((runItem) => (
              <div key={runItem.id} className="rounded-lg border p-3">
                <div className="flex justify-between gap-2">
                  <Badge
                    variant={
                      runItem.status === "success" ? "secondary" : "destructive"
                    }
                  >
                    {runItem.status}
                  </Badge>
                  {manage && runItem.status === "error" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => run(runItem.ruleId, runItem.id)}
                      aria-label="Riprova"
                    >
                      <RefreshCw />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs">
                  {runItem.error ?? runItem.output}
                </p>
                <p
                  className="mt-1 truncate text-[10px] text-muted-foreground"
                  title={runItem.executionKey}
                >
                  {runItem.executionKey}
                </p>
              </div>
            ))}
            {!store.automationRuns.length && (
              <p className="text-sm text-muted-foreground">
                Nessuna esecuzione.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Adattatori API</CardTitle>
          <CardDescription>
            Contratti predisposti e disabilitati: zero chiamate esterne e zero
            credenziali nel frontend.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {integrationAdapters.map((adapter) => (
            <div key={adapter.provider} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Cable className="size-4" />
                  {adapter.provider}
                </span>
                <Badge variant="outline">Off</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {adapter.reason}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuova automazione</DialogTitle>
            <DialogDescription>
              L’esecuzione resta manuale finché non esiste un backend con
              scheduler.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="automation-name">Nome</Label>
              <Input
                id="automation-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Trigger</Label>
                <Select
                  value={trigger}
                  onValueChange={(value) =>
                    setTrigger(value as AutomationTrigger)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {automationTriggers.map((item) => (
                      <SelectItem key={item} value={item}>
                        {automationLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Azione</Label>
                <Select
                  value={action}
                  onValueChange={(value) =>
                    setAction(value as AutomationAction)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {automationActions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {automationLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Destinatario</Label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {identity.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="automation-message">Messaggio</Label>
              <Textarea
                id="automation-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => changeOpen(false)}>
              Annulla
            </Button>
            <Button onClick={create}>Salva regola</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
