"use client";

import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { DealEditForm } from "./DealEditForm";
import { STAGE_CONFIG, formatCurrency } from "../utils";
import { DashboardFilters } from "./GlobalFilterBar";

// Definizione Tipi di Card per il Context
export type CardContextType = 'QUALIFIED_LEADS' | 'TOTAL_VALUE' | 'WIN_RATE' | 'AVG_VALUE' | 'CLOSING_THIS_MONTH' | null;

interface DrillDownSheetProps {
  cardType: CardContextType;
  onClose: () => void;
  globalFilters: DashboardFilters;
}

export function DrillDownSheet({ cardType, onClose, globalFilters }: DrillDownSheetProps) {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"LIST" | "EDIT">("LIST");
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

  // Titolo dinamico in base alla card selezionata
  const getTitle = () => {
    switch (cardType) {
      case 'QUALIFIED_LEADS': return "Offerte in fase di qualificazione";
      case 'TOTAL_VALUE': return "Tutte le offerte (Valore)";
      case 'WIN_RATE': return "Storico Vincite/Perdite";
      case 'AVG_VALUE': return "Offerte incluse nella media";
      case 'CLOSING_THIS_MONTH': return "In chiusura questo mese";
      default: return "Dettaglio Offerte";
    }
  };

  const fetchDeals = async () => {
    if (!cardType) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // 1. APPLICA I FILTRI GLOBALI DI BASE (Cliente, Mese)
      if (globalFilters.clientName) params.append("clientName", globalFilters.clientName);
      if (globalFilters.month) params.append("expectedCloseMonth", globalFilters.month);
      
      // 2. APPLICA LOGICA SPECIFICA DELLA CARD (Override o merge dei filtri)
      switch (cardType) {
        case 'QUALIFIED_LEADS':
          // Questa card DEVE mostrare solo i lead, ignorando il filtro stage globale se diverso
          params.set("stages", "Lead qualificato"); 
          break;
        
        case 'WIN_RATE':
          // Mostra solo Vinti o Persi
          params.append("stages", "Chiuso vinto");
          params.append("stages", "Chiuso perso");
          break;

        case 'CLOSING_THIS_MONTH':
           // Se c'è un filtro mese globale, usa quello, altrimenti usa il mese corrente
           if (!globalFilters.month) {
              const now = new Date();
              params.set("expectedCloseMonth", String(now.getMonth() + 1));
              params.set("expectedCloseYear", String(now.getFullYear()));
           }
           // Applichiamo lo stage globale se presente, altrimenti tutti
           if (globalFilters.stage) params.set("stages", globalFilters.stage);
           break;

        case 'TOTAL_VALUE':
        case 'AVG_VALUE':
           // Queste card rispettano totalmente i filtri globali (incluso lo stage)
           if (globalFilters.stage) params.set("stages", globalFilters.stage);
           break;
      }

      const res = await apiFetch<any[]>(`/superadmin/dashboard/deals?${params.toString()}`);
      setDeals(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch quando cambia il tipo di card o i filtri globali
  useEffect(() => {
    if (cardType) {
      setView("LIST");
      fetchDeals();
    }
  }, [cardType, globalFilters]);

  const isOpen = !!cardType;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto sm:w-[800px]">
        
        {/* VISTA: LISTA */}
        {view === "LIST" && (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold text-slate-900">{getTitle()}</SheetTitle>
              <SheetDescription>
                Lista filtrata in base alla card selezionata e ai filtri globali.
              </SheetDescription>
            </SheetHeader>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600"/>
              </div>
            ) : deals.length === 0 ? (
               <div className="text-center py-10 text-slate-500 bg-slate-50 rounded border border-dashed">
                 Nessun dato trovato per i criteri selezionati.
               </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Offerta</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Valore</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => {
                       const config = STAGE_CONFIG[deal.stage] || { badgeClass: 'bg-slate-100 text-slate-700', label: deal.stage };
                       return (
                        <TableRow 
                          key={deal.id} 
                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => { setSelectedDeal(deal); setView("EDIT"); }}
                        >
                          <TableCell>
                            <div className="font-medium text-slate-900">{deal.name}</div>
                            <div className="text-xs text-slate-500">{deal.clientName || 'Nessun cliente'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`font-normal ${config.badgeClass}`}>
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
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

        {/* VISTA: EDIT FORM */}
        {view === "EDIT" && selectedDeal && (
          <div className="animate-in slide-in-from-right duration-300">
             <Button 
                variant="ghost" 
                onClick={() => setView("LIST")} 
                className="mb-4 pl-0 hover:pl-2 text-slate-500 hover:text-indigo-600 transition-all"
             >
                <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla lista
             </Button>
             
             <DealEditForm 
                deal={selectedDeal} 
                onSave={() => { 
                  setView("LIST"); 
                  fetchDeals(); // Ricarica la lista aggiornata
                }} 
                onCancel={() => setView("LIST")} 
             />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}