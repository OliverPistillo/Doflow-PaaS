"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { Loader2, ArrowLeft, Plus, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

type LineItemForm = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type InvoiceFormValues = {
  tenantId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  taxRate: number;
  notes: string;
  lineItems: LineItemForm[];
};

type Tenant = {
  id: string;
  name: string;
  contactEmail?: string;
};

export default function NewInvoicePage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // MOCK default dates
  const today = new Date().toISOString().split("T")[0];
  const nextMonthDate = new Date();
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonth = nextMonthDate.toISOString().split("T")[0];

  const { register, control, handleSubmit, watch, setValue } = useForm<InvoiceFormValues>({
    defaultValues: {
      tenantId: "",
      clientName: "",
      issueDate: today,
      dueDate: nextMonth,
      status: "pending",
      taxRate: 22,
      notes: "",
      lineItems: [{ description: "Servizio piattaforma DoFlow", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchLineItems = watch("lineItems");
  const watchTaxRate = watch("taxRate");

  useEffect(() => {
    apiFetch<Tenant[]>("/superadmin/tenants")
      .then((data) => {
        if (Array.isArray(data)) {
          setTenants(data.filter(t => t && t.id && t.name));
        } else {
          setTenants([]);
        }
      })
      .catch((e) => {
        console.error("Errore caricamento tenants:", e);
        setTenants([]);
      })
      .finally(() => setLoadingTenants(false));
  }, []);

  // Calcolo totali con protezione null-safety
  const safeItems = Array.isArray(watchLineItems) ? watchLineItems : [];
  const subtotal = safeItems.reduce((acc, item) => acc + (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0), 0);
  const taxAmount = subtotal * ((Number(watchTaxRate) || 0) / 100);
  const total = subtotal + taxAmount;

  const onSubmit = async (data: InvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      // Setup payload matching backend entity
      const payload = {
        clientName: data.clientName,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        status: data.status,
        taxRate: data.taxRate,
        notes: data.notes,
        amount: total, // computed
        lineItems: data.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: Number(item.quantity) * Number(item.unitPrice),
        })),
        // we can also pass tenantId if the backend allows it, but for now clientName is used
      };

      await apiFetch("/superadmin/finance/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      router.push("/superadmin/finance/invoices");
    } catch (e) {
      console.error(e);
      alert("Errore durante la creazione della fattura");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTenantSelect = (id: string) => {
    const tenant = tenants.find((t) => t.id === id);
    if (tenant) {
      setValue("tenantId", id);
      setValue("clientName", tenant.name);
    }
  };

  const fmtCurrency = (val: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(val);
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/superadmin/finance/invoices">
          <Button variant="ghost" size="icon" className="rounded-full shadow-sm bg-white border">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Crea Nuova Fattura
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compila i dettagli e aggiungi le voci per generare una nuova fattura.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Dati Generali */}
          <div className="bg-card glass-card p-6 rounded-2xl shadow-sm border border-border/50 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Dati Intestazione</h2>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Seleziona Tenant / Cliente</label>
              <Select onValueChange={handleTenantSelect} value={watch("tenantId")}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={loadingTenants ? "Caricamento..." : "Scegli cliente..."} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  <SelectItem value="custom">Cliente Esterno (Personalizzato)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Ragione Sociale Intestatario</label>
              <Input {...register("clientName", { required: true })} placeholder="Es. Mario Rossi SRL" className="bg-white" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Data Emissione</label>
                <Input type="date" {...register("issueDate", { required: true })} className="bg-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Scadenza</label>
                <Input type="date" {...register("dueDate", { required: true })} className="bg-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Stato</label>
                <Select onValueChange={(v: "paid"|"pending"|"overdue") => setValue("status", v)} value={watch("status")}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Pagata</SelectItem>
                    <SelectItem value="pending">In Scadenza (Pending)</SelectItem>
                    <SelectItem value="overdue">Scaduta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Aliquota IVA (%)</label>
                <Input type="number" step="1" {...register("taxRate", { required: true, valueAsNumber: true })} className="bg-white" />
              </div>
            </div>
          </div>

          {/* Card Riepilogo e Note */}
          <div className="bg-slate-50 p-6 rounded-2xl shadow-inner border border-slate-200 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 border-b pb-2 mb-4">Riepilogo Importi</h2>
              <div className="space-y-3 mt-6">
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>Imponibile:</span>
                  <span className="tabular-nums">{fmtCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>IVA ({watchTaxRate}%):</span>
                  <span className="tabular-nums">{fmtCurrency(taxAmount)}</span>
                </div>
                <div className="pt-4 border-t border-slate-300 flex justify-between items-center">
                  <span className="font-bold text-lg text-slate-800 uppercase tracking-wide">Totale:</span>
                  <span className="text-4xl font-black text-indigo-700 tabular-nums tracking-tighter drop-shadow-sm">{fmtCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Note / Condizioni (Opzionale)</label>
              <textarea 
                {...register("notes")}
                className="w-full min-h-[100px] rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Grazie per aver scelto DoFlow. Coordinate bancarie: IT12X00000..."
              />
            </div>
          </div>
        </div>

        {/* Voci Fattura */}
        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border/50">
          <div className="flex justify-between items-center border-b pb-2 mb-4">
            <h2 className="text-lg font-bold text-slate-800">Voci Fattura (Line Items)</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi Riga
            </Button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_100px_150px_150px_40px] gap-4 mb-2 px-2 text-xs font-bold text-slate-500 uppercase tracking-widest hidden md:grid">
              <div>Descrizione</div>
              <div>Quantità</div>
              <div>Prezzo Un. (€)</div>
              <div className="text-right">Totale (€)</div>
              <div></div>
            </div>

            {fields.map((field, index) => {
              const rowQty = Number(safeItems[index]?.quantity) || 0;
              const rowPrice = Number(safeItems[index]?.unitPrice) || 0;
              const rowTotal = rowQty * rowPrice;

              return (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_100px_150px_150px_40px] gap-4 items-center bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg md:rounded-none border md:border-none border-slate-200">
                  <div className="space-y-1">
                    <label className="text-[10px] md:hidden font-bold text-slate-500 uppercase">Descrizione</label>
                    <Input {...register(`lineItems.${index}.description`, { required: true })} placeholder="Servizio..." className="bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] md:hidden font-bold text-slate-500 uppercase">Quantità</label>
                    <Input type="number" step="0.01" {...register(`lineItems.${index}.quantity`, { required: true, valueAsNumber: true })} className="bg-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] md:hidden font-bold text-slate-500 uppercase">Prezzo Un.</label>
                    <Input type="number" step="0.01" {...register(`lineItems.${index}.unitPrice`, { required: true, valueAsNumber: true })} className="bg-white" />
                  </div>
                  <div className="text-right font-mono font-bold text-slate-700 bg-white md:bg-slate-50 p-2 md:p-3 rounded-md border border-slate-200 md:border-none shadow-sm md:shadow-none h-10 flex items-center justify-end">
                    {fmtCurrency(rowTotal)}
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50" 
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

        {/* Azioni Form */}
        <div className="flex justify-end gap-4 pt-4">
          <Link href="/superadmin/finance/invoices">
            <Button type="button" variant="ghost" className="rounded-xl px-8">Annulla</Button>
          </Link>
          <Button type="submit" className="rounded-xl px-8 shadow-md" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvataggio...</>
            ) : (
              "Salva Fattura e Torna all'elenco"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
