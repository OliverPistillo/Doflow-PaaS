import type {
  CommercialOpportunity,
  CommercialPipeline,
  CommercialQuote,
} from "@/lib/tenant-commercial-api";

export const PIPELINE_GROUPS = [
  {
    id: "new",
    label: "Nuovi",
    stages: ["new_lead", "to_contact"],
    targetStage: "new_lead",
    color: "#6558e8",
  },
  {
    id: "contacted",
    label: "Contattati",
    stages: ["contacted", "call_scheduled", "briefing_sent", "briefing_received"],
    targetStage: "contacted",
    color: "#5d8ff5",
  },
  {
    id: "quote",
    label: "Preventivo",
    stages: ["quote_preparation", "quote_sent", "follow_up"],
    targetStage: "quote_sent",
    color: "#8fc98d",
  },
  {
    id: "won",
    label: "Vinti",
    stages: ["accepted"],
    targetStage: "accepted",
    color: "#3fbd73",
  },
] as const;

export function commercialMoney(value: unknown) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function commercialDate(value: unknown, includeTime = false) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function initials(value: string) {
  const clean = value.trim();
  if (!clean) return "?";
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function quoteTotal(quote: CommercialQuote) {
  if (quote.total !== undefined && quote.total !== null) return Number(quote.total || 0);
  return Number(quote.subtotal || 0) - Number(quote.discount_total || 0) + Number(quote.tax_total || 0);
}

export function groupPipeline(pipeline: CommercialPipeline | null) {
  const opportunities = (pipeline?.stages || []).flatMap((stage) => stage.items || []);
  return PIPELINE_GROUPS.map((group) => {
    const items = opportunities.filter((item) => group.stages.includes(item.stage as never));
    return {
      ...group,
      items,
      count: items.length,
      totalValue: items.reduce((sum, item) => sum + Number(item.value_estimate || 0), 0),
    };
  });
}

export function pipelineTotal(items: CommercialOpportunity[]) {
  return items
    .filter((item) => !["accepted", "lost", "paused"].includes(item.stage))
    .reduce((sum, item) => sum + Number(item.value_estimate || 0), 0);
}

export function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

export function isThisMonth(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}
