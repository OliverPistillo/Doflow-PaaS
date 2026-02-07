"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { STAGE_CONFIG } from "../utils";

interface Deal {
  id: string;
  name: string; // Corrisponde a 'title' nel DB
  clientName: string;
  value: number; // Euro (float)
  stage: string;
  winProbability: number; // % (float)
  expectedCloseDate: string;
}

interface DealEditFormProps {
  deal: Deal;
  onSave: () => void;
  onCancel: () => void;
}

export function DealEditForm({ deal, onSave, onCancel }: DealEditFormProps) {
  const [formData, setFormData] = useState({
    title: deal.name,
    clientName: deal.clientName,
    value: deal.value, // Euro
    stage: deal.stage,
    winProbability: deal.winProbability, // 0-100
    expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Il Backend si aspetta { title, value (Euro), winProbability (%), ... }
      await apiFetch(`/superadmin/dashboard/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      onSave(); 
    } catch (error) {
      console.error("Errore salvataggio:", error);
      alert("Errore durante il salvataggio. Controlla la console.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-xl font-bold text-slate-900">Modifica Offerta</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Titolo Offerta */}
        <div className="grid gap-2">
          <Label htmlFor="title">Nome dell'offerta</Label>
          <Input 
            id="title"
            value={formData.title} 
            onChange={(e) => setFormData({...formData, title: e.target.value})} 
          />
        </div>

        {/* Fase */}
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
              {Object.keys(STAGE_CONFIG).map((stageKey) => (
                <SelectItem key={stageKey} value={stageKey}>
                  {stageKey}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Valore e Probabilità */}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="value">Valore (€)</Label>
            <Input 
              id="value"
              type="number" 
              step="0.01"
              value={formData.value} 
              onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value) || 0})} 
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prob">Probabilità (%)</Label>
            <Input 
              id="prob"
              type="number" 
              min="0" max="100"
              value={formData.winProbability} 
              onChange={(e) => setFormData({...formData, winProbability: parseFloat(e.target.value) || 0})} 
            />
          </div>
        </div>

        {/* Data e Cliente */}
        <div className="grid gap-2">
          <Label htmlFor="date">Data di chiusura prevista</Label>
          <Input 
            id="date"
            type="date" 
            value={formData.expectedCloseDate} 
            onChange={(e) => setFormData({...formData, expectedCloseDate: e.target.value})} 
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="client">Cliente</Label>
          <Input 
            id="client"
            value={formData.clientName} 
            onChange={(e) => setFormData({...formData, clientName: e.target.value})} 
          />
        </div>

        {/* Pulsanti Azione */}
        <div className="pt-4 flex justify-end gap-2 border-t mt-6">
          <Button type="button" variant="outline" onClick={onCancel}>Annulla</Button>
          <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Salva Modifiche
          </Button>
        </div>

      </form>
    </div>
  );
}