"use client";

import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, Loader2, ArrowLeft, PenSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { DealEditForm } from "./DealEditForm";
import { STAGE_CONFIG, formatCurrency } from "../utils";

interface DrillDownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialFilters: {
    stage?: string;
    month?: string; // Format YYYY-MM
    year?: number;
  };
}

export function DrillDownSheet({ isOpen, onClose, title, initialFilters }: DrillDownSheetProps) {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Stati Filtri Locali
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  
  // Navigazione (LISTA <-> EDIT)
  const [view, setView] = useState<"LIST" | "EDIT">("LIST");
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

  // Fetch Dati
  const fetchDeals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      
      // Logica Filtri:
      // Se c'è un filtro iniziale dai props (es. click su card "Lead"), usiamo quello a meno che l'utente non lo cambi esplicitamente.
      // Se l'utente seleziona "all", rimuoviamo il filtro stage.
      const currentStage = stageFilter !== "all" ? stageFilter : (initialFilters.stage || "");
      if (currentStage) params.append("stages", currentStage);
      
      // Filtri Temporali (dal props, es. "Chiudono questo mese")
      if (initialFilters.month) {
         // Esempio initialFilters.month = "2024-02"
         const [y, m] = initialFilters.month.split('-');
         params.append("expectedCloseYear", y);
         params.append("expectedCloseMonth", m);
      }

      const res = await apiFetch<any[]>(`/superadmin/dashboard/deals?${params.toString()}`);
      setDeals(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Fetch quando cambiano i parametri
  useEffect(() => {
    if (isOpen) {
      // Se si apre lo sheet, reset view e fetch
      if (view === "LIST") fetchDeals();
    }
  }, [isOpen, search, stageFilter, initialFilters, view]);

  // Reset stato quando si chiude
  useEffect(() => {
    if (!isOpen) {
      setView("LIST");
      setSearch("");
      setStageFilter("all");
    }
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto sm:w-[800px]">
        
        {/* VISTA: LISTA */}
        {view === "LIST" && (
          <>
            <SheetHeader className="mb-6 space-y-1">
              <SheetTitle className="text-2xl font-bold text-slate-900">{title}</SheetTitle>
              <SheetDescription>
                Clicca su un'offerta per visualizzare i dettagli o modificarla.
              </SheetDescription>
            </SheetHeader>

            {/* Filtri Bar */}
            <div className="flex flex-col gap-3 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Cerca offerta o cliente..."
                  className="pl-9 bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[200px] bg-white">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Filter className="h-4 w-4"/>
                        <SelectValue placeholder="Tutte le fasi" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le fasi</SelectItem>
                    {Object.keys(STAGE_CONFIG).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabella */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : deals.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Nessuna offerta trovata con i filtri correnti.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Offerta / Cliente</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Valore</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => {
                       const config = STAGE_CONFIG[deal.stage] || { badgeClass: 'bg-slate-100', label: deal.stage };
                       return (
                        <TableRow 
                          key={deal.id} 
                          className="cursor-pointer hover:bg-slate-50 transition-colors group"
                          onClick={() => { setSelectedDeal(deal); setView("EDIT"); }}
                        >
                          <TableCell className="py-3">
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {deal.name}
                            </div>
                            <div className="text-xs text-slate-500">{deal.clientName || 'Nessun cliente'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`font-normal ${config.badgeClass}`}>
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-700">
                            {formatCurrency(deal.value)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {/* VISTA: EDIT */}
        {view === "EDIT" && selectedDeal && (
          <div className="animate-in slide-in-from-right duration-300">
             <Button 
                variant="ghost" 
                onClick={() => setView("LIST")} 
                className="mb-2 pl-0 hover:pl-2 text-slate-500 hover:text-indigo-600 transition-all"
             >
                <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla lista
             </Button>
             
             <DealEditForm 
                deal={selectedDeal} 
                onSave={() => {
                  setView("LIST");
                  // Il fetch verrà triggerato dallo useEffect quando view torna a LIST
                }} 
                onCancel={() => setView("LIST")} 
             />
          </div>
        )}

      </SheetContent>
    </Sheet>
  );
}