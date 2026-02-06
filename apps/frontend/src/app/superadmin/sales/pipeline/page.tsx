"use client";

import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- Dati Mock ---
type Deal = {
  id: string;
  name: string;
  client: string;
  service: string;
  value: number;
  probability: number;
  closeDate: string;
};

type Stage = {
  id: string;
  label: string;
  color: string;
  items: Deal[];
};

const INITIAL_DATA: Stage[] = [
  {
    id: "lead",
    label: "Lead qualificato",
    color: "bg-blue-100 text-blue-700",
    items: [
      { id: "1", name: "App Mobile", client: "GreenLeaf Ventures", service: "IT Support", value: 1500, probability: 40, closeDate: "01/08/2024" },
      { id: "2", name: "Nu Innovations Pilot", client: "Silverline Realty", service: "Personal Training", value: 2500, probability: 45, closeDate: "05/08/2024" },
      { id: "3", name: "Theta Group Data Analysis", client: "Peak Performance Gym", service: "Bookkeeping", value: 1000, probability: 50, closeDate: "10/08/2024" },
    ]
  },
  {
    id: "proposal",
    label: "Preventivo inviato",
    color: "bg-amber-100 text-amber-700",
    items: [
      { id: "4", name: "Supporto tecnico", client: "Petal Pushers", service: "Video Editing", value: 1500, probability: 55, closeDate: "18/07/2024" },
      { id: "5", name: "Migrazione Cloud", client: "Sunrise Health", service: "SEO Optimization", value: 2000, probability: 65, closeDate: "25/07/2024" },
      { id: "6", name: "Epsilon Ltd Security", client: "TechNova Inc.", service: "Logo Design", value: 500, probability: 20, closeDate: "15/08/2024" },
    ]
  },
  {
    id: "negotiation",
    label: "Negoziazione",
    color: "bg-purple-100 text-purple-700",
    items: [
      { id: "7", name: "Pacchetto Formazione", client: "Blue Horizon Travel", service: "Event Photo", value: 1500, probability: 75, closeDate: "05/07/2024" },
      { id: "8", name: "Contratto annuale Beta", client: "Bright Future LLC", service: "Social Media", value: 2000, probability: 80, closeDate: "10/07/2024" },
    ]
  },
  {
    id: "won",
    label: "Chiuso vinto",
    color: "bg-emerald-100 text-emerald-700",
    items: [
      { id: "9", name: "Iota Systems HW Upgrade", client: "Maple & Co.", service: "App Dev", value: 500, probability: 100, closeDate: "10/06/2024" },
      { id: "10", name: "Integrazione CRM", client: "Urban Eats", service: "Copywriting", value: 1000, probability: 100, closeDate: "20/06/2024" },
    ]
  }
];

export default function PipelinePage() {
  const [stages, setStages] = useState(INITIAL_DATA);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    lead: true, proposal: true, negotiation: true, won: true
  });

  const toggle = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline delle offerte</h1>
          <p className="text-slate-500 text-sm">Gestisci le opportunità di vendita e monitora le conversioni.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" /> Filtra
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" /> Nuova Offerta
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {stages.map((stage) => (
          <div key={stage.id} className="space-y-2">
            {/* Header Fase */}
            <div 
              className="flex items-center gap-2 cursor-pointer select-none group" 
              onClick={() => toggle(stage.id)}
            >
              <div className="p-1 rounded-md hover:bg-slate-200 transition-colors">
                {expanded[stage.id] ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              </div>
              <Badge variant="secondary" className={`px-2 py-1 text-xs font-semibold rounded-md ${stage.color}`}>
                {stage.label}
              </Badge>
              <span className="text-xs text-slate-400 font-medium">{stage.items.length}</span>
            </div>

            {/* Tabella Fase */}
            {expanded[stage.id] && (
              <div className="border rounded-lg bg-white shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nome dell'offerta</th>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Servizi</th>
                      <th className="px-4 py-3 font-medium">Valore</th>
                      <th className="px-4 py-3 font-medium">Probabilità</th>
                      <th className="px-4 py-3 font-medium">Chiusura prevista</th>
                      <th className="px-4 py-3 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stage.items.map((deal) => (
                      <tr key={deal.id} className="hover:bg-slate-50/50 group">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border-0 ${stage.color}`}>
                              {stage.label}
                            </Badge>
                            {deal.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="font-normal text-slate-600 bg-slate-100 hover:bg-slate-200">
                            {deal.client}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-slate-500 border-slate-200">
                            {deal.service}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          €{deal.value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {deal.probability}%
                        </td>
                        <td className="px-4 py-3 text-slate-500 flex items-center gap-2">
                          <Calendar className="h-3 w-3" /> {deal.closeDate}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Modifica</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">Elimina</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t bg-slate-50/30">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-indigo-600">
                    <Plus className="h-3 w-3 mr-1" /> Aggiungi record
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}