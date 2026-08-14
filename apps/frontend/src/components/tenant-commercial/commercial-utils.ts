import type {
  CommercialOpportunity,
  CommercialPipeline,
  CommercialQuote,
} from "@/lib/tenant-commercial-api";
import {
  canonicalCommercialStage,
  canonicalizeCommercialStageItem,
  commercialStageLabel as stageLabel,
  DOFLOW_PIPELINE_GROUPS,
  isOpenCommercialStage,
  LEGACY_PIPELINE_GROUPS,
  normalizeCommercialStage,
} from "@/lib/commercial-stage-model";

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

export function pipelineItems(pipeline: CommercialPipeline | null, doflow: boolean) {
  const byId = new Map<string, CommercialOpportunity>();
  for (const item of [
    ...(pipeline?.stages || []).flatMap((stage) => stage.items || []),
    ...(pipeline?.unmappedItems || []),
  ]) {
    byId.set(item.id, doflow ? canonicalizeCommercialStageItem(item) : item);
  }
  return [...byId.values()];
}

export function groupPipeline(pipeline: CommercialPipeline | null, doflow: boolean) {
  const opportunities = pipelineItems(pipeline, doflow);
  const groups = doflow ? DOFLOW_PIPELINE_GROUPS : LEGACY_PIPELINE_GROUPS;
  return groups.map((group) => {
    const items = opportunities.filter((item) => doflow
      ? canonicalCommercialStage(item.stage) === group.id
      : "stages" in group && group.stages.includes(item.stage as never));
    return {
      ...group,
      items,
      count: items.length,
      totalValue: items.reduce((sum, item) => sum + Number(item.value_estimate || 0), 0),
    };
  });
}

export function pipelineTotal(items: CommercialOpportunity[], doflow: boolean) {
  return items
    .filter((item) => isOpenCommercialStage(item.stage, doflow))
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

export function pipelineStageLabel(stage: string, doflow = true) {
  return stageLabel(stage, doflow);
}
