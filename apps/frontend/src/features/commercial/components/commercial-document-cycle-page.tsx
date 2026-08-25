"use client";

import { useEffect, useState } from "react";
import { CopyPlus, Plus, Printer, RotateCcw } from "lucide-react";
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
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial";
import { RecordCollaborationPanel } from "@/features/commercial/components/record-collaboration-panel";
import {
  documentRevenueApi,
  type DocumentRevenueSummary,
} from "@/lib/tenant-document-revenue-api";

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
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
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [serviceId, setServiceId] = useState(store.services[0]?.id ?? "");
  const [orderId, setOrderId] = useState(store.orders[0]?.id ?? "");
  const [validUntil, setValidUntil] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<DocumentRevenueSummary | null>(null);
  useEffect(() => {
    if (!quotes)
      void documentRevenueApi
        .summary()
        .then(setSummary)
        .catch(() => setSummary(null));
  }, [quotes, store.invoices]);
  const create = async () => {
    if (quotes) {
      const lead = leads.find((item) => item.id === subjectId);
      const customer = customers.find((item) => item.id === subjectId);
      const service = store.services.find((item) => item.id === serviceId);
      if (!service || (!lead && !customer))
        return toast.error("Seleziona destinatario e servizio.");
      const id = await store.addQuote({
        status: "Bozza",
        leadId: lead?.id,
        customerId: customer?.id,
        salespersonId: lead?.assigneeId ?? customer!.profile.assigneeId,
        lines: [
          {
            id: crypto.randomUUID(),
            serviceId: service.id,
            description: service.name,
            quantity: 1,
            unitPrice: service.price,
            discount: 0,
          },
        ],
        discount: 0,
        vatRate: 0,
        validUntil,
        conditions: "Validità e condizioni come indicate nel documento.",
        notes,
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
        paymentIds: [],
        refundIds: [],
        lines: [],
        vatRate: 0,
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
              {quotes
                ? store.quotes.length
                : (summary?.invoiceCount ?? store.invoices.length)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>
              {quotes ? "Accettati" : "Note di credito"}
            </CardDescription>
            <CardTitle>
              {quotes
                ? store.quotes.filter((item) => item.status === "Accettato")
                    .length
                : summary?.redacted
                  ? "—"
                  : euro.format(summary?.creditNotes ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>
              {quotes ? "Valore preventivi" : "Fatturato netto locale"}
            </CardDescription>
            <CardTitle>
              {quotes
                ? euro.format(
                    store.quotes.reduce((sum, item) => sum + item.total, 0),
                  )
                : summary?.redacted
                  ? "—"
                  : euro.format(summary?.netRevenue ?? 0)}
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
              onStatus={async (item, status) => {
                if (await store.updateQuote(item.id, { status }))
                  toast.success("Stato preventivo aggiornato");
              }}
              onVersion={async (item) => {
                const result = await store.createQuoteVersion(item.id);
                if (result.ok)
                  toast.success(
                    result.existing
                      ? "Versione già presente"
                      : "Nuova versione creata",
                  );
                else toast.error(result.message);
              }}
            />
          ) : (
            <InvoicesTable
              items={store.invoices}
              onStatus={async (item, status) => {
                if (await store.updateInvoice(item.id, { status }))
                  toast.success("Stato documento aggiornato");
              }}
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {quotes ? "Nuovo preventivo" : "Nuova fattura locale"}
            </DialogTitle>
            <DialogDescription>
              Numeri, snapshot e totali vengono assegnati dal server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {quotes ? (
              <>
                <div className="space-y-1.5">
                  <Label>Lead o cliente</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger aria-label="Lead o cliente">
                      <SelectValue placeholder="Seleziona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          Lead · {lead.company}
                        </SelectItem>
                      ))}
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          Cliente · {customer.profile.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Servizio</Label>
                  <Select value={serviceId} onValueChange={setServiceId}>
                    <SelectTrigger aria-label="Servizio preventivo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {store.services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} · {euro.format(service.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <Button onClick={() => void create()}>Salva</Button>
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
  onStatus: (item: CommercialQuote, status: QuoteStatus) => Promise<void>;
  onVersion: (item: CommercialQuote) => Promise<void>;
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
                disabled={[
                  "Accettato",
                  "Rifiutato",
                  "Scaduto",
                  "Sostituito",
                ].includes(item.status)}
                onValueChange={(value) =>
                  void onStatus(item, value as QuoteStatus)
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quoteStatuses
                    .filter(
                      (status) => status !== "Bozza" && status !== "Sostituito",
                    )
                    .map((status) => (
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
              <RecordCollaborationPanel
                recordType="quote"
                recordId={item.id}
                label={item.code}
                compact
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Stampa ${item.code}`}
                onClick={() => window.print()}
              >
                <Printer />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Nuova versione ${item.code}`}
                onClick={() => void onVersion(item)}
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
  onStatus: (item: CommercialInvoice, status: InvoiceStatus) => Promise<void>;
  onCredit: (item: CommercialInvoice) => Promise<void>;
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
                disabled={
                  item.kind === "credit_note" ||
                  ["Pagata", "Annullata", "Stornata"].includes(item.status)
                }
                onValueChange={(value) =>
                  void onStatus(item, value as InvoiceStatus)
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {invoiceStatuses
                    .filter((status) =>
                      [
                        item.status,
                        "Proforma",
                        "Emessa esternamente",
                        "Annullata",
                      ].includes(status),
                    )
                    .map((status) => (
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
              <RecordCollaborationPanel
                recordType="invoice"
                recordId={item.id}
                label={item.code}
                compact
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Stampa ${item.code}`}
                onClick={() => window.print()}
              >
                <Printer />
              </Button>
              {item.kind === "invoice" &&
                [
                  "Emessa esternamente",
                  "Parzialmente pagata",
                  "Pagata",
                  "Scaduta",
                ].includes(item.status) && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Storna ${item.code}`}
                    onClick={() => void onCredit(item)}
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
