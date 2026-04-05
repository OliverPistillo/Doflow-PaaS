// Percorso: apps/frontend/src/app/superadmin/finance/dashboard/components/InvoiceCreateSheet.tsx
// Fix: tutti i colori indigo-* → token semantici primary/*

"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Building2, Sparkles, ChevronDown, ChevronUp, Save, UserPlus } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Invoice = {
  id: string; invoiceNumber: string; clientName: string;
  clientAddress?: string; clientCity?: string; clientZip?: string;
  clientVat?: string; clientFiscalCode?: string; clientSdi?: string; clientPec?: string;
  amount: number; issueDate: string; dueDate: string; status: string;
};

interface InvoiceClient {
  id: string; clientName: string; clientVat?: string; clientFiscalCode?: string;
  clientSdi?: string; clientPec?: string; clientAddress?: string;
  clientCity?: string; clientZip?: string; paymentMethod?: string; invoiceCount: number;
}

interface InvoiceSheetProps {
  isOpen: boolean; onClose: () => void; onSuccess: () => void; invoiceToEdit?: Invoice | null;
}

function SaveClientDialog({ open, clientName, onSave, onSkip }: {
  open: boolean; clientName: string; onSave: () => Promise<void>; onSkip: () => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onSkip(); }}>
      <DialogContent className="sm:max-w-sm rounded-card">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            {/* ✅ bg-primary/10 invece di bg-indigo-100 */}
            <div className="h-10 w-10 rounded-nav bg-primary/10 flex items-center justify-center">
              <Save className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <DialogTitle>Salvare il cliente?</DialogTitle>
          </div>
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

const emptyForm = () => ({
  invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`,
  clientName: "", clientAddress: "", clientCity: "", clientZip: "",
  clientVat: "", clientFiscalCode: "", clientSdi: "", clientPec: "",
  amount: "", issueDate: new Date().toISOString().split("T")[0], dueDate: "", status: "pending",
});

export function InvoiceCreateSheet({ isOpen, onClose, onSuccess, invoiceToEdit }: InvoiceSheetProps) {
  const [loading,    setLoading]    = useState(false);
  const [clients,    setClients]    = useState<InvoiceClient[]>([]);
  const [showExtra,  setShowExtra]  = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [clientMode, setClientMode] = useState<"select" | "nuovo">("select");
  const [selectedId, setSelectedId] = useState<string>("");
  const [showSaveDialog,  setShowSaveDialog]  = useState(false);
  const [pendingFormData, setPendingFormData] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [formData, setFormData] = useState(emptyForm());

  useEffect(() => {
    if (!isOpen) return;
    apiFetch<InvoiceClient[]>("/superadmin/finance/clients")
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setShowExtra(false); setAutofilled(false); setClientMode("select"); setSelectedId("");
    if (invoiceToEdit) {
      setFormData({
        invoiceNumber:    invoiceToEdit.invoiceNumber,
        clientName:       invoiceToEdit.clientName,
        clientAddress:    invoiceToEdit.clientAddress    ?? "",
        clientCity:       invoiceToEdit.clientCity       ?? "",
        clientZip:        invoiceToEdit.clientZip        ?? "",
        clientVat:        invoiceToEdit.clientVat        ?? "",
        clientFiscalCode: invoiceToEdit.clientFiscalCode ?? "",
        clientSdi:        invoiceToEdit.clientSdi        ?? "",
        clientPec:        invoiceToEdit.clientPec        ?? "",
        amount:           invoiceToEdit.amount.toString(),
        issueDate:        invoiceToEdit.issueDate ? new Date(invoiceToEdit.issueDate).toISOString().split("T")[0] : "",
        dueDate:          invoiceToEdit.dueDate   ? new Date(invoiceToEdit.dueDate).toISOString().split("T")[0]   : "",
        status:           invoiceToEdit.status,
      });
    } else {
      setFormData(emptyForm());
    }
  }, [isOpen, invoiceToEdit]);

  function handleClientSelect(value: string) {
    if (value === "__nuovo__") {
      setClientMode("nuovo"); setSelectedId("");
      setFormData((prev) => ({
        ...prev, clientName: "", clientAddress: "", clientCity: "", clientZip: "",
        clientVat: "", clientFiscalCode: "", clientSdi: "", clientPec: "",
      }));
      return;
    }
    const client = clients.find((c) => c.id === value);
    if (!client) return;
    setSelectedId(value); setClientMode("select");
    setFormData((prev) => ({
      ...prev, clientName: client.clientName, clientAddress: client.clientAddress ?? "",
      clientCity: client.clientCity ?? "", clientZip: client.clientZip ?? "",
      clientVat: client.clientVat ?? "", clientFiscalCode: client.clientFiscalCode ?? "",
      clientSdi: client.clientSdi ?? "", clientPec: client.clientPec ?? "",
    }));
    if (client.clientVat || client.clientSdi || client.clientPec) setShowExtra(true);
    setAutofilled(true);
    setTimeout(() => setAutofilled(false), 2500);
  }

  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  async function persistInvoice(data: typeof formData) {
    const payload = { ...data, amount: parseFloat(data.amount) };
    if (invoiceToEdit) {
      await apiFetch(`/superadmin/finance/invoices/${invoiceToEdit.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      await apiFetch("/superadmin/finance/invoices", { method: "POST", body: JSON.stringify(payload) });
    }
  }

  async function persistClient(data: typeof formData) {
    await apiFetch("/superadmin/finance/clients/upsert", {
      method: "POST",
      body: JSON.stringify({
        clientName: data.clientName, clientAddress: data.clientAddress || undefined,
        clientCity: data.clientCity || undefined, clientZip: data.clientZip || undefined,
        clientVat: data.clientVat || undefined, clientFiscalCode: data.clientFiscalCode || undefined,
        clientSdi: data.clientSdi || undefined, clientPec: data.clientPec || undefined,
      }),
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await persistInvoice(formData);
      onSuccess();
      const isNewClient = clientMode === "nuovo" && formData.clientName.trim();
      if (isNewClient && !invoiceToEdit) {
        setPendingFormData({ ...formData }); setShowSaveDialog(true);
      } else { onClose(); }
    } catch (err) {
      console.error(err); alert("Errore salvataggio fattura");
    } finally { setLoading(false); }
  };

  const selectedClient = clients.find((c) => c.id === selectedId);

  return (
    <>
      <SaveClientDialog open={showSaveDialog} clientName={pendingFormData?.clientName ?? ""}
        onSave={async () => {
          if (pendingFormData) await persistClient(pendingFormData).catch(console.error);
          setShowSaveDialog(false); onClose();
        }}
        onSkip={() => { setShowSaveDialog(false); onClose(); }}
      />

      <Sheet open={isOpen && !showSaveDialog} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{invoiceToEdit ? "Modifica Fattura" : "Nuova Fattura"}</SheetTitle>
            <SheetDescription>
              {invoiceToEdit
                ? "Aggiorna i dati della fattura esistente."
                : "Seleziona un cliente salvato oppure scegli \"Nuovo\" per inserirne uno."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            <div className="grid gap-1.5">
              <Label className="text-xs">Numero Fattura</Label>
              <Input required value={formData.invoiceNumber} onChange={set("invoiceNumber")} />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {/* ✅ text-primary invece di text-indigo-600 */}
                <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Cliente</span>
                {autofilled && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-in fade-in">
                    <Sparkles className="h-2.5 w-2.5" aria-hidden="true" /> Compilato automaticamente
                  </span>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Ragione Sociale *</Label>
                <Select value={clientMode === "nuovo" ? "__nuovo__" : selectedId} onValueChange={handleClientSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder={clients.length > 0 ? "Seleziona cliente o scegli Nuovo…" : "Seleziona Nuovo per inserire un cliente…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-medium">{c.clientName}</span>
                        {c.clientVat && <span className="text-muted-foreground text-xs ml-2">{c.clientVat}</span>}
                      </SelectItem>
                    ))}
                    {clients.length > 0 && <Separator className="my-1" />}
                    <SelectItem value="__nuovo__">
                      {/* ✅ text-primary */}
                      <span className="flex items-center gap-2 text-primary font-semibold">
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        Nuovo cliente…
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {clientMode === "select" && selectedClient && (
                // ✅ bg-primary/5 border-primary/20 invece di bg-indigo-50 border-indigo-100
                <div className="rounded-nav border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="text-sm font-semibold text-primary">{selectedClient.clientName}</p>
                  {(selectedClient.clientAddress || selectedClient.clientCity) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[selectedClient.clientAddress, selectedClient.clientCity].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {clientMode === "nuovo" && (
                // ✅ border-primary/30 invece di border-indigo-200
                <div className="space-y-3 pl-3 border-l-2 border-primary/30">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Ragione Sociale *</Label>
                    <Input required placeholder="Es. Rossi Srl" value={formData.clientName} onChange={set("clientName")} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="grid gap-1.5 col-span-2">
                      <Label className="text-xs">Indirizzo</Label>
                      <Input value={formData.clientAddress} onChange={set("clientAddress")} placeholder="Via Roma 1" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">CAP</Label>
                      <Input value={formData.clientZip} onChange={set("clientZip")} placeholder="20100" className="font-mono" />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Città</Label>
                    <Input value={formData.clientCity} onChange={set("clientCity")} placeholder="Milano" />
                  </div>

                  <button type="button" onClick={() => setShowExtra((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {showExtra ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {showExtra ? "Nascondi" : "Aggiungi"} dati fiscali (P.IVA, C.F., SDI, PEC)
                  </button>

                  {showExtra && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Partita IVA</Label>
                          <Input value={formData.clientVat} onChange={set("clientVat")} placeholder="IT00000000000" className="font-mono text-xs" />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Codice Fiscale</Label>
                          <Input value={formData.clientFiscalCode} onChange={set("clientFiscalCode")} placeholder="RSSMRA…" className="font-mono text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Codice SDI</Label>
                          <Input value={formData.clientSdi} onChange={set("clientSdi")} placeholder="0000000" className="font-mono text-xs" maxLength={7} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">PEC</Label>
                          <Input value={formData.clientPec} onChange={set("clientPec")} placeholder="azienda@pec.it" type="email" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Dati Fattura</span>
              <div className="grid gap-1.5">
                <Label className="text-xs">Importo imponibile (€) *</Label>
                <Input required type="number" step="0.01" min="0" placeholder="0.00" value={formData.amount} onChange={set("amount")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Data emissione *</Label>
                  <Input type="date" required value={formData.issueDate} onChange={set("issueDate")} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Scadenza *</Label>
                  <Input type="date" required value={formData.dueDate} onChange={set("dueDate")} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Stato</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">In Scadenza</SelectItem>
                    <SelectItem value="paid">Pagata</SelectItem>
                    <SelectItem value="overdue">Scaduta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              {/* ✅ bg-foreground invece di bg-slate-900 */}
              <Button type="submit"
                disabled={loading || (!selectedId && clientMode === "select" && !invoiceToEdit)}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {invoiceToEdit ? "Salva Modifiche" : "Registra Fattura"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}