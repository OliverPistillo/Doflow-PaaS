"use client";

import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; 
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

// Definizione del tipo Task (deve corrispondere a quella della pagina)
type Task = {
  id: string;
  name: string;
  serviceName: string;
  category: string;
  dueDate: string;
  priority: string;
  notes: string;
  status: string;
};

interface TaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskToEdit?: Task | null; // Se presente, siamo in modalità MODIFICA
}

const CATEGORIES = ["Marketing", "Digital Services", "Technical Services", "Content Creation"];
const PRIORITIES = ["Alta", "Media", "Bassa", "Urgente"];

export function TaskCreateSheet({ isOpen, onClose, onSuccess, taskToEdit }: TaskSheetProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    serviceName: "",
    category: "Marketing",
    priority: "Media",
    dueDate: "",
    notes: ""
  });

  // Effetto per popolare il form quando si apre in modifica
  useEffect(() => {
    if (isOpen && taskToEdit) {
      setFormData({
        name: taskToEdit.name,
        serviceName: taskToEdit.serviceName,
        category: taskToEdit.category,
        priority: taskToEdit.priority,
        // Gestione sicura della data: prendiamo solo la parte YYYY-MM-DD
        dueDate: taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().split('T')[0] : "",
        notes: taskToEdit.notes || ""
      });
    } else if (isOpen && !taskToEdit) {
      // Reset se stiamo creando nuovo
      setFormData({ name: "", serviceName: "", category: "Marketing", priority: "Media", dueDate: "", notes: "" });
    }
  }, [isOpen, taskToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        dueDate: formData.dueDate ? formData.dueDate : undefined,
        priority: formData.priority 
      };

      if (taskToEdit) {
        // --- MODALITÀ MODIFICA (PATCH) ---
        await apiFetch(`/superadmin/delivery/tasks/${taskToEdit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // --- MODALITÀ CREAZIONE (POST) ---
        await apiFetch("/superadmin/delivery/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Errore durante il salvataggio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{taskToEdit ? "Modifica Task" : "Nuovo Task"}</SheetTitle>
          <SheetDescription>
            {taskToEdit ? "Aggiorna i dettagli del task esistente." : "Aggiungi un nuovo task operativo al sistema."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          
          <div className="grid gap-2">
            <Label>Nome Task</Label>
            <Input 
              required 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
            />
          </div>

          <div className="grid gap-2">
            <Label>Nome Servizio / Progetto</Label>
            <Input 
              required 
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
              className="resize-none h-32"
              placeholder="Dettagli aggiuntivi..."
              value={formData.notes} 
              onChange={(e) => setFormData({...formData, notes: e.target.value})} 
            />
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {taskToEdit ? "Salva Modifiche" : "Crea Task"}
            </Button>
          </div>

        </form>
      </SheetContent>
    </Sheet>
  );
}