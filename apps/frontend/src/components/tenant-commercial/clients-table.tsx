"use client";

import { Mail, MoreHorizontal, Pencil, Phone, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CommercialClientRow } from "./commercial-client-types";
import { commercialDate, commercialMoney, initials } from "./commercial-utils";
import { CommercialEmptyState } from "./commercial-ui";

const statusLabels: Record<string, string> = {
  active_client: "Attivo",
  prospect: "Potenziale",
  former_client: "Ex cliente",
  partner: "Partner",
  dormant: "Da ricontattare",
};

const statusClasses: Record<string, string> = {
  active_client: "bg-emerald-100 text-emerald-700",
  prospect: "bg-orange-100 text-orange-700",
  former_client: "bg-slate-100 text-slate-600",
  partner: "bg-blue-100 text-blue-700",
  dormant: "bg-rose-100 text-rose-700",
};

export function ClientsTable({
  rows,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: {
  rows: CommercialClientRow[];
  selectedId?: string;
  onSelect: (row: CommercialClientRow) => void;
  onEdit: (row: CommercialClientRow) => void;
  onDelete: (row: CommercialClientRow) => void;
}) {
  if (rows.length === 0) {
    return <CommercialEmptyState>Nessun cliente corrisponde ai filtri selezionati.</CommercialEmptyState>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-600">
            <th className="px-4 py-4">Cliente</th>
            <th className="px-4 py-4">Referente</th>
            <th className="px-4 py-4">Contatti</th>
            <th className="px-4 py-4">Servizio</th>
            <th className="px-4 py-4">Ultimo contatto</th>
            <th className="px-4 py-4">Stato</th>
            <th className="px-4 py-4 text-right">Valore</th>
            <th className="w-12 px-2 py-4"><span className="sr-only">Azioni</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const contactName = row.contact
              ? [row.contact.first_name, row.contact.last_name].filter(Boolean).join(" ")
              : "-";
            const selected = selectedId === row.company.id;
            return (
              <tr
                key={row.company.id}
                onClick={() => onSelect(row)}
                className={cn(
                  "cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50",
                  selected && "bg-violet-50/70 hover:bg-violet-50",
                )}
                aria-selected={selected}
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                      {initials(row.company.name)}
                    </span>
                    <span className="font-semibold text-slate-900">{row.company.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-700">{contactName}</td>
                <td className="px-4 py-4">
                  <div className="space-y-1 text-xs text-slate-600">
                    {row.contact?.email || row.company.email ? (
                      <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{row.contact?.email || row.company.email}</p>
                    ) : null}
                    {row.contact?.phone || row.company.phone ? (
                      <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{row.contact?.phone || row.company.phone}</p>
                    ) : null}
                    {!row.contact?.email && !row.company.email && !row.contact?.phone && !row.company.phone ? "-" : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-700">{row.service || row.company.industry || "-"}</td>
                <td className="px-4 py-4 text-slate-600">{commercialDate(row.lastActivity?.completed_at || row.lastActivity?.updated_at)}</td>
                <td className="px-4 py-4">
                  <span className={cn("inline-flex rounded-lg px-2.5 py-1 text-xs font-medium", statusClasses[row.company.status || ""] || "bg-slate-100 text-slate-600")}>
                    {statusLabels[row.company.status || ""] || row.company.status || "Non definito"}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-slate-900">{commercialMoney(row.value)}</td>
                <td className="px-2 py-4" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Azioni ${row.company.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(row)}>
                        <Pencil className="mr-2 h-4 w-4" /> Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-rose-600" onClick={() => onDelete(row)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
