"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  GripVertical,
  Medal,
  ListFilter,
  Plus,
  Scale,
  Search,
  Trophy,
  UsersRound,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import {
  rankingHistory,
  rankingMetricLabels,
  rankingRoleLabels,
} from "@/features/commercial/commercial-rankings";
import { CommercialPipelineBoard } from "@/features/commercial/components/commercial-pipeline-board";
import { CommercialPointsButton } from "@/features/commercial/components/commercial-points-panel";
import { GuidedCallAnalytics } from "@/features/commercial/components/guided-call-sheet";
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges";
import {
  type CommercialAppointment,
  type RankingConfig,
  type RankingRole,
} from "@/features/commercial/components/commercial-leads-provider";
import type { PointPolicy } from "@/features/commercial/commercial-collaboration";
import { pipelineStages } from "@/features/commercial/data/commercial-fixtures";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import type {
  CommercialLead,
  PipelineStage,
  TeamMember,
} from "@/features/commercial/types";
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial";
import { performanceApi, type RankingPreview } from "@/lib/tenant-performance-api";

const money = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
function formatWorkspaceDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed);
}
const shortDate = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});
const roles: RankingRole[] = [
  "commercial",
  "developer",
  "project_manager",
  "support",
];

function nextPeriod(period: string) {
  const date = new Date(`${period}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}
function localDateValue(value: string | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function localTimeValue(value: string | Date) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function stageLabel(stage: PipelineStage) {
  return pipelineStages.find((item) => item.id === stage)?.label ?? stage;
}
function ownerName(id: string, commercialTeam: TeamMember[]) {
  return commercialTeam.find((member) => member.id === id)?.name ?? id;
}

const podiumTone: Record<number, string> = {
  1: "border-[#D4A72C]/60 bg-[#D4A72C]/10 dark:bg-[#D4A72C]/15",
  2: "border-slate-400/60 bg-slate-400/10 dark:bg-slate-300/10",
  3: "border-orange-700/45 bg-orange-700/10 dark:bg-orange-500/10",
};

export function CommercialRankingsPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { store, identity } = useAuthorizedCommercial();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [rulesRole, setRulesRole] = useState<RankingRole>();
  const [expanded, setExpanded] = useState(false);
  const administrator = identity.hasCapability("canManageRankings");
  const defaultRole: RankingRole = identity.currentUser.roles.includes(
    "commercial",
  )
    ? "commercial"
    : identity.currentUser.roles.includes("web_developer")
      ? "developer"
      : identity.currentUser.roles.includes("project_manager")
        ? "project_manager"
        : "support";
  const [serverRows, setServerRows] = useState<Partial<Record<RankingRole, RankingPreview["rows"]>>>({});

  useEffect(() => {
    let active = true;
    const requestedRoles = compact ? [defaultRole] : roles;
    void Promise.all(requestedRoles.map(async (role) => [role, (await performanceApi.previewRanking(period, role)).rows] as const))
      .then((entries) => { if (active) setServerRows(Object.fromEntries(entries)); })
      .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Classifica non disponibile"); });
    return () => { active = false; };
  }, [compact, defaultRole, period]);

  if (compact && expanded) return <CommercialRankingsPanel />;
  const visibleRoles = compact ? [defaultRole] : roles;
  return (
    <Card id="classifiche" className="min-w-0 overflow-hidden">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-5 text-[#D4A72C]" />
              Classifiche mensili
            </CardTitle>
            <CardDescription>
              Risultati reali del periodo. I badge premio vengono assegnati
              soltanto dopo il consolidamento.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <CommercialPointsButton />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRulesRole(defaultRole)}
            >
              <Scale />
              Regolamento classifica
            </Button>
            {!compact && (
              <Input
                aria-label="Periodo classifiche"
                type="month"
                className="w-40"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          key={`${identity.currentUser.id}-${expanded}`}
          defaultValue={defaultRole}
        >
          <TabsList
            className={`grid h-auto w-full grid-cols-2 gap-1 ${visibleRoles.length > 2 ? "sm:grid-cols-4" : ""}`}
          >
            {visibleRoles.map((role) => (
              <TabsTrigger key={role} value={role}>
                {rankingRoleLabels[role]}
              </TabsTrigger>
            ))}
          </TabsList>
          {visibleRoles.map((role) => {
            const config =
              store.rankingConfigs.find((item) => item.role === role) ??
              { role, metrics: [] };
            const weightTotal = config.metrics.reduce(
              (sum, metric) => sum + metric.weight,
              0,
            );
            const rows = serverRows[role] ?? [];
            const visibleRows = (
              administrator
                ? rows
                : rows.filter((row) => row.userId === identity.currentUser.id)
            ).slice(0, compact ? 3 : undefined);
            const currentPeriod =
              period === new Date().toISOString().slice(0, 7);
            const consolidated = store.rankingSnapshots.some(
              (snapshot) =>
                snapshot.period === period &&
                snapshot.role === role &&
                snapshot.status !== "revoked",
            );
            return (
              <TabsContent key={role} value={role} className="space-y-4 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={consolidated ? "secondary" : "outline"}>
                    {consolidated
                      ? "Classifica consolidata"
                      : "Classifica provvisoria"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRulesRole(role)}
                  >
                    <Scale />
                    Regolamento
                  </Button>
                </div>
                <div className="grid items-end gap-3 md:grid-cols-3">
                  {visibleRows.slice(0, 3).map((row, index) => {
                    const history = rankingHistory(
                      row.userId,
                      role,
                      store.rankingSnapshots,
                    );
                    const primaryMetric = config.metrics.find(
                      (metric) => metric.weight > 0,
                    );
                    const actualPosition = row.position;
                    return (
                      <article
                        key={row.userId}
                        className={`relative rounded-xl border p-4 text-center ${podiumTone[actualPosition] ?? "bg-card"} ${index === 0 ? "md:order-2 md:min-h-48" : index === 1 ? "md:order-1" : "md:order-3"}`}
                      >
                        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-background/80 shadow-sm">
                          <UserAvatar
                            userId={row.userId}
                            name={row.name}
                            className="size-10"
                          />
                        </div>
                        <div className="flex justify-center gap-1">
                          {!row.tied && actualPosition <= 3 ? (
                            <Medal
                              className={`size-5 ${actualPosition === 1 ? "text-[#D4A72C]" : actualPosition === 2 ? "text-slate-400" : "text-orange-700 dark:text-orange-400"}`}
                            />
                          ) : null}
                          <Badge variant="outline">
                            {row.tied ? "Pari merito" : `#${actualPosition}`}
                          </Badge>
                        </div>
                        <h3 className="mt-2 font-semibold">{row.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {rankingRoleLabels[role]}
                        </p>
                        <p className="mt-3 text-2xl font-semibold tabular-nums">
                          {row.score.toFixed(2)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            /100
                          </span>
                        </p>
                        {primaryMetric && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {rankingMetricLabels[primaryMetric.metric]}:{" "}
                            <strong>
                              {row.metrics[primaryMetric.metric] ?? 0}
                            </strong>
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap justify-center gap-1">
                          <RankingWinnerBadges
                            userId={row.userId}
                            roles={[role]}
                          />
                          <span className="text-[11px] text-muted-foreground">
                            {history.totalWins} vittorie · serie{" "}
                            {history.currentStreak}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!visibleRows.length && (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nessun risultato reale nel periodo selezionato.
                  </p>
                )}
                {!compact && visibleRows.length > 3 && (
                  <div className="divide-y rounded-lg border">
                    {visibleRows.slice(3).map((row) => (
                      <div
                        key={row.userId}
                        className="flex items-center gap-3 p-3"
                      >
                        <Badge variant="outline">#{row.position}</Badge>
                        <UserAvatar
                          userId={row.userId}
                          name={row.name}
                          className="size-8"
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {row.name}
                        </span>
                        {row.tied && (
                          <Badge variant="outline">Pari merito</Badge>
                        )}
                        <strong className="tabular-nums">
                          {row.score.toFixed(2)} pt
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
                {administrator && !compact && (
                  <Button
                    variant="outline"
                    disabled={
                      currentPeriod ||
                      weightTotal !== 100 ||
                      !rows.some((row) => row.score > 0) ||
                      consolidated
                    }
                    onClick={async () => {
                      if (rows.length && (await store.saveRankingSnapshot({ period, role })))
                        toast.success(
                          `Classifica ${rankingRoleLabels[role]} consolidata; badge valido da ${nextPeriod(period)}`,
                        );
                    }}
                  >
                    Consolida periodo chiuso
                  </Button>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
        {compact && (
          <Button
            className="mt-3 w-full"
            variant="ghost"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Riduci classifica" : "Vedi classifica completa"}
            <ArrowRight />
          </Button>
        )}
      </CardContent>
      <Dialog
        open={Boolean(rulesRole)}
        onOpenChange={(open) => !open && setRulesRole(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regolamento classifica</DialogTitle>
            <DialogDescription>
              Formula trasparente per{" "}
              {rankingRoleLabels[rulesRole ?? defaultRole]}. I pesi si
              modificano esclusivamente dalle Impostazioni.
            </DialogDescription>
          </DialogHeader>
          <RankingRulesContent
            role={rulesRole ?? defaultRole}
            config={
              store.rankingConfigs.find(
                (item) => item.role === (rulesRole ?? defaultRole),
              ) ??
              { role: rulesRole ?? defaultRole, metrics: [] }
            }
            pointPolicy={store.pointPolicy}
            lastConsolidation={
              store.rankingSnapshots
                .filter(
                  (snapshot) =>
                    snapshot.role === (rulesRole ?? defaultRole) &&
                    snapshot.status !== "revoked",
                )
                .sort((a, b) => b.computedAt.localeCompare(a.computedAt))[0]
                ?.computedAt
            }
            administrator={administrator}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RankingRulesContent({
  role,
  config,
  pointPolicy,
  lastConsolidation,
  administrator,
}: {
  role: RankingRole;
  config: RankingConfig;
  pointPolicy: PointPolicy;
  lastConsolidation?: string;
  administrator: boolean;
}) {
  const total = config.metrics.reduce((sum, metric) => sum + metric.weight, 0);
  return (
    <Tabs defaultValue="principles" className="min-w-0">
      <TabsList className="grid h-auto grid-cols-2 gap-1 sm:grid-cols-3">
        <TabsTrigger value="principles">Principi</TabsTrigger>
        <TabsTrigger value="points">Punti</TabsTrigger>
        <TabsTrigger value="ranking">Classifica</TabsTrigger>
        <TabsTrigger value="rewards">Premi</TabsTrigger>
        <TabsTrigger value="penalties">Penalità</TabsTrigger>
        <TabsTrigger value="approval">Approvazione</TabsTrigger>
      </TabsList>
      <div className="max-h-[58vh] overflow-y-auto pt-4">
        <TabsContent value="principles" className="space-y-2 text-sm">
          <p>
            <strong>Due misure distinte.</strong> I punti operativi sono
            movimenti reali del ledger e possono essere convertiti. Il punteggio
            classifica è normalizzato da 0 a 100 e serve soltanto al confronto
            mensile.
          </p>
          <p className="text-muted-foreground">
            Nessun badge nasce dal ruolo o da un record “Vinto”: il podio resta
            provvisorio fino al consolidamento del periodo chiuso.
          </p>
        </TabsContent>
        <TabsContent value="points" className="space-y-2 text-sm">
          <RuleRow
            label="Attività entro scadenza"
            value={pointPolicy.onTimeBase}
          />
          <RuleRow
            label="Anticipo di almeno 2 giorni"
            value={pointPolicy.earlyTwoDayBonus}
          />
          <RuleRow
            label="Anticipo di almeno 5 giorni"
            value={pointPolicy.earlyFiveDayBonus}
          />
          <RuleRow
            label="Urgente completata in tempo"
            value={pointPolicy.urgentOnTimeBonus}
          />
          <RuleRow
            label="QA al primo passaggio"
            value={pointPolicy.qaFirstPass}
          />
          <RuleRow
            label="Progetto consegnato"
            value={pointPolicy.deliveredProject}
          />
          <RuleRow
            label="Supporto approvato"
            value={pointPolicy.approvedSupport}
          />
          <RuleRow
            label="Appuntamento qualificato"
            value={pointPolicy.qualifiedAppointment}
          />
          <p className="text-xs text-muted-foreground">
            Gli incassi confermati assegnano{" "}
            {pointPolicy.collectedPerHundredEuro} punto/i ogni 100 €. I rimborsi
            sottraggono lo stesso valore nel mese effettivo.
          </p>
        </TabsContent>
        <TabsContent value="ranking" className="space-y-3">
          <div className="divide-y rounded-lg border">
            {config.metrics.map((metric) => (
              <div
                key={metric.metric}
                className="flex justify-between gap-3 p-2 text-sm"
              >
                <span>{rankingMetricLabels[metric.metric]}</span>
                <strong>{metric.weight}%</strong>
              </div>
            ))}
          </div>
          <p
            className={
              total === 100
                ? "text-sm text-emerald-600"
                : "text-sm text-destructive"
            }
          >
            Totale pesi: {total}%
          </p>
          <p className="text-xs text-muted-foreground">
            Ruolo: {rankingRoleLabels[role]}. Metriche normalizzate sul miglior
            risultato reale del periodo; pareggi mostrati in modo trasparente.
          </p>
        </TabsContent>
        <TabsContent value="rewards" className="space-y-2 text-sm">
          <RuleRow
            label="Soglia minima"
            value={pointPolicy.redemptionMinimumPoints}
          />
          <RuleRow
            label="Unità conversione"
            value={pointPolicy.redemptionPointsUnit}
          />
          <p>
            {pointPolicy.redemptionPointsUnit} punti corrispondono a{" "}
            {pointPolicy.redemptionEuroValue} € indicativi. Limite mensile:{" "}
            {pointPolicy.redemptionMonthlyMaximumPoints} pt. Scadenza:{" "}
            {pointPolicy.pointExpiryMonths} mesi.
          </p>
          <p className="text-xs text-muted-foreground">
            Il premio è un benefit interno soggetto ad approvazione, non denaro
            immediatamente disponibile né una transazione fiscale.
          </p>
        </TabsContent>
        <TabsContent value="penalties" className="space-y-2 text-sm">
          <RuleRow
            label="Lavoro respinto in QA"
            value={pointPolicy.qaRejected}
          />
          <RuleRow
            label="Prima riapertura"
            value={pointPolicy.firstReopenPenalty}
          />
          <RuleRow
            label="Seconda riapertura"
            value={pointPolicy.secondReopenPenalty}
          />
          <RuleRow
            label="SLA supporto superato"
            value={pointPolicy.supportSlaPenalty}
          />
          <RuleRow
            label="Correzione poi approvata"
            value={pointPolicy.correctionRecovery}
          />
          <p className="text-xs text-muted-foreground">
            Bonus, penalità e rettifiche manuali richiedono motivazione e
            autore. Uno storno aggiunge un movimento contrario e non riscrive
            l’originale.
          </p>
        </TabsContent>
        <TabsContent value="approval" className="space-y-2 text-sm">
          <p>
            I punti qualità restano provvisori finché un supervisore autorizzato
            approva il lavoro. Il collaboratore non può auto-approvarsi;
            l’override amministrativo richiede una motivazione.
          </p>
          <p>
            Le richieste premio seguono:{" "}
            <strong>in revisione → approvata/rifiutata → consegnata</strong>.
            Durante la revisione i punti sono bloccati.
          </p>
          <p className="text-xs text-muted-foreground">
            Ultimo consolidamento:{" "}
            {lastConsolidation
              ? dateTime.format(new Date(lastConsolidation))
              : "mai"}
            .
          </p>
          {administrator && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/impostazioni">
                Configura regole e pesi
              </Link>
            </Button>
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}

function RuleRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span>{label}</span>
      <strong className={value < 0 ? "text-red-600" : "text-emerald-600"}>
        {value > 0 ? "+" : ""}
        {value} pt
      </strong>
    </div>
  );
}

function LeadList({
  leads,
  showValues,
}: {
  leads: CommercialLead[];
  showValues: boolean;
}) {
  const commercialTeam = useCommercialTeam();
  const visible = leads.slice(0, 10);
  return (
    <Card className="overflow-hidden">
      <div className="hidden max-h-[520px] overflow-auto md:block">
        <Table className="min-w-[860px]">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Azienda</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Responsabile</TableHead>
              {showValues && <TableHead>Valore</TableHead>}
              <TableHead>Prossima azione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Link
                    className="font-medium hover:underline"
                    href={`/dashboard/commercial/leads/${lead.id}`}
                  >
                    {lead.firstName} {lead.lastName}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {lead.email}
                  </span>
                </TableCell>
                <TableCell>
                  {lead.company}
                  <span className="block text-xs text-muted-foreground">
                    {lead.service}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{stageLabel(lead.stage)}</Badge>
                </TableCell>
                <TableCell>
                  <span className="block">{ownerName(lead.assigneeId, commercialTeam)}</span>
                  <RankingWinnerBadges
                    userId={lead.assigneeId}
                    compact
                    className="mt-1"
                  />
                </TableCell>
                {showValues && (
                  <TableCell>{money.format(lead.value)}</TableCell>
                )}
                <TableCell>
                  {lead.nextAction}
                  <span className="block text-xs text-muted-foreground">
                    {formatWorkspaceDateTime(lead.nextActionAt)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 p-3 md:hidden">
        {visible.map((lead) => (
          <Link
            key={lead.id}
            href={`/dashboard/commercial/leads/${lead.id}`}
            className="rounded-lg border p-3"
          >
            <div className="flex justify-between gap-2">
              <strong>{lead.company}</strong>
              <Badge variant="secondary">{stageLabel(lead.stage)}</Badge>
            </div>
            <p className="text-sm">
              {lead.firstName} {lead.lastName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span>{ownerName(lead.assigneeId, commercialTeam)}</span>
              <RankingWinnerBadges userId={lead.assigneeId} compact />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {lead.nextAction} · {formatWorkspaceDateTime(lead.nextActionAt)}
            </p>
            {showValues && (
              <p className="mt-2 font-semibold">{money.format(lead.value)}</p>
            )}
          </Link>
        ))}
      </div>
      {!leads.length && (
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nessun lead con i filtri correnti.
        </CardContent>
      )}
      {leads.length > 10 && (
        <div className="border-t p-2 text-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/commercial/leads">
              Vedi tutti i lead <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
    </Card>
  );
}

function DeadlinesView({ leads }: { leads: CommercialLead[] }) {
  const commercialTeam = useCommercialTeam();
  const { activities } = useAuthorizedCommercial();
  const leadIds = new Set(leads.map((lead) => lead.id));
  const items = [
    ...leads
      .filter((lead) => lead.nextActionAt)
      .map((lead) => ({
        id: `lead-${lead.id}`,
        date: lead.nextActionAt,
        title: lead.nextAction,
        detail: `${lead.company} · ${ownerName(lead.assigneeId, commercialTeam)}`,
        href: `/dashboard/commercial/leads/${lead.id}`,
        type: "Prossima azione",
      })),
    ...activities
      .filter(
        ({ activity, customer }) =>
          leadIds.has(customer.sourceLeadId) &&
          ["Follow-up", "Chiamata", "Riunione", "Email", "WhatsApp"].includes(
            activity.type,
          ) &&
          activity.dueAt,
      )
      .map(({ activity, customer }) => ({
        id: `activity-${activity.id}`,
        date: activity.dueAt,
        title: activity.title,
        detail: `${customer.profile.company} · ${ownerName(activity.assigneeId, commercialTeam)}`,
        href: `/dashboard/attivita?activityId=${activity.id}`,
        type: "Attività commerciale",
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scadenze commerciali</CardTitle>
        <CardDescription>
          Follow-up, prossime azioni e attività in ordine cronologico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex flex-wrap items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
          >
            <div className="w-32 shrink-0 text-sm font-medium">
              {dateTime.format(new Date(item.date))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.detail}
              </p>
            </div>
            <Badge variant="outline">{item.type}</Badge>
          </Link>
        ))}
        {!items.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nessuna scadenza commerciale.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AppointmentCard({
  appointment,
  onEdit,
}: {
  appointment: CommercialAppointment;
  onEdit: () => void;
}) {
  const commercialTeam = useCommercialTeam();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: appointment.id });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-md border bg-card p-2 shadow-sm ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          aria-label={`Trascina ${appointment.title} per riprogrammare`}
          className="touch-none cursor-grab p-1 text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onEdit}
        >
          <strong className="block truncate text-sm">
            {appointment.title}
          </strong>
          <span className="text-xs text-muted-foreground">
            {localTimeValue(appointment.startsAt)} ·{" "}
            {ownerName(appointment.assigneeId, commercialTeam)}
          </span>
        </button>
      </div>
      <Badge className="mt-2" variant="outline">
        {appointment.status === "scheduled"
          ? "Pianificato"
          : appointment.status === "completed"
            ? "Completato"
            : appointment.status === "cancelled"
              ? "Annullato"
              : "No-show"}
      </Badge>
    </article>
  );
}

function DayColumn({
  day,
  appointments,
  onEdit,
}: {
  day: string;
  appointments: CommercialAppointment[];
  onEdit: (appointment: CommercialAppointment) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  return (
    <section
      ref={setNodeRef}
      className={`min-h-44 rounded-lg border p-2 ${isOver ? "border-primary bg-primary/5" : ""}`}
    >
      <h3 className="mb-2 text-sm font-medium capitalize">
        {shortDate.format(new Date(`${day}T12:00:00`))}
      </h3>
      <div className="space-y-2">
        {appointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            onEdit={() => onEdit(appointment)}
          />
        ))}
      </div>
    </section>
  );
}

function AppointmentsView({ leads }: { leads: CommercialLead[] }) {
  const commercialTeam = useCommercialTeam();
  const { store, customers, identity } = useAuthorizedCommercial();
  const filteredAppointments = store.appointments.filter((appointment) =>
    leads.some((lead) => lead.id === appointment.leadId),
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialAppointment>();
  const [form, setForm] = useState({
    title: "",
    leadId: leads[0]?.id ?? "",
    date: localDateValue(new Date()),
    time: "10:00",
    duration: "60",
    assigneeId: identity.currentUser.id,
    notes: "",
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return localDateValue(date);
  });
  const reset = () => {
    setEditing(undefined);
    setForm({
      title: "",
      leadId: leads[0]?.id ?? "",
      date: localDateValue(new Date()),
      time: "10:00",
      duration: "60",
      assigneeId: identity.currentUser.id,
      notes: "",
    });
  };
  const edit = (appointment: CommercialAppointment) => {
    setEditing(appointment);
    setForm({
      title: appointment.title,
      leadId: appointment.leadId,
      date: localDateValue(appointment.startsAt),
      time: localTimeValue(appointment.startsAt),
      duration: String(
        Math.max(
          15,
          (new Date(appointment.endsAt).getTime() -
            new Date(appointment.startsAt).getTime()) /
            60000,
        ),
      ),
      assigneeId: appointment.assigneeId,
      notes: appointment.notes ?? "",
    });
    setOpen(true);
  };
  const save = async () => {
    const lead = leads.find((item) => item.id === form.leadId);
    if (!lead || !form.title.trim()) return;
    const startsAt = new Date(`${form.date}T${form.time}:00`).toISOString();
    const endsAt = new Date(
      new Date(startsAt).getTime() + Number(form.duration) * 60000,
    ).toISOString();
    if (editing)
      await store.updateAppointment(editing.id, {
        title: form.title.trim(),
        leadId: lead.id,
        customerId: customers.find(
          (customer) => customer.sourceLeadId === lead.id,
        )?.id,
        startsAt,
        endsAt,
        assigneeId: form.assigneeId,
        notes: form.notes,
      });
    else {
      const customer = customers.find((item) => item.sourceLeadId === lead.id);
      const activityId = customer
        ? (await store.addCustomerActivity(customer.id, {
            title: form.title.trim(),
            description: "Attività collegata ad appuntamento commerciale.",
            type: "Riunione",
            status: "Da fare",
            priority: "Media",
            assigneeId: form.assigneeId,
            leadId: lead.id,
            dueAt: startsAt,
          }) ?? undefined)
        : undefined;
      await store.addAppointment({
        title: form.title.trim(),
        startsAt,
        endsAt,
        status: "scheduled",
        leadId: lead.id,
        customerId: customer?.id,
        assigneeId: form.assigneeId,
        activityId,
        notes: form.notes,
      });
    }
    toast.success(editing ? "Appuntamento aggiornato" : "Appuntamento creato");
    setOpen(false);
    reset();
  };
  const reschedule = (appointment: CommercialAppointment, day: string) => {
    const startsAt = new Date(
      `${day}T${localTimeValue(appointment.startsAt)}:00`,
    ).toISOString();
    const duration =
      new Date(appointment.endsAt).getTime() -
      new Date(appointment.startsAt).getTime();
    store.updateAppointment(appointment.id, {
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + duration).toISOString(),
    });
    toast.success("Appuntamento riprogrammato");
  };
  const onDragEnd = (event: DragEndEvent) => {
    const appointment = filteredAppointments.find(
      (item) => item.id === event.active.id,
    );
    const day = String(event.over?.id ?? "");
    if (
      appointment &&
      /^\d{4}-\d{2}-\d{2}$/.test(day) &&
      localDateValue(appointment.startsAt) !== day
    )
      reschedule(appointment, day);
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            reset();
            setOpen(true);
          }}
          disabled={!leads.length}
        >
          <Plus />
          Nuovo appuntamento
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day) => (
            <DayColumn
              key={day}
              day={day}
              appointments={filteredAppointments.filter(
                (appointment) => localDateValue(appointment.startsAt) === day,
              )}
              onEdit={edit}
            />
          ))}
        </div>
      </DndContext>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agenda completa</CardTitle>
          <CardDescription>
            Alternativa accessibile per mobile e tastiera.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...filteredAppointments]
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            .map((appointment) => (
              <div
                key={appointment.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{appointment.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateTime.format(new Date(appointment.startsAt))} ·{" "}
                    {ownerName(appointment.assigneeId, commercialTeam)}
                  </p>
                </div>
                <Select
                  value={localDateValue(appointment.startsAt)}
                  onValueChange={(day) => reschedule(appointment, day)}
                >
                  <SelectTrigger
                    aria-label={`Riprogramma ${appointment.title}`}
                    className="w-40"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {days.map((day) => (
                      <SelectItem key={day} value={day}>
                        {shortDate.format(new Date(`${day}T12:00:00`))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => edit(appointment)}
                >
                  Modifica
                </Button>
              </div>
            ))}
          {!filteredAppointments.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nessun appuntamento.
            </p>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica appuntamento" : "Nuovo appuntamento"}
            </DialogTitle>
            <DialogDescription>
              Collegato a lead, cliente, responsabile e attività quando
              disponibile.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="sm:col-span-2">
              Titolo
              <Input
                aria-label="Titolo appuntamento"
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </Label>
            <Label className="sm:col-span-2">
              Lead
              <Select
                disabled={Boolean(editing)}
                value={form.leadId}
                onValueChange={(leadId) => setForm({ ...form, leadId })}
              >
                <SelectTrigger aria-label="Lead appuntamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.company} · {lead.firstName} {lead.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Data
              <Input
                aria-label="Data appuntamento"
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm({ ...form, date: event.target.value })
                }
              />
            </Label>
            <Label>
              Ora
              <Input
                aria-label="Ora appuntamento"
                type="time"
                value={form.time}
                onChange={(event) =>
                  setForm({ ...form, time: event.target.value })
                }
              />
            </Label>
            <Label>
              Durata
              <Select
                value={form.duration}
                onValueChange={(duration) => setForm({ ...form, duration })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minuti</SelectItem>
                  <SelectItem value="60">60 minuti</SelectItem>
                  <SelectItem value="90">90 minuti</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Responsabile
              <Select
                disabled={!identity.hasCapability("canAssignLeads")}
                value={form.assigneeId}
                onValueChange={(assigneeId) => setForm({ ...form, assigneeId })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commercialTeam.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label className="sm:col-span-2">
              Note
              <Textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </Label>
            {editing && (
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {(
                  ["scheduled", "completed", "cancelled", "no_show"] as const
                ).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={editing.status === status ? "default" : "outline"}
                    onClick={() => {
                      store.updateAppointment(editing.id, { status });
                      setEditing({ ...editing, status });
                    }}
                  >
                    {status === "scheduled"
                      ? "Pianificato"
                      : status === "completed"
                        ? "Completato"
                        : status === "cancelled"
                          ? "Annullato"
                          : "No-show"}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            {editing && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (store.deleteAppointment(editing.id)) {
                    toast.success("Appuntamento eliminato");
                    setOpen(false);
                    reset();
                  }
                }}
              >
                Elimina appuntamento
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button
              disabled={!form.title.trim() || !form.leadId}
              onClick={save}
            >
              Salva appuntamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CommercialWorkspacePage() {
  const commercialTeam = useCommercialTeam();
  const { leads, identity, store } = useAuthorizedCommercial();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const filtered = useMemo(
    () =>
      leads.filter(
        (lead) =>
          (!query.trim() ||
            `${lead.firstName} ${lead.lastName} ${lead.company} ${lead.email}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())) &&
          (stage === "all" || lead.stage === stage) &&
          (assignee === "all" || lead.assigneeId === assignee),
      ),
    [assignee, leads, query, stage],
  );
  const showValues = identity.hasCapability("canViewCommercialValues");
  const today = new Date().toISOString().slice(0, 10);
  const appointmentsToday = store.appointments.filter(
    (item) =>
      filtered.some((lead) => lead.id === item.leadId) &&
      item.status === "scheduled" &&
      item.startsAt.slice(0, 10) === today,
  );
  const openQuotes = store.quotes.filter(
    (quote) =>
      !quote.archivedAt &&
      ["Bozza", "Inviato", "Visualizzato"].includes(quote.status) &&
      (!quote.leadId || filtered.some((lead) => lead.id === quote.leadId)),
  );
  const personalPayments = store.payments.filter(
    (payment) =>
      !payment.archivedAt &&
      payment.status === "Confermato" &&
      (identity.currentUser.roles.includes("administrator") ||
        payment.salespersonId === identity.currentUser.id),
  );
  const netCollected = personalPayments.reduce(
    (sum, payment) =>
      sum +
      (payment.type === "Rimborso"
        ? -Math.abs(payment.amount)
        : Math.abs(payment.amount)),
    0,
  );
  const paidOrderIds = new Set(
    personalPayments
      .filter((payment) => payment.type !== "Rimborso")
      .map((payment) => payment.orderId),
  );
  const conversion = filtered.length
    ? Math.round(
        (store.orders.filter(
          (order) => paidOrderIds.has(order.id) && !order.archivedAt,
        ).length /
          filtered.length) *
          100,
      )
    : 0;
  const overdueFollowups = filtered.filter(
    (lead) =>
      lead.nextActionAt &&
      lead.nextActionAt.slice(0, 10) < today &&
      !["won", "lost", "unqualified", "not-interested"].includes(lead.stage),
  );
  const noFirstContact = filtered.filter(
    (lead) => lead.createdAt === lead.lastContact || !lead.lastContact,
  );
  const urgent = [
    [
      "Senza primo contatto",
      noFirstContact.length,
      "/dashboard/commercial/leads",
    ],
    [
      "Follow-up scaduti",
      overdueFollowups.length,
      "/dashboard/commercial?view=deadlines",
    ],
    [
      "Appuntamenti oggi",
      appointmentsToday.length,
      "/dashboard/commercial?view=appointments",
    ],
    [
      "Proposte da preparare",
      openQuotes.filter((quote) => quote.status === "Bozza").length,
      "/dashboard/preventivi",
    ],
  ] as const;
  const kpis = [
    ["Lead assegnati / visibili", filtered.length],
    [
      "Contattati",
      filtered.filter(
        (lead) =>
          Boolean(lead.lastContact) && lead.lastContact !== lead.createdAt,
      ).length,
    ],
    [
      "Appuntamenti",
      store.appointments.filter(
        (item) =>
          filtered.some((lead) => lead.id === item.leadId) &&
          item.status === "scheduled",
      ).length,
    ],
    ["Proposte aperte", openQuotes.length],
    [
      showValues ? "Incassato reale" : "Incassato personale",
      money.format(netCollected),
    ],
    ["Conversione su pagamenti", `${conversion}%`],
  ] as const;
  return (
    <main className="@container/commercial mx-auto w-full max-w-[1440px] space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard commerciale</h1>
        <p className="text-sm text-muted-foreground">
          Priorità, risultati reali e workspace nello stesso perimetro
          autorizzato.
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="p-4">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Richiede attenzione</h2>
            <p className="text-xs text-muted-foreground">
              Azioni commerciali urgenti e realmente aperte.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {urgent.map(([label, value, href]) => (
            <Link
              key={label}
              href={href}
              className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/40"
            >
              <span className="text-sm">{label}</span>
              <Badge variant={value ? "destructive" : "secondary"}>
                {value}
              </Badge>
            </Link>
          ))}
        </div>
      </section>
      <CommercialRankingsPanel compact />
      <GuidedCallAnalytics />
      <Tabs defaultValue="list">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="list">
            <ListFilter />
            Lista
          </TabsTrigger>
          <TabsTrigger value="kanban">
            <UsersRound />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="deadlines">
            <Clock3 />
            Scadenze
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <CalendarDays />
            Appuntamenti
          </TabsTrigger>
        </TabsList>
        <Card className="mt-4">
          <CardContent className="flex flex-wrap gap-2 p-3">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Cerca nel commerciale"
                className="pl-9"
                placeholder="Cerca lead, azienda o email"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger
                aria-label="Filtra stato commerciale"
                className="w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {pipelineStages.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger
                aria-label="Filtra responsabile commerciale"
                className="w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i responsabili</SelectItem>
                {commercialTeam.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <TabsContent value="list" className="mt-4">
          <LeadList leads={filtered} showValues={showValues} />
        </TabsContent>
        <TabsContent value="kanban" className="mt-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Pipeline commerciale</CardTitle>
              <CardDescription>
                Trascina tra le fasi configurate o riordina nella stessa
                colonna. Su mobile usa il menu “Sposta in”.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <CommercialPipelineBoard visibleLeads={filtered} enhancedCards />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="deadlines" className="mt-4">
          <DeadlinesView leads={filtered} />
        </TabsContent>
        <TabsContent value="appointments" className="mt-4">
          <AppointmentsView leads={filtered} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
