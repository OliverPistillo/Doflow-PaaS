"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string;
  clientCity?: string;
  clientZip?: string;
  clientVat?: string;
  clientFiscalCode?: string;
  clientSdi?: string;
  clientPec?: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: string;
};

interface InvoiceClient {
  id: string;
  clientName: string;
  contactName?: string;
  clientVat?: string;
  clientFiscalCode?: string;
  clientSdi?: string;
  clientPec?: string;
  clientAddress?: string;
  clientCity?: string;
  clientZip?: string;
  paymentMethod?: string;
  invoiceCount: number;
}

interface InvoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoiceToEdit?: Invoice | null;
}

// ─── Client Autocomplete ──────────────────────────────────────────────────────

function ClientAutocomplete({
  value, onChange, onSelect, clients,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (c: InvoiceClient) => void;
  clients: InvoiceClient[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return clients
      .filter(c => c.clientName.toLowerCase().includes(q))
      .slice(0, 7);
  }, [value, clients]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          required
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Es. Acme Srl — inizia a digitare..."
          className="pl-9 pr-8"
        />
        {value && (
          <button type="button" onClick={() => { onChange(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1.5 w-full bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-1.5 flex items-center gap-1.5 bg-muted/40 border-b border-border/50">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Clienti salvati · click per compilare automaticamente
            </span>
          </div>
          {suggestions.map(client => (
            <button key={client.id} type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors flex items-center gap-3 group border-b border-border/20 last:border-0"
              onMouseDown={e => { e.preventDefault(); onSelect(client); setOpen(false); }}>
              <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  {client.clientName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {[client.clientVat, client.clientCity].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0 border-indigo-200 dark:border-indigo-800 text-indigo-600">
                {client.invoiceCount} fatt.
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InvoiceCreateSheet({ isOpen, onClose, onSuccess, invoiceToEdit }: InvoiceSheetProps) {
  const [loading,    setLoading]    = useState(false);
  const [clients,    setClients]    = useState<InvoiceClient[]>([]);
  const [autofilled, setAutofilled] = useState(false);
  const [showExtra,  setShowExtra]  = useState(false); // sezione dati fiscali espandibile

  const [formData, setFormData] = useState({
    invoiceNumber:   "",
    clientName:      "",
    clientAddress:   "",
    clientCity:      "",
    clientZip:       "",
    clientVat:       "",
    clientFiscalCode:"",
    clientSdi:       "",
    clientPec:       "",
    amount:          "",
    issueDate:       "",
    dueDate:         "",
    status:          "pending",
  });

  // Carica anagrafica clienti all'apertura dello sheet
  useEffect(() => {
    if (!isOpen) return;
    apiFetch<InvoiceClient[]>("/superadmin/finance/clients")
      .then(data => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]));
  }, [isOpen]);

  // Reset / popola form al cambio apertura
  useEffect(() => {
    if (!isOpen) return;
    if (invoiceToEdit) {
      setFormData({
        invoiceNumber:    invoiceToEdit.invoiceNumber,
        clientName:       invoiceToEdit.clientName,
        clientAddress:    invoiceToEdit.clientAddress   ?? "",
        clientCity:       invoiceToEdit.clientCity      ?? "",
        clientZip:        invoiceToEdit.clientZip       ?? "",
        clientVat:        invoiceToEdit.clientVat       ?? "",
        clientFiscalCode: invoiceToEdit.clientFiscalCode ?? "",
        clientSdi:        invoiceToEdit.clientSdi       ?? "",
        clientPec:        invoiceToEdit.clientPec       ?? "",
        amount:           invoiceToEdit.amount.toString(),
        issueDate:        invoiceToEdit.issueDate ? new Date(invoiceToEdit.issueDate).toISOString().split("T")[0] : "",
        dueDate:          invoiceToEdit.dueDate   ? new Date(invoiceToEdit.dueDate).toISOString().split("T")[0]   : "",
        status:           invoiceToEdit.status,
      });
    } else {
      const year = new Date().getFullYear();
      setFormData({
        invoiceNumber:    `INV-${year}-${Math.floor(Math.random() * 900) + 100}`,
        clientName:       "",
        clientAddress:    "",
        clientCity:       "",
        clientZip:        "",
        clientVat:        "",
        clientFiscalCode: "",
        clientSdi:        "",
        clientPec:        "",
        amount:           "",
        issueDate:        new Date().toISOString().split("T")[0],
        dueDate:          "",
        status:           "pending",
      });
    }
    setShowExtra(false);
  }, [isOpen, invoiceToEdit]);

  // Quando si seleziona un cliente dall'autocomplete
  function handleClientSelect(client: InvoiceClient) {
    setFormData(prev => ({
      ...prev,
      clientName:       client.clientName,
      clientAddress:    client.clientAddress    ?? prev.clientAddress,
      clientCity:       client.clientCity       ?? prev.clientCity,
      clientZip:        client.clientZip        ?? prev.clientZip,
      clientVat:        client.clientVat        ?? prev.clientVat,
      clientFiscalCode: client.clientFiscalCode ?? prev.clientFiscalCode,
      clientSdi:        client.clientSdi        ?? prev.clientSdi,
      clientPec:        client.clientPec        ?? prev.clientPec,
    }));
    // Apri la sezione dati fiscali se ci sono dati pre-compilati
    if (client.clientVat || client.clientSdi || client.clientPec) setShowExtra(true);
    setAutofilled(true);
    setTimeout(() => setAutofilled(false), 2500);
  }

  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData, amount: parseFloat(formData.amount) };

      if (invoiceToEdit) {
        await apiFetch(`/superadmin/finance/invoices/${invoiceToEdit.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/superadmin/finance/invoices", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      // Persiste / aggiorna il cliente nell'anagrafica
      if (formData.clientName.trim()) {
        await apiFetch("/superadmin/finance/clients/upsert", {
          method: "POST",
          body: JSON.stringify({
            clientName:       formData.clientName,
            clientAddress:    formData.clientAddress    || undefined,
            clientCity:       formData.clientCity       || undefined,
            clientZip:        formData.clientZip        || undefined,
            clientVat:        formData.clientVat        || undefined,
            clientFiscalCode: formData.clientFiscalCode || undefined,
            clientSdi:        formData.clientSdi        || undefined,
            clientPec:        formData.clientPec        || undefined,
          }),
        }).catch(() => {}); // non blocca il flusso se fallisce
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio fattura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{invoiceToEdit ? "Modifica Fattura" : "Nuova Fattura"}</SheetTitle>
          <SheetDescription>
            {invoiceToEdit
              ? "Aggiorna i dati della fattura esistente."
              : "I dati del cliente vengono salvati automaticamente per le fatture future."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-6">

          {/* Numero fattura */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Numero Fattura</Label>
            <Input required value={formData.invoiceNumber} onChange={set("invoiceNumber")} />
          </div>

          <Separator />

          {/* ── Cliente ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                Dati Cliente
              </span>
              {autofilled && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full animate-in fade-in duration-300">
                  <Sparkles className="h-2.5 w-2.5" /> Compilato automaticamente
                </span>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Ragione Sociale *</Label>
              <ClientAutocomplete
                value={formData.clientName}
                onChange={v => setFormData(prev => ({ ...prev, clientName: v }))}
                onSelect={handleClientSelect}
                clients={clients}
              />
              {!formData.clientName && clients.length > 0 && (
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  {clients.length} client{clients.length === 1 ? "e salvato" : "i salvati"} — inizia a digitare per i suggerimenti
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Indirizzo</Label>
                <Input value={formData.clientAddress} onChange={set("clientAddress")} placeholder="Via Roma 1" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Città</Label>
                  <Input value={formData.clientCity} onChange={set("clientCity")} placeholder="Milano" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">CAP</Label>
                  <Input value={formData.clientZip} onChange={set("clientZip")} placeholder="20100" className="font-mono" />
                </div>
              </div>
            </div>

            {/* Dati fiscali (espandibili) */}
            <button type="button" onClick={() => setShowExtra(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {showExtra ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showExtra ? "Nascondi" : "Mostra"} dati fiscali (P.IVA, SDI, PEC)
            </button>

            {showExtra && (
              <div className="space-y-2 pl-1 border-l-2 border-indigo-100 dark:border-indigo-900">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Partita IVA</Label>
                    <Input value={formData.clientVat} onChange={set("clientVat")} placeholder="IT00000000000" className="font-mono" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Codice Fiscale</Label>
                    <Input value={formData.clientFiscalCode} onChange={set("clientFiscalCode")} placeholder="RSSMRA80A01H501Z" className="font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Codice SDI</Label>
                    <Input value={formData.clientSdi} onChange={set("clientSdi")} placeholder="0000000" className="font-mono" maxLength={7} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">PEC</Label>
                    <Input value={formData.clientPec} onChange={set("clientPec")} placeholder="cliente@pec.it" type="email" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Dati fattura ── */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Dati Fattura</span>

            <div className="grid gap-1.5">
              <Label className="text-xs">Importo imponibile (€) *</Label>
              <Input required type="number" step="0.01" min="0" placeholder="0.00"
                value={formData.amount} onChange={set("amount")} />
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
              <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">In Scadenza (Pending)</SelectItem>
                  <SelectItem value="paid">Pagata</SelectItem>
                  <SelectItem value="overdue">Scaduta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {invoiceToEdit ? "Salva Modifiche" : "Registra Fattura"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
