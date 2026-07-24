"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TeamMember } from "@/lib/tenant-team-api";
import { Initials, SettingsBadge, SettingsEmpty } from "./settings-center-ui";
import { allowedAreas, roleLabel, statusMeta } from "./settings-center-model";

export function UsersTable({
  rows,
  selectedId,
  onSelect,
  page,
  pages,
  onPageChange,
}: {
  rows: TeamMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-4">Utente</th><th className="px-4 py-4">Email</th><th className="px-4 py-4">Ruolo</th><th className="px-4 py-4">Aree consentite dal ruolo</th><th className="px-4 py-4">Ultimo accesso</th><th className="px-4 py-4">Stato</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((member) => {
              const status = statusMeta(member.status);
              return (
                <tr key={member.id} onClick={() => onSelect(member.id)} className={`cursor-pointer ${selectedId === member.id ? "bg-violet-50/70" : "hover:bg-slate-50/70"}`}>
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><Initials name={member.display_name} /><div><p className="font-semibold text-slate-900">{member.display_name}</p><p className="text-xs text-slate-500">{member.job_title || member.operational_role || member.employment_type || "Profilo team"}</p></div></div></td>
                  <td className="px-4 py-4 text-slate-700">{member.email}</td>
                  <td className="px-4 py-4 font-medium text-slate-800">{roleLabel(member.tenant_role)}</td>
                  <td className="max-w-64 px-4 py-4 text-slate-600">{allowedAreas(member)}</td>
                  <td className="px-4 py-4 text-slate-500">Non disponibile</td>
                  <td className="px-4 py-4"><SettingsBadge label={status.label} tone={status.tone} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? <SettingsEmpty className="m-5">Nessun utente corrisponde ai filtri.</SettingsEmpty> : null}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        <span>{rows.length} utenti in pagina</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span>{page}/{pages}</span>
          <button disabled={page >= pages} onClick={() => onPageChange(Math.min(pages, page + 1))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
}
