"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; 
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface TaskCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = ["Marketing", "Digital Services", "Technical Services", "Content Creation"];
const PRIORITIES = ["Alta", "Media", "Bassa", "Urgente"];

export function TaskCreateSheet({ isOpen, onClose, onSuccess }: TaskCreateSheetProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    serviceName: "",
    category: "Marketing",
    priority: "Media",
    dueDate: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // --- FIX: Prepariamo il payload pulito ---
      // Se la data è vuota, mandiamo undefined, altrimenti il backend esplode
      const payload = {
        ...formData,
        dueDate: formData.dueDate ? formData.dueDate : undefined,
        priority: formData.priority 
      };

      await apiFetch("/superadmin/delivery/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      onSuccess();
      onClose();
      // Reset form
      setFormData({ name: "", serviceName: "", category: "Marketing", priority: "Media", dueDate: "", notes: "" });
    } catch (e) {
      console.error(e);
      alert("Errore creazione task. Controlla che il backend sia avviato e la tabella esista.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nuovo Task di Delivery</SheetTitle>
          <SheetDescription>Aggiungi un nuovo task operativo al sistema.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          
          <div className="grid gap-2">
            <Label>Nome Task</Label>
            <Input 
              required 
              placeholder="Es. Setup Campagna FB"
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
            />
          </div>

          <div className="grid gap-2">
            <Label>Nome Servizio / Progetto</Label>
            <Input 
              required 
              placeholder="Es. Social Media Management"
              value={formData.serviceName} 
              onChange={(e) => setFormData({...formData, serviceName: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priorità</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Scadenza</Label>
            <Input 
              type="date" 
              value={formData.dueDate} 
              onChange={(e) => setFormData({...formData, dueDate: e.target.value})} 
            />
          </div>

          <div className="grid gap-2">
            <Label>Note</Label>
            <Textarea 
              className="resize-none h-24"
              placeholder="Dettagli aggiuntivi..."
              value={formData.notes} 
              onChange={(e) => setFormData({...formData, notes: e.target.value})} 
            />
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea Task
            </Button>
          </div>

        </form>
      </SheetContent>
    </Sheet>
  );
}