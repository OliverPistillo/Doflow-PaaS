"use client";
/* eslint-disable @typescript-eslint/no-unused-expressions */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Boxes,
  CreditCard,
  FileCheck2,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  orderFinancialsFromServer,
  type CommercialOrder,
  type CommercialPayment,
  type CommercialSale,
  type CommercialService,
} from "@/features/commercial/commercial-commerce";
import {
  OrderFormDialog,
  PaymentFormDialog,
  SaleFormDialog,
  ServiceFormDialog,
} from "@/features/commercial/components/commerce-form-dialogs";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import {
  commerceApi,
  type CommerceEconomics,
} from "@/lib/tenant-commerce-api";

export type CommerceSection = "catalogo" | "vendite" | "ordini" | "pagamenti";
const sectionLabels: Record<
  CommerceSection,
  { title: string; description: string }
> = {
  catalogo: {
    title: "Catalogo servizi",
    description: "Offerta commerciale, condizioni e template di progetto.",
  },
  vendite: {
    title: "Vendite",
    description:
      "Trattative vinte e ricavi autorizzati, collegati a lead e clienti.",
  },
  ordini: {
    title: "Ordini",
    description:
      "Ordini, stato amministrativo e collegamento esplicito ai progetti.",
  },
  pagamenti: {
    title: "Pagamenti",
    description:
      "Registrazioni manuali, incassato e residuo. Nessuna transazione fiscale reale.",
  },
};
const money = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });

function formatCommerceDate(value?: string | Date | null) {
  if (!value) return "—";
  const parsed =
    value instanceof Date
      ? value
      : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? "—" : date.format(parsed);
}

type OperationsEconomics = CommerceEconomics & { invoiced: number };
const emptyEconomics: OperationsEconomics = {
  sold: 0,
  orderCount: 0,
  ordered: 0,
  invoiced: 0,
  grossCollected: 0,
  refunded: 0,
  netCollected: 0,
  residual: 0,
  openOrders: 0,
  payingCustomers: 0,
  trend: [],
};

export function CommerceOperationsPage({
  section,
}: {
  section: CommerceSection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState("recent");
  const [dialog, setDialog] = useState<
    "service" | "sale" | "order" | "payment" | null
  >(null);
  const [selected, setSelected] = useState<
    CommercialService | CommercialSale | CommercialOrder | CommercialPayment
  >();
  const [defaultOrderId, setDefaultOrderId] = useState<string>();
  const canManageCatalog = identity.hasCapability("canManageCatalog");
  const canManageSales = identity.hasCapability("canManageOwnSales");
  const canManageOrders = identity.hasCapability("canManageOwnOrders");
  const canManagePayments = identity.hasCapability("canManagePayments");
  const canManageContracts = identity.hasCapability("canManageOwnContracts");
  const canManageRenewals = identity.hasCapability("canManageOwnRenewals");
  const canViewValues = identity.hasCapability("canViewCommercialValues");
  const periodStart =
    period === "month"
      ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .slice(0, 10)
      : "";
  const [economics, setEconomics] =
    useState<OperationsEconomics>(emptyEconomics);
  const [economicsStatus, setEconomicsStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  useEffect(() => {
    if (!canViewValues) return;
    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) setEconomicsStatus("loading");
    }, 0);
    void commerceApi
      .economics(periodStart || undefined)
      .then((result) => {
        if (cancelled) return;
        setEconomics({ ...result, invoiced: result.ordered });
        setEconomicsStatus("loaded");
      })
      .catch((cause) => {
        if (cancelled) return;
        setEconomics(emptyEconomics);
        setEconomicsStatus("error");
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Dati economici non disponibili",
        );
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [canViewValues, periodStart]);
  const filteredSales = useMemo(
    () =>
      store.sales
        .filter(
          (sale) =>
            (!periodStart || sale.date >= periodStart) &&
            search(
              query,
              sale.dealId,
              sale.status,
              store.services.find((service) => service.id === sale.serviceId)
                ?.name,
              store.customers.find(
                (customer) => customer.id === sale.customerId,
              )?.profile.company,
              store.leads.find((lead) => lead.id === sale.leadId)?.company,
            ),
        )
        .sort((a, b) =>
          sort === "value" ? b.value - a.value : b.date.localeCompare(a.date),
        ),
    [
      periodStart,
      query,
      sort,
      store.customers,
      store.leads,
      store.sales,
      store.services,
    ],
  );
  const filteredOrders = useMemo(
    () =>
      store.orders
        .filter(
          (order) =>
            (!periodStart || order.orderDate >= periodStart) &&
            search(
              query,
              order.code,
              order.administrativeStatus,
              store.customers.find(
                (customer) => customer.id === order.customerId,
              )?.profile.company,
              ...order.items.map((item) => item.name),
            ),
        )
        .sort((a, b) =>
          sort === "value"
            ? b.total - a.total
            : b.orderDate.localeCompare(a.orderDate),
        ),
    [periodStart, query, sort, store.customers, store.orders],
  );
  const mineOnly =
    section === "pagamenti" && searchParams.get("scope") === "mine";
  const confirmedOnly =
    section === "pagamenti" && searchParams.get("status") === "confirmed";
  const netView = section === "pagamenti" && searchParams.get("net") === "true";
  const filteredPayments = useMemo(
    () =>
      store.payments
        .filter(
          (payment) =>
            (!mineOnly || payment.salespersonId === identity.currentUserId) &&
            (!confirmedOnly || payment.status === "Confermato") &&
            (!periodStart ||
              (payment.effectiveDate ?? payment.date) >= periodStart) &&
            search(
              query,
              payment.reference,
              payment.method,
              payment.type,
              payment.refundReason,
              store.orders.find((order) => order.id === payment.orderId)?.code,
            ),
        )
        .sort((a, b) =>
          sort === "value"
            ? b.amount - a.amount
            : (b.effectiveDate ?? b.date).localeCompare(
                a.effectiveDate ?? a.date,
              ),
        ),
    [
      confirmedOnly,
      identity.currentUserId,
      mineOnly,
      periodStart,
      query,
      sort,
      store.orders,
      store.payments,
    ],
  );
  const filteredServices = useMemo(
    () =>
      store.services
        .filter((service) =>
          search(
            query,
            service.name,
            service.category,
            service.description,
            service.status,
          ),
        )
        .sort((a, b) =>
          sort === "value"
            ? b.price - a.price
            : a.name.localeCompare(b.name, "it"),
        ),
    [query, sort, store.services],
  );
  const wonSales = filteredSales.filter((sale) => sale.status === "Vinta");
  const economicsLoading = economicsStatus === "loading";
  const personalNet = filteredPayments.reduce(
    (total, payment) =>
      total +
      (payment.type === "Rimborso"
        ? -Math.abs(payment.amount)
        : Math.abs(payment.amount)),
    0,
  );
  function create(kind: typeof dialog, orderId?: string) {
    setSelected(undefined);
    setDefaultOrderId(orderId);
    setDialog(kind);
  }
  function edit(
    kind: Exclude<typeof dialog, null>,
    item: NonNullable<typeof selected>,
  ) {
    setSelected(item);
    setDialog(kind);
  }
  function close() {
    setDialog(null);
    setSelected(undefined);
    setDefaultOrderId(undefined);
  }
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            Vendite e amministrazione
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {sectionLabels[section].title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sectionLabels[section].description}
          </p>
        </div>
        {section === "catalogo" && canManageCatalog && (
          <Button onClick={() => create("service")}>
            <Plus /> Nuovo servizio
          </Button>
        )}
        {section === "vendite" && canManageSales && (
          <Button onClick={() => create("sale")}>
            <Plus /> Nuova vendita
          </Button>
        )}
        {section === "ordini" && canManageOrders && (
          <Button onClick={() => create("order")}>
            <Plus /> Nuovo ordine
          </Button>
        )}
        {section === "pagamenti" && canManagePayments && (
          <Button onClick={() => create("payment")}>
            <Plus /> Nuovo pagamento
          </Button>
        )}
      </header>
      <CommerceNavigation section={section} />
      {section === "pagamenti" && (mineOnly || confirmedOnly || netView) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="mr-auto text-sm font-medium">
              Incassato netto personale:{" "}
              <strong className="tabular-nums">
                {money.format(personalNet)}
              </strong>
            </span>
            {mineOnly && <Badge variant="secondary">Solo i miei</Badge>}
            {confirmedOnly && (
              <Badge variant="secondary">Incassi confermati</Badge>
            )}
            {netView && (
              <Badge variant="secondary">Al netto dei rimborsi</Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setPeriod("all");
                setSort("recent");
                router.replace(pathname);
              }}
            >
              Azzera filtri
            </Button>
          </CardContent>
        </Card>
      )}
      {canViewValues && (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
            aria-busy={economicsLoading}
          >
            <Kpi
              label="Venduto"
              value={money.format(economics.sold)}
              icon={ShoppingCart}
            />
            <Kpi
              label="Fatturato"
              value={money.format(economics.invoiced)}
              icon={FileCheck2}
            />
            <Kpi
              label="Incassato lordo"
              value={money.format(economics.grossCollected)}
              icon={CreditCard}
            />
            <Kpi
              label="Rimborsato"
              value={money.format(economics.refunded)}
              icon={CreditCard}
            />
            <Kpi
              label="Incassato netto"
              value={money.format(economics.netCollected)}
              icon={Sparkles}
            />
            <Kpi
              label="Residuo"
              value={money.format(economics.residual)}
              icon={Boxes}
            />
          </section>
          {section === "vendite" && (
            <Breakdowns sales={wonSales} services={store.services} />
          )}
        </>
      )}
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Cerca in ${sectionLabels[section].title.toLocaleLowerCase("it-IT")}…`}
            />
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutto il periodo</SelectItem>
              <SelectItem value="month">Questo mese</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Più recenti</SelectItem>
              <SelectItem value="value">Valore maggiore</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {section === "catalogo" && (
        <CatalogTable
          items={filteredServices}
          canManage={canManageCatalog}
          onEdit={(item) => edit("service", item)}
          onArchive={async (item) => {
            if (await store.archiveService(item.id))
              toast.success("Servizio archiviato.");
          }}
          canViewValues={canViewValues}
        />
      )}
      {section === "vendite" && (
        <SalesTable
          items={filteredSales}
          store={store}
          canManage={canManageSales}
          onEdit={(item) => edit("sale", item)}
          onArchive={async (item) => {
            if (await store.archiveSale(item.id))
              toast.success("Vendita archiviata.");
          }}
          canViewValues={canViewValues}
        />
      )}
      {section === "ordini" && (
        <OrdersTable
          items={filteredOrders}
          store={store}
          canManage={canManageOrders}
          canManagePayments={canManagePayments}
          canManageContracts={canManageContracts}
          canManageRenewals={canManageRenewals}
          onEdit={(item) => edit("order", item)}
          onArchive={async (item) => {
            if (await store.archiveOrder(item.id))
              toast.success("Ordine archiviato.");
          }}
          onPayment={(item) => create("payment", item.id)}
          onProject={async (item) => {
            const result = await store.generateOrderProject(item.id);
            result.ok
              ? toast.success(
                  result.existing
                    ? "Progetto già collegato: nessun duplicato creato."
                    : "Progetto generato e collegato.",
                )
              : toast.error(result.message);
          }}
          canViewValues={canViewValues}
        />
      )}
      {section === "pagamenti" && (
        <PaymentsTable
          items={filteredPayments}
          store={store}
          canManage={canManagePayments}
          onEdit={(item) => edit("payment", item)}
          onArchive={async (item) => {
            if (await store.archivePayment(item.id))
              toast.success("Pagamento archiviato.");
          }}
        />
      )}{" "}
      {dialog === "service" && (
        <ServiceFormDialog
          key={(selected as CommercialService | undefined)?.id ?? "new-service"}
          open
          onOpenChange={(open) => !open && close()}
          service={selected as CommercialService | undefined}
        />
      )}
      {dialog === "sale" && (
        <SaleFormDialog
          key={(selected as CommercialSale | undefined)?.id ?? "new-sale"}
          open
          onOpenChange={(open) => !open && close()}
          sale={selected as CommercialSale | undefined}
        />
      )}
      {dialog === "order" && (
        <OrderFormDialog
          key={(selected as CommercialOrder | undefined)?.id ?? "new-order"}
          open
          onOpenChange={(open) => !open && close()}
          order={selected as CommercialOrder | undefined}
        />
      )}
      {dialog === "payment" && (
        <PaymentFormDialog
          key={
            (selected as CommercialPayment | undefined)?.id ??
            `new-payment-${defaultOrderId}`
          }
          open
          onOpenChange={(open) => !open && close()}
          payment={selected as CommercialPayment | undefined}
          defaultOrderId={defaultOrderId}
        />
      )}
    </main>
  );
}

function CommerceNavigation({ section }: { section: CommerceSection }) {
  const identity = useDoflowIdentity();
  const entries: Array<{
    id: CommerceSection;
    label: string;
    allowed: boolean;
  }> = [
    {
      id: "catalogo",
      label: "Catalogo",
      allowed: identity.hasCapability("canViewSales"),
    },
    {
      id: "vendite",
      label: "Vendite",
      allowed: identity.hasCapability("canViewSales"),
    },
    {
      id: "ordini",
      label: "Ordini",
      allowed: identity.hasCapability("canViewOrders"),
    },
    {
      id: "pagamenti",
      label: "Pagamenti",
      allowed: identity.hasCapability("canManagePayments"),
    },
  ];
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1"
      aria-label="Vendite e amministrazione"
    >
      {entries
        .filter((entry) => entry.allowed)
        .map((entry) => (
          <Button
            key={entry.id}
            asChild
            variant={section === entry.id ? "secondary" : "ghost"}
            className="shrink-0"
          >
            <Link href={`/dashboard/${entry.id}`}>{entry.label}</Link>
          </Button>
        ))}
    </nav>
  );
}
function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShoppingCart;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
function Breakdowns({
  sales,
  services,
}: {
  sales: CommercialSale[];
  services: CommercialService[];
}) {
  const identity = useDoflowIdentity();
  const commercialTeam = useCommercialTeam();
  const group = (key: (sale: CommercialSale) => string) =>
    Object.entries(
      sales.reduce<Record<string, number>>(
        (result, sale) => ({
          ...result,
          [key(sale)]: (result[key(sale)] ?? 0) + sale.value,
        }),
        {},
      ),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  const sold = sales.reduce((total, sale) => total + sale.value, 0);
  const costs = sales.reduce((total, sale) => total + (sale.cost ?? 0), 0);
  return (
    <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
      <MiniBreakdown
        title="Vendite per servizio"
        rows={group(
          (sale) =>
            services.find((service) => service.id === sale.serviceId)?.name ??
            "Altro",
        )}
      />
      <MiniBreakdown
        title="Vendite per commerciale"
        rows={group(
          (sale) =>
            commercialTeam.find((member) => member.id === sale.salespersonId)
              ?.name ?? "Non assegnato",
        )}
      />
      <MiniBreakdown
        title="Vendite per origine"
        rows={group((sale) => sale.origin)}
      />
      {identity.hasCapability("canViewAdministration") && (
        <MiniBreakdown
          title="Risultato aziendale"
          rows={[
            ["Costi", costs],
            ["Margine", sold - costs],
          ]}
        />
      )}
    </section>
  );
}
function MiniBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, number]>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length ? (
          rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{label}</span>
              <b>{money.format(value)}</b>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Nessun dato nel periodo.
          </p>
        )}
      </CardContent>
    </Card>
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
          <div className="p-10 text-center">
            <p className="font-medium">Nessun risultato</p>
            <p className="text-sm text-muted-foreground">
              Modifica i filtri oppure crea il primo record autorizzato.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
const ActionButtons = ({
  onEdit,
  onArchive,
}: {
  onEdit: () => void;
  onArchive: () => void;
}) => (
  <div className="flex justify-end gap-1">
    <Button size="sm" variant="outline" onClick={onEdit}>
      Modifica
    </Button>
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Archivia"
      onClick={onArchive}
    >
      <Archive />
    </Button>
  </div>
);
function CatalogTable({
  items,
  canManage,
  onEdit,
  onArchive,
  canViewValues,
}: {
  items: CommercialService[];
  canManage: boolean;
  onEdit: (item: CommercialService) => void;
  onArchive: (item: CommercialService) => void;
  canViewValues: boolean;
}) {
  return (
    <TableShell empty={!items.length}>
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {[
              "Servizio",
              "Categoria",
              "Prezzo",
              "Condizioni e piani",
              "Disponibilità",
              "Template",
              "Azioni",
            ].map((label) => (
              <th key={label} className="px-4 py-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <b>{item.name}</b>
                <span className="block max-w-xs truncate text-xs text-muted-foreground">
                  {item.description}
                </span>
              </td>
              <td className="px-4 py-3">{item.category}</td>
              <td className="px-4 py-3 font-medium">
                {canViewValues ? money.format(item.price) : "Riservato"}
              </td>
              <td className="px-4 py-3">
                {canViewValues ? (
                  <>
                    <span>
                      {money.format(item.deposit)} acconto · {item.installments}{" "}
                      rate
                    </span>
                    {item.billingPlans?.map((plan) => (
                      <small
                        key={plan.id}
                        className="block text-muted-foreground"
                      >
                        {plan.name}:{" "}
                        {money.format(plan.oneTimePrice + plan.recurringPrice)}{" "}
                        primo anno · {money.format(plan.recurringPrice)}/
                        {plan.recurrence === "annual" ? "anno" : "mese"}
                      </small>
                    ))}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={item.status === "active" ? "secondary" : "outline"}
                >
                  {item.status === "active" ? "Attivo" : "Inattivo"}
                </Badge>
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.availability}
                </span>
              </td>
              <td className="px-4 py-3">{item.projectTemplate?.name ?? "—"}</td>
              <td className="px-4 py-3">
                {canManage && (
                  <ActionButtons
                    onEdit={() => onEdit(item)}
                    onArchive={() => onArchive(item)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}
function SalesTable({
  items,
  store,
  canManage,
  onEdit,
  onArchive,
  canViewValues,
}: {
  items: CommercialSale[];
  store: ReturnType<typeof useCommercialLeads>;
  canManage: boolean;
  onEdit: (item: CommercialSale) => void;
  onArchive: (item: CommercialSale) => void;
  canViewValues: boolean;
}) {
  const commercialTeam = useCommercialTeam();
  return (
    <TableShell empty={!items.length}>
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {[
              "Data",
              "Cliente / lead",
              "Servizio",
              "Origine",
              "Commerciale",
              "Valore",
              "Stato",
              "Ordine",
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
            const subject =
              store.customers.find(
                (customer) => customer.id === item.customerId,
              )?.profile.company ??
              store.leads.find((lead) => lead.id === item.leadId)?.company ??
              "—";
            return (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  {formatCommerceDate(item.date)}
                </td>
                <td className="px-4 py-3">
                  <b>{subject}</b>
                  <span className="block text-xs text-muted-foreground">
                    {item.dealId}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {store.services.find(
                    (service) => service.id === item.serviceId,
                  )?.name ?? "—"}
                </td>
                <td className="px-4 py-3">{item.origin}</td>
                <td className="px-4 py-3">
                  {commercialTeam.find(
                    (member) => member.id === item.salespersonId,
                  )?.name ?? item.salespersonId}
                </td>
                <td className="px-4 py-3 font-medium">
                  {canViewValues ? money.format(item.value) : "Riservato"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={item.status === "Vinta" ? "secondary" : "outline"}
                  >
                    {item.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {store.orders.find((order) => order.id === item.orderId)
                    ?.code ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {canManage && (
                    <ActionButtons
                      onEdit={() => onEdit(item)}
                      onArchive={() => onArchive(item)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}
function OrdersTable({
  items,
  store,
  canManage,
  canManagePayments,
  canManageContracts,
  canManageRenewals,
  onEdit,
  onArchive,
  onPayment,
  onProject,
  canViewValues,
}: {
  items: CommercialOrder[];
  store: ReturnType<typeof useCommercialLeads>;
  canManage: boolean;
  canManagePayments: boolean;
  canManageContracts: boolean;
  canManageRenewals: boolean;
  onEdit: (item: CommercialOrder) => void;
  onArchive: (item: CommercialOrder) => void;
  onPayment: (item: CommercialOrder) => void;
  onProject: (item: CommercialOrder) => void;
  canViewValues: boolean;
}) {
  const commercialTeam = useCommercialTeam();
  return (
    <TableShell empty={!items.length}>
      <table className="w-full min-w-[1400px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {[
              "Ordine",
              "Cliente",
              "Servizi e piani",
              "Commerciale",
              "Totale",
              "Pagato",
              "Residuo",
              "Stato",
              "Contratto",
              "Progetto",
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
            const financials = orderFinancialsFromServer(item);
            const contract = store.contracts.find(
              (entry) =>
                entry.orderId === item.id && entry.status !== "Sostituito",
            );
            const recurringItem = item.items.find(
              (entry) => entry.planId && entry.renewalPrice,
            );
            const renewal =
              recurringItem &&
              store.renewals.find(
                (entry) =>
                  entry.sourceOrderId === item.id &&
                  entry.planId === recurringItem.planId,
              );
            return (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <b>{item.code}</b>
                  <span className="block text-xs text-muted-foreground">
                    {formatCommerceDate(item.orderDate)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {store.customers.find(
                    (customer) => customer.id === item.customerId,
                  )?.profile.company ?? "Cliente autorizzato"}
                </td>
                <td className="px-4 py-3">
                  {item.items.map((entry) => (
                    <span key={entry.id} className="block">
                      {entry.quantity}× {entry.name}
                      {entry.planId && (
                        <small className="block text-muted-foreground">
                          una tantum{" "}
                          {canViewValues
                            ? money.format(entry.oneTimePrice ?? 0)
                            : "riservata"}{" "}
                          · rinnovo{" "}
                          {canViewValues
                            ? money.format(entry.renewalPrice ?? 0)
                            : "riservato"}{" "}
                          · primo periodo{" "}
                          {canViewValues
                            ? money.format(
                                entry.firstPeriodTotal ?? entry.unitPrice,
                              )
                            : "riservato"}
                        </small>
                      )}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3">
                  {commercialTeam.find(
                    (member) => member.id === item.salespersonId,
                  )?.name ?? item.salespersonId}
                </td>
                <td className="px-4 py-3 font-medium">
                  {canViewValues ? money.format(item.total) : "Riservato"}
                </td>
                <td className="px-4 py-3">
                  {canViewValues ? money.format(financials.paid) : "—"}
                </td>
                <td className="px-4 py-3">
                  {canViewValues ? money.format(financials.residual) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      financials.status === "Pagato" ? "secondary" : "outline"
                    }
                  >
                    {financials.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {contract ? (
                    <Button asChild size="sm" variant="link" className="px-0">
                      <Link href="/dashboard/contratti">{contract.status}</Link>
                    </Button>
                  ) : canManageContracts ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const result = await store.generateContract(item.id);
                        result.ok
                          ? toast.success(
                              result.existing
                                ? "Contratto già presente."
                                : "Contratto preparato.",
                            )
                          : toast.error(result.message);
                      }}
                    >
                      Genera contratto
                    </Button>
                  ) : (
                    "Mancante"
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.projectId ? (
                    <Button asChild size="sm" variant="link" className="px-0">
                      <Link href={`/dashboard/progetti/${item.projectId}`}>
                        Apri progetto
                      </Link>
                    </Button>
                  ) : canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onProject(item)}
                    >
                      Genera progetto
                    </Button>
                  ) : (
                    "Da generare"
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {recurringItem && canManageRenewals && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const result = await store.activateRenewal(
                            item.id,
                            recurringItem.id,
                          );
                          result.ok
                            ? toast.success(
                                result.existing
                                  ? "Rinnovo già attivo."
                                  : "Rinnovo attivato.",
                              )
                            : toast.error(result.message);
                        }}
                      >
                        {renewal ? "Rinnovo attivo" : "Attiva rinnovo"}
                      </Button>
                    )}
                    {canManagePayments && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPayment(item)}
                      >
                        Pagamento
                      </Button>
                    )}
                    {canManage && (
                      <ActionButtons
                        onEdit={() => onEdit(item)}
                        onArchive={() => onArchive(item)}
                      />
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
function PaymentsTable({
  items,
  store,
  canManage,
  onEdit,
  onArchive,
}: {
  items: CommercialPayment[];
  store: ReturnType<typeof useCommercialLeads>;
  canManage: boolean;
  onEdit: (item: CommercialPayment) => void;
  onArchive: (item: CommercialPayment) => void;
}) {
  const commercialTeam = useCommercialTeam();
  return (
    <TableShell empty={!items.length}>
      <table className="w-full min-w-[1180px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {[
              "Data effettiva",
              "Ordine",
              "Tipo",
              "Metodo",
              "Riferimento",
              "Origine / motivo",
              "Commerciale",
              "Operatore",
              "Importo",
              "Stato",
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
            const original = store.payments.find(
              (payment) => payment.id === item.originalPaymentId,
            );
            return (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  {formatCommerceDate(item.effectiveDate ?? item.date)}
                  <span className="block text-xs text-muted-foreground">
                    registrato {formatCommerceDate(item.date)}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">
                  {store.orders.find((order) => order.id === item.orderId)
                    ?.code ?? "—"}
                </td>
                <td className="px-4 py-3">{item.type}</td>
                <td className="px-4 py-3">{item.method}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {item.reference}
                </td>
                <td className="px-4 py-3 text-xs">
                  {original ? `Da ${original.reference}` : "—"}
                  {item.refundReason && (
                    <span className="block text-muted-foreground">
                      {item.refundReason}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {commercialTeam.find(
                    (member) => member.id === item.salespersonId,
                  )?.name ??
                    item.salespersonId ??
                    "—"}
                </td>
                <td className="px-4 py-3">
                  {commercialTeam.find(
                    (member) => member.id === item.operatorId,
                  )?.name ??
                    item.operatorId ??
                    "—"}
                </td>
                <td
                  className={`px-4 py-3 font-medium ${item.type === "Rimborso" ? "text-red-600 dark:text-red-400" : ""}`}
                >
                  {item.type === "Rimborso" ? "−" : ""}
                  {money.format(Math.abs(item.amount))}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      item.status === "Confermato" ? "secondary" : "outline"
                    }
                  >
                    {item.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {canManage && (
                    <ActionButtons
                      onEdit={() => onEdit(item)}
                      onArchive={() => onArchive(item)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}
function search(query: string, ...values: Array<string | undefined>) {
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
