import Link from "next/link";
import { CalendarClock, Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import type { CommercialActivity } from "@/lib/tenant-commercial-api";
import { cn } from "@/lib/utils";
import { commercialDate } from "./commercial-utils";
import { CommercialEmptyState, CommercialSectionCard } from "./commercial-ui";

const actionIcons: Record<string, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: CalendarClock,
  follow_up: MessageCircle,
};

export function CommercialTodayActions({ items }: { items: CommercialActivity[] }) {
  return (
    <CommercialSectionCard title="Azioni di oggi">
      {items.length === 0 ? (
        <CommercialEmptyState>Nessuna azione commerciale in scadenza oggi.</CommercialEmptyState>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80">
          {items.slice(0, 5).map((item) => {
            const Icon = actionIcons[item.type] || CalendarClock;
            const overdue = item.due_at ? new Date(item.due_at).getTime() < Date.now() : false;
            return (
              <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
                <Icon className="h-4 w-4 text-slate-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="truncate text-xs text-slate-500">{item.company_name || item.opportunity_title || "Attività commerciale"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs", overdue ? "text-rose-600" : "text-slate-500")}>
                    {commercialDate(item.due_at, true)}
                  </span>
                  <Link href="/activities" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Apri
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CommercialSectionCard>
  );
}
