"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  FolderKanban,
  MoreVertical,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CommercialQuote } from "@/lib/tenant-commercial-api";
import { cn } from "@/lib/utils";
import { commercialDate, commercialMoney, quoteTotal } from "./commercial-utils";
import { CommercialEmptyState } from "./commercial-ui";

const tabs = [
  { value: "all", label: "Tutti" },
  { value: "draft", label: "Bozze" },
  { value: "sent", label: "Inviati", statuses: ["sent", "viewed"] },
  { value: "accepted", label: "Accettati" },
  { value: "rejected", label: "Rifiutati", statuses: ["rejected", "expired"] },
] as const;

const statusLabels: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  viewed: "Visualizzato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  expired: "Scaduto",
};

const statusClasses: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-indigo-50 text-indigo-700",
  viewed: "bg-blue-50 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  expired: "bg-rose-100 text-rose-700",
};

export type QuoteTableActions = {
  open: (item: CommercialQuote) => void;
  edit: (item: CommercialQuote) => void;
  accept: (item: CommercialQuote) => void;
  reject: (item: CommercialQuote) => void;
  recalculate: (item: CommercialQuote) => void;
  remove: (item: CommercialQuote) => void;
  createProject: (item: CommercialQuote) => void;
  createInvoice: (item: CommercialQuote) => void;
};

export function QuotesTable({
  items,
  loading,
  search,
  onSearch,
  status,
  onStatus,
  showMoney,
  canCreateInvoice,
  actions,
}: {
  items: CommercialQuote[];
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  showMoney: boolean;
  canCreateInvoice: boolean;
  actions: QuoteTableActions;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const counts = useMemo(() => Object.fromEntries(tabs.map((tab) => {
    if (tab.value === "all") return [tab.value, items.length];
    const statuses = "statuses" in tab ? tab.statuses : [tab.value];
    return [tab.value, items.filter((item) => statuses.includes(item.status as never)).length];
  })), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    const tab = tabs.find((entry) => entry.value === status);
    const statuses = tab && "statuses" in tab ? tab.statuses : status === "all" ? null : [status];
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [item.quote_number, item.title, item.company_name].filter(Boolean).join(" ").toLowerCase().includes(needle);
    return matchesSearch && (!statuses || statuses.includes(item.status as never));
  }), [items, search, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 pt-3 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onStatus(tab.value)}
              className={cn(
                "relative shrink-0 px-3 py-3 text-sm font-medium text-slate-600",
                status === tab.value && "text-indigo-600 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-indigo-600",
              )}
            >
              {tab.label}
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{counts[tab.value]}</span>
            </button>
          ))}
        </div>
        <div className="relative mb-3 w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => onSearch(event.target.value)} className="h-10 rounded-xl border-slate-200 pl-10" placeholder="Cerca preventivo o cliente..." />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">Caricamento preventivi...</div>
      ) : visible.length === 0 ? (
        <div className="p-5"><CommercialEmptyState>Nessun preventivo corrisponde ai filtri selezionati.</CommercialEmptyState></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-600">
                <th className="px-5 py-4">Preventivo</th>
                <th className="px-5 py-4">Cliente</th>
                {showMoney ? <th className="px-5 py-4">Importo</th> : null}
                <th className="px-5 py-4">Inviato</th>
                <th className="px-5 py-4">Scadenza</th>
                <th className="px-5 py-4">Stato</th>
                <th className="px-5 py-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-5 py-4"><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.quote_number || "-"}</p></td>
                  <td className="px-5 py-4 text-slate-700">{item.company_name || "-"}</td>
                  {showMoney ? <td className="px-5 py-4 font-semibold text-slate-900">{commercialMoney(quoteTotal(item))}</td> : null}
                  <td className="px-5 py-4 text-slate-600">{["sent", "viewed", "accepted", "rejected", "expired"].includes(item.status) ? commercialDate(item.sent_at || item.updated_at) : "-"}</td>
                  <td className="px-5 py-4 text-slate-600">{commercialDate(item.valid_until)}</td>
                  <td className="px-5 py-4"><span className={cn("inline-flex rounded-lg px-2.5 py-1 text-xs font-medium", statusClasses[item.status] || "bg-slate-100 text-slate-700")}>{statusLabels[item.status] || item.status}</span></td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => actions.open(item)} aria-label={`Apri ${item.title}`}><Eye className="h-4 w-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Altre azioni ${item.title}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => actions.edit(item)}><Edit3 className="mr-2 h-4 w-4" />Modifica</DropdownMenuItem>
                          <DropdownMenuItem disabled={item.status === "accepted"} onClick={() => actions.accept(item)}><CheckCircle2 className="mr-2 h-4 w-4" />Accetta</DropdownMenuItem>
                          <DropdownMenuItem disabled={item.status === "rejected"} onClick={() => actions.reject(item)}><XCircle className="mr-2 h-4 w-4" />Rifiuta</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => actions.recalculate(item)}><RefreshCw className="mr-2 h-4 w-4" />Ricalcola</DropdownMenuItem>
                          {item.status === "accepted" ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => actions.createProject(item)}><FolderKanban className="mr-2 h-4 w-4" />Crea progetto</DropdownMenuItem>
                              {canCreateInvoice ? <DropdownMenuItem onClick={() => actions.createInvoice(item)}><Receipt className="mr-2 h-4 w-4" />Crea fattura</DropdownMenuItem> : null}
                            </>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => actions.remove(item)}><Trash2 className="mr-2 h-4 w-4" />Elimina</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        <span>{filtered.length === 0 ? "0" : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filtered.length)}`} di {filtered.length}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-14 text-center">{page} / {pages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </footer>
    </section>
  );
}
