"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Loader2, ArrowLeft, Plus, Trash2, Receipt, AlertTriangle,
  UserPlus, Sparkles, Bookmark, FileText, FileCheck2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  invoiceNumber:     string;
  issueDate:         string;
  dueDate:           string;
  status:            "paid" | "pending" | "overdue";
  // Regime fiscale
  taxRegime:         "ordinario" | "forfettario";
  taxRate:           number;
  inpsRate:          number;
  ritenutaRate:      number;
  // Voci e note
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

type SavedService = {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
};

// ─── Dialog: salva cliente ────────────────────────────────────────────────────

function SaveClientDialog({ open, clientName, onSave, onSkip }: {
  open: boolean;
  clientName: string;
  onSave: () => Promise<void>;
  onSkip: () => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onSkip(); }}>
      <DialogContent className="sm:max-w-sm rounded-card">
        <DialogHeader>
          <DialogTitle>Salvare il cliente?</DialogTitle>
          <DialogDescription>
            Vuoi salvare <strong>{clientName}</strong> nell&apos;anagrafica clienti?
            La prossima volta comparirà nel menu a tendina.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onSkip} disabled={saving}>No, continua</Button>
          <Button size="sm" disabled={saving}
            onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Sì, salva cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: salva servizio ───────────────────────────────────────────────────

function SaveServiceDialog({ open, item, onSave, onSkip }: {
  open: boolean;
  item: LineItemForm | null;
  onSave: () => Promise<void>;
  onSkip: () => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onSkip(); }}>
      <DialogContent className="sm:max-w-sm rounded-card">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-nav bg-primary/10 flex items-center justify-center">
              <Bookmark className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Salvare il servizio?</DialogTitle>
          </div>
          <DialogDescription>
            Vuoi salvare <strong>{item?.description}</strong> nei servizi predefiniti?
            La prossima volta sarà disponibile nel selettore.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onSkip} disabled={saving}>No</Button>
          <Button size="sm" disabled={saving}
            onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Sì, salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function NewInvoicePage() {
  const router = useRouter();

  // Stato base
  const [docType, setDocType]           = useState<"preventivo" | "fattura">("preventivo");
  const [tenants, setTenants]           = useState<Tenant[]>([]);
  const [loadingTenants, setLoading]    = useState(true);
  const [isSubmitting, setSubmitting]   = useState(false);
  const [savedClients, setSavedClients] = useState<InvoiceClient[]>([]);
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);
  const [serviceSelectKey, setServiceSelectKey] = useState(0); // forza reset dopo ogni selezione
  const [clientMode, setClientMode]     = useState<"tenant" | "saved" | "nuovo">("nuovo");
  const [autofilled, setAutofilled]     = useState(false);

  // Dialog salvataggio cliente
  const [showSaveDialog, setShowSaveDialog]   = useState(false);
  const [pendingData, setPendingData]         = useState<any>(null);

  // Dialog salvataggio servizio
  const [showSaveServiceDialog, setShowSaveServiceDialog] = useState(false);
  const [pendingServiceIdx, setPendingServiceIdx]         = useState<number | null>(null);

  // Date di default
  const today = new Date().toISOString().split("T")[0];
  const nextMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  })();

  const { register, control, handleSubmit, watch, setValue, getValues } =
    useForm<InvoiceFormValues>({
      defaultValues: {
        tenantId: "", clientName: "", clientAddress: "", clientCity: "",
        clientZip: "", clientVat: "", clientFiscalCode: "", clientSdi: "", clientPec: "",
        invoiceNumber: "", issueDate: today, dueDate: nextMonth, status: "pending",
        taxRegime: "ordinario", taxRate: 22, inpsRate: 0, ritenutaRate: 0,
        notes: "",
        lineItems: [{ description: "Servizio piattaforma DoFlow", quantity: 1, unitPrice: 0 }],
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });

  // Watch values
  const watchLineItems = watch("lineItems");
  const watchTaxRate   = watch("taxRate");
  const watchTaxRegime = watch("taxRegime");
  const watchInpsRate  = watch("inpsRate");
  const watchRitenuta  = watch("ritenutaRate");

  const isForfettario = watchTaxRegime === "forfettario";

  // ── Calcoli fiscali ──────────────────────────────────────────────────────────
  const safeItems  = Array.isArray(watchLineItems) ? watchLineItems : [];
  const imponibile = safeItems.reduce(
    (s, i) => s + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0), 0
  );
  const taxRate      = isForfettario ? 0 : (Number(watchTaxRate) || 22);
  const inpsRate     = Number(watchInpsRate) || 0;
  const ritenutaRate = Number(watchRitenuta) || 0;

  const inpsAmount  = imponibile * inpsRate / 100;
  const baseConInps = imponibile + inpsAmount;
  const ivaAmount   = isForfettario ? 0 : baseConInps * taxRate / 100;
  const ritenutaAmt = imponibile * ritenutaRate / 100;
  const totaleLordo = baseConInps + ivaAmount;
  const totaleNetto = totaleLordo - ritenutaAmt;

  // Reset aliquote al cambio regime
  useEffect(() => {
    if (isForfettario) {
      setValue("taxRate", 0);
    } else {
      if ((getValues("taxRate") || 0) === 0) setValue("taxRate", 22);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isForfettario]);

  // Caricamento dati iniziali
  useEffect(() => {
    apiFetch<Tenant[]>("/superadmin/tenants")
      .then((d) => setTenants(Array.isArray(d) ? d.filter(t => t?.id && t?.name) : []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));

    apiFetch<InvoiceClient[]>("/superadmin/finance/clients")
      .then(d => setSavedClients(Array.isArray(d) ? d : []))
      .catch(() => setSavedClients([]));

    apiFetch<SavedService[]>("/superadmin/finance/services")
      .then(d => setSavedServices(Array.isArray(d) ? d : []))
      .catch(() => setSavedServices([]));
  }, []);

  // ── Gestione cliente ─────────────────────────────────────────────────────────
  const handleClientSelect = useCallback((value: string) => {
    if (value === "__nuovo__") {
      setClientMode("nuovo");
      setValue("tenantId", "");
      setValue("clientName", ""); setValue("clientAddress", ""); setValue("clientCity", "");
      setValue("clientZip", ""); setValue("clientVat", ""); setValue("clientFiscalCode", "");
      setValue("clientSdi", ""); setValue("clientPec", "");
      return;
    }
    const tenant = tenants.find(t => t.id === value);
    if (tenant) {
      setClientMode("tenant");
      setValue("tenantId", value);
      setValue("clientName", tenant.name);
      return;
    }
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

  // ── Gestione servizi ─────────────────────────────────────────────────────────
  const handleServiceSelect = useCallback((value: string) => {
    if (value === "__nuovo__") {
      append({ description: "", quantity: 1, unitPrice: 0 });
    } else {
      const svc = savedServices.find(s => s.id === value);
      if (svc) {
        append({ description: svc.description, quantity: svc.quantity || 1, unitPrice: svc.unitPrice });
      }
    }
    // Reset al placeholder dopo ogni selezione (evita la riga blu persistente)
    setServiceSelectKey(k => k + 1);
  }, [savedServices, append]);

  const openSaveService = (idx: number) => {
    const item = getValues(`lineItems.${idx}`);
    if (!item?.description?.trim()) return;
    setPendingServiceIdx(idx);
    setShowSaveServiceDialog(true);
  };

  const persistService = async () => {
    if (pendingServiceIdx === null) return;
    const item = getValues(`lineItems.${pendingServiceIdx}`);
    await apiFetch("/superadmin/finance/services", {
      method: "POST",
      body: JSON.stringify({
        description: item.description,
        unitPrice:   item.unitPrice,
        quantity:    item.quantity,
      }),
    });
    const updated = await apiFetch<SavedService[]>("/superadmin/finance/services").catch(() => []);
    setSavedServices(Array.isArray(updated) ? updated : []);
    setPendingServiceIdx(null);
    setShowSaveServiceDialog(false);
  };

  // ── Costruzione payload ──────────────────────────────────────────────────────
  const buildPayload = (data: InvoiceFormValues) => ({
    ...data,
    docType,
    amount:    imponibile,
    taxRate:   isForfettario ? 0 : Number(data.taxRate),
    lineItems: data.lineItems.map(i => ({
      description: i.description,
      quantity:    i.quantity,
      unitPrice:   i.unitPrice,
      total:       Number(i.quantity) * Number(i.unitPrice),
    })),
  });

  // ── Submit ───────────────────────────────────────────────────────────────────
  const onSubmit = async (data: InvoiceFormValues) => {
    setSubmitting(true);
    try {
      await apiFetch("/superadmin/finance/invoices", {
        method: "POST",
        body: JSON.stringify(buildPayload(data)),
      });
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

  // ─── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Dialog salva cliente */}
      <SaveClientDialog
        open={showSaveDialog}
        clientName={pendingData?.clientName ?? ""}
        onSave={async () => { await handleConfirmSaveClient(); }}
        onSkip={() => { setShowSaveDialog(false); router.push("/superadmin/finance/invoices"); }}
      />

      {/* Dialog salva servizio */}
      <SaveServiceDialog
        open={showSaveServiceDialog}
        item={pendingServiceIdx !== null ? getValues(`lineItems.${pendingServiceIdx}`) : null}
        onSave={persistService}
        onSkip={() => { setShowSaveServiceDialog(false); setPendingServiceIdx(null); }}
      />

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
              {docType === "preventivo"
                ? <><FileText className="h-6 w-6 text-primary" /> Crea Preventivo</>
                : <><FileCheck2 className="h-6 w-6 text-primary" /> Crea Fattura di Cortesia</>
              }
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {docType === "preventivo"
                ? "Documento proforma non fiscale — da inviare al cliente per approvazione."
                : "Documento di cortesia non fiscale — ricorda di emettere anche la fattura elettronica via SDI."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Tipo Documento ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            {([
              { type: "preventivo", label: "Preventivo", sub: "Proforma non fiscale", Icon: FileText },
              { type: "fattura",    label: "Fattura di Cortesia", sub: "Documento informativo", Icon: FileCheck2 },
            ] as const).map(({ type, label, sub, Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setDocType(type)}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                  docType === type
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  docType === type ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className={`font-bold text-sm ${docType === type ? "text-primary" : "text-foreground"}`}>
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </button>
            ))}
          </div>

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
                <Select
                  onValueChange={(v: "ordinario" | "forfettario") => setValue("taxRegime", v)}
                  value={watchTaxRegime}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinario">Regime Ordinario (IVA)</SelectItem>
                    <SelectItem value="forfettario">Regime Forfettario (L. 190/2014)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">IVA (%)</label>
                <Input
                  type="number" step="1" disabled={isForfettario}
                  {...register("taxRate", { valueAsNumber: true })}
                  className={isForfettario ? "opacity-40" : ""}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Rivalsa INPS (%)</label>
                <Input type="number" step="0.5" {...register("inpsRate", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Ritenuta Acc. (%)</label>
                <Input type="number" step="0.5" {...register("ritenutaRate", { valueAsNumber: true })} />
              </div>
            </div>

            {isForfettario && (
              <div className="mt-4 flex gap-2 items-start bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  In regime forfettario l&apos;IVA non viene applicata. Il PDF includerà la dicitura
                  legale obbligatoria (Legge 190/2014).
                </p>
              </div>
            )}
          </div>

          {/* ── Dati Documento e Cliente ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Documento */}
            <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-4">
              <h2 className="text-base font-bold border-b pb-2">Dati Documento</h2>

              {docType === "fattura" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                    Numero Fattura
                    <span className="text-[10px] font-medium text-muted-foreground/60 normal-case tracking-normal">
                      opzionale — solo per archivio interno
                    </span>
                  </label>
                  <Input
                    {...register("invoiceNumber")}
                    placeholder="Es. 2026-001"
                    className="font-mono"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                  Seleziona Cliente
                  {autofilled && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <Sparkles className="h-2.5 w-2.5" /> Compilato automaticamente
                    </span>
                  )}
                </label>
                <Select
                  onValueChange={handleClientSelect}
                  value={clientMode === "nuovo" ? "__nuovo__" : ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTenants ? "Caricamento..." : "Scegli cliente..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Tenant
                        </div>
                        {tenants.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {savedClients.length > 0 && (
                      <>
                        <Separator className="my-1" />
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Clienti Salvati
                        </div>
                        {savedClients.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="font-medium">{c.clientName}</span>
                            {c.clientVat && (
                              <span className="text-muted-foreground text-xs ml-2">{c.clientVat}</span>
                            )}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    <Separator className="my-1" />
                    <SelectItem value="__nuovo__">
                      <span className="flex items-center gap-2 text-primary font-semibold">
                        <UserPlus className="h-3.5 w-3.5" /> Nuovo cliente…
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Ragione Sociale *
                </label>
                <Input
                  {...register("clientName", { required: true })}
                  placeholder="Mario Rossi S.r.l."
                  readOnly={clientMode !== "nuovo"}
                  className={clientMode !== "nuovo" ? "bg-muted/50 cursor-default" : ""}
                />
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

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Stato</label>
                <Select
                  onValueChange={(v: "paid" | "pending" | "overdue") => setValue("status", v)}
                  value={watch("status")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Pagata</SelectItem>
                    <SelectItem value="pending">In Scadenza</SelectItem>
                    <SelectItem value="overdue">Scaduta</SelectItem>
                  </SelectContent>
                </Select>
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

          {/* ── Voci Fattura ─────────────────────────────────────────────────── */}
          <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-base font-bold">Voci Fattura</h2>
            </div>

            {/* Selettore servizi salvati */}
            <div className="mb-5 pb-4 border-b border-dashed border-border/60">
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                Aggiungi voce
              </label>
              <Select key={serviceSelectKey} onValueChange={handleServiceSelect}>
                <SelectTrigger className="max-w-lg focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none">
                  <SelectValue placeholder="Seleziona servizio salvato o aggiungi nuovo…" />
                </SelectTrigger>
                <SelectContent>
                  {savedServices.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Servizi Salvati
                      </div>
                      {savedServices.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="font-medium">{s.description}</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            — {fmtCurrency(s.unitPrice)}
                          </span>
                        </SelectItem>
                      ))}
                      <Separator className="my-1" />
                    </>
                  )}
                  <SelectItem value="__nuovo__">
                    <span className="flex items-center gap-2 text-primary font-semibold">
                      <Plus className="h-3.5 w-3.5" /> Aggiungi riga vuota
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabella voci */}
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-[1fr_80px_130px_130px_80px_40px] gap-3 px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <div>Descrizione</div>
                <div>Q.tà</div>
                <div>Prezzo Un. (€)</div>
                <div className="text-right">Totale</div>
                <div className="text-center">Salva</div>
                <div />
              </div>

              {fields.map((field, index) => {
                const rowQty   = Number(safeItems[index]?.quantity) || 0;
                const rowPrice = Number(safeItems[index]?.unitPrice) || 0;
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_80px_130px_130px_80px_40px] gap-3 items-center bg-muted/30 p-3 md:p-0 rounded-lg md:rounded-none border md:border-none border-border/40"
                  >
                    <Input
                      {...register(`lineItems.${index}.description`, { required: true })}
                      placeholder="Descrizione servizio…"
                    />
                    <Input
                      type="number" step="0.01"
                      {...register(`lineItems.${index}.quantity`, { required: true, valueAsNumber: true })}
                    />
                    <Input
                      type="number" step="0.01"
                      {...register(`lineItems.${index}.unitPrice`, { required: true, valueAsNumber: true })}
                    />
                    <div className="text-right font-mono font-bold text-sm text-foreground bg-muted/50 p-2 rounded-md h-10 flex items-center justify-end">
                      {fmtCurrency(rowQty * rowPrice)}
                    </div>
                    {/* Salva servizio */}
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-10 w-10"
                        onClick={() => openSaveService(index)}
                        title="Salva come servizio predefinito"
                      >
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Riepilogo Fiscale e Note ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Note */}
            <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-4">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Note / Condizioni di Pagamento
              </label>
              <textarea
                {...register("notes")}
                className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder="Es. Pagamento a 30gg data fattura tramite bonifico bancario."
              />

            </div>

            {/* Totali */}
            <div className="bg-muted/30 p-6 rounded-2xl border border-border/50 space-y-3">
              <h2 className="text-base font-bold mb-4">Riepilogo Importi</h2>

              {[
                { label: "Imponibile:",                        value: fmtCurrency(imponibile),   show: true },
                { label: `Rivalsa INPS (${inpsRate}%):`,       value: fmtCurrency(inpsAmount),   show: inpsAmount > 0 },
                { label: `IVA (${taxRate}%):`,                  value: isForfettario ? "Non applicata" : fmtCurrency(ivaAmount), show: true },
                { label: `Ritenuta (${ritenutaRate}%):`,        value: `-${fmtCurrency(ritenutaAmt)}`, show: ritenutaAmt > 0 },
              ].filter(r => r.show).map(r => (
                <div key={r.label} className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{r.label}</span>
                  <span className="tabular-nums font-medium">{r.value}</span>
                </div>
              ))}

              <div className="pt-3 border-t flex justify-between items-center">
                <span className="font-bold text-foreground">
                  {docType === "preventivo" ? "Totale preventivo:" : "Totale da pagare:"}
                </span>
                <span className="text-3xl font-black text-primary tabular-nums">
                  {fmtCurrency(totaleNetto)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Azioni ──────────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-4 pt-2">
            <Link href="/superadmin/finance/invoices">
              <Button type="button" variant="ghost" className="rounded-xl px-8">Annulla</Button>
            </Link>
            <Button type="submit" className="rounded-xl px-8 shadow-md gap-2" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Salvataggio…</>
              ) : (
                docType === "preventivo"
                ? <><FileText className="h-4 w-4" /> Salva Preventivo</>
                : <><FileCheck2 className="h-4 w-4" /> Salva Fattura di Cortesia</>
              )}
            </Button>
          </div>

        </form>
      </div>
    </>
  );
}