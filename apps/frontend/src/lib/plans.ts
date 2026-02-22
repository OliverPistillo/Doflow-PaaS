// ─── Tipi base ────────────────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Package, ShoppingCart, FileText, Users, Settings,
  LayoutDashboard, CreditCard, Truck, Layers, Shield, CheckSquare,
  KanbanSquare, Building2, Contact, GitFork, Receipt, Wallet,
  Calendar, Clock, Mail, BookTemplate, Megaphone, FormInput,
  Warehouse, PackageSearch, Factory, ClipboardList,
  FolderOpen, PenLine, UsersRound, UserCog, Activity,
  Banknote, TrendingUp, BarChart2, Building, FileSpreadsheet,
  Zap, Plug, Bell, ShieldCheck, Download, Timer,
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
  minW:     number;
  maxW:     number;
  minH:     number;
  maxH:     number;
  minPlan:  PlanTier;
  lockMsg?: string;
};

export const WIDGET_DEFINITIONS: Record<WidgetId, WidgetDefinition> = {
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

// ─── Layout di default per piano ─────────────────────────────────────────────

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

// ─── Tipi navigazione sidebar ─────────────────────────────────────────────────

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

// ─── Sidebar groups completi ──────────────────────────────────────────────────

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
        label:   "Feed Attività",
        href:    "/activity",
        icon:    Activity,
        minPlan: "STARTER",
      },
      {
        label:   "Analytics Avanzata",
        href:    "/analytics",
        icon:    BarChart3,
        minPlan: "ENTERPRISE",
        lockMsg: "Disponibile con il piano Enterprise. Report incrociati, Business Intelligence e heatmap.",
      },
    ],
  },
  {
    label: "CRM & Vendite",
    modules: [
      {
        label:   "CRM & Clienti",
        href:    "/customers",
        icon:    Users,
        minPlan: "STARTER",
      },
      {
        label:   "Contatti",
        href:    "/contacts",
        icon:    Contact,
        minPlan: "STARTER",
      },
      {
        label:   "Aziende",
        href:    "/companies",
        icon:    Building2,
        minPlan: "STARTER",
      },
      {
        label:   "Pipeline Vendite",
        href:    "/deals",
        icon:    GitFork,
        minPlan: "STARTER",
      },
      {
        label:   "Preventivi",
        href:    "/quotes",
        icon:    FileSpreadsheet,
        minPlan: "STARTER",
      },
    ],
  },
  {
    label: "Catalogo & Ordini",
    modules: [
      {
        label:   "Catalogo Prodotti",
        href:    "/products",
        icon:    Package,
        minPlan: "STARTER",
      },
      {
        label:   "Ordini",
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
        lockMsg: "Disponibile con il piano Pro. Genera fatture dagli ordini, gestisci scadenziario e invia PDF.",
      },
      {
        label:   "Note Spese",
        href:    "/expenses",
        icon:    Receipt,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Registra spese, allega ricevute e genera report mensili.",
      },
      {
        label:   "Abbonamento",
        href:    "/billing",
        icon:    CreditCard,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro.",
      },
      {
        label:   "Riconciliazione",
        href:    "/payments",
        icon:    Banknote,
        minPlan: "ENTERPRISE",
        lockMsg: "Disponibile con il piano Enterprise. Riconciliazione bancaria e cash flow avanzato.",
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
        label:   "Task Board",
        href:    "/tasks/board",
        icon:    KanbanSquare,
        minPlan: "STARTER",
      },
      {
        label:   "Calendario",
        href:    "/calendar",
        icon:    Calendar,
        minPlan: "STARTER",
      },
      {
        label:   "Progetti",
        href:    "/projects",
        icon:    Layers,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro.",
      },
      {
        label:   "Foglio Ore",
        href:    "/timesheet",
        icon:    Timer,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Traccia ore per progetto, approva e genera report.",
      },
    ],
  },
  {
    label: "Comunicazione",
    modules: [
      {
        label:   "Posta Condivisa",
        href:    "/inbox",
        icon:    Mail,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Inbox condivisa del team con email collegate a deal.",
      },
      {
        label:   "Template Email",
        href:    "/email-templates",
        icon:    BookTemplate,
        minPlan: "STARTER",
      },
      {
        label:   "Campagne Email",
        href:    "/campaigns",
        icon:    Megaphone,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Campagne email con A/B test e report di performance.",
      },
      {
        label:   "Form & Landing",
        href:    "/forms",
        icon:    FormInput,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Form builder per cattura lead con mapping CRM.",
      },
    ],
  },
  {
    label: "Logistica & Magazzino",
    modules: [
      {
        label:   "Logistica",
        href:    "/logistics",
        icon:    Truck,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Gestione spedizioni, DDT e tracking corrieri.",
      },
      {
        label:   "Magazzino",
        href:    "/inventory",
        icon:    Warehouse,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Giacenze in tempo reale, movimenti e alert scorta.",
      },
      {
        label:   "Fornitori",
        href:    "/suppliers",
        icon:    Factory,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro.",
      },
      {
        label:   "Ordini Acquisto",
        href:    "/purchase-orders",
        icon:    ClipboardList,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro.",
      },
    ],
  },
  {
    label: "Documenti & File",
    modules: [
      {
        label:   "Documenti",
        href:    "/documents",
        icon:    FolderOpen,
        minPlan: "STARTER",
      },
      {
        label:   "Firma Digitale",
        href:    "/signatures",
        icon:    PenLine,
        minPlan: "ENTERPRISE",
        lockMsg: "Disponibile con il piano Enterprise. Firma elettronica con validità legale.",
      },
    ],
  },
  {
    label: "HR & Team",
    modules: [
      {
        label:   "Team",
        href:    "/team",
        icon:    UsersRound,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Organigramma, profili e calendario ferie.",
      },
      {
        label:   "Ruoli & Permessi",
        href:    "/team/roles",
        icon:    UserCog,
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
        label:   "Azienda",
        href:    "/settings/company",
        icon:    Building,
        minPlan: "STARTER",
      },
      {
        label:   "Notifiche",
        href:    "/settings/notifications",
        icon:    Bell,
        minPlan: "STARTER",
      },
      {
        label:   "Import/Export",
        href:    "/settings/import-export",
        icon:    Download,
        minPlan: "STARTER",
      },
      {
        label:   "Automazioni",
        href:    "/settings/automations",
        icon:    Zap,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Workflow builder visuale con trigger e azioni automatiche.",
      },
      {
        label:   "Integrazioni",
        href:    "/settings/integrations",
        icon:    Plug,
        minPlan: "PRO",
        lockMsg: "Disponibile con il piano Pro. Collega Google Workspace, Stripe, Zapier e altro.",
      },
      {
        label:   "Sicurezza Avanzata",
        href:    "/settings/security",
        icon:    ShieldCheck,
        minPlan: "ENTERPRISE",
        lockMsg: "Disponibile con il piano Enterprise. Audit log, ruoli granulari e IP whitelist.",
      },
    ],
  },
];
