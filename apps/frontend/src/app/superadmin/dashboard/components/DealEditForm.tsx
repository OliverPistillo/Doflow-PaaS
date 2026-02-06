"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Deal {
  id: string;
  name: string;
  clientName: string;
  value: number;
  stage: string;
  winProbability: number;
  expectedCloseDate: string;
}

interface DealEditFormProps {
  deal: Deal;
  onSave: () => void;
  onCancel: () => void;
}

export function DealEditForm({ deal, onSave, onCancel }: DealEditFormProps) {
  const [formData, setFormData] = useState({
    name: deal.name,
    clientName: deal.clientName,
    value: deal.value,
    stage: deal.stage,
    winProbability: deal.winProbability,
    expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/superadmin/dashboard/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      onSave(); // Ricarica la lista padre
    } catch (error) {
      console.error("Errore salvataggio:", error);
      alert("Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-xl font-bold text-slate-900">{formData.name}</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="grid gap-2">
          <Label>Nome dell'offerta</Label>
          <Input 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})} 
          />
        </div>

        <div className="grid gap-2">
          <Label>Fase</Label>
          <Select 
            value={formData.stage} 
            onValueChange={(val) => setFormData({...formData, stage: val})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Lead qualificato">Lead qualificato</SelectItem>
              <SelectItem value="Preventivo inviato">Preventivo inviato</SelectItem>
              <SelectItem value="Negoziazione">Negoziazione</SelectItem>
              <SelectItem value="Chiuso vinto">Chiuso vinto</SelectItem>
              <SelectItem value="Chiuso perso">Chiuso perso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Valore (€)</Label>
            <Input 
              type="number" 
              value={formData.value} 
              onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value)})} 
            />
          </div>
          <div className="grid gap-2">
            <Label>Probabilità (%)</Label>
            <Input 
              type="number" 
              value={formData.winProbability} 
              onChange={(e) => setFormData({...formData, winProbability: parseInt(e.target.value)})} 
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Data di chiusura prevista</Label>
          <Input 
            type="date" 
            value={formData.expectedCloseDate} 
            onChange={(e) => setFormData({...formData, expectedCloseDate: e.target.value})} 
          />
        </div>

        <div className="grid gap-2">
          <Label>Cliente</Label>
          <Input 
            value={formData.clientName} 
            onChange={(e) => setFormData({...formData, clientName: e.target.value})} 
          />
        </div>

        <div className="pt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Annulla</Button>
          <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Salva Modifiche
          </Button>
        </div>

      </form>
    </div>
  );
}