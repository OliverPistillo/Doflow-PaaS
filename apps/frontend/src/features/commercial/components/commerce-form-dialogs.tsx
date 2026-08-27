"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  createOrderDraftItem,
  estimateOrderDraftTotal,
  serviceRequiresAnnualPlan,
  type CommercialOrder,
  type CommercialOrderItem,
  type CommercialPayment,
  type CommercialSale,
  type CommercialService,
  orderStatuses,
  paymentMethods,
  paymentTypes,
  saleOrigins,
  serviceCategories,
} from "@/features/commercial/commercial-commerce";
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider";
import { useCommercialTeam } from "@/features/commercial/use-commercial-team";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";

const today = () => new Date().toISOString().slice(0, 10);
const numberValue = (value: FormDataEntryValue | null) => Number(value || 0);

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: CommercialService;
}) {
  const store = useCommercialLeads();
  const [renewal, setRenewal] = useState(service?.renewal.enabled ?? false);
  async function submit(formData: FormData) {
    const price = numberValue(formData.get("price"));
    const deposit = numberValue(formData.get("deposit"));
    const balance = numberValue(formData.get("balance"));
    const promoName = String(formData.get("promotionName") || "").trim();
    const extraName = String(formData.get("extraName") || "").trim();
    const nowId = crypto.randomUUID();
    if (
      !String(formData.get("name") || "").trim() ||
      price < 0 ||
      deposit < 0 ||
      balance < 0
    ) {
      toast.error("Compila nome e importi validi.");
      return;
    }
    const existingPlans = service?.billingPlans ?? [];
    const billingPlans = renewal
      ? existingPlans.length
        ? existingPlans.map((plan, index) => ({
            ...plan,
            oneTimePrice: price,
            recurringPrice: numberValue(formData.get(`planRecurring${index}`)),
            included: String(
              formData.get(`planIncluded${index}`) || plan.included.join(", "),
            )
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          }))
        : [
            {
              id: crypto.randomUUID(),
              name: "Standard",
              description: "Piano ricorrente",
              oneTimePrice: price,
              recurringPrice: numberValue(formData.get("renewalPrice")),
              recurrence:
                String(formData.get("renewalInterval")) === "monthly"
                  ? ("monthly" as const)
                  : ("annual" as const),
              renewal: "optional" as const,
              included: [],
              active: true,
            },
          ]
      : [];
    const input = {
      name: String(formData.get("name")),
      category: String(
        formData.get("category"),
      ) as CommercialService["category"],
      description: String(formData.get("description")),
      price,
      status: String(formData.get("status")) as CommercialService["status"],
      availability: String(
        formData.get("availability"),
      ) as CommercialService["availability"],
      deposit,
      balance,
      installments: Math.max(1, numberValue(formData.get("installments"))),
      promotions: promoName
        ? [
            {
              id: service?.promotions[0]?.id ?? nowId,
              name: promoName,
              kind: "percentage" as const,
              value: numberValue(formData.get("promotionValue")),
              active: true,
            },
          ]
        : [],
      extras: extraName
        ? [
            {
              id: service?.extras[0]?.id ?? crypto.randomUUID(),
              name: extraName,
              price: numberValue(formData.get("extraPrice")),
              active: true,
            },
          ]
        : [],
      renewal: {
        enabled: renewal,
        interval: String(
          formData.get("renewalInterval"),
        ) as CommercialService["renewal"]["interval"],
        price: numberValue(formData.get("renewalPrice")),
      },
      billingPlans,
      projectTemplate: {
        name: String(formData.get("templateName") || formData.get("name")),
        projectType: String(formData.get("projectType")) as NonNullable<
          CommercialService["projectTemplate"]
        >["projectType"],
        phases: String(
          formData.get("phases") || "Onboarding, Lavorazione, Consegna",
        )
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
    };
    const ok = service
      ? await store.updateService(service.id, input)
      : Boolean(await store.addService(input));
    if (!ok) {
      toast.error("Nessuna modifica salvata o operazione non autorizzata.");
      return;
    }
    toast.success(service ? "Servizio aggiornato." : "Servizio creato.");
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {service ? "Modifica servizio" : "Nuovo servizio"}
          </DialogTitle>
          <DialogDescription>
            Catalogo commerciale e template operativo. Nessun progetto viene
            creato automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome"
            name="name"
            defaultValue={service?.name}
            required
          />
          <SelectField
            label="Categoria"
            name="category"
            defaultValue={service?.category ?? "Siti web"}
            options={[...serviceCategories]}
          />
          <div className="sm:col-span-2">
            <Field
              label="Descrizione"
              name="description"
              defaultValue={service?.description}
            />
          </div>
          <Field
            label="Prezzo (€)"
            name="price"
            type="number"
            defaultValue={service?.price ?? 0}
            min="0"
            step="0.01"
          />
          <SelectField
            label="Stato"
            name="status"
            defaultValue={service?.status ?? "active"}
            options={["active", "inactive"]}
            labels={{ active: "Attivo", inactive: "Inattivo" }}
          />
          <SelectField
            label="Disponibilità"
            name="availability"
            defaultValue={service?.availability ?? "available"}
            options={["available", "limited", "unavailable"]}
            labels={{
              available: "Disponibile",
              limited: "Limitata",
              unavailable: "Non disponibile",
            }}
          />
          <Field
            label="Acconto (€)"
            name="deposit"
            type="number"
            defaultValue={service?.deposit ?? 0}
            min="0"
            step="0.01"
          />
          <Field
            label="Saldo (€)"
            name="balance"
            type="number"
            defaultValue={service?.balance ?? 0}
            min="0"
            step="0.01"
          />
          <Field
            label="Numero rate"
            name="installments"
            type="number"
            defaultValue={service?.installments ?? 1}
            min="1"
          />
          <Field
            label="Promozione"
            name="promotionName"
            defaultValue={service?.promotions[0]?.name}
            placeholder="Es. Lancio"
          />
          <Field
            label="Sconto promozione (%)"
            name="promotionValue"
            type="number"
            defaultValue={service?.promotions[0]?.value ?? 0}
            min="0"
            max="100"
          />
          <Field
            label="Extra"
            name="extraName"
            defaultValue={service?.extras[0]?.name}
            placeholder="Es. Copywriting"
          />
          <Field
            label="Prezzo extra (€)"
            name="extraPrice"
            type="number"
            defaultValue={service?.extras[0]?.price ?? 0}
            min="0"
            step="0.01"
          />
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="renewal"
              checked={renewal}
              onCheckedChange={(value) => setRenewal(Boolean(value))}
            />
            <Label htmlFor="renewal">Servizio con rinnovo</Label>
          </div>
          {renewal && (
            <>
              <SelectField
                label="Frequenza rinnovo"
                name="renewalInterval"
                defaultValue={service?.renewal.interval ?? "annual"}
                options={["monthly", "quarterly", "annual"]}
                labels={{
                  monthly: "Mensile",
                  quarterly: "Trimestrale",
                  annual: "Annuale",
                }}
              />
              <Field
                label="Prezzo rinnovo predefinito (€)"
                name="renewalPrice"
                type="number"
                defaultValue={service?.renewal.price ?? 0}
                min="0"
                step="0.01"
              />
              {service?.billingPlans?.map((plan, index) => (
                <section
                  key={plan.id}
                  className="grid gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-2"
                >
                  <div className="sm:col-span-2">
                    <p className="font-medium">Piano {plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.renewal === "required"
                        ? "Rinnovo obbligatorio"
                        : "Rinnovo facoltativo"}{" "}
                      · {plan.recurrence === "annual" ? "annuale" : "mensile"}
                    </p>
                  </div>
                  <Field
                    label="Una tantum (€)"
                    name={`planOneTime${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={plan.oneTimePrice}
                  />
                  <Field
                    label="Rinnovo (€)"
                    name={`planRecurring${index}`}
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={plan.recurringPrice}
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="Incluso (separato da virgole)"
                      name={`planIncluded${index}`}
                      defaultValue={plan.included.join(", ")}
                    />
                  </div>
                </section>
              ))}
            </>
          )}
          <Field
            label="Nome template progetto"
            name="templateName"
            defaultValue={service?.projectTemplate?.name}
          />
          <SelectField
            label="Tipo progetto"
            name="projectType"
            defaultValue={service?.projectTemplate?.projectType ?? "other"}
            options={[
              "website",
              "ecommerce",
              "landing",
              "branding",
              "marketing",
              "maintenance",
              "consulting",
              "other",
            ]}
          />
          <div className="sm:col-span-2">
            <Field
              label="Fasi template (separate da virgola)"
              name="phases"
              defaultValue={service?.projectTemplate?.phases.join(", ")}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit">Salva servizio</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SaleFormDialog({
  open,
  onOpenChange,
  sale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale?: CommercialSale;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const commercialTeam = useCommercialTeam();
  const initialSubject = sale?.customerId
    ? `customer:${sale.customerId}`
    : sale?.leadId
      ? `lead:${sale.leadId}`
      : "";
  async function submit(formData: FormData) {
    const subject = String(formData.get("subject"));
    const [kind, subjectId] = subject.split(":");
    const input = {
      customerId: kind === "customer" ? subjectId : undefined,
      leadId: kind === "lead" ? subjectId : undefined,
      serviceId: String(formData.get("serviceId")),
      salespersonId: String(formData.get("salespersonId")),
      origin: String(formData.get("origin")) as CommercialSale["origin"],
      value: numberValue(formData.get("value")),
      cost: identity.hasCapability("canViewAdministration")
        ? numberValue(formData.get("cost"))
        : sale?.cost,
      date: String(formData.get("date")),
      status: String(formData.get("status")) as CommercialSale["status"],
      dealId: String(formData.get("dealId")).trim(),
      notes: String(formData.get("notes")),
    };
    if (!subjectId || !input.serviceId || !input.dealId || input.value < 0) {
      toast.error("Cliente/lead, servizio e trattativa sono obbligatori.");
      return;
    }
    const ok = sale
      ? await store.updateSale(sale.id, input)
      : Boolean(await store.addSale(input));
    if (!ok) {
      toast.error("Nessuna modifica salvata o operazione non autorizzata.");
      return;
    }
    toast.success(sale ? "Vendita aggiornata." : "Vendita registrata.");
    onOpenChange(false);
  }
  const subjects = [
    ...store.leads.map((lead) => ({
      id: `lead:${lead.id}`,
      label: `Lead · ${lead.company}`,
    })),
    ...store.customers.map((customer) => ({
      id: `customer:${customer.id}`,
      label: `Cliente · ${customer.profile.company}`,
    })),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {sale ? "Modifica vendita" : "Nuova vendita"}
          </DialogTitle>
          <DialogDescription>
            Collega la vendita a un lead o cliente reale.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Lead o cliente"
            name="subject"
            defaultValue={initialSubject}
            options={subjects.map((item) => item.id)}
            labels={Object.fromEntries(
              subjects.map((item) => [item.id, item.label]),
            )}
          />
          <SelectField
            label="Servizio"
            name="serviceId"
            defaultValue={sale?.serviceId}
            options={store.services
              .filter((item) => item.status === "active")
              .map((item) => item.id)}
            labels={Object.fromEntries(
              store.services.map((item) => [item.id, item.name]),
            )}
          />
          <SelectField
            label="Commerciale"
            name="salespersonId"
            defaultValue={sale?.salespersonId ?? identity.currentUser.id}
            disabled={!identity.hasCapability("canAssignLeads")}
            options={commercialTeam.map((item) => item.id)}
            labels={Object.fromEntries(
              commercialTeam.map((item) => [item.id, item.name]),
            )}
          />
          <SelectField
            label="Origine"
            name="origin"
            defaultValue={sale?.origin ?? "Commerciale"}
            options={[...saleOrigins]}
          />
          <Field
            label="Valore (€)"
            name="value"
            type="number"
            defaultValue={sale?.value ?? 0}
            min="0"
            step="0.01"
          />
          {identity.hasCapability("canViewAdministration") && (
            <Field
              label="Costo interno (€)"
              name="cost"
              type="number"
              defaultValue={sale?.cost ?? 0}
              min="0"
              step="0.01"
            />
          )}
          <Field
            label="Data"
            name="date"
            type="date"
            defaultValue={sale?.date ?? today()}
          />
          <SelectField
            label="Stato"
            name="status"
            defaultValue={sale?.status ?? "In trattativa"}
            options={["Bozza", "In trattativa", "Vinta", "Persa", "Annullata"]}
          />
          <Field
            label="Trattativa / riferimento"
            name="dealId"
            defaultValue={sale?.dealId}
            required
            placeholder="Es. DEAL-2026-104"
          />
          <div className="sm:col-span-2">
            <TextField label="Note" name="notes" defaultValue={sale?.notes} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit">Salva vendita</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrderFormDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: CommercialOrder;
}) {
  const store = useCommercialLeads();
  const identity = useDoflowIdentity();
  const commercialTeam = useCommercialTeam();
  const fallbackService = store.services[0];
  const [idempotencyKey] = useState(
    () => order?.idempotencyKey ?? crypto.randomUUID(),
  );
  const [items, setItems] = useState<CommercialOrderItem[]>(
    order?.items.length
      ? order.items
      : fallbackService
        ? [
            createOrderDraftItem(
              fallbackService,
              fallbackService.billingPlans?.[0]?.id,
            ),
          ]
        : [],
  );
  async function submit(formData: FormData) {
    const selectedSaleId = String(formData.get("saleId"));
    const validItems = items.filter(
      (item) =>
        store.services.some((service) => service.id === item.serviceId) &&
        item.quantity > 0 &&
        item.unitPrice >= 0 &&
        item.discount >= 0,
    );
    const missingRequiredPlan = validItems.some((item) => {
      const service = store.services.find(
        (entry) => entry.id === item.serviceId,
      );
      return (
        service &&
        serviceRequiresAnnualPlan(service) &&
        !service.billingPlans?.some(
          (plan) => plan.id === item.planId && plan.active,
        )
      );
    });
    const input = {
      idempotencyKey,
      customerId: String(formData.get("customerId")),
      saleId:
        selectedSaleId && selectedSaleId !== "none"
          ? selectedSaleId
          : undefined,
      dealId: String(formData.get("dealId")) || undefined,
      items: validItems,
      salespersonId: String(formData.get("salespersonId")),
      discount: numberValue(formData.get("discount")),
      deposit: numberValue(formData.get("deposit")),
      installments: Math.max(1, numberValue(formData.get("installments"))),
      administrativeStatus: String(
        formData.get("administrativeStatus"),
      ) as CommercialOrder["administrativeStatus"],
      orderDate: String(formData.get("orderDate")),
      dueDate: String(formData.get("dueDate")) || undefined,
      notes: String(formData.get("notes")),
    };
    if (!input.customerId || !validItems.length) {
      toast.error(
        "Cliente e almeno un servizio con importi validi sono obbligatori.",
      );
      return;
    }
    if (missingRequiredPlan) {
      toast.error(
        "Seleziona un piano annuale per ogni servizio che lo richiede.",
      );
      return;
    }
    if (
      !order &&
      !["Bozza", "Confermato", "Acconto richiesto"].includes(
        input.administrativeStatus,
      )
    ) {
      toast.error("Stato iniziale ordine non supportato dal backend.");
      return;
    }
    const ok = order
      ? await store.updateOrder(order.id, input)
      : Boolean(await store.addOrder(input));
    if (!ok) {
      toast.error("Nessuna modifica salvata o operazione non autorizzata.");
      return;
    }
    toast.success(order ? "Ordine aggiornato." : "Ordine creato.");
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)] sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 sm:px-6 sm:pr-12">
          <DialogTitle>
            {order ? `Modifica ${order.code}` : "Nuovo ordine"}
          </DialogTitle>
          <DialogDescription>
            Registrazione amministrativa manuale; nessuna fattura o transazione
            viene emessa.
          </DialogDescription>
        </DialogHeader>
        <form
          action={submit}
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
        >
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <SelectField
                label="Cliente"
                name="customerId"
                defaultValue={order?.customerId}
                options={store.customers.map((item) => item.id)}
                labels={Object.fromEntries(
                  store.customers.map((item) => [
                    item.id,
                    item.profile.company,
                  ]),
                )}
              />
              <SelectField
                label="Vendita collegata (opzionale)"
                name="saleId"
                defaultValue={order?.saleId ?? "none"}
                options={[
                  "none",
                  ...store.sales
                    .filter((item) => item.status === "Vinta")
                    .map((item) => item.id),
                ]}
                labels={{
                  none: "Nessuna",
                  ...Object.fromEntries(
                    store.sales.map((item) => [item.id, item.dealId]),
                  ),
                }}
              />
              <Field
                label="Trattativa"
                name="dealId"
                defaultValue={order?.dealId}
              />
              <div className="sm:col-span-2">
                <OrderItemsEditor
                  items={items}
                  services={store.services}
                  onChange={setItems}
                />
              </div>
              <Field
                label="Sconto ordine (€)"
                name="discount"
                type="number"
                defaultValue={order?.discount ?? 0}
                min="0"
                step="0.01"
              />
              <Field
                label="Acconto previsto (€)"
                name="deposit"
                type="number"
                defaultValue={order?.deposit ?? 0}
                min="0"
                step="0.01"
              />
              <Field
                label="Importo fatturato (€)"
                name="invoicedAmount"
                type="number"
                defaultValue={order?.invoicedAmount ?? 0}
                min="0"
                step="0.01"
                readOnly
              />
              <Field
                label="Numero rate"
                name="installments"
                type="number"
                defaultValue={order?.installments ?? 1}
                min="1"
              />
              <SelectField
                label="Commerciale"
                name="salespersonId"
                defaultValue={order?.salespersonId ?? identity.currentUser.id}
                disabled={!identity.hasCapability("canAssignLeads")}
                options={commercialTeam.map((item) => item.id)}
                labels={Object.fromEntries(
                  commercialTeam.map((item) => [item.id, item.name]),
                )}
              />
              <SelectField
                label="Stato"
                name="administrativeStatus"
                defaultValue={order?.administrativeStatus ?? "Bozza"}
                options={[...orderStatuses]}
              />
              <Field
                label="Data ordine"
                name="orderDate"
                type="date"
                defaultValue={order?.orderDate ?? today()}
              />
              <Field
                label="Scadenza"
                name="dueDate"
                type="date"
                defaultValue={order?.dueDate}
              />
              <div className="sm:col-span-2">
                <TextField
                  label="Note"
                  name="notes"
                  defaultValue={order?.notes}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none rounded-b-xl px-4 py-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit">Salva ordine</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderItemsEditor({
  items,
  services,
  onChange,
}: {
  items: CommercialOrderItem[];
  services: CommercialService[];
  onChange: (items: CommercialOrderItem[]) => void;
}) {
  const update = (id: string, updates: Partial<CommercialOrderItem>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  const add = () => {
    const service =
      services.find(
        (item) => !items.some((entry) => entry.serviceId === item.id),
      ) ?? services[0];
    if (service)
      onChange([
        ...items,
        createOrderDraftItem(service, service.billingPlans?.[0]?.id),
      ]);
  };
  return (
    <section className="min-w-0 space-y-3 rounded-lg border p-3">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <Label>Servizi dell’ordine</Label>
          <p className="text-xs text-muted-foreground">
            Le condizioni del piano vengono salvate come snapshot storico
            nell’ordine.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={add}
          disabled={!services.length}
        >
          <Plus />
          Aggiungi servizio
        </Button>
      </div>
      {items.map((item, index) => {
        const service = services.find((entry) => entry.id === item.serviceId);
        return (
          <article
            key={item.id}
            aria-label={`Servizio ordine ${index + 1}`}
            className="grid min-w-0 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-12"
          >
            <div className="flex min-w-0 items-center justify-between gap-3 border-b pb-2 sm:col-span-12">
              <p className="font-medium">Servizio {index + 1}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.name}
              </p>
            </div>
            <div className="grid min-w-0 gap-1.5 sm:col-span-5">
              <Label htmlFor={`order-service-${item.id}`}>Servizio</Label>
              <Select
                value={item.serviceId}
                onValueChange={(serviceId) => {
                  const nextService = services.find(
                    (entry) => entry.id === serviceId,
                  );
                  if (nextService) {
                    const snapshot = createOrderDraftItem(
                      nextService,
                      nextService.billingPlans?.[0]?.id,
                    );
                    onChange(
                      items.map((entry) =>
                        entry.id === item.id
                          ? { ...snapshot, id: item.id }
                          : entry,
                      ),
                    );
                  }
                }}
              >
                <SelectTrigger
                  id={`order-service-${item.id}`}
                  className="min-w-0 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {services.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5 sm:col-span-4">
              <Label htmlFor={`order-plan-${item.id}`}>Piano</Label>
              <Select
                value={item.planId ?? "once"}
                onValueChange={(planId) => {
                  if (!service) return;
                  const snapshot = createOrderDraftItem(
                    service,
                    planId === "once" ? undefined : planId,
                  );
                  onChange(
                    items.map((entry) =>
                      entry.id === item.id
                        ? { ...snapshot, id: item.id }
                        : entry,
                    ),
                  );
                }}
              >
                <SelectTrigger
                  id={`order-plan-${item.id}`}
                  className="min-w-0 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Una tantum</SelectItem>
                  {service?.billingPlans
                    ?.filter((plan) => plan.active)
                    .map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} · {plan.oneTimePrice + plan.recurringPrice}{" "}
                        € primo anno
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5 sm:col-span-3">
              <Label htmlFor={`order-quantity-${item.id}`}>Quantità</Label>
              <Input
                id={`order-quantity-${item.id}`}
                aria-label={`Quantità servizio ${index + 1}`}
                className="w-full"
                type="number"
                min="1"
                value={item.quantity}
                onChange={(event) =>
                  update(item.id, {
                    quantity: Math.max(1, Number(event.target.value)),
                  })
                }
              />
            </div>
            <div className="grid min-w-0 gap-1.5 sm:col-span-4">
              <Label htmlFor={`order-price-${item.id}`}>
                Primo periodo (€)
              </Label>
              <Input
                id={`order-price-${item.id}`}
                aria-label={`Prezzo servizio ${index + 1}`}
                className="w-full"
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(event) =>
                  update(item.id, {
                    unitPrice: Math.max(0, Number(event.target.value)),
                  })
                }
              />
            </div>
            <div className="grid min-w-0 gap-1.5 sm:col-span-4">
              <Label htmlFor={`order-discount-${item.id}`}>Sconto (€)</Label>
              <Input
                id={`order-discount-${item.id}`}
                aria-label={`Sconto servizio ${index + 1}`}
                className="w-full"
                type="number"
                min="0"
                step="0.01"
                value={item.discount}
                onChange={(event) =>
                  update(item.id, {
                    discount: Math.max(0, Number(event.target.value)),
                  })
                }
              />
            </div>
            <div className="flex items-end sm:col-span-4 sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full sm:w-auto"
                aria-label={`Rimuovi servizio ${index + 1}`}
                disabled={items.length === 1}
                onClick={() =>
                  onChange(items.filter((entry) => entry.id !== item.id))
                }
              >
                <Trash2 />
                Rimuovi
              </Button>
            </div>
            {item.planId && (
              <p className="rounded-md bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground sm:col-span-12">
                Una tantum {item.oneTimePrice} € · rinnovo {item.renewalPrice}{" "}
                €/{item.recurrence === "annual" ? "anno" : "mese"} · primo
                periodo {item.firstPeriodTotal} €
              </p>
            )}
          </article>
        );
      })}
      <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
        <span className="text-muted-foreground">Totale servizi</span>
        <strong className="tabular-nums">
          {estimateOrderDraftTotal(items, 0).toLocaleString("it-IT", {
            style: "currency",
            currency: "EUR",
          })}
        </strong>
      </div>
    </section>
  );
}

export function PaymentFormDialog({
  open,
  onOpenChange,
  payment,
  defaultOrderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: CommercialPayment;
  defaultOrderId?: string;
}) {
  const store = useCommercialLeads();
  async function submit(formData: FormData) {
    const originalPaymentId = String(formData.get("originalPaymentId"));
    const input = {
      orderId: String(formData.get("orderId")),
      amount: numberValue(formData.get("amount")),
      date: String(formData.get("date")),
      effectiveDate:
        String(formData.get("effectiveDate")) || String(formData.get("date")),
      method: String(formData.get("method")) as CommercialPayment["method"],
      reference: String(formData.get("reference")).trim(),
      type: String(formData.get("type")) as CommercialPayment["type"],
      status: String(formData.get("status")) as CommercialPayment["status"],
      originalPaymentId:
        originalPaymentId && originalPaymentId !== "none"
          ? originalPaymentId
          : undefined,
      refundReason: String(formData.get("refundReason")) || undefined,
      notes: String(formData.get("notes")),
    };
    if (!input.orderId || input.amount <= 0 || !input.reference) {
      toast.error("Ordine, importo e riferimento sono obbligatori.");
      return;
    }
    if (payment) {
      if (!(await store.updatePayment(payment.id, input))) {
        toast.error(
          "Riferimento duplicato, rimborso non valido, nessuna modifica o operazione non autorizzata.",
        );
        return;
      }
    } else {
      const result = await store.addPayment(input);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
    }
    toast.success(payment ? "Pagamento aggiornato." : "Pagamento registrato.");
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {payment ? "Modifica pagamento" : "Nuovo pagamento"}
          </DialogTitle>
          <DialogDescription>
            Registrazione manuale nel prototipo, senza integrazioni fiscali o
            gateway. I rimborsi richiedono movimento originario e motivo.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(new FormData(event.currentTarget));
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <SelectField
            label="Ordine"
            name="orderId"
            defaultValue={payment?.orderId ?? defaultOrderId}
            disabled={Boolean(payment)}
            options={store.orders.map((item) => item.id)}
            labels={Object.fromEntries(
              store.orders.map((item) => [item.id, item.code]),
            )}
          />
          <Field
            label="Importo (€)"
            name="amount"
            type="number"
            defaultValue={payment?.amount ?? 0}
            min="0.01"
            step="0.01"
          />
          <Field
            label="Data registrazione"
            name="date"
            type="date"
            defaultValue={payment?.date ?? today()}
          />
          <Field
            label="Data effettiva"
            name="effectiveDate"
            type="date"
            defaultValue={payment?.effectiveDate ?? payment?.date ?? today()}
          />
          <SelectField
            label="Metodo"
            name="method"
            defaultValue={payment?.method ?? "Bonifico"}
            options={[...paymentMethods]}
          />
          <Field
            label="Riferimento univoco"
            name="reference"
            defaultValue={payment?.reference}
            required
          />
          <SelectField
            label="Tipo"
            name="type"
            defaultValue={payment?.type ?? "Acconto"}
            options={[...paymentTypes]}
          />
          <SelectField
            label="Stato"
            name="status"
            defaultValue={payment?.status ?? "Confermato"}
            options={["Da confermare", "Confermato", "Fallito", "Annullato"]}
          />
          <SelectField
            label="Pagamento originario (rimborsi)"
            name="originalPaymentId"
            defaultValue={payment?.originalPaymentId ?? "none"}
            options={[
              "none",
              ...store.payments
                .filter(
                  (item) =>
                    item.type !== "Rimborso" &&
                    item.status === "Confermato" &&
                    !item.archivedAt,
                )
                .map((item) => item.id),
            ]}
            labels={{
              none: "Non applicabile",
              ...Object.fromEntries(
                store.payments.map((item) => [
                  item.id,
                  `${item.reference} · ${item.amount} €`,
                ]),
              ),
            }}
          />
          <Field
            label="Motivo rimborso"
            name="refundReason"
            defaultValue={payment?.refundReason}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Note"
              name="notes"
              defaultValue={payment?.notes}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit">Salva pagamento</Button>
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
function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue} />
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
        defaultValue={defaultValue || options[0]}
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
        <input type="hidden" name={name} value={defaultValue || options[0]} />
      )}
    </div>
  );
}
