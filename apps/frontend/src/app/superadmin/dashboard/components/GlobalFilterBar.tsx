"use client";

import React, { useEffect, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { STAGE_CONFIG } from "../utils"; // Usa le tue costanti
import { apiFetch } from "@/lib/api";

export interface DashboardFilters {
  stage?: string;
  month?: string; // "1"..."12"
  clientName?: string;
}

interface GlobalFilterBarProps {
  filters: DashboardFilters;
  onFilterChange: (newFilters: DashboardFilters) => void;
}

export function GlobalFilterBar({ filters, onFilterChange }: GlobalFilterBarProps) {
  const [clients, setClients] = useState<string[]>([]);

  // Carica i clienti per il dropdown
  useEffect(() => {
    apiFetch<string[]>("/superadmin/dashboard/filters/clients")
      .then(setClients)
      .catch(console.error);
  }, []);

  const updateFilter = (key: keyof DashboardFilters, value: string | undefined) => {
    onFilterChange({ ...filters, [key]: value === "all" ? undefined : value });
  };

  const hasActiveFilters = filters.stage || filters.month || filters.clientName;

  return (
    <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-6">
      <span className="text-sm font-semibold text-slate-700">Filtra per:</span>
      
      {/* Filtro A: Stato Trattativa */}
      <Select 
        value={filters.stage || "all"} 
        onValueChange={(val) => updateFilter("stage", val)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Stato trattativa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli stati</SelectItem>
          {Object.entries(STAGE_CONFIG).map(([key, config]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: config.color }} />
                {config.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filtro B: Mese Chiusura */}
      <Select 
        value={filters.month || "all"} 
        onValueChange={(val) => updateFilter("month", val)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Mese chiusura" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i mesi</SelectItem>
          {Array.from({ length: 12 }, (_, i) => {
            const monthName = new Date(0, i).toLocaleString('it-IT', { month: 'long' });
            return (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Filtro C: Cliente */}
      <Select 
        value={filters.clientName || "all"} 
        onValueChange={(val) => updateFilter("clientName", val)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i clienti</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client} value={client}>{client}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onFilterChange({})}
          className="text-slate-500 hover:text-red-500"
        >
          <X className="mr-2 h-4 w-4" /> Resetta
        </Button>
      )}
    </div>
  );
}