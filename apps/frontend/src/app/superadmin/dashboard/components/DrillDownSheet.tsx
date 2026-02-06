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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, Loader2, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { DealEditForm } from "./DealEditForm";

interface DrillDownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialFilters: {
    stage?: string;
    month?: string;
  };
}

export function DrillDownSheet({ isOpen, onClose, title, initialFilters }: DrillDownSheetProps) {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Stati per i filtri
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(initialFilters.stage || "all");
  
  // Stati per la navigazione (Lista vs Edit)
  const [view, setView] = useState<"LIST" | "EDIT">("LIST");
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

  // Fetch dei dati
  const fetchDeals = async () => {
    setLoading(true);
    try {
      // Costruiamo la query string
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      
      // Se il filtro è "all", non mandiamo nulla, altrimenti mandiamo il valore
      // Se arriva dai props (initialFilters), ha priorità finché non viene cambiato
      const stageToSend = stageFilter !== "all" ? stageFilter : undefined;
      if (stageToSend) params.append("stages", stageToSend);
      
      if (initialFilters.month) params.append("month", initialFilters.month);

      const res = await apiFetch<any[]>(`/superadmin/dashboard/deals?${params.toString()}`);
      setDeals(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Reset e Fetch quando si apre lo sheet o cambiano i filtri
  useEffect(() => {
    if (isOpen) {
      setView("LIST");
      setStageFilter(initialFilters.stage || "all"); // Reset filtro stage se cambia contesto
      fetchDeals();
    }
  }, [isOpen, initialFilters, stageFilter, search]);

  const handleEditClick = (deal: any) => {
    setSelectedDeal(deal);
    setView("EDIT");
  };

  const handleSave = () => {
    setView("LIST");
    fetchDeals(); // Ricarica i dati aggiornati
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        
        {/* VISTA: LISTA */}
        {view === "LIST" && (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold text-slate-900">{title}</SheetTitle>
              <SheetDescription>
                Lista dettagliata delle offerte. Clicca su una riga per modificare.
              </SheetDescription>
            </SheetHeader>

            {/* Barra dei Filtri */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Cerca per nome o cliente..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[180px]">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-400"/>
                        <SelectValue placeholder="Filtra Fase" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le fasi</SelectItem>
                    <SelectItem value="Lead qualificato">Lead qualificato</SelectItem>
                    <SelectItem value="Preventivo inviato">Preventivo inviato</SelectItem>
                    <SelectItem value="Negoziazione">Negoziazione</SelectItem>
                    <SelectItem value="Chiuso vinto">Chiuso vinto</SelectItem>
                  </SelectContent>
                </Select>
                {/* Qui potresti aggiungere altri filtri (Cliente, Mese) */}
              </div>
            </div>

            {/* Tabella Dati */}
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : deals.length === 0 ? (
              <div className="text-center py-10 text-slate-500 border rounded-lg bg-slate-50">
                Nessuna offerta trovata.
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Valore</TableHead>
                      <TableHead>Fase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => (
                      <TableRow 
                        key={deal.id} 
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => handleEditClick(deal)}
                      >
                        <TableCell>
                          <div className="font-medium text-slate-900">{deal.name}</div>
                          <div className="text-xs text-slate-500">{deal.clientName}</div>
                        </TableCell>
                        <TableCell>€{Number(deal.value).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                             deal.stage === 'Chiuso vinto' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                             deal.stage === 'Negoziazione' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                             deal.stage === 'Preventivo inviato' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                             'bg-slate-100 text-slate-700'
                          }>
                            {deal.stage}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {/* VISTA: EDIT */}
        {view === "EDIT" && selectedDeal && (
          <div className="animate-in slide-in-from-right duration-300">
             <Button variant="ghost" onClick={() => setView("LIST")} className="mb-4 pl-0 hover:pl-2 transition-all">
                <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla lista
             </Button>
             <DealEditForm 
                deal={selectedDeal} 
                onSave={handleSave} 
                onCancel={() => setView("LIST")} 
             />
          </div>
        )}

      </SheetContent>
    </Sheet>
  );
}