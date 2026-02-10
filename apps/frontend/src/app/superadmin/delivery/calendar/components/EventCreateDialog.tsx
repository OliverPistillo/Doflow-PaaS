"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

interface EventCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: Date;
}

export function EventCreateDialog({ isOpen, onClose, onSuccess, defaultDate }: EventCreateDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    date: defaultDate ? defaultDate.toISOString().split('T')[0] : "",
    type: "meeting",
    description: ""
  });
  const [loading, setLoading] = useState(false);

  // Aggiorna la data se cambia la selezione nel calendario
  React.useEffect(() => {
     if(defaultDate) {
         setFormData(prev => ({ ...prev, date: defaultDate.toISOString().split('T')[0] }));
     }
  }, [defaultDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/superadmin/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      onSuccess();
      onClose();
      setFormData({ title: "", date: "", type: "meeting", description: "" });
    } catch (e) {
      console.error(e);
      alert("Errore creazione evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo Evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Titolo</Label>
            <Input 
              required 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label>Data</Label>
            <Input 
              type="date" 
              required 
              value={formData.date} 
              onChange={(e) => setFormData({...formData, date: e.target.value})} 
            />
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end pt-4">
             <Button type="submit" disabled={loading}>
                {loading ? "Salvataggio..." : "Crea Evento"}
             </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}