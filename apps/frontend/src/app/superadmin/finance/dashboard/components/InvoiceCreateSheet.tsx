"use client";

import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

// Tipo Invoice (copiato per coerenza, ideale spostarlo in types.ts)
type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: string;
};

interface InvoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoiceToEdit?: Invoice | null; // <--- NUOVO
}

export function InvoiceCreateSheet({ isOpen, onClose, onSuccess, invoiceToEdit }: InvoiceSheetProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    clientName: "",
    amount: "",
    issueDate: "",
    dueDate: "",
    status: "pending"
  });

  // Reset o Popola al cambio di apertura
  useEffect(() => {
    if (isOpen) {
      if (invoiceToEdit) {
        // MODALITÀ MODIFICA
        setFormData({
          invoiceNumber: invoiceToEdit.invoiceNumber,
          clientName: invoiceToEdit.clientName,
          amount: invoiceToEdit.amount.toString(),
          issueDate: invoiceToEdit.issueDate ? new Date(invoiceToEdit.issueDate).toISOString().split('T')[0] : "",
          dueDate: invoiceToEdit.dueDate ? new Date(invoiceToEdit.dueDate).toISOString().split('T')[0] : "",
          status: invoiceToEdit.status
        });
      } else {
        // MODALITÀ CREAZIONE
        setFormData({
            invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
            clientName: "",
            amount: "",
            issueDate: new Date().toISOString().split('T')[0],
            dueDate: "",
            status: "pending"
        });
      }
    }
  }, [isOpen, invoiceToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
          ...formData,
          amount: parseFloat(formData.amount)
      };

      if (invoiceToEdit) {
          // PATCH (Modifica)
          // Nota: Assicurati che il backend supporti PATCH /invoices/:id. 
          // Se non lo supporta ancora, dovremo aggiungerlo nel controller backend.
          // Per ora assumiamo di sì o che userai un workaround (es. delete + create, ma meglio patch).
          await apiFetch(`/superadmin/finance/invoices/${invoiceToEdit.id}`, {
             method: "PATCH",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify(payload),
          });
      } else {
          // POST (Creazione)
          await apiFetch("/superadmin/finance/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      }

      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Errore salvataggio fattura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{invoiceToEdit ? "Modifica Fattura" : "Nuova Fattura"}</SheetTitle>
          <SheetDescription>{invoiceToEdit ? "Aggiorna i dati della fattura esistente." : "Registra una nuova fattura emessa."}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="grid gap-2">
            <Label>Numero Fattura</Label>
            <Input required value={formData.invoiceNumber} onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})} />
          </div>

          <div className="grid gap-2">
            <Label>Cliente</Label>
            <Input required placeholder="Es. Acme Corp" value={formData.clientName} onChange={(e) => setFormData({...formData, clientName: e.target.value})} />
          </div>

          <div className="grid gap-2">
            <Label>Importo (€)</Label>
            <Input required type="number" step="0.01" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="grid gap-2">
                <Label>Emissione</Label>
                <Input type="date" required value={formData.issueDate} onChange={(e) => setFormData({...formData, issueDate: e.target.value})} />
             </div>
             <div className="grid gap-2">
                <Label>Scadenza</Label>
                <Input type="date" required value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} />
             </div>
          </div>

          <div className="grid gap-2">
            <Label>Stato</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
               <SelectTrigger><SelectValue /></SelectTrigger>
               <SelectContent>
                  <SelectItem value="pending">In Scadenza (Pending)</SelectItem>
                  <SelectItem value="paid">Pagata</SelectItem>
                  <SelectItem value="overdue">Scaduta</SelectItem>
               </SelectContent>
            </Select>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading} className="bg-slate-900">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {invoiceToEdit ? "Salva Modifiche" : "Registra Fattura"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}