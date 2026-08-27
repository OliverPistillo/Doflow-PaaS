"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyPlus, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  fiscalAdapter,
  invoiceStatuses,
  quoteStatuses,
  type CommercialInvoice,
  type CommercialQuote,
  type InvoiceStatus,
  type QuoteStatus,
} from "@/features/commercial/commercial-documents";
import { CommercialSubjectCombobox } from "@/features/commercial/components/commercial-subject-combobox";
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial";

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function CommercialDocumentCyclePage({
  section,
}: {
  section: "quotes" | "invoices";
}) {
  const { store, identity, leads, customers } = useAuthorizedCommercial();
  const quotes = section === "quotes";
  const canCreate = quotes
    ? identity.hasCapability("canManageOwnQuotes")
    : identity.hasCapability("canManageInvoices");
  const initialService = store.services[0];
  const initialPlan = initialService?.billingPlans?.find((item) => item.active);
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [quoteLines, setQuoteLines] = useState([
    {
      id: "quote-line-1",
      serviceId: initialService?.id ?? "",
      planId: initialPlan?.id ?? "none",
      quantity: 1,
      discount: 0,
    },
  ]);
  const [orderId, setOrderId] = useState(store.orders[0]?.id ?? "");
  const [vatRate, setVatRate] = useState("22");
  const [validUntil, setValidUntil] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const create = async () => {
    if (quotes) {
      const lead = leads.find((item) => item.id === subjectId);
      const customer = customers.find((item) => item.id === subjectId);
      const profile = customer?.profile ?? lead;
      const lines = quoteLines.flatMap((draft) => {
        const service = store.services.find(
          (item) => item.id === draft.serviceId,
        );
        if (!service) return [];
        const plan = service.billingPlans?.find(
          (item) => item.id === draft.planId && item.active,
        );
        return [
          {
            id: crypto.randomUUID(),
            serviceId: service.id,
            title: plan ? `${service.name} · ${plan.name}` : service.name,
            description: plan?.description || service.description,
            quantity: draft.quantity,
            unitPrice: plan
              ? plan.oneTimePrice + plan.recurringPrice
              : service.price,
            discount: draft.discount,
            oneTimePrice: plan?.oneTimePrice ?? service.price,
            recurringPrice:
              plan?.recurringPrice ??
              (service.renewal.enabled ? service.renewal.price : 0),
            recurrence: plan?.recurrence ?? service.renewal.interval,
            includedSnapshot: plan ? [...plan.included] : [],
            deposit: service.deposit,
            balance: service.balance,
            installments: service.installments,
          },
        ];
      });
      if (!lines.length || !profile)
        return toast.error("Seleziona destinatario e almeno un servizio.");
      const request = profile.originalRequest;
      const briefSnapshot = request
        ? `Richiesta: ${request.projectType}. Obiettivi: ${request.objectives.join(", ")}. Tempistiche: ${request.timing}.`
        : profile.formSubmission
          ? `Richiesta: ${profile.formSubmission.projectType}. Obiettivi: ${profile.formSubmission.goals.join(", ")}. Tempistiche: ${profile.formSubmission.timing}.`
          : `Esigenza raccolta: ${profile.service || lines.map((line) => line.title).join(", ")}.`;
      const id = await store.addQuote({
        status: "Bozza",
        leadId: lead?.id,
        customerId: customer?.id,
        salespersonId: profile.assigneeId,
        lines,
        discount: 0,
        vatRate: Number(vatRate),
        validUntil,
        conditions:
          "Offerta valida fino alla data indicata. Tempi, revisioni, inclusioni ed esclusioni saranno confermati nel contratto successivo.",
        notes,
        recipientSnapshot: {
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          company: profile.company,
          address: profile.location,
          email: profile.email,
          phone: profile.phone,
          vatNumber: profile.vatNumber,
          taxCode: profile.taxCode,
        },
        supplierSnapshot: { ...store.commerceSettings.supplierProfile },
        briefSnapshot,
      });
      if (!id) return toast.error("Preventivo non creato.");
      toast.success("Preventivo creato");
    } else {
      const order = store.orders.find((item) => item.id === orderId);
      if (!order) return toast.error("Seleziona un ordine.");
      const id = await store.addInvoice({
        kind: "invoice",
        status: "Bozza",
        customerId: order.customerId,
        orderId: order.id,
        paymentIds: store.payments
          .filter(
            (item) => item.orderId === order.id && item.type !== "Rimborso",
          )
          .map((item) => item.id),
        refundIds: store.payments
          .filter(
            (item) => item.orderId === order.id && item.type === "Rimborso",
          )
          .map((item) => item.id),
        lines: order.items.map((item) => ({
          id: crypto.randomUUID(),
          serviceId: item.serviceId,
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
        vatRate: Number(vatRate),
        dueAt: validUntil,
        notes,
      });
      if (!id) return toast.error("Fattura locale non creata.");
      toast.success("Fattura locale creata");
    }
    setOpen(false);
    setNotes("");
  };
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ciclo documentale locale
          </p>
          <h1 className="text-2xl font-semibold">
            {quotes ? "Preventivi" : "Fatture e note di credito"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quotes
              ? "Versioni immutabili, stati e collegamenti commerciali."
              : fiscalAdapter.warning}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus />
            {quotes ? "Nuovo preventivo" : "Nuova fattura locale"}
          </Button>
        )}
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Totale documenti</CardDescription>
            <CardTitle>
              {quotes ? store.quotes.length : store.invoices.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{quotes ? "Accettati" : "Pagate"}</CardDescription>
            <CardTitle>
              {quotes
                ? store.quotes.filter((item) => item.status === "Accettato")
                    .length
                : store.invoices.filter((item) => item.status === "Pagata")
                    .length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Valore</CardDescription>
            <CardTitle>
              {euro.format(
                (quotes ? store.quotes : store.invoices).reduce(
                  (sum, item) =>
                    sum +
                    ("kind" in item && item.kind === "credit_note"
                      ? -item.total
                      : item.total),
                  0,
                ),
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>
            {quotes ? "Registro preventivi" : "Registro documenti locali"}
          </CardTitle>
          <CardDescription>
            {quotes
              ? "Un preventivo accettato resta immutabile; le revisioni creano una nuova versione."
              : "Numerazione locale separata, non fiscale e non trasmessa allo SDI."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {quotes ? (
            <QuotesTable
              items={store.quotes}
              onStatus={(item, status) =>
                store.updateQuote(item.id, { status })
              }
              onVersion={async (item) => {
                const result = await store.createQuoteVersion(item.id);
                if (result.ok) toast.success("Nuova versione creata");
                else toast.error(result.message);
              }}
            />
          ) : (
            <InvoicesTable
              items={store.invoices}
              onStatus={(item, status) =>
                store.updateInvoice(item.id, { status })
              }
              onCredit={async (item) => {
                const result = await store.createCreditNote(
                  item.id,
                  item.total,
                  `Storno completo ${item.code}`,
                );
                if (result.ok) toast.success("Nota di credito creata");
                else toast.error(result.message);
              }}
            />
          )}
        </CardContent>
      </Card>
      {!quotes && (
        <Card>
          <CardHeader>
            <CardTitle>Integrazione fiscale</CardTitle>
            <CardDescription>
              Nessuna trasmissione esterna viene simulata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">Adattatore disabilitato</Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              {fiscalAdapter.warning}
            </p>
          </CardContent>
        </Card>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {quotes ? "Nuovo preventivo" : "Nuova fattura locale"}
            </DialogTitle>
            <DialogDescription>
              I dati vengono salvati nello store commerciale esistente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {quotes ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="document-subject">Lead o cliente</Label>
                  <CommercialSubjectCombobox
                    id="document-subject"
                    leads={leads}
                    customers={customers}
                    value={subjectId}
                    onValueChange={setSubjectId}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Servizi</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const service = store.services[0];
                        setQuoteLines((items) => [
                          ...items,
                          {
                            id: crypto.randomUUID(),
                            serviceId: service?.id ?? "",
                            planId:
                              service?.billingPlans?.find((item) => item.active)
                                ?.id ?? "none",
                            quantity: 1,
                            discount: 0,
                          },
                        ]);
                      }}
                    >
                      <Plus />
                      Aggiungi servizio
                    </Button>
                  </div>
                  {quoteLines.map((line, index) => {
                    const service = store.services.find(
                      (item) => item.id === line.serviceId,
                    );
                    return (
                      <div
                        key={line.id}
                        className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_5rem_7rem_auto]"
                      >
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Servizio {index + 1}
                          </Label>
                          <Select
                            value={line.serviceId}
                            onValueChange={(value) =>
                              setQuoteLines((items) =>
                                items.map((item) =>
                                  item.id === line.id
                                    ? {
                                        ...item,
                                        serviceId: value,
                                        planId:
                                          store.services
                                            .find((entry) => entry.id === value)
                                            ?.billingPlans?.find(
                                              (entry) => entry.active,
                                            )?.id ?? "none",
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger
                              aria-label={`Servizio preventivo ${index + 1}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {store.services
                                .filter(
                                  (item) =>
                                    !item.archivedAt &&
                                    item.status === "active",
                                )
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name} · {euro.format(item.price)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Piano</Label>
                          <Select
                            value={line.planId}
                            onValueChange={(value) =>
                              setQuoteLines((items) =>
                                items.map((item) =>
                                  item.id === line.id
                                    ? { ...item, planId: value }
                                    : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger
                              aria-label={`Piano servizio ${index + 1}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Standard</SelectItem>
                              {service?.billingPlans
                                ?.filter((item) => item.active)
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label
                            className="text-xs"
                            htmlFor={`quote-quantity-${line.id}`}
                          >
                            Quantità
                          </Label>
                          <Input
                            id={`quote-quantity-${line.id}`}
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(event) =>
                              setQuoteLines((items) =>
                                items.map((item) =>
                                  item.id === line.id
                                    ? {
                                        ...item,
                                        quantity: Math.max(
                                          1,
                                          Number(event.target.value),
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            className="text-xs"
                            htmlFor={`quote-discount-${line.id}`}
                          >
                            Sconto
                          </Label>
                          <Input
                            id={`quote-discount-${line.id}`}
                            type="number"
                            min={0}
                            value={line.discount}
                            onChange={(event) =>
                              setQuoteLines((items) =>
                                items.map((item) =>
                                  item.id === line.id
                                    ? {
                                        ...item,
                                        discount: Math.max(
                                          0,
                                          Number(event.target.value),
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={quoteLines.length === 1}
                            aria-label={`Rimuovi servizio ${index + 1}`}
                            onClick={() =>
                              setQuoteLines((items) =>
                                items.filter((item) => item.id !== line.id),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Ordine</Label>
                <Select value={orderId} onValueChange={setOrderId}>
                  <SelectTrigger aria-label="Ordine fattura">
                    <SelectValue placeholder="Seleziona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.orders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.code} · {euro.format(order.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="document-vat">IVA %</Label>
                <Input
                  id="document-vat"
                  type="number"
                  min={0}
                  value={vatRate}
                  onChange={(event) => setVatRate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="document-due">
                  {quotes ? "Validità" : "Scadenza"}
                </Label>
                <Input
                  id="document-due"
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="document-notes">Note</Label>
              <Textarea
                id="document-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={create}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function QuotesTable({
  items,
  onStatus,
  onVersion,
}: {
  items: CommercialQuote[];
  onStatus: (item: CommercialQuote, status: QuoteStatus) => void;
  onVersion: (item: CommercialQuote) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Codice</TableHead>
          <TableHead>Versione</TableHead>
          <TableHead>Stato</TableHead>
          <TableHead>Validità</TableHead>
          <TableHead>Totale</TableHead>
          <TableHead className="text-right">Azioni</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.code}</TableCell>
            <TableCell>v{item.version}</TableCell>
            <TableCell>
              <Select
                value={item.status}
                disabled={
                  item.status === "Accettato" || item.status === "Sostituito"
                }
                onValueChange={(value) => onStatus(item, value as QuoteStatus)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quoteStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>{item.validUntil}</TableCell>
            <TableCell>{euro.format(item.total)}</TableCell>
            <TableCell className="text-right">
              <Button asChild size="icon-sm" variant="ghost">
                <Link
                  href={`/dashboard/preventivi/${item.id}/anteprima`}
                  aria-label={`Anteprima e stampa ${item.code}`}
                >
                  <Printer />
                </Link>
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Nuova versione ${item.code}`}
                onClick={() => onVersion(item)}
              >
                <CopyPlus />
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {!items.length && (
          <TableRow>
            <TableCell
              colSpan={6}
              className="h-28 text-center text-muted-foreground"
            >
              Nessun preventivo nel perimetro autorizzato.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
function InvoicesTable({
  items,
  onStatus,
  onCredit,
}: {
  items: CommercialInvoice[];
  onStatus: (item: CommercialInvoice, status: InvoiceStatus) => void;
  onCredit: (item: CommercialInvoice) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Codice</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Stato</TableHead>
          <TableHead>Scadenza</TableHead>
          <TableHead>Totale</TableHead>
          <TableHead className="text-right">Azioni</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.code}</TableCell>
            <TableCell>
              {item.kind === "credit_note"
                ? "Nota di credito"
                : "Fattura locale"}
            </TableCell>
            <TableCell>
              <Select
                value={item.status}
                onValueChange={(value) =>
                  onStatus(item, value as InvoiceStatus)
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {invoiceStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>{item.dueAt}</TableCell>
            <TableCell>{euro.format(item.total)}</TableCell>
            <TableCell className="text-right">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Stampa ${item.code}`}
                onClick={() => window.print()}
              >
                <Printer />
              </Button>
              {item.kind === "invoice" && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Storna ${item.code}`}
                  onClick={() => onCredit(item)}
                >
                  <RotateCcw />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
        {!items.length && (
          <TableRow>
            <TableCell
              colSpan={6}
              className="h-28 text-center text-muted-foreground"
            >
              Nessun documento locale nel perimetro autorizzato.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
