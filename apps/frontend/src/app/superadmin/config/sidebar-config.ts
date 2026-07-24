// apps/frontend/src/app/superadmin/config/sidebar-config.ts

import {
  LayoutDashboard,
  TrendingUp,
  ListTodo,
  FileText,
  Building2,
  Users,
  Wallet,
  Receipt,
  CircleDollarSign,
  UserPlus,
  Zap,
  HeartPulse,
  HardDrive,
  Bell,
  LifeBuoy,
  Mail,
  Rocket,
  Puzzle,
  Settings,
  CalendarDays,
  Truck,
  Globe,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ─── Primitive types ──────────────────────────────────────────────────────────

/**
 * Una singola voce di menu — foglia terminale.
 */
export interface NavLeaf {
  kind: "leaf";
  label: string;
  href: string;
  icon: LucideIcon;
  /** Etichetta badge: "New", "3" (notifiche non lette), ecc.  */
  badge?: string;
  /** Se true, apre in nuova scheda */
  external?: boolean;
}

/**
 * Una voce di menu con sotto-voci collassabili (Collapsible di shadcn).
 * Attualmente non usata nella config di default, ma il tipo è pronto.
 */
export interface NavGroup {
  kind: "group";
  label: string;
  /** Icona usata nel tooltip quando la sidebar è compressa (icon mode) */
  icon: LucideIcon;
  items: NavLeaf[];
  /** Aperto di default all'avvio */
  defaultOpen?: boolean;
}

export type NavItem = NavLeaf | NavGroup;

/**
 * Una sezione della sidebar — corrisponde a un <SidebarGroup>.
 */
export interface NavSection {
  /** Chiave stabile per localStorage (stato collapsed per sezione). */
  id: string;
  /** Testo del <SidebarGroupLabel>. */
  title: string;
  items: NavItem[];
}

export type SidebarConfig = NavSection[];

// ─── Guard helpers ────────────────────────────────────────────────────────────

export function isNavLeaf(item: NavItem): item is NavLeaf {
  return item.kind === "leaf";
}

export function isNavGroup(item: NavItem): item is NavGroup {
  return item.kind === "group";
}

// ─── Config ───────────────────────────────────────────────────────────────────

export const SUPERADMIN_SIDEBAR: SidebarConfig = [
  // ── 1. COMMAND CENTER ────────────────────────────────────────────────────────
  {
    id: "command-center",
    title: "Command Center",
    items: [
      {
        kind: "leaf",
        label: "Control Room",
        href: "/superadmin",
        icon: LayoutDashboard,
      },
    ],
  },

  // ── 2. SALES & CRM ───────────────────────────────────────────────────────────
  {
    id: "sales",
    title: "Sales & CRM",
    items: [
      {
        kind: "leaf",
        label: "Sales Dashboard",
        href: "/superadmin/sales/dashboard",
        icon: TrendingUp,
      },
      {
        kind: "leaf",
        label: "Pipeline",
        href: "/superadmin/sales/pipeline",
        icon: ListTodo,
      },
      {
        kind: "leaf",
        label: "Richieste Preventivo",
        href: "/superadmin/sales/quote-requests",
        icon: FileText,
      },
      {
        kind: "leaf",
        label: "Lead Management",
        href: "/superadmin/leads",
        icon: UserPlus,
      },
      {
        kind: "leaf",
        label: "Automazioni CRM",
        href: "/superadmin/automations",
        icon: Zap,
      },
      {
        kind: "leaf",
        label: "Sales Intelligence",
        href: "/superadmin/sales-intelligence",
        icon: Sparkles,
        badge: "NEW",
      },
    ],
  },

  // ── 3. PLATFORM ADMIN ────────────────────────────────────────────────────────
  {
    id: "platform-admin",
    title: "Platform Admin",
    items: [
      {
        kind: "leaf",
        label: "Tenant",
        href: "/superadmin/tenants",
        icon: Building2,
      },
      {
        kind: "leaf",
        label: "Utenti",
        href: "/superadmin/users",
        icon: Users,
      },
      {
        kind: "leaf",
        label: "Moduli & Feature Flags",
        href: "/superadmin/modules",
        icon: Puzzle,
      },
      {
        kind: "leaf",
        label: "Subscriptions",
        href: "/superadmin/subscriptions",
        icon: CircleDollarSign,
      },
    ],
  },

  // ── 4. FATTURAZIONE ──────────────────────────────────────────────────────────
  {
    id: "billing",
    title: "Fatturazione",
    items: [
      {
        kind: "leaf",
        label: "Dashboard Finanziario",
        href: "/superadmin/finance/dashboard",
        icon: Wallet,
      },
      {
        kind: "leaf",
        label: "Fatture & Preventivi",
        href: "/superadmin/finance/invoices",
        icon: Receipt,
      },
    ],
  },

  // ── 5. OPERATIONS ────────────────────────────────────────────────────────────
  {
    id: "operations",
    title: "Operations",
    items: [
      {
        kind: "leaf",
        label: "Stato Delivery",
        href: "/superadmin/delivery/status",
        icon: Truck,
      },
      {
        kind: "leaf",
        label: "Calendario",
        href: "/superadmin/delivery/calendar",
        icon: CalendarDays,
      },
    ],
  },

  // ── 6. INFRASTRUTTURA ────────────────────────────────────────────────────────
  {
    id: "infra",
    title: "Infrastruttura",
    items: [
      {
        kind: "leaf",
        label: "System Monitor",
        href: "/superadmin/system",
        icon: HeartPulse,
      },
      {
        kind: "leaf",
        label: "Storage & Backup",
        href: "/superadmin/storage",
        icon: HardDrive,
      },
    ],
  },

  // ── 7. COMUNICAZIONE & SUPPORTO ──────────────────────────────────────────────
  {
    id: "comms",
    title: "Comunicazione & Supporto",
    items: [
      {
        kind: "leaf",
        label: "Notifiche",
        href: "/superadmin/notifications",
        icon: Bell,
      },
      {
        kind: "leaf",
        label: "Ticket Supporto",
        href: "/superadmin/tickets",
        icon: LifeBuoy,
      },
      {
        kind: "leaf",
        label: "Email Templates",
        href: "/superadmin/email-templates",
        icon: Mail,
      },
      {
        kind: "leaf",
        label: "Changelog",
        href: "/superadmin/changelog",
        icon: Rocket,
      },
    ],
  },

  // ── 8. CONFIGURAZIONE ────────────────────────────────────────────────────────
  {
    id: "settings",
    title: "Configurazione",
    items: [
      {
        kind: "leaf",
        label: "Impostazioni Globali",
        href: "/superadmin/settings",
        icon: Settings,
      },
    ],
  },
];