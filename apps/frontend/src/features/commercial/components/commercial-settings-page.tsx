"use client";

import { useEffect, useState } from "react";

import { Scale, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  commercialGoalMetrics,
  useCommercialLeads,
  type CommercialGoal,
  type RankingConfig,
  type RankingRole,
} from "@/features/commercial/components/commercial-leads-provider";
import {
  getGoalMetricDefinition,
  goalMetricDefinitions,
} from "@/features/commercial/commercial-goals";
import {
  rankingMetricLabels,
  rankingRoleLabels,
} from "@/features/commercial/commercial-rankings";
import { TeamDutiesPanel } from "@/features/commercial/components/team-duties-panel";
import { CalendarIntegrationSettings } from "@/features/commercial/components/calendar-integration-settings";
import { BonusAdministrationSettings } from "@/features/bonus/bonus-page";
import { CommercialSettingsHub } from "@/features/commercial/components/commercial-settings-hub";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import {
  roleLabels,
  type DoflowCapability,
  type DoflowRole,
  doflowRoles,
} from "@/features/identity/permissions";

const supervisionCapabilities: Array<{ id: DoflowCapability; label: string }> =
  [
    { id: "canApproveProjectWork", label: "Approva lavoro progetto" },
    { id: "canPublishClientUpdate", label: "Pubblica aggiornamenti cliente" },
  ];

export function CommercialSettingsPage() {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const canManage = identity.hasCapability("canManageRoles");
  return (
    <CommercialSettingsHub
      calendar={<CalendarIntegrationSettings />}
      duties={<TeamDutiesPanel />}
      roles={<RoleSettings />}
      rankings={
        canManage ? (
          <div className="space-y-4">
            <RankingSettings
              configs={store.rankingConfigs}
              onSave={store.updateRankingConfig}
            />
            <BonusAdministrationSettings />
            <GoalsSettings
              goals={store.goals}
              users={identity.users}
              onCreate={store.addGoal}
              onUpdate={store.updateGoal}
              onArchive={store.archiveGoal}
            />
          </div>
        ) : null
      }
      dataTools={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dati operativi</CardTitle>
            <CardDescription>
              I dati reali non vengono mai ripristinati o sostituiti da fixture
              dal frontend.
            </CardDescription>
          </CardHeader>
        </Card>
      }
    />
  );
}

function RoleSettings() {
  const identity = useDoflowIdentity();
  const toggleRole = (userId: string, role: DoflowRole, enabled: boolean) => {
    const user = identity.users.find((item) => item.id === userId);
    if (!user) return;
    if (
      !enabled &&
      role === "administrator" &&
      identity.users.filter((item) => item.roles.includes("administrator"))
        .length === 1
    )
      return toast.error("Deve rimanere almeno un amministratore");
    identity.updateUserRoles(
      userId,
      enabled
        ? [...user.roles, role]
        : user.roles.filter((item) => item !== role),
    );
    toast.success("Ruoli aggiornati");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" />
          Ruoli e autorizzazioni
        </CardTitle>
        <CardDescription>
          I ruoli definiscono quali sezioni e operazioni sono disponibili per
          ogni utente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {identity.users.map((user) => (
          <section key={user.id} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-3">
              <UserAvatar
                userId={user.id}
                name={user.name}
                className="size-10"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {doflowRoles.map((role) => {
                const id = `${user.id}-${role}`;
                return (
                  <Label
                    key={role}
                    htmlFor={id}
                    className="flex items-center gap-2 rounded-md border p-3 font-normal"
                  >
                    <Checkbox
                      id={id}
                      checked={user.roles.includes(role)}
                      onCheckedChange={(checked) =>
                        toggleRole(user.id, role, checked === true)
                      }
                    />
                    <span>{roleLabels[role]}</span>
                  </Label>
                );
              })}
            </div>
            <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
              {supervisionCapabilities.map((capability) => {
                const id = `${user.id}-${capability.id}`;
                const enabled =
                  user.roles.includes("administrator") ||
                  user.capabilities?.includes(capability.id);
                return (
                  <Label
                    key={capability.id}
                    htmlFor={id}
                    className="flex items-center gap-2 rounded-md border p-3 font-normal"
                  >
                    <Checkbox
                      id={id}
                      disabled={user.roles.includes("administrator")}
                      checked={enabled}
                      onCheckedChange={(checked) => {
                        const current = user.capabilities ?? [];
                        identity.updateUserCapabilities(
                          user.id,
                          checked === true
                            ? [...current, capability.id]
                            : current.filter((item) => item !== capability.id),
                        );
                        toast.success("Autorizzazione aggiornata");
                      }}
                    />
                    <span>{capability.label}</span>
                  </Label>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

const rankingRoles: RankingRole[] = [
  "commercial",
  "developer",
  "project_manager",
  "support",
];

function RankingSettings({
  configs,
  onSave,
}: {
  configs: RankingConfig[];
  onSave: ReturnType<typeof useCommercialLeads>["updateRankingConfig"];
}) {
  const [role, setRole] = useState<RankingRole>("commercial");
  const source =
    configs.find((item) => item.role === role) ??
    { role, metrics: [] };
  const [drafts, setDrafts] = useState<
    Record<RankingRole, RankingConfig["metrics"]>
  >(
    () =>
      Object.fromEntries(
        rankingRoles.map((item) => [
          item,
          (
            configs.find((config) => config.role === item) ??
            { role: item, metrics: [] }
          ).metrics,
        ]),
      ) as Record<RankingRole, RankingConfig["metrics"]>,
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDrafts(Object.fromEntries(rankingRoles.map((item) => [item, configs.find((config) => config.role === item)?.metrics ?? []])) as Record<RankingRole, RankingConfig["metrics"]>);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [configs]);
  const draft = drafts[role] ?? source.metrics;
  const total = draft.reduce((sum, metric) => sum + metric.weight, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="size-4" />
          Classifiche: metriche e pesi
        </CardTitle>
        <CardDescription>
          Configurazione amministrativa. Il salvataggio e il consolidamento sono
          bloccati finché la somma non è esattamente 100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          value={role}
          onValueChange={(value) => setRole(value as RankingRole)}
        >
          <SelectTrigger
            aria-label="Ruolo classifica"
            className="w-full sm:w-64"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rankingRoles.map((item) => (
              <SelectItem key={item} value={item}>
                {rankingRoleLabels[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="divide-y rounded-lg border">
          {draft.map((metric) => (
            <div
              key={metric.metric}
              className="grid grid-cols-[minmax(0,1fr)_80px] items-center gap-3 p-3"
            >
              <Label
                htmlFor={`ranking-setting-${role}-${metric.metric}`}
                className="text-sm"
              >
                {rankingMetricLabels[metric.metric]}
              </Label>
              <Input
                id={`ranking-setting-${role}-${metric.metric}`}
                type="number"
                min="0"
                max="100"
                value={metric.weight}
                onChange={(event) => {
                  const weight = Number(event.target.value);
                  setDrafts((current) => ({
                    ...current,
                    [role]: draft.map((item) =>
                      item.metric === metric.metric
                        ? { ...item, weight }
                        : item,
                    ),
                  }));
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className={
              total === 100
                ? "text-sm font-medium text-emerald-600"
                : "text-sm font-medium text-destructive"
            }
          >
            Totale pesi: {total}%
          </p>
          <Button
            disabled={total !== 100}
            onClick={async () => {
              if (await onSave(role, draft)) toast.success("Pesi classifica salvati");
              else toast.error("Pesi non validi: il totale deve essere 100%");
            }}
          >
            Salva pesi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const goalMetricLabels = Object.fromEntries(
  commercialGoalMetrics.map((metric) => [
    metric,
    goalMetricDefinitions[metric].label,
  ]),
) as Record<CommercialGoal["metric"], string>;

function GoalsSettings({
  goals,
  users,
  onCreate,
  onUpdate,
  onArchive,
}: {
  goals: CommercialGoal[];
  users: ReturnType<typeof useDoflowIdentity>["users"];
  onCreate: ReturnType<typeof useCommercialLeads>["addGoal"];
  onUpdate: ReturnType<typeof useCommercialLeads>["updateGoal"];
  onArchive: ReturnType<typeof useCommercialLeads>["archiveGoal"];
}) {
  const empty = {
    title: "",
    description: "",
    targetType: "company" as CommercialGoal["targetType"],
    targetId: "",
    metric: "revenue" as CommercialGoal["metric"],
    targetValue: "",
    unit: "currency" as CommercialGoal["unit"],
    startsAt: "2026-08-01",
    endsAt: "2026-08-31",
    responsibleId: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string>();
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = () => {
    if (
      !form.title.trim() ||
      Number(form.targetValue) <= 0 ||
      !form.startsAt ||
      !form.endsAt
    )
      return;
    const definition = getGoalMetricDefinition(form.metric);
    const record = {
      ...form,
      title: form.title.trim(),
      targetId: form.targetId || undefined,
      targetValue: Number(form.targetValue),
      unit: definition.unit,
      metricType: definition.metricType,
      labelSingular: definition.labelSingular,
      labelPlural: definition.labelPlural,
      currency: definition.currency,
      responsibleId: form.responsibleId || undefined,
      status: "active" as const,
    };
    if (editingId) onUpdate(editingId, record);
    else onCreate(record);
    setEditingId(undefined);
    setForm(empty);
    toast.success(editingId ? "Obiettivo aggiornato" : "Obiettivo creato");
  };
  const edit = (goal: CommercialGoal) => {
    setEditingId(goal.id);
    setForm({
      title: goal.title,
      description: goal.description,
      targetType: goal.targetType,
      targetId: goal.targetId ?? "",
      metric: goal.metric,
      targetValue: String(goal.targetValue),
      unit: goal.unit,
      startsAt: goal.startsAt,
      endsAt: goal.endsAt,
      responsibleId: goal.responsibleId ?? "",
      notes: goal.notes ?? "",
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Obiettivi aziendali, di ruolo e personali
        </CardTitle>
        <CardDescription>
          Salvati nello store commerciale esistente; il valore corrente viene
          calcolato dai dati operativi, senza duplicarli.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="goal-title">Titolo</Label>
            <Input
              id="goal-title"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
            />
          </div>
          <div>
            <Label>Metrica</Label>
            <Select
              value={form.metric}
              onValueChange={(value) => set("metric", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {commercialGoalMetrics.map((metric) => (
                  <SelectItem key={metric} value={metric}>
                    {goalMetricLabels[metric]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="goal-target">Valore obiettivo</Label>
            <Input
              id="goal-target"
              type="number"
              min="1"
              value={form.targetValue}
              onChange={(event) => set("targetValue", event.target.value)}
            />
          </div>
          <div>
            <Label>Destinazione</Label>
            <Select
              value={form.targetType}
              onValueChange={(value) => set("targetType", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Azienda</SelectItem>
                <SelectItem value="role">Ruolo</SelectItem>
                <SelectItem value="user">Persona</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsabile</Label>
            <Select
              value={form.responsibleId || "none"}
              onValueChange={(value) =>
                set("responsibleId", value === "none" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assegnato</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="goal-start">Inizio</Label>
            <Input
              id="goal-start"
              type="date"
              value={form.startsAt}
              onChange={(event) => set("startsAt", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="goal-end">Fine</Label>
            <Input
              id="goal-end"
              type="date"
              value={form.endsAt}
              onChange={(event) => set("endsAt", event.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button onClick={save}>
              {editingId ? "Salva modifica" : "Crea obiettivo"}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(undefined);
                  setForm(empty);
                }}
              >
                Annulla
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-3">
          {goals
            .filter((goal) => goal.status !== "archived")
            .map((goal) => (
              <div
                key={goal.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{goal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {goalMetricLabels[goal.metric]} · obiettivo{" "}
                    {goal.targetValue} · {goal.startsAt} → {goal.endsAt}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => edit(goal)}>
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onArchive(goal.id);
                    toast.success("Obiettivo archiviato");
                  }}
                >
                  Archivia
                </Button>
              </div>
            ))}
          {!goals.some((goal) => goal.status !== "archived") && (
            <p className="text-sm text-muted-foreground">
              Nessun obiettivo configurato.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
