"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface InvoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InvoiceCreateSheet({ isOpen, onClose, onSuccess }: InvoiceSheetProps) {
  const [loading, setLoading] = useState(false);
  // Generiamo un numero fattura random per default
  const [formData, setFormData] = useState({
    invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
    clientName: "",
    amount: "",
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    status: "pending"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/superadmin/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...formData,
            amount: parseFloat(formData.amount) // Converti stringa in numero
        }),
      });
      onSuccess();
      onClose();
      // Reset form parziale
      setFormData(prev => ({ 
          ...prev, 
          clientName: "", 
          amount: "", 
          invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}` 
      }));
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
          <SheetTitle>Nuova Fattura</SheetTitle>
          <SheetDescription>Registra una nuova fattura emessa.</SheetDescription>
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
              Registra Fattura
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}