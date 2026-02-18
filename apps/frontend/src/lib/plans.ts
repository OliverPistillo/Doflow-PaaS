/**
 * plans.ts — Definizione commerciale dei piani DoFlow.
 *
 * REGOLA: Questa è l'unica fonte di verità per:
 *  - quali moduli (voci sidebar) sono inclusi in ogni piano
 *  - quali widget dashboard sono disponibili per piano
 *  - i metadati di upselling (nome piano superiore, messaggio)
 *
 * Il backend valida i piani a livello di API (gating per endpoint).
 * Il frontend usa questa config SOLO per UI (mostrare/bloccare elementi).
 * Non usare mai questa config come security gate lato client.
 */

import {
  LayoutDashboard,
  BarChart3,
  Users,
  ShoppingCart,
  Package,
  FileText,
  Truck,
  Layers,
  Settings,
  CreditCard,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type PlanTier = "STARTER" | "PRO" | "ENTERPRISE";

/** Tipo union di tutti i widget id disponibili */
export type WidgetId =
  // STARTER
  | "kpi_new_leads"
  | "kpi_open_orders"
  | "kpi_quote_value"
  | "list_recent_quotes"
  | "chart_orders_trend"
  // PRO
  | "kpi_revenue_month"
  | "kpi_cashflow_overdue"
  | "kpi_low_stock"
  | "list_unpaid_invoices"
  | "chart_income_vs_expenses"
  // ENTERPRISE
  | "chart_market_share"
  | "chart_sales_heatmap"
  | "leaderboard_sellers";

/** Ordine numerico per confronto: STARTER < PRO < ENTERPRISE */
export const PLAN_ORDER: Record<PlanTier, number> = {
  STARTER:    1,
  PRO:        2,
  ENTERPRISE: 3,
};

/** Restituisce true se il piano attivo include il piano richiesto */
export function planIncludes(active: PlanTier, required: PlanTier): boolean {
  return PLAN_ORDER[active] >= PLAN_ORDER[required];
}

// ─── Moduli Sidebar ───────────────────────────────────────────────────────────

export interface SidebarModule {
  label:    string;
  href:     string;
  icon:     LucideIcon;
  minPlan:  PlanTier;
  /** Messaggio mostrato nel tooltip del lucchetto */
  lockMsg?: string;
}

export interface SidebarGroup {
  label:   string;
  modules: SidebarModule[];
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Panoramica",
    modules: [
      {
        label:   "Dashboard",
        href:    "/dashboard",
        icon:    LayoutDashboard,
        minPlan: "STARTER",
      },
      {
        label:   "Analytics Avanzata",
        href:    "/analytics",
        icon:    BarChart3,
        minPlan: "ENTERPRISE",
        lockMsg: "Disponibile con il piano Enterprise. Passa a Enterprise per accedere a Business Intelligence, report incrociati e heatmap.",
      },
    ],
  },
  {
    label: "Gestione Commerciale",
    modules: [
      {
        label:   "CRM & Clienti",
        href:    "/customers",
        icon:    Users,
        minPlan: "STARTER",
      },
      {
        label:   "Catalogo",
        href:    "/products",
        icon:    Package,
        minPlan: "STARTER",
      },
      {
        label:   "Vendite & Preventivi",
        href:    "/orders",
        icon:    ShoppingCart,
        minPlan: "STARTER",
      },
    ],
  },
  {
    label: "Fatturazione",
    modules: [
      {
        label:   "Fatture & Pagamenti",
        href:    "/invoices",
        icon:    FileText,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Genera fatture dagli ordini, gestisci lo scadenziario e invia PDF ai clienti.",
      },
      {
        label:   "Abbonamento",
        href:    "/billing",
        icon:    CreditCard,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro.",
      },
    ],
  },
  {
    label: "Operazioni",
    modules: [
      {
        label:   "Logistica",
        href:    "/logistics",
        icon:    Truck,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Gestisci giacenze di magazzino, DDT e tracciamento spedizioni.",
      },
      {
        label:   "Progetti",
        href:    "/projects",
        icon:    Layers,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro.",
      },
    ],
  },
  {
    label: "Sistema",
    modules: [
      {
        label:   "Impostazioni",
        href:    "/settings",
        icon:    Settings,
        minPlan: "STARTER",
      },
      {
        label:   "Sicurezza Avanzata",
        href:    "/settings/security",
        icon:    Shield,
        minPlan: "ENTERPRISE",
        lockMsg: "Disponibile con il piano Enterprise. Audit log tenant, ruoli granulari e obbligo MFA per tutto il team.",
      },
    ],
  },
];

// ─── Widget Dashboard ─────────────────────────────────────────────────────────

export interface WidgetDefinition {
  id:       WidgetId;
  label:    string;
  /** Dimensione default nella griglia (w max 3) */
  defaultW: number;
  defaultH: number;
  minPlan:  PlanTier;
  lockMsg?: string;
}

export const WIDGET_DEFINITIONS: Record<WidgetId, WidgetDefinition> = {
  // ── STARTER ─────────────────────────────────────────────────────────────
  kpi_new_leads: {
    id: "kpi_new_leads", label: "Nuovi Lead",
    defaultW: 1, defaultH: 1, minPlan: "STARTER",
  },
  kpi_open_orders: {
    id: "kpi_open_orders", label: "Ordini Aperti",
    defaultW: 1, defaultH: 1, minPlan: "STARTER",
  },
  kpi_quote_value: {
    id: "kpi_quote_value", label: "Valore Preventivi",
    defaultW: 1, defaultH: 1, minPlan: "STARTER",
  },
  list_recent_quotes: {
    id: "list_recent_quotes", label: "Ultimi Preventivi",
    defaultW: 2, defaultH: 2, minPlan: "STARTER",
  },
  chart_orders_trend: {
    id: "chart_orders_trend", label: "Trend Ordini (30gg)",
    defaultW: 1, defaultH: 2, minPlan: "STARTER",
  },

  // ── PRO ──────────────────────────────────────────────────────────────────
  kpi_revenue_month: {
    id: "kpi_revenue_month", label: "Fatturato del Mese",
    defaultW: 1, defaultH: 1, minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },
  kpi_cashflow_overdue: {
    id: "kpi_cashflow_overdue", label: "Scaduto da Incassare",
    defaultW: 1, defaultH: 1, minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },
  kpi_low_stock: {
    id: "kpi_low_stock", label: "Prodotti Sotto Scorta",
    defaultW: 1, defaultH: 1, minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },
  list_unpaid_invoices: {
    id: "list_unpaid_invoices", label: "Fatture Non Pagate",
    defaultW: 2, defaultH: 2, minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },
  chart_income_vs_expenses: {
    id: "chart_income_vs_expenses", label: "Entrate vs Uscite",
    defaultW: 1, defaultH: 2, minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },

  // ── ENTERPRISE ────────────────────────────────────────────────────────────
  chart_market_share: {
    id: "chart_market_share", label: "Quote di Mercato",
    defaultW: 1, defaultH: 2, minPlan: "ENTERPRISE",
    lockMsg: "Disponibile con Piano Enterprise.",
  },
  chart_sales_heatmap: {
    id: "chart_sales_heatmap", label: "Heatmap Vendite",
    defaultW: 2, defaultH: 2, minPlan: "ENTERPRISE",
    lockMsg: "Disponibile con Piano Enterprise.",
  },
  leaderboard_sellers: {
    id: "leaderboard_sellers", label: "Classifica Venditori",
    defaultW: 1, defaultH: 2, minPlan: "ENTERPRISE",
    lockMsg: "Disponibile con Piano Enterprise.",
  },
};

// ─── Layout di default per piano ──────────────────────────────────────────────

export type LayoutItem = {
  i: WidgetId; x: number; y: number; w: number; h: number;
  minW?: number; maxW?: number; minH?: number;
};

export const DEFAULT_LAYOUTS: Record<PlanTier, LayoutItem[]> = {
  STARTER: [
    { i: "kpi_new_leads",       x: 0, y: 0, w: 1, h: 1 },
    { i: "kpi_open_orders",     x: 1, y: 0, w: 1, h: 1 },
    { i: "kpi_quote_value",     x: 2, y: 0, w: 1, h: 1 },
    { i: "list_recent_quotes",  x: 0, y: 1, w: 2, h: 2 },
    { i: "chart_orders_trend",  x: 2, y: 1, w: 1, h: 2 },
  ],
  PRO: [
    { i: "kpi_revenue_month",        x: 0, y: 0, w: 1, h: 1 },
    { i: "kpi_cashflow_overdue",     x: 1, y: 0, w: 1, h: 1 },
    { i: "kpi_low_stock",            x: 2, y: 0, w: 1, h: 1 },
    { i: "list_unpaid_invoices",     x: 0, y: 1, w: 2, h: 2 },
    { i: "chart_income_vs_expenses", x: 2, y: 1, w: 1, h: 2 },
  ],
  ENTERPRISE: [
    { i: "kpi_revenue_month",        x: 0, y: 0, w: 1, h: 1 },
    { i: "kpi_cashflow_overdue",     x: 1, y: 0, w: 1, h: 1 },
    { i: "kpi_low_stock",            x: 2, y: 0, w: 1, h: 1 },
    { i: "chart_market_share",       x: 0, y: 1, w: 1, h: 2 },
    { i: "chart_sales_heatmap",      x: 1, y: 1, w: 2, h: 2 },
    { i: "leaderboard_sellers",      x: 0, y: 3, w: 1, h: 2 },
    { i: "list_unpaid_invoices",     x: 1, y: 3, w: 2, h: 2 },
  ],
};

// ─── Badge e colori per il piano ──────────────────────────────────────────────

export const PLAN_META: Record<PlanTier, {
  label: string;
  color: string;       // Tailwind bg class
  textColor: string;   // Tailwind text class
  nextPlan?: PlanTier;
  upgradeLabel?: string;
}> = {
  STARTER: {
    label:         "Starter",
    color:         "bg-slate-100",
    textColor:     "text-slate-700",
    nextPlan:      "PRO",
    upgradeLabel:  "Passa a Pro",
  },
  PRO: {
    label:         "Pro",
    color:         "bg-indigo-100",
    textColor:     "text-indigo-700",
    nextPlan:      "ENTERPRISE",
    upgradeLabel:  "Passa a Enterprise",
  },
  ENTERPRISE: {
    label:         "Enterprise",
    color:         "bg-amber-100",
    textColor:     "text-amber-700",
  },
};
