// ─── Tipi base ────────────────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Package, ShoppingCart, FileText,
  Users, Settings, LayoutDashboard, CreditCard,
  Truck, Layers, Shield, CheckSquare, UserPlus,
} from "lucide-react";

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

// ─── LayoutItem — coordinata sulla griglia a 12 colonne ──────────────────────
//
//  rowHeight = 80px  →  h=2 = 160px (KPI tile),  h=5 = 400px (lista/grafico)
//  cols = 12         →  w=4 = 1/3,  w=6 = metà,  w=8 = 2/3,  w=12 = pieno

export type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

// ─── Definizione widget con vincoli griglia ───────────────────────────────────

export type WidgetDefinition = {
  id:       WidgetId;
  label:    string;
  defaultW: number;
  defaultH: number;
  /** Vincoli che react-grid-layout rispetta durante drag/resize */
  minW:     number;
  maxW:     number;
  minH:     number;
  maxH:     number;
  minPlan:  PlanTier;
  lockMsg?: string;
};

export const WIDGET_DEFINITIONS: Record<WidgetId, WidgetDefinition> = {
  // ── STARTER ─────────────────────────────────────────────────────────────
  kpi_new_leads: {
    id: "kpi_new_leads", label: "Nuovi Lead",
    defaultW: 4, defaultH: 2,
    minW: 3, maxW: 6, minH: 2, maxH: 2,
    minPlan: "STARTER",
  },
  kpi_open_orders: {
    id: "kpi_open_orders", label: "Ordini Aperti",
    defaultW: 4, defaultH: 2,
    minW: 3, maxW: 6, minH: 2, maxH: 2,
    minPlan: "STARTER",
  },
  kpi_quote_value: {
    id: "kpi_quote_value", label: "Valore Preventivi",
    defaultW: 4, defaultH: 2,
    minW: 3, maxW: 6, minH: 2, maxH: 2,
    minPlan: "STARTER",
  },
  list_recent_quotes: {
    id: "list_recent_quotes", label: "Ultimi Preventivi",
    defaultW: 8, defaultH: 5,
    minW: 4, maxW: 12, minH: 3, maxH: 8,
    minPlan: "STARTER",
  },
  chart_orders_trend: {
    id: "chart_orders_trend", label: "Trend Ordini (30gg)",
    defaultW: 4, defaultH: 5,
    minW: 3, maxW: 12, minH: 3, maxH: 8,
    minPlan: "STARTER",
  },

  // ── PRO ──────────────────────────────────────────────────────────────────
  kpi_revenue_month: {
    id: "kpi_revenue_month", label: "Fatturato del Mese",
    defaultW: 4, defaultH: 2,
    minW: 3, maxW: 6, minH: 2, maxH: 2,
    minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },
  kpi_cashflow_overdue: {
    id: "kpi_cashflow_overdue", label: "Scaduto da Incassare",
    defaultW: 4, defaultH: 2,
    minW: 3, maxW: 6, minH: 2, maxH: 2,
    minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },
  kpi_low_stock: {
    id: "kpi_low_stock", label: "Prodotti Sotto Scorta",
    defaultW: 4, defaultH: 2,
    minW: 3, maxW: 6, minH: 2, maxH: 2,
    minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },
  list_unpaid_invoices: {
    id: "list_unpaid_invoices", label: "Fatture Non Pagate",
    defaultW: 8, defaultH: 5,
    minW: 4, maxW: 12, minH: 3, maxH: 8,
    minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },
  chart_income_vs_expenses: {
    id: "chart_income_vs_expenses", label: "Entrate vs Uscite",
    defaultW: 4, defaultH: 5,
    minW: 3, maxW: 12, minH: 3, maxH: 8,
    minPlan: "PRO",
    lockMsg: "Disponibile con Piano Pro.",
  },

  // ── ENTERPRISE ────────────────────────────────────────────────────────────
  chart_market_share: {
    id: "chart_market_share", label: "Quote di Mercato",
    defaultW: 4, defaultH: 5,
    minW: 3, maxW: 8, minH: 3, maxH: 8,
    minPlan: "ENTERPRISE",
    lockMsg: "Disponibile con Piano Enterprise.",
  },
  chart_sales_heatmap: {
    id: "chart_sales_heatmap", label: "Heatmap Vendite",
    defaultW: 8, defaultH: 5,
    minW: 4, maxW: 12, minH: 3, maxH: 8,
    minPlan: "ENTERPRISE",
    lockMsg: "Disponibile con Piano Enterprise.",
  },
  leaderboard_sellers: {
    id: "leaderboard_sellers", label: "Top Venditori",
    defaultW: 4, defaultH: 5,
    minW: 3, maxW: 8, minH: 3, maxH: 8,
    minPlan: "ENTERPRISE",
    lockMsg: "Disponibile con Piano Enterprise.",
  },
};

// ─── Layout di default per piano (griglia 12 colonne, rowHeight=80) ──────────
//
//  Riga y=0: 3 KPI tile affiancati (w=4, h=2 = 160px ciascuno)
//  Riga y=2: lista grande (w=8, h=5) + grafico laterale (w=4, h=5)
//  Riga y=7: (solo Enterprise) leaderboard + lista fatture

export const DEFAULT_LAYOUTS: Record<PlanTier, LayoutItem[]> = {
  STARTER: [
    { i: "kpi_new_leads",      x: 0, y: 0, w: 4, h: 2 },
    { i: "kpi_open_orders",    x: 4, y: 0, w: 4, h: 2 },
    { i: "kpi_quote_value",    x: 8, y: 0, w: 4, h: 2 },
    { i: "list_recent_quotes", x: 0, y: 2, w: 8, h: 5 },
    { i: "chart_orders_trend", x: 8, y: 2, w: 4, h: 5 },
  ],
  PRO: [
    { i: "kpi_revenue_month",        x: 0, y: 0, w: 4, h: 2 },
    { i: "kpi_cashflow_overdue",     x: 4, y: 0, w: 4, h: 2 },
    { i: "kpi_low_stock",            x: 8, y: 0, w: 4, h: 2 },
    { i: "list_unpaid_invoices",     x: 0, y: 2, w: 8, h: 5 },
    { i: "chart_income_vs_expenses", x: 8, y: 2, w: 4, h: 5 },
  ],
  ENTERPRISE: [
    { i: "kpi_revenue_month",        x: 0, y: 0, w: 4, h: 2 },
    { i: "kpi_cashflow_overdue",     x: 4, y: 0, w: 4, h: 2 },
    { i: "kpi_low_stock",            x: 8, y: 0, w: 4, h: 2 },
    { i: "chart_market_share",       x: 0, y: 2, w: 4, h: 5 },
    { i: "chart_sales_heatmap",      x: 4, y: 2, w: 8, h: 5 },
    { i: "leaderboard_sellers",      x: 0, y: 7, w: 4, h: 5 },
    { i: "list_unpaid_invoices",     x: 4, y: 7, w: 8, h: 5 },
  ],
};

// ─── Badge e colori per il piano ──────────────────────────────────────────────

export const PLAN_META: Record<PlanTier, {
  label: string;
  color: string;
  textColor: string;
  nextPlan?: PlanTier;
  upgradeLabel?: string;
}> = {
  STARTER: {
    label:        "Starter",
    color:        "bg-slate-100",
    textColor:    "text-slate-700",
    nextPlan:     "PRO",
    upgradeLabel: "Passa a Pro",
  },
  PRO: {
    label:        "Pro",
    color:        "bg-indigo-100",
    textColor:    "text-indigo-700",
    nextPlan:     "ENTERPRISE",
    upgradeLabel: "Passa a Enterprise",
  },
  ENTERPRISE: {
    label:     "Enterprise",
    color:     "bg-amber-100",
    textColor: "text-amber-700",
  },
};

// ─── Tipi navigazione sidebar (usati da tenant-sidebar.tsx) ──────────────────

export type NavItem = {
  label:    string;
  href:     string;
  icon:     LucideIcon;
  minPlan:  PlanTier;
  lockMsg?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};


// ─── Navigazione sidebar — compatibilità con tenant-sidebar.tsx ──────────────



export interface SidebarModule {
  label:    string;
  href:     string;
  icon:     LucideIcon;
  minPlan:  PlanTier;
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
        label:   "Task",
        href:    "/tasks",
        icon:    CheckSquare,
        minPlan: "STARTER",
      },
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
