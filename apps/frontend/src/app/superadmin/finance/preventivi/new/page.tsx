// Percorso: apps/frontend/src/app/superadmin/finance/preventivi/new/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Loader2, ArrowLeft, Plus, Trash2, FileText, UserPlus, Sparkles, Bookmark } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type LineItemForm = { description: string; quantity: number; unitPrice: number };

type FormValues = {
  tenantId: string; clientName: string; clientAddress: string; clientCity: string;
  clientZip: string; clientVat: string; clientFiscalCode: string; clientSdi: string; clientPec: string;
  issueDate: string; validUntil: string;
  notes: string; lineItems: LineItemForm[];
};

type Tenant        = { id: string; name: string };
type InvoiceClient = { id: string; clientName: string; clientVat?: string; clientAddress?: string; clientCity?: string; clientZip?: string; clientFiscalCode?: string; clientSdi?: string; clientPec?: string; invoiceCount: number };
type SavedService  = { id: string; description: string; unitPrice: number; quantity: number };

// ─── Dialog salva cliente ──────────────────────────────────────────────────────

function SaveClientDialog({ open, clientName, onSave, onSkip }: { open: boolean; clientName: string; onSave: () => Promise<void>; onSkip: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onSkip(); }}>
      <DialogContent className="sm:max-w-sm rounded-card">
        <DialogHeader>
          <DialogTitle>Salvare il cliente?</DialogTitle>
          <DialogDescription>Vuoi salvare <strong>{clientName}</strong> nell&apos;anagrafica? Comparirà nel menu a tendina la prossima volta.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onSkip} disabled={saving}>No, continua</Button>
          <Button size="sm" disabled={saving} onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />} Sì, salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog salva servizio ─────────────────────────────────────────────────────

function SaveServiceDialog({ open, item, onSave, onSkip }: { open: boolean; item: LineItemForm | null; onSave: () => Promise<void>; onSkip: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onSkip(); }}>
      <DialogContent className="sm:max-w-sm rounded-card">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-nav bg-indigo-50 flex items-center justify-center">
              <Bookmark className="h-5 w-5 text-indigo-600" />
            </div>
            <DialogTitle>Salvare il servizio?</DialogTitle>
          </div>
          <DialogDescription>Vuoi salvare <strong>{item?.description}</strong> nei servizi predefiniti?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onSkip} disabled={saving}>No</Button>
          <Button size="sm" disabled={saving} onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />} Sì, salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pagina ────────────────────────────────────────────────────────────────────

export default function NewPreventivoPage() {
  const router = useRouter();
  const [tenants, setTenants]             = useState<Tenant[]>([]);
  const [loadingTenants, setLoading]      = useState(true);
  const [isSubmitting, setSubmitting]     = useState(false);
  const [savedClients, setSavedClients]   = useState<InvoiceClient[]>([]);
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);
  const [serviceSelectKey, setServiceSelectKey] = useState(0);
  const [clientMode, setClientMode]       = useState<"tenant" | "saved" | "nuovo">("nuovo");
  const [autofilled, setAutofilled]       = useState(false);
  const [showSaveDialog, setShowSaveDialog]               = useState(false);
  const [pendingData, setPendingData]                     = useState<any>(null);
  const [showSaveServiceDialog, setShowSaveServiceDialog] = useState(false);
  const [pendingServiceIdx, setPendingServiceIdx]         = useState<number | null>(null);

  // Validità preventivo: 30 giorni da oggi
  const today = new Date().toISOString().split("T")[0];
  const in30  = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();

  const { register, control, handleSubmit, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: {
      tenantId: "", clientName: "", clientAddress: "", clientCity: "", clientZip: "",
      clientVat: "", clientFiscalCode: "", clientSdi: "", clientPec: "",
      issueDate: today, validUntil: in30,
      notes: "Il presente preventivo ha validità 30 giorni dalla data di emissione.",
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const watchLineItems = watch("lineItems");
  const safeItems  = Array.isArray(watchLineItems) ? watchLineItems : [];
  const totale     = safeItems.reduce((s, i) => s + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0), 0);

  useEffect(() => {
    apiFetch<Tenant[]>("/superadmin/tenants").then(d => setTenants(Array.isArray(d) ? d.filter(t => t?.id && t?.name) : [])).catch(() => setTenants([])).finally(() => setLoading(false));
    apiFetch<InvoiceClient[]>("/superadmin/finance/clients").then(d => setSavedClients(Array.isArray(d) ? d : [])).catch(() => setSavedClients([]));
    apiFetch<SavedService[]>("/superadmin/finance/services").then(d => setSavedServices(Array.isArray(d) ? d : [])).catch(() => setSavedServices([]));
  }, []);

  const handleClientSelect = useCallback((value: string) => {
    if (value === "__nuovo__") {
      setClientMode("nuovo");
      ["tenantId","clientName","clientAddress","clientCity","clientZip","clientVat","clientFiscalCode","clientSdi","clientPec"].forEach(f => setValue(f as any, ""));
      return;
    }
    const tenant = tenants.find(t => t.id === value);
    if (tenant) { setClientMode("tenant"); setValue("tenantId", value); setValue("clientName", tenant.name); return; }
    const sc = savedClients.find(c => c.id === value);
    if (sc) {
      setClientMode("saved"); setValue("tenantId", "");
      setValue("clientName", sc.clientName); setValue("clientAddress", sc.clientAddress ?? "");
      setValue("clientCity", sc.clientCity ?? ""); setValue("clientZip", sc.clientZip ?? "");
      setValue("clientVat", sc.clientVat ?? ""); setValue("clientFiscalCode", sc.clientFiscalCode ?? "");
      setValue("clientSdi", sc.clientSdi ?? ""); setValue("clientPec", sc.clientPec ?? "");
      setAutofilled(true); setTimeout(() => setAutofilled(false), 2500);
    }
  }, [tenants, savedClients, setValue]);

  const handleServiceSelect = useCallback((value: string) => {
    if (value === "__nuovo__") append({ description: "", quantity: 1, unitPrice: 0 });
    else { const svc = savedServices.find(s => s.id === value); if (svc) append({ description: svc.description, quantity: svc.quantity || 1, unitPrice: svc.unitPrice }); }
    setServiceSelectKey(k => k + 1);
  }, [savedServices, append]);

  const openSaveService = (idx: number) => {
    if (!getValues(`lineItems.${idx}`)?.description?.trim()) return;
    setPendingServiceIdx(idx); setShowSaveServiceDialog(true);
  };

  const persistService = async () => {
    if (pendingServiceIdx === null) return;
    const item = getValues(`lineItems.${pendingServiceIdx}`);
    await apiFetch("/superadmin/finance/services", { method: "POST", body: JSON.stringify({ description: item.description, unitPrice: item.unitPrice, quantity: item.quantity }) });
    const updated = await apiFetch<SavedService[]>("/superadmin/finance/services").catch(() => []);
    setSavedServices(Array.isArray(updated) ? updated : []);
    setPendingServiceIdx(null); setShowSaveServiceDialog(false);
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await apiFetch("/superadmin/finance/invoices", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          docType: "preventivo",
          amount: totale,
          dueDate: data.validUntil,
          status: "pending",
          taxRegime: "forfettario",
          taxRate: 0, inpsRate: 0, ritenutaRate: 0,
          lineItems: data.lineItems.map(i => ({ ...i, total: Number(i.quantity) * Number(i.unitPrice) })),
        }),
      });
      if (clientMode === "nuovo" && data.clientName?.trim()) { setPendingData(data); setShowSaveDialog(true); }
      else router.push("/superadmin/finance/invoices");
    } catch (e: any) { alert(`Errore: ${e?.message || "Errore sconosciuto"}`); }
    finally { setSubmitting(false); }
  };

  const saveClient = async () => {
    if (!pendingData) return;
    await apiFetch("/superadmin/finance/clients/upsert", { method: "POST", body: JSON.stringify({ clientName: pendingData.clientName, clientAddress: pendingData.clientAddress || undefined, clientCity: pendingData.clientCity || undefined, clientZip: pendingData.clientZip || undefined, clientVat: pendingData.clientVat || undefined, clientFiscalCode: pendingData.clientFiscalCode || undefined, clientSdi: pendingData.clientSdi || undefined, clientPec: pendingData.clientPec || undefined }) }).catch(console.error);
    router.push("/superadmin/finance/invoices");
  };

  const fmt = (v: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);

  return (
    <>
      <SaveClientDialog open={showSaveDialog} clientName={pendingData?.clientName ?? ""} onSave={saveClient} onSkip={() => { setShowSaveDialog(false); router.push("/superadmin/finance/invoices"); }} />
      <SaveServiceDialog open={showSaveServiceDialog} item={pendingServiceIdx !== null ? getValues(`lineItems.${pendingServiceIdx}`) : null} onSave={persistService} onSkip={() => { setShowSaveServiceDialog(false); setPendingServiceIdx(null); }} />

      <div className="max-w-5xl mx-auto py-8 px-4">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/superadmin/finance/invoices">
            <Button variant="ghost" size="icon" className="rounded-full shadow-sm bg-card border"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-indigo-600" /> Nuovo Preventivo
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Documento proforma non fiscale — da inviare al cliente per approvazione prima di iniziare i lavori.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Dati Documento + Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-4">
              <h2 className="text-base font-bold border-b pb-2">Dati Documento</h2>

              {/* Selettore cliente */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                  Cliente
                  {autofilled && <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full"><Sparkles className="h-2.5 w-2.5" /> Compilato</span>}
                </label>
                <Select onValueChange={handleClientSelect} value={clientMode === "nuovo" ? "__nuovo__" : ""}>
                  <SelectTrigger><SelectValue placeholder={loadingTenants ? "Caricamento..." : "Scegli cliente..."} /></SelectTrigger>
                  <SelectContent>
                    {tenants.length > 0 && (<><div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Tenant</div>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</>)}
                    {savedClients.length > 0 && (<><Separator className="my-1" /><div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Salvati</div>{savedClients.map(c => <SelectItem key={c.id} value={c.id}><span className="font-medium">{c.clientName}</span>{c.clientVat && <span className="text-muted-foreground text-xs ml-2">{c.clientVat}</span>}</SelectItem>)}</>)}
                    <Separator className="my-1" />
                    <SelectItem value="__nuovo__"><span className="flex items-center gap-2 text-indigo-600 font-semibold"><UserPlus className="h-3.5 w-3.5" /> Nuovo cliente…</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ragione sociale */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Ragione Sociale *</label>
                <Input {...register("clientName", { required: true })} placeholder="Mario Rossi S.r.l." readOnly={clientMode !== "nuovo"} className={clientMode !== "nuovo" ? "bg-muted/50 cursor-default" : ""} />
              </div>

              {/* Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Data Preventivo</label>
                  <Input type="date" {...register("issueDate", { required: true })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Valido Fino Al</label>
                  <Input type="date" {...register("validUntil", { required: true })} />
                </div>
              </div>
            </div>

            {/* Dati cliente (solo ragione, indirizzo, piva) */}
            <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-4">
              <h2 className="text-base font-bold border-b pb-2">Dati Cliente</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground uppercase">Partita IVA</label><Input {...register("clientVat")} placeholder="IT12345678901" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground uppercase">Codice Fiscale</label><Input {...register("clientFiscalCode")} placeholder="RSSMRA80A01H501U" /></div>
              </div>
              <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground uppercase">Indirizzo</label><Input {...register("clientAddress")} placeholder="Via Roma 1" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground uppercase">CAP</label><Input {...register("clientZip")} placeholder="20121" maxLength={5} /></div>
                <div className="space-y-2 col-span-2"><label className="text-xs font-bold text-muted-foreground uppercase">Città</label><Input {...register("clientCity")} placeholder="Milano MI" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground uppercase">SDI</label><Input {...register("clientSdi")} placeholder="0000000" maxLength={7} className="font-mono" /></div>
                <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground uppercase">PEC</label><Input {...register("clientPec")} type="email" placeholder="cliente@pec.it" /></div>
              </div>
            </div>
          </div>

          {/* Voci */}
          <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-base font-bold">Voci Preventivo</h2>
            </div>
            <div className="mb-5 pb-4 border-b border-dashed border-border/60">
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Aggiungi voce</label>
              <Select key={serviceSelectKey} onValueChange={handleServiceSelect}>
                <SelectTrigger className="max-w-lg focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none">
                  <SelectValue placeholder="Seleziona servizio salvato o aggiungi nuovo…" />
                </SelectTrigger>
                <SelectContent>
                  {savedServices.length > 0 && (<><div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Servizi Salvati</div>{savedServices.map(s => <SelectItem key={s.id} value={s.id}><span className="font-medium">{s.description}</span><span className="text-muted-foreground text-xs ml-2">— {fmt(s.unitPrice)}</span></SelectItem>)}<Separator className="my-1" /></>)}
                  <SelectItem value="__nuovo__"><span className="flex items-center gap-2 text-indigo-600 font-semibold"><Plus className="h-3.5 w-3.5" /> Aggiungi riga vuota</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-[1fr_80px_130px_130px_80px_40px] gap-3 px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <div>Descrizione</div><div>Q.tà</div><div>Prezzo Un. (€)</div><div className="text-right">Totale</div><div className="text-center">Salva</div><div />
              </div>
              {fields.map((field, index) => {
                const rowTotal = (Number(safeItems[index]?.quantity) || 0) * (Number(safeItems[index]?.unitPrice) || 0);
                return (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_80px_130px_130px_80px_40px] gap-3 items-center bg-muted/30 p-3 md:p-0 rounded-lg md:rounded-none border md:border-none border-border/40">
                    <Input {...register(`lineItems.${index}.description`, { required: true })} placeholder="Descrizione servizio…" />
                    <Input type="number" step="0.01" {...register(`lineItems.${index}.quantity`, { required: true, valueAsNumber: true })} />
                    <Input type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`, { required: true, valueAsNumber: true })} />
                    <div className="text-right font-mono font-bold text-sm bg-muted/50 p-2 rounded-md h-10 flex items-center justify-end">{fmt(rowTotal)}</div>
                    <div className="flex justify-center">
                      <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 h-10 w-10" onClick={() => openSaveService(index)}><Bookmark className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => remove(index)} disabled={fields.length === 1}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note + Totale */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Note / Condizioni</label>
              <textarea {...register("notes")} className="w-full min-h-[140px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" placeholder="Es. Tempi di consegna, modalità di pagamento, esclusioni…" />
            </div>
            <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/40 space-y-3">
              <h2 className="text-base font-bold mb-4">Riepilogo</h2>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Totale voci:</span>
                <span className="tabular-nums font-medium">{fmt(totale)}</span>
              </div>
              <div className="pt-3 border-t border-indigo-200/60 flex justify-between items-center">
                <span className="font-bold text-foreground">Totale preventivo:</span>
                <span className="text-3xl font-black text-indigo-600 tabular-nums">{fmt(totale)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2">
                Il preventivo non include IVA (regime forfettario). Il prezzo è da intendersi tutto incluso.
              </p>
            </div>
          </div>

          {/* Azioni */}
          <div className="flex justify-end gap-4 pt-2">
            <Link href="/superadmin/finance/invoices">
              <Button type="button" variant="ghost" className="rounded-xl px-8">Annulla</Button>
            </Link>
            <Button type="submit" className="rounded-xl px-8 shadow-md gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvataggio…</> : <><FileText className="h-4 w-4" /> Salva Preventivo</>}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}