"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { Loader2, ArrowLeft, Plus, Trash2, Receipt, AlertTriangle, UserPlus, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

// ─── Tipi ────────────────────────────────────────────────────────────────────

type LineItemForm = {
  description: string;
  quantity:    number;
  unitPrice:   number;
};

type InvoiceFormValues = {
  // Intestatario
  tenantId:          string;
  clientName:        string;
  clientAddress:     string;
  clientCity:        string;
  clientZip:         string;
  clientVat:         string;
  clientFiscalCode:  string;
  clientSdi:         string;
  clientPec:         string;
  // Documento
  issueDate:         string;
  dueDate:           string;
  status:            "paid" | "pending" | "overdue";
  // Regime fiscale
  taxRegime:         "ordinario" | "forfettario";
  taxRate:           number;
  inpsRate:          number;
  ritenutaRate:      number;
  stampDuty:         boolean;
  // Voci
  notes:             string;
  lineItems:         LineItemForm[];
};

type Tenant = { id: string; name: string; contactEmail?: string };

interface InvoiceClient {
  id: string;
  clientName: string;
  clientVat?: string;
  clientFiscalCode?: string;
  clientSdi?: string;
  clientPec?: string;
  clientAddress?: string;
  clientCity?: string;
  clientZip?: string;
  invoiceCount: number;
}

const STAMP_THRESHOLD = 77.47;

// ─── Componente ──────────────────────────────────────────────────────────────

export default function NewInvoicePage() {
  const router = useRouter();
  const [tenants, setTenants]             = useState<Tenant[]>([]);
  const [loadingTenants, setLoading]      = useState(true);
  const [isSubmitting, setSubmitting]     = useState(false);
  const [savedClients, setSavedClients]   = useState<InvoiceClient[]>([]);
  const [clientMode, setClientMode]       = useState<"tenant"|"saved"|"nuovo">("nuovo");
  const [autofilled, setAutofilled]       = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingData, setPendingData]     = useState<any>(null);

  const today = new Date().toISOString().split("T")[0];
  const nextMonth = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  })();

  const { register, control, handleSubmit, watch, setValue, getValues } =
    useForm<InvoiceFormValues>({
      defaultValues: {
        tenantId: "", clientName: "", clientAddress: "", clientCity: "",
        clientZip: "", clientVat: "", clientFiscalCode: "", clientSdi: "", clientPec: "",
        issueDate: today, dueDate: nextMonth, status: "pending",
        taxRegime: "ordinario", taxRate: 22, inpsRate: 0, ritenutaRate: 0, stampDuty: false,
        notes: "",
        lineItems: [{ description: "Servizio piattaforma DoFlow", quantity: 1, unitPrice: 0 }],
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });

  // Watch values
  const watchLineItems   = watch("lineItems");
  const watchTaxRate     = watch("taxRate");
  const watchTaxRegime   = watch("taxRegime");
  const watchInpsRate    = watch("inpsRate");
  const watchRitenuta    = watch("ritenutaRate");
  const watchStampDuty   = watch("stampDuty");

  const isForfettario = watchTaxRegime === "forfettario";

  // ── Calcoli fiscali in tempo reale ────────────────────────────────────────
  const safeItems  = Array.isArray(watchLineItems) ? watchLineItems : [];
  const imponibile = safeItems.reduce(
    (s, i) => s + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0), 0
  );
  const taxRate      = isForfettario ? 0 : (Number(watchTaxRate) || 22);
  const inpsRate     = Number(watchInpsRate) || 0;
  const ritenutaRate = Number(watchRitenuta)  || 0;

  const inpsAmount    = imponibile * inpsRate / 100;
  const baseConInps   = imponibile + inpsAmount;
  const ivaAmount     = isForfettario ? 0 : baseConInps * taxRate / 100;
  const ritenutaAmt   = imponibile * ritenutaRate / 100;

  // Bollo automatico in forfettario se imponibile > €77.47
  const autoStamp     = isForfettario && imponibile > STAMP_THRESHOLD;
  const stampAmount   = (watchStampDuty || autoStamp) ? 2.00 : 0;

  const totaleLordo   = baseConInps + ivaAmount + stampAmount;
  const totaleNetto   = totaleLordo - ritenutaAmt;

  // Quando si cambia regime, azzera/ripristina le aliquote
  useEffect(() => {
    if (isForfettario) {
      setValue("taxRate", 0);
      setValue("stampDuty", imponibile > STAMP_THRESHOLD);
    } else {
      if ((getValues("taxRate") || 0) === 0) setValue("taxRate", 22);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isForfettario, imponibile]);

  // Load tenants + saved clients
  useEffect(() => {
    apiFetch<Tenant[]>("/superadmin/tenants")
      .then((d) => setTenants(Array.isArray(d) ? d.filter(t => t?.id && t?.name) : []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
    apiFetch<InvoiceClient[]>("/superadmin/finance/clients")
      .then(d => setSavedClients(Array.isArray(d) ? d : []))
      .catch(() => setSavedClients([]));
  }, []);

  const handleClientSelect = useCallback((value: string) => {
    if (value === "__nuovo__") {
      setClientMode("nuovo");
      setValue("tenantId", "");
      setValue("clientName", ""); setValue("clientAddress", ""); setValue("clientCity", "");
      setValue("clientZip", ""); setValue("clientVat", ""); setValue("clientFiscalCode", "");
      setValue("clientSdi", ""); setValue("clientPec", "");
      return;
    }
    // Tenant
    const tenant = tenants.find(t => t.id === value);
    if (tenant) {
      setClientMode("tenant");
      setValue("tenantId", value);
      setValue("clientName", tenant.name);
      return;
    }
    // Saved client
    const sc = savedClients.find(c => c.id === value);
    if (sc) {
      setClientMode("saved");
      setValue("tenantId", "");
      setValue("clientName",       sc.clientName);
      setValue("clientAddress",    sc.clientAddress    ?? "");
      setValue("clientCity",       sc.clientCity       ?? "");
      setValue("clientZip",        sc.clientZip        ?? "");
      setValue("clientVat",        sc.clientVat        ?? "");
      setValue("clientFiscalCode", sc.clientFiscalCode ?? "");
      setValue("clientSdi",        sc.clientSdi        ?? "");
      setValue("clientPec",        sc.clientPec        ?? "");
      setAutofilled(true);
      setTimeout(() => setAutofilled(false), 2500);
    }
  }, [tenants, savedClients, setValue]);

  // Current select value for controlled Select
  const selectValue = (() => {
    const tid = (document?.querySelector?.('[name="tenantId"]') as any)?.value ?? "";
    if (clientMode === "nuovo") return "__nuovo__";
    if (clientMode === "tenant") {
      const t = tenants.find(t => t.name === (document?.querySelector?.('[name="clientName"]') as any)?.value);
      return t?.id ?? "";
    }
    const sc = savedClients.find(c => c.clientName === (document?.querySelector?.('[name="clientName"]') as any)?.value);
    return sc?.id ?? "";
  })();

  const buildPayload = (data: InvoiceFormValues) => ({
    ...data,
    amount:    imponibile,
    taxRate:   isForfettario ? 0 : Number(data.taxRate),
    stampDuty: data.stampDuty || autoStamp,
    lineItems: data.lineItems.map(i => ({
      description: i.description,
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      total:       Number(i.quantity) * Number(i.unitPrice),
    })),
  });

  const onSubmit = async (data: InvoiceFormValues) => {
    setSubmitting(true);
    try {
      await apiFetch("/superadmin/finance/invoices", {
        method: "POST",
        body: JSON.stringify(buildPayload(data)),
      });
      // Nuovo cliente → chiedi se salvare
      if (clientMode === "nuovo" && data.clientName?.trim()) {
        setPendingData(data);
        setShowSaveDialog(true);
      } else {
        router.push("/superadmin/finance/invoices");
      }
    } catch (e: any) {
      alert(`Errore: ${e?.message || "Errore sconosciuto"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSaveClient = async () => {
    if (pendingData) {
      try {
        await apiFetch("/superadmin/finance/clients/upsert", {
          method: "POST",
          body: JSON.stringify({
            clientName:       pendingData.clientName,
            clientAddress:    pendingData.clientAddress    || undefined,
            clientCity:       pendingData.clientCity       || undefined,
            clientZip:        pendingData.clientZip        || undefined,
            clientVat:        pendingData.clientVat        || undefined,
            clientFiscalCode: pendingData.clientFiscalCode || undefined,
            clientSdi:        pendingData.clientSdi        || undefined,
            clientPec:        pendingData.clientPec        || undefined,
          }),
        });
      } catch (e) { console.error("Errore salvataggio cliente", e); }
    }
    router.push("/superadmin/finance/invoices");
  };

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <>
    {/* Dialog conferma salvataggio nuovo cliente */}
    <Dialog open={showSaveDialog} onOpenChange={v => { if (!v) router.push("/superadmin/finance/invoices"); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Salvare il cliente?</DialogTitle>
          <DialogDescription>
            Vuoi aggiungere <strong>{pendingData?.clientName}</strong> all&apos;anagrafica clienti?
            La prossima volta apparirà nel menu a tendina.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button type="button" onClick={() => router.push("/superadmin/finance/invoices")}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg border hover:bg-muted transition-colors">
            No, continua
          </button>
          <button type="button" onClick={handleConfirmSaveClient}
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors">
            Sì, salva cliente
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/superadmin/finance/invoices">
          <Button variant="ghost" size="icon" className="rounded-full shadow-sm bg-card border">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Crea Nuova Fattura
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Compila i dati fiscali e aggiungi le voci per generare una fattura conforme.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Regime Fiscale ──────────────────────────────────────────────── */}
        <div className="bg-card glass-card rounded-2xl border border-border/50 p-6">
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            Regime Fiscale
            {isForfettario && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                IVA NON APPLICATA
              </Badge>
            )}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Regime</label>
              <Select onValueChange={(v: "ordinario"|"forfettario") => setValue("taxRegime", v)} value={watchTaxRegime}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordinario">Regime Ordinario (IVA)</SelectItem>
                  <SelectItem value="forfettario">Regime Forfettario (L. 190/2014)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">IVA (%)</label>
              <Input type="number" step="1" disabled={isForfettario}
                {...register("taxRate", { valueAsNumber: true })}
                className={isForfettario ? "opacity-40" : ""} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Rivalsa INPS (%)</label>
              <Input type="number" step="0.5" {...register("inpsRate", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Ritenuta Acc. (%)</label>
              <Input type="number" step="0.5" {...register("ritenutaRate", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2 flex flex-col">
              <label className="text-xs font-bold text-muted-foreground uppercase">Marca da Bollo (2€)</label>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="stampDuty" {...register("stampDuty")} className="h-4 w-4 rounded" />
                <label htmlFor="stampDuty" className="text-sm text-muted-foreground">
                  {autoStamp ? "Aggiunta automaticamente" : "Aggiungi bollo"}
                </label>
                {autoStamp && <Badge className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">AUTO</Badge>}
              </div>
            </div>
          </div>

          {isForfettario && (
            <div className="mt-4 flex gap-2 items-start bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                In regime forfettario l&apos;IVA non viene applicata. Il PDF includerà la dicitura legale obbligatoria
                (Legge 190/2014){imponibile > STAMP_THRESHOLD ? ` e la marca da bollo da €2,00 (imponibile > €${STAMP_THRESHOLD}).` : "."}
              </p>
            </div>
          )}
        </div>

        {/* ── Dati Documento e Cliente ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Documento */}
          <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-4">
            <h2 className="text-base font-bold border-b pb-2">Dati Documento</h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                Seleziona Cliente
                {autofilled && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    <Sparkles className="h-2.5 w-2.5" /> Compilato automaticamente
                  </span>
                )}
              </label>
              <Select onValueChange={handleClientSelect} value={clientMode === "nuovo" ? "__nuovo__" : ""}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingTenants ? "Caricamento..." : "Scegli cliente..."} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tenant</div>
                      {tenants.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </>
                  )}
                  {savedClients.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clienti Salvati</div>
                      {savedClients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-medium">{c.clientName}</span>
                          {c.clientVat && <span className="text-muted-foreground text-xs ml-2">{c.clientVat}</span>}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  <Separator className="my-1" />
                  <SelectItem value="__nuovo__">
                    <span className="flex items-center gap-2 text-indigo-600 font-semibold">
                      <UserPlus className="h-3.5 w-3.5" /> Nuovo cliente…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Ragione Sociale *</label>
              <Input {...register("clientName", { required: true })} placeholder="Mario Rossi S.r.l." readOnly={clientMode !== "nuovo"} className={clientMode !== "nuovo" ? "bg-muted/50 cursor-default" : ""} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Data Emissione</label>
                <Input type="date" {...register("issueDate", { required: true })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Scadenza</label>
                <Input type="date" {...register("dueDate", { required: true })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Stato</label>
                <Select onValueChange={(v: "paid"|"pending"|"overdue") => setValue("status", v)} value={watch("status")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Pagata</SelectItem>
                    <SelectItem value="pending">In Scadenza</SelectItem>
                    <SelectItem value="overdue">Scaduta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Dati Fiscali Cliente */}
          <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-4">
            <h2 className="text-base font-bold border-b pb-2">Dati Fiscali Committente</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Partita IVA</label>
                <Input {...register("clientVat")} placeholder="IT12345678901" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Codice Fiscale</label>
                <Input {...register("clientFiscalCode")} placeholder="RSSMRA80A01H501U" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Indirizzo</label>
              <Input {...register("clientAddress")} placeholder="Via Roma 1" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">CAP</label>
                <Input {...register("clientZip")} placeholder="20121" maxLength={5} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Città</label>
                <Input {...register("clientCity")} placeholder="Milano MI" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Codice SDI</label>
                <Input {...register("clientSdi")} placeholder="0000000" maxLength={7} className="font-mono" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">PEC</label>
                <Input {...register("clientPec")} type="email" placeholder="cliente@pec.it" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Voci Fattura ───────────────────────────────────────────────── */}
        <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h2 className="text-base font-bold">Voci Fattura (Line Items)</h2>
            <Button type="button" variant="outline" size="sm"
              onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi Riga
            </Button>
          </div>

          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-[1fr_80px_130px_130px_40px] gap-3 px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <div>Descrizione</div><div>Q.tà</div><div>Prezzo Un. (€)</div><div className="text-right">Totale</div><div />
            </div>

            {fields.map((field, index) => {
              const rowQty   = Number(safeItems[index]?.quantity)  || 0;
              const rowPrice = Number(safeItems[index]?.unitPrice) || 0;
              return (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_80px_130px_130px_40px] gap-3 items-center
                     bg-muted/30 p-3 md:p-0 rounded-lg md:rounded-none border md:border-none border-border/40">
                  <Input {...register(`lineItems.${index}.description`, { required: true })} placeholder="Descrizione servizio..." />
                  <Input type="number" step="0.01" {...register(`lineItems.${index}.quantity`, { required: true, valueAsNumber: true })} />
                  <Input type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`, { required: true, valueAsNumber: true })} />
                  <div className="text-right font-mono font-bold text-sm text-foreground bg-muted/50 p-2 rounded-md h-10 flex items-center justify-end">
                    {fmtCurrency(rowQty * rowPrice)}
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => remove(index)} disabled={fields.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Riepilogo Fiscale e Note ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Note */}
          <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">Note / Condizioni di Pagamento</label>
            <textarea
              {...register("notes")}
              className="w-full min-h-[140px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Es. Pagamento entro 30gg. IBAN: IT..."
            />
          </div>

          {/* Totali */}
          <div className="bg-muted/30 p-6 rounded-2xl border border-border/50 space-y-3">
            <h2 className="text-base font-bold mb-4">Riepilogo Importi</h2>

            {[
              { label: "Imponibile:",              value: fmtCurrency(imponibile),   show: true },
              { label: `Rivalsa INPS (${inpsRate}%):`, value: fmtCurrency(inpsAmount), show: inpsAmount > 0 },
              { label: `IVA (${taxRate}%):`,       value: isForfettario ? "Non applicata" : fmtCurrency(ivaAmount), show: true },
              { label: "Marca da Bollo:",           value: fmtCurrency(stampAmount), show: stampAmount > 0 },
              { label: `Ritenuta (${ritenutaRate}%):`, value: `-${fmtCurrency(ritenutaAmt)}`, show: ritenutaAmt > 0 },
            ].filter(r => r.show).map(r => (
              <div key={r.label} className="flex justify-between items-center text-sm text-muted-foreground">
                <span>{r.label}</span>
                <span className="tabular-nums font-medium">{r.value}</span>
              </div>
            ))}

            <div className="pt-3 border-t flex justify-between items-center">
              <span className="font-bold text-foreground">Totale da Pagare:</span>
              <span className="text-3xl font-black text-primary tabular-nums">{fmtCurrency(totaleNetto)}</span>
            </div>
          </div>
        </div>

        {/* ── Azioni ─────────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-4 pt-2">
          <Link href="/superadmin/finance/invoices">
            <Button type="button" variant="ghost" className="rounded-xl px-8">Annulla</Button>
          </Link>
          <Button type="submit" className="rounded-xl px-8 shadow-md gap-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvataggio...</>
            ) : (
              <><Receipt className="h-4 w-4" /> Salva Fattura</>
            )}
          </Button>
        </div>
      </form>
    </div>
    </>
  );
}
