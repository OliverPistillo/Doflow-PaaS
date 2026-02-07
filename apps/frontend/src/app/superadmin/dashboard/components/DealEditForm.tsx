"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { STAGE_CONFIG } from "../utils";

interface Deal {
  id: string;
  name: string;
  clientName: string;
  value: number;
  stage: string;
  winProbability: number;
  expectedCloseDate: string;
  // assignedTo: string; // Futuro
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
    value: deal.value,
    stage: deal.stage,
    winProbability: deal.winProbability * 100, // Visualizza come 0-100
    expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : '',
    assignedTo: "Daniele", // Mock
  });

  // Mock dei servizi (solo UI per ora)
  const [services, setServices] = useState<string[]>(["Website Design"]);
  const [newService, setNewService] = useState("");

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/superadmin/dashboard/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           ...formData,
           winProbability: formData.winProbability / 100 // Torna a 0-1 per il backend
        }),
      });
      onSave(); 
    } catch (error) {
      console.error(error);
      alert("Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const addService = () => {
    if (newService.trim()) {
      setServices([...services, newService]);
      setNewService("");
    }
  };

  return (
    <div className="space-y-6 px-1">
      {/* Header Form */}
      <div className="flex items-center justify-between border-b pb-4 mb-4">
        <div>
           <h2 className="text-xl font-bold text-slate-900">{formData.title}</h2>
           <p className="text-xs text-slate-500">ID: {deal.id}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Nome Offerta */}
        <div className="grid gap-2">
          <Label>Nome offerta</Label>
          <Input 
            value={formData.title} 
            onChange={(e) => setFormData({...formData, title: e.target.value})} 
          />
        </div>

        {/* Stato Trattativa */}
        <div className="grid gap-2">
          <Label>Stato trattativa</Label>
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
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: STAGE_CONFIG[stageKey].color}}/>
                    {stageKey}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Valore e Probabilità */}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Valore (€)</Label>
            <Input 
              type="number" 
              step="0.01"
              value={formData.value} 
              onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value) || 0})} 
            />
          </div>
          <div className="grid gap-2">
            <Label>Probabilità (%)</Label>
            <Input 
              type="number" 
              min="0" max="100"
              value={formData.winProbability} 
              onChange={(e) => setFormData({...formData, winProbability: parseFloat(e.target.value) || 0})} 
            />
          </div>
        </div>

        {/* Data e Assegnatario */}
        <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
            <Label>Data di chiusura prevista</Label>
            <Input 
                type="date" 
                value={formData.expectedCloseDate} 
                onChange={(e) => setFormData({...formData, expectedCloseDate: e.target.value})} 
            />
            </div>
            <div className="grid gap-2">
            <Label>Assegnato a</Label>
            <Select value={formData.assignedTo} onValueChange={(val) => setFormData({...formData, assignedTo: val})}>
                <SelectTrigger>
                <SelectValue />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="Daniele">Daniele</SelectItem>
                <SelectItem value="Federica">Federica</SelectItem>
                <SelectItem value="Marco">Marco</SelectItem>
                </SelectContent>
            </Select>
            </div>
        </div>

        {/* Cliente */}
        <div className="grid gap-2">
          <Label>Cliente</Label>
          <Input 
            value={formData.clientName} 
            onChange={(e) => setFormData({...formData, clientName: e.target.value})} 
          />
        </div>

        {/* Servizi (Mock UI) */}
        <div className="grid gap-2 border p-3 rounded-md bg-slate-50">
           <Label>Servizi inclusi</Label>
           <div className="space-y-2">
              {services.map((s, idx) => (
                 <div key={idx} className="flex justify-between items-center bg-white border p-2 rounded text-sm">
                    <span>{s}</span>
                    <Trash2 className="h-4 w-4 text-slate-400 cursor-pointer hover:text-red-500" onClick={() => setServices(services.filter((_, i) => i !== idx))} />
                 </div>
              ))}
           </div>
           <div className="flex gap-2 mt-2">
              <Input 
                placeholder="Nuovo servizio..." 
                value={newService} 
                onChange={(e) => setNewService(e.target.value)}
                className="bg-white"
              />
              <Button type="button" size="sm" onClick={addService} variant="outline"><Plus className="h-4 w-4" /></Button>
           </div>
        </div>

        {/* Footer */}
        <div className="pt-4 flex justify-end gap-2 border-t mt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Annulla</Button>
          <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Salva
          </Button>
        </div>

      </form>
    </div>
  );
}