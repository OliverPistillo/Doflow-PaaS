"use client";
/* eslint-disable @typescript-eslint/no-unused-expressions */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BellRing,
  CalendarClock,
  FileCheck2,
  FilePenLine,
  FileSignature,
  Plus,
  Repeat2,
  Search,
  Send,
  ShieldCheck,
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  contractSendMethods,
  contractStatuses,
  renewalStatuses,
  type CommercialContract,
  type CommercialRenewal,
} from "@/features/commercial/commercial-commerce";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import { RecordCollaborationPanel } from "@/features/commercial/components/record-collaboration-panel";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

export type ContractRenewalSection = "contratti" | "rinnovi";
const money = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
const displayDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
        new Date(value.length === 10 ? `${value}T12:00:00` : value),
      )
    : "—";

function Kpi({
  label,
  value,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: string;
  icon: typeof FileSignature;
  tone?: "muted" | "warning" | "success";
}) {
  const color =
    tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground";
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Icon className={`size-4 ${color}`} aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ContractRenewalOperationsPage({
  section,
}: {
  section: ContractRenewalSection;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedContract, setSelectedContract] =
    useState<CommercialContract>();
  const [selectedRenewal, setSelectedRenewal] = useState<CommercialRenewal>();
  const [sendContract, setSendContract] = useState<CommercialContract>();
  const canManageContracts = identity.hasCapability("canManageOwnContracts");
  const canManageRenewals = identity.hasCapability("canManageOwnRenewals");
  const canManageRules = identity.hasCapability("canManageCommerceRules");
  const canViewValues = identity.hasCapability("canViewCommercialValues");
  const contracts = useMemo(
    () =>
      store.contracts
        .filter(
          (item) =>
            (status === "all" || item.status === status) &&
            match(
              query,
              item.code,
              item.title,
              item.signatoryName,
              store.customers.find(
                (customer) => customer.id === item.customerId,
              )?.profile.company,
            ),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [query, status, store.contracts, store.customers],
  );
  const renewals = useMemo(
    () =>
      store.renewals
        .filter(
          (item) =>
            (status === "all" || item.status === status) &&
            match(
              query,
              item.planName,
              item.nextDueAt,
              store.customers.find(
                (customer) => customer.id === item.customerId,
              )?.profile.company,
            ),
        )
        .sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt)),
    [query, status, store.customers, store.renewals],
  );
  const signed = store.contracts.filter(
    (item) => item.status === "Firmato",
  ).length;
  const waiting = store.contracts.filter(
    (item) => item.status === "In attesa di firma",
  ).length;
  const expiring = store.renewals.filter((item) =>
    ["In scadenza", "Da rinnovare", "Promemoria inviato"].includes(item.status),
  ).length;
  const annual = store.renewals
    .filter(
      (item) =>
        item.recurrence === "annual" &&
        !["Annullato", "Scaduto"].includes(item.status),
    )
    .reduce((sum, item) => sum + item.priceSnapshot, 0);
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            Vendite e amministrazione
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {section === "contratti" ? "Contratti" : "Rinnovi"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {section === "contratti"
              ? "Versioni, invii registrati, firma e collegamenti operativi."
              : "Piani ricorrenti, scadenze e ordini annuali idempotenti."}
          </p>
        </div>
        {section === "contratti" && canManageContracts && (
          <Button
            onClick={async () => {
              const order = store.orders.find(
                (item) =>
                  !store.contracts.some(
                    (contract) =>
                      contract.orderId === item.id &&
                      contract.status !== "Sostituito",
                  ),
              );
              if (!order)
                return toast.info(
                  "Tutti gli ordini visibili hanno già un contratto attivo.",
                );
              const result = await store.generateContract(order.id);
              result.ok
                ? toast.success(
                    result.existing
                      ? "Contratto già presente."
                      : "Contratto preparato.",
                  )
                : toast.error(result.message);
            }}
          >
            <Plus />
            Genera dal prossimo ordine
          </Button>
        )}
      </header>
      <nav
        className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1"
        aria-label="Contratti e rinnovi"
      >
        <Button
          asChild
          variant={section === "contratti" ? "secondary" : "ghost"}
        >
          <Link href="/dashboard/contratti">Contratti</Link>
        </Button>
        <Button asChild variant={section === "rinnovi" ? "secondary" : "ghost"}>
          <Link href="/dashboard/rinnovi">Rinnovi</Link>
        </Button>
      </nav>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {section === "contratti" ? (
          <>
            <Kpi
              label="Contratti attivi"
              value={String(
                store.contracts.filter(
                  (item) => !["Sostituito", "Archiviato"].includes(item.status),
                ).length,
              )}
              icon={FileSignature}
            />
            <Kpi
              label="In attesa di firma"
              value={String(waiting)}
              icon={CalendarClock}
              tone={waiting ? "warning" : "muted"}
            />
            <Kpi
              label="Firmati"
              value={String(signed)}
              icon={FileCheck2}
              tone="success"
            />
            <Kpi
              label="Ordini senza contratto"
              value={String(
                store.orders.filter(
                  (order) =>
                    !store.contracts.some(
                      (contract) =>
                        contract.orderId === order.id &&
                        !contract.archivedAt &&
                        contract.status !== "Sostituito",
                    ),
                ).length,
              )}
              icon={ShieldCheck}
              tone="warning"
            />
          </>
        ) : (
          <>
            <Kpi
              label="Rinnovi attivi"
              value={String(
                store.renewals.filter(
                  (item) => !["Annullato", "Scaduto"].includes(item.status),
                ).length,
              )}
              icon={Repeat2}
            />
            <Kpi
              label="In scadenza"
              value={String(expiring)}
              icon={CalendarClock}
              tone={expiring ? "warning" : "muted"}
            />
            <Kpi
              label="Promemoria"
              value={String(
                store.renewals.filter(
                  (item) => item.status === "Promemoria inviato",
                ).length,
              )}
              icon={BellRing}
            />
            <Kpi
              label="Valore ricorrente"
              value={canViewValues ? money.format(annual) : "Riservato"}
              icon={Repeat2}
              tone="success"
            />
          </>
        )}
      </section>
      {canManageRules && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Regole di avvio progetto
            </CardTitle>
            <CardDescription>
              Configurazione amministrativa applicata dal provider, anche oltre
              i controlli UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6">
            <RuleCheckbox
              label="Richiedi contratto firmato"
              checked={store.commerceSettings.requireSignedContractForProject}
              onChange={(checked) =>
                store.updateCommerceSettings({
                  requireSignedContractForProject: checked,
                })
              }
            />
            <RuleCheckbox
              label="Richiedi acconto registrato"
              checked={store.commerceSettings.requireDepositForProject}
              onChange={(checked) =>
                store.updateCommerceSettings({
                  requireDepositForProject: checked,
                })
              }
            />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Cerca ${section}…`}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {(section === "contratti"
                ? contractStatuses
                : renewalStatuses
              ).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {section === "contratti" ? (
        <ContractTable
          items={contracts}
          canManage={canManageContracts}
          store={store}
          onOpen={setSelectedContract}
          onSend={setSendContract}
        />
      ) : (
        <RenewalTable
          items={renewals}
          canManage={canManageRenewals}
          canViewValues={canViewValues}
          store={store}
          onOpen={setSelectedRenewal}
        />
      )}
      {selectedContract && (
        <ContractDetail
          contract={selectedContract}
          open
          onOpenChange={(open) => !open && setSelectedContract(undefined)}
        />
      )}
      {selectedRenewal && (
        <RenewalDetail
          renewal={selectedRenewal}
          open
          onOpenChange={(open) => !open && setSelectedRenewal(undefined)}
          canViewValues={canViewValues}
        />
      )}
      {sendContract && (
        <ContractSendDialog
          contract={sendContract}
          open
          onOpenChange={(open) => !open && setSendContract(undefined)}
        />
      )}
    </main>
  );
}

function RuleCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = label.replaceAll(" ", "-");
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
function TableShell({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
        {empty && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nessun record autorizzato corrisponde ai filtri.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
function ContractTable({
  items,
  canManage,
  store,
  onOpen,
  onSend,
}: {
  items: CommercialContract[];
  canManage: boolean;
  store: ReturnType<typeof useCommercialLeads>;
  onOpen: (item: CommercialContract) => void;
  onSend: (item: CommercialContract) => void;
}) {
  const identity = useDoflowIdentity();
  const commercialTeam = useCommercialTeam();
  return (
    <TableShell empty={!items.length}>
      <table className="w-full min-w-[1120px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {[
              "Contratto",
              "Cliente",
              "Ordine",
              "Versione",
              "Stato",
              "Firma entro",
              "Invii",
              "Operatore",
              "Azioni",
            ].map((label) => (
              <th key={label} className="px-4 py-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const canManageItem =
              canManage &&
              (identity.hasCapability("canViewAllLeads") ||
                item.salespersonId === identity.currentUser.id);
            return (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <b>{item.code}</b>
                  <span className="block max-w-xs truncate text-xs text-muted-foreground">
                    {item.title}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {store.customers.find(
                    (customer) => customer.id === item.customerId,
                  )?.profile.company ?? "Cliente autorizzato"}
                </td>
                <td className="px-4 py-3">
                  {store.orders.find((order) => order.id === item.orderId)
                    ?.code ?? "—"}
                </td>
                <td className="px-4 py-3">v{item.version}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      item.status === "Firmato" ? "secondary" : "outline"
                    }
                  >
                    {item.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {displayDate(item.signatureDueAt)}
                </td>
                <td className="px-4 py-3">{item.sendHistory.length}</td>
                <td className="px-4 py-3">
                  {commercialTeam.find(
                    (member) => member.id === item.operatorId,
                  )?.name ?? item.operatorId}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <RecordCollaborationPanel
                      recordType="contract"
                      recordId={item.id}
                      label={item.code}
                      compact
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpen(item)}
                    >
                      Dettagli
                    </Button>
                    {canManageItem &&
                      !["Firmato", "Sostituito", "Archiviato"].includes(
                        item.status,
                      ) && (
                        <Button size="sm" onClick={() => onSend(item)}>
                          <Send />
                          Invia
                        </Button>
                      )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}
function RenewalTable({
  items,
  canManage,
  canViewValues,
  store,
  onOpen,
}: {
  items: CommercialRenewal[];
  canManage: boolean;
  canViewValues: boolean;
  store: ReturnType<typeof useCommercialLeads>;
  onOpen: (item: CommercialRenewal) => void;
}) {
  const identity = useDoflowIdentity();
  const commercialTeam = useCommercialTeam();
  return (
    <TableShell empty={!items.length}>
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {[
              "Piano",
              "Cliente",
              "Scadenza",
              "Prezzo rinnovo",
              "Responsabile",
              "Stato",
              "Ordine rinnovo",
              "Azioni",
            ].map((label) => (
              <th key={label} className="px-4 py-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const canManageItem =
              canManage &&
              (identity.hasCapability("canViewAllLeads") ||
                item.salespersonId === identity.currentUser.id);
            return (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <b>{item.planName}</b>
                  <span className="block text-xs text-muted-foreground">
                    {item.recurrence === "annual" ? "Annuale" : "Mensile"} ·{" "}
                    {item.renewalRequired ? "obbligatorio" : "facoltativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {store.customers.find(
                    (customer) => customer.id === item.customerId,
                  )?.profile.company ?? "Cliente autorizzato"}
                </td>
                <td className="px-4 py-3">{displayDate(item.nextDueAt)}</td>
                <td className="px-4 py-3 font-medium">
                  {canViewValues
                    ? money.format(item.priceSnapshot)
                    : "Riservato"}
                </td>
                <td className="px-4 py-3">
                  {commercialTeam.find((member) => member.id === item.ownerId)
                    ?.name ?? item.ownerId}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      item.status === "Pagato" || item.status === "Attivo"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {item.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {store.orders.find(
                    (order) => order.id === item.renewalOrderId,
                  )?.code ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <RecordCollaborationPanel
                      recordType="renewal"
                      recordId={item.id}
                      label={item.planName}
                      compact
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpen(item)}
                    >
                      Dettagli
                    </Button>
                    {canManageItem && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          const result = await store.generateRenewalOrder(
                            item.id,
                          );
                          result.ok
                            ? toast.success(
                                result.existing
                                  ? "Ordine e attività già presenti."
                                  : "Ordine e attività di rinnovo creati.",
                              )
                            : toast.error(result.message);
                        }}
                      >
                        Genera ordine
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}

function ContractDetail({
  contract,
  open,
  onOpenChange,
}: {
  contract: CommercialContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const live =
    store.contracts.find((item) => item.id === contract.id) ?? contract;
  const canManage =
    identity.hasCapability("canManageOwnContracts") &&
    (identity.hasCapability("canViewAllLeads") ||
      live.salespersonId === identity.currentUser.id);
  async function save(formData: FormData) {
    const ok = await store.updateContract(live.id, {
      title: String(formData.get("title")),
      signatoryName: String(formData.get("signatoryName")),
      signatureDueAt: String(formData.get("signatureDueAt")) || undefined,
      documentName: String(formData.get("documentName")) || undefined,
      documentReference: String(formData.get("documentReference")) || undefined,
      notes: String(formData.get("notes")),
      visibility: String(
        formData.get("visibility"),
      ) as CommercialContract["visibility"],
    });
    ok
      ? toast.success("Contratto aggiornato.")
      : toast.info("Nessuna modifica salvata.");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{live.code}</DialogTitle>
          <DialogDescription>
            Metadati documentali: nessuna firma elettronica o spedizione esterna
            reale.
          </DialogDescription>
        </DialogHeader>
        <form action={save} className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Titolo"
            name="title"
            defaultValue={live.title}
            disabled={!canManage}
          />
          <Field
            label="Firmatario"
            name="signatoryName"
            defaultValue={live.signatoryName}
            disabled={!canManage}
          />
          <Field
            label="Scadenza firma"
            name="signatureDueAt"
            type="date"
            defaultValue={live.signatureDueAt?.slice(0, 10)}
            disabled={!canManage}
          />
          <SelectField
            label="Visibilità"
            name="visibility"
            defaultValue={live.visibility}
            options={["internal", "client"]}
            labels={{ internal: "Solo interna", client: "Visibile al cliente" }}
            disabled={!canManage}
          />
          <Field
            label="Nome documento"
            name="documentName"
            defaultValue={live.documentName}
            disabled={!canManage}
          />
          <Field
            label="Riferimento documento"
            name="documentReference"
            defaultValue={live.documentReference}
            disabled={!canManage}
          />
          <div className="sm:col-span-2">
            <Label htmlFor="contract-notes">Note</Label>
            <Textarea
              id="contract-notes"
              name="notes"
              defaultValue={live.notes}
              disabled={!canManage}
            />
          </div>
          <section className="space-y-2 sm:col-span-2">
            <h3 className="font-medium">Storico invii</h3>
            {live.sendHistory.length ? (
              live.sendHistory.map((attempt) => (
                <div key={attempt.id} className="rounded-md border p-3 text-sm">
                  <b>{attempt.kind}</b> · {attempt.method} ·{" "}
                  {displayDate(attempt.sentAt)}
                  <p className="text-xs text-muted-foreground">
                    {attempt.note || "Nessuna nota"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessun invio registrato.
              </p>
            )}
          </section>
          <DialogFooter className="flex-wrap sm:col-span-2">
            {canManage && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const result = await store.createContractVersion(live.id);
                    result.ok
                      ? toast.success(
                          result.existing
                            ? "Versione già presente."
                            : "Nuova versione preparata.",
                        )
                      : toast.error(result.message);
                  }}
                >
                  <FilePenLine />
                  Nuova versione
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (await store.markContractSigned(live.id))
                      toast.success("Firma registrata internamente.");
                  }}
                >
                  <FileCheck2 />
                  Registra firma interna
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    if (await store.archiveContract(live.id)) {
                      toast.success("Contratto archiviato.");
                      onOpenChange(false);
                    }
                  }}
                >
                  <Archive />
                  Archivia
                </Button>
                <Button type="submit">Salva</Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function RenewalDetail({
  renewal,
  open,
  onOpenChange,
  canViewValues,
}: {
  renewal: CommercialRenewal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canViewValues: boolean;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const commercialTeam = useCommercialTeam();
  const live = store.renewals.find((item) => item.id === renewal.id) ?? renewal;
  const canManage =
    identity.hasCapability("canManageOwnRenewals") &&
    (identity.hasCapability("canViewAllLeads") ||
      live.salespersonId === identity.currentUser.id);
  async function save(formData: FormData) {
    const ok = await store.updateRenewal(live.id, {
      nextDueAt: new Date(
        `${String(formData.get("nextDueAt"))}T12:00:00`,
      ).toISOString(),
      mode: String(formData.get("mode")) as CommercialRenewal["mode"],
      ownerId: String(formData.get("ownerId")),
      status: String(formData.get("status")) as CommercialRenewal["status"],
    });
    ok
      ? toast.success("Rinnovo aggiornato.")
      : toast.info("Nessuna modifica salvata.");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{live.planName}</DialogTitle>
          <DialogDescription>
            Snapshot storico{" "}
            {canViewValues ? money.format(live.priceSnapshot) : "riservato"}; le
            modifiche al catalogo non lo alterano.
          </DialogDescription>
        </DialogHeader>
        <form action={save} className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Prossima scadenza"
            name="nextDueAt"
            type="date"
            defaultValue={live.nextDueAt.slice(0, 10)}
            disabled={!canManage}
          />
          <SelectField
            label="Gestione"
            name="mode"
            defaultValue={live.mode}
            options={["manual", "automatic"]}
            labels={{
              manual: "Manuale",
              automatic: "Automatica (solo pianificazione)",
            }}
            disabled={!canManage}
          />
          <SelectField
            label="Responsabile"
            name="ownerId"
            defaultValue={live.ownerId}
            options={commercialTeam.map((member) => member.id)}
            labels={Object.fromEntries(
              commercialTeam.map((member) => [member.id, member.name]),
            )}
            disabled={!canManage}
          />
          <SelectField
            label="Stato"
            name="status"
            defaultValue={live.status}
            options={renewalStatuses.filter((status) => status !== "Pagato")}
            disabled={!canManage}
          />
          <section className="space-y-2 sm:col-span-2">
            <h3 className="font-medium">Contenuti inclusi</h3>
            <p className="text-sm text-muted-foreground">
              {live.includedSnapshot.join(" · ") ||
                "Nessun contenuto specificato"}
            </p>
            <h3 className="pt-2 font-medium">Storico</h3>
            {live.history.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3 text-sm">
                <b>{entry.kind}</b> · {displayDate(entry.date)}
                <p className="text-xs text-muted-foreground">{entry.detail}</p>
              </div>
            ))}
          </section>
          <DialogFooter className="flex-wrap sm:col-span-2">
            {canManage && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const result = await store.sendRenewalReminder(live.id);
                    result.ok
                      ? toast.success(
                          result.existing
                            ? "Promemoria già presente."
                            : "Promemoria operativo creato.",
                        )
                      : toast.error(result.message);
                  }}
                >
                  <BellRing />
                  Promemoria
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    if (await store.archiveRenewal(live.id)) {
                      toast.success("Rinnovo archiviato.");
                      onOpenChange(false);
                    }
                  }}
                >
                  <Archive />
                  Archivia
                </Button>
                <Button type="submit">Salva</Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function ContractSendDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: CommercialContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useCommercialLeads();
  async function submit(formData: FormData) {
    const result = await store.sendContract(contract.id, {
      method: String(
        formData.get("method"),
      ) as CommercialContract["sendHistory"][number]["method"],
      kind: String(formData.get("kind")) as "invio" | "reinvio" | "promemoria",
      note: String(formData.get("note")),
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Tentativo registrato; nessun invio esterno eseguito.");
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registra invio {contract.code}</DialogTitle>
          <DialogDescription>
            Registra il tentativo nella Timeline. Gli adapter esterni non
            configurati restituiscono un errore esplicito.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <SelectField
            label="Operazione"
            name="kind"
            defaultValue={contract.sendHistory.length ? "reinvio" : "invio"}
            options={["invio", "reinvio", "promemoria"]}
          />
          <SelectField
            label="Metodo"
            name="method"
            defaultValue="Email"
            options={[...contractSendMethods]}
          />
          <div>
            <Label htmlFor="send-note">Nota</Label>
            <Textarea id="send-note" name="note" />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit">
              <Send />
              Registra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
function SelectField({
  label,
  name,
  defaultValue,
  options,
  labels,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: string[];
  labels?: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select
        name={name}
        defaultValue={defaultValue ?? options[0]}
        disabled={disabled}
      >
        <SelectTrigger id={name} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels?.[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabled && (
        <input type="hidden" name={name} value={defaultValue ?? options[0]} />
      )}
    </div>
  );
}
function match(query: string, ...values: Array<string | undefined>) {
  const normalized = query.trim().toLocaleLowerCase("it-IT");
  return (
    !normalized ||
    values
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("it-IT")
      .includes(normalized)
  );
}
