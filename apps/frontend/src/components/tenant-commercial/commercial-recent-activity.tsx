import { FileText, MessageCircle, Phone, UserPlus, type LucideIcon } from "lucide-react";
import type { CommercialActivity, CommercialQuote } from "@/lib/tenant-commercial-api";
import { commercialDate } from "./commercial-utils";
import { CommercialEmptyState, CommercialSectionCard } from "./commercial-ui";

type Movement = {
  id: string;
  title: string;
  subtitle: string;
  date?: string | null;
  icon: LucideIcon;
  tone: string;
};

export function CommercialRecentActivity({
  activities,
  quotes,
}: {
  activities: CommercialActivity[];
  quotes: CommercialQuote[];
}) {
  const movements: Movement[] = [
    ...activities.map((item) => ({
      id: `activity-${item.id}`,
      title: item.completed_at ? `${item.title} completata` : item.title,
      subtitle: item.company_name || item.contact_name || item.opportunity_title || "Attività commerciale",
      date: item.completed_at || item.updated_at || item.created_at,
      icon: item.type === "call" ? Phone : MessageCircle,
      tone: item.type === "call" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600",
    })),
    ...quotes.map((item) => ({
      id: `quote-${item.id}`,
      title: item.status === "accepted" ? "Preventivo accettato" : "Preventivo aggiornato",
      subtitle: item.company_name || item.title,
      date: item.accepted_at || item.updated_at || item.created_at,
      icon: FileText,
      tone: "bg-emerald-100 text-emerald-600",
    })),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 4);

  return (
    <CommercialSectionCard title="Ultimi movimenti" actionHref="/activities" actionLabel="Vedi tutti">
      {movements.length === 0 ? (
        <CommercialEmptyState>Nessun movimento commerciale recente.</CommercialEmptyState>
      ) : (
        <div className="divide-y divide-slate-100">
          {movements.map((item) => {
            const Icon = item.icon || UserPlus;
            return (
              <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                </div>
                <span className="text-xs text-slate-500">{commercialDate(item.date, true)}</span>
              </div>
            );
          })}
        </div>
      )}
    </CommercialSectionCard>
  );
}
