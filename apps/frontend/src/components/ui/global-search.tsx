// Percorso: apps/frontend/src/components/ui/global-search.tsx
// Search globale Cmd+K — shadcn CommandDialog
// Fix rispetto alla versione precedente:
//   - SearchTriggerButton ha un solo stato + un solo CommandDialog
//   - Rimossa la struttura duplicata GlobalSearch + GlobalSearchModal
//   - Export pulito: GlobalSearch (hook-based) + SearchTriggerButton (UI)

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, FileText, ShoppingCart, Building2,
  Settings, BarChart3, CalendarDays, Receipt, ListTodo,
  Package, Wallet, Shield, Activity, Search,
} from "lucide-react";

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type SearchItem = {
  id:       string;
  label:    string;
  href:     string;
  group:    string;
  icon:     React.ComponentType<{ className?: string }>;
  keywords?: string[];
};

// ─── Catalogo voci — tenant CRM ───────────────────────────────────────────────

const TENANT_ITEMS: SearchItem[] = [
  { id: "dashboard",   label: "Dashboard",       href: "/dashboard",        group: "Panoramica", icon: LayoutDashboard, keywords: ["home", "overview"] },
  { id: "contacts",    label: "Contatti",         href: "/contacts",         group: "CRM",        icon: Users           },
  { id: "companies",   label: "Aziende",          href: "/companies",        group: "CRM",        icon: Building2       },
  { id: "deals",       label: "Offerte",          href: "/deals",            group: "CRM",        icon: ListTodo,        keywords: ["pipeline", "trattative"] },
  { id: "invoices",    label: "Fatture",          href: "/invoices",         group: "Finanza",    icon: Receipt         },
  { id: "orders",      label: "Ordini",           href: "/orders",           group: "Finanza",    icon: ShoppingCart    },
  { id: "quotes",      label: "Preventivi",       href: "/quotes",           group: "Finanza",    icon: FileText        },
  { id: "payments",    label: "Pagamenti",        href: "/payments",         group: "Finanza",    icon: Wallet          },
  { id: "products",    label: "Prodotti",         href: "/products",         group: "Catalogo",   icon: Package         },
  { id: "inventory",   label: "Inventario",       href: "/inventory",        group: "Catalogo",   icon: Package,         keywords: ["magazzino", "stock"] },
  { id: "calendar",    label: "Calendario",       href: "/calendar",         group: "Strumenti",  icon: CalendarDays    },
  { id: "tasks",       label: "Attività",         href: "/tasks",            group: "Strumenti",  icon: Activity        },
  { id: "analytics",   label: "Analisi",          href: "/analytics",        group: "Report",     icon: BarChart3,       keywords: ["statistiche", "report"] },
  { id: "settings",    label: "Impostazioni",     href: "/settings",         group: "Account",    icon: Settings        },
  { id: "team",        label: "Team",             href: "/team",             group: "Account",    icon: Users,           keywords: ["utenti", "ruoli"] },
];

// ─── Catalogo voci — superadmin ───────────────────────────────────────────────

const SUPERADMIN_ITEMS: SearchItem[] = [
  { id: "sa-dashboard", label: "Sales Dashboard",     href: "/superadmin/dashboard",          group: "Sales",    icon: BarChart3    },
  { id: "sa-pipeline",  label: "Gestione Offerte",    href: "/superadmin/sales/pipeline",     group: "Sales",    icon: ListTodo     },
  { id: "sa-metrics",   label: "Metriche SaaS",       href: "/superadmin/metrics",            group: "Platform", icon: Activity     },
  { id: "sa-tower",     label: "Control Tower",       href: "/superadmin/control-tower",      group: "Platform", icon: Shield       },
  { id: "sa-tenants",   label: "Gestione Tenant",     href: "/superadmin/tenants",            group: "Admin",    icon: Building2    },
  { id: "sa-users",     label: "Gestione Utenti",     href: "/superadmin/users",              group: "Admin",    icon: Users        },
  { id: "sa-audit",     label: "Audit Log",           href: "/superadmin/audit",              group: "Admin",    icon: Activity     },
  { id: "sa-fin-dash",  label: "Dashboard Finanza",   href: "/superadmin/finance/dashboard",  group: "Finanza",  icon: Wallet       },
  { id: "sa-invoices",  label: "Gestione Fatture",    href: "/superadmin/finance/invoices",   group: "Finanza",  icon: Receipt      },
  { id: "sa-delivery",  label: "Stato del Servizio",  href: "/superadmin/delivery/status",    group: "Delivery", icon: ListTodo     },
  { id: "sa-calendar",  label: "Calendario Progetto", href: "/superadmin/delivery/calendar",  group: "Delivery", icon: CalendarDays },
  { id: "sa-settings",  label: "Impostazioni Globali",href: "/superadmin/settings",           group: "Account",  icon: Settings     },
  { id: "sa-account",   label: "Il mio Account",      href: "/superadmin/account",            group: "Account",  icon: Users        },
];

// ─── Hook useGlobalSearch ────────────────────────────────────────────────────
// Permette di aprire la ricerca programmaticamente da qualsiasi componente

const SearchContext = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
} | null>(null);

/** Wrappa l'app se si vuole condividere lo stato del dialog (opzionale) */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <SearchContext.Provider value={{ open, setOpen }}>
      {children}
    </SearchContext.Provider>
  );
}

// ─── Logica condivisa ─────────────────────────────────────────────────────────

function useSearch(context: "tenant" | "superadmin") {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const items  = context === "superadmin" ? SUPERADMIN_ITEMS : TENANT_ITEMS;

  const groups = React.useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const item of items) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return map;
  }, [items]);

  // Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const navigate = React.useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  return { open, setOpen, groups, navigate };
}

// ─── CommandPalette — il dialog effettivo ─────────────────────────────────────

function CommandPalette({
  open, onClose, groups, navigate,
}: {
  open:     boolean;
  onClose:  () => void;
  groups:   Map<string, SearchItem[]>;
  navigate: (href: string) => void;
}) {
  return (
    <CommandDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <CommandInput placeholder="Cerca pagine, sezioni, azioni…" />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Search className="h-8 w-8 opacity-30" aria-hidden="true" />
            <p className="text-sm">Nessun risultato trovato.</p>
          </div>
        </CommandEmpty>

        {Array.from(groups.entries()).map(([groupName, groupItems], gi) => (
          <React.Fragment key={groupName}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={groupName}>
              {groupItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={[item.label, ...(item.keywords ?? [])].join(" ")}
                    onSelect={() => navigate(item.href)}
                    className="gap-2 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>

      {/* Footer hint */}
      <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Premi{" "}
          <kbd className="font-mono bg-muted border border-border rounded px-1.5 py-0.5 text-[10px]">↵</kbd>
          {" "}per aprire
        </span>
        <span>
          <kbd className="font-mono bg-muted border border-border rounded px-1.5 py-0.5 text-[10px]">Esc</kbd>
          {" "}per chiudere
        </span>
      </div>
    </CommandDialog>
  );
}

// ─── SearchTriggerButton ──────────────────────────────────────────────────────
// Pulsante da inserire negli header — gestisce internamente stato + dialog

export function SearchTriggerButton({
  context = "tenant",
}: {
  context?: "tenant" | "superadmin";
}) {
  const { open, setOpen, groups, navigate } = useSearch(context);

  return (
    <>
      {/* Trigger visibile su md+ */}
      <button
        onClick={() => setOpen(true)}
        className={[
          "hidden md:flex items-center gap-2",
          "h-9 px-3 rounded-nav",
          "bg-muted/60 border border-border/50",
          "text-sm text-muted-foreground",
          "hover:bg-muted hover:text-foreground hover:border-border",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ].join(" ")}
        aria-label="Apri ricerca globale (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Cerca…</span>
        <kbd className="ml-2 font-mono text-[10px] bg-background border border-border rounded px-1.5 py-0.5 text-muted-foreground/70">
          ⌘K
        </kbd>
      </button>

      {/* Mobile: solo icona */}
      <button
        onClick={() => setOpen(true)}
        className={[
          "flex md:hidden items-center justify-center",
          "h-9 w-9 rounded-nav",
          "text-muted-foreground hover:text-foreground hover:bg-muted",
          "transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ].join(" ")}
        aria-label="Apri ricerca (Ctrl+K)"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Dialog — unica istanza */}
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        groups={groups}
        navigate={navigate}
      />
    </>
  );
}

// ─── GlobalSearch — componente autonomo (senza pulsante trigger) ──────────────
// Utile per aprire il dialog dall'esterno o integrare in flussi custom

export function GlobalSearch({
  context = "tenant",
  open,
  onClose,
}: {
  context?: "tenant" | "superadmin";
  open:     boolean;
  onClose:  () => void;
}) {
  const router = useRouter();
  const items  = context === "superadmin" ? SUPERADMIN_ITEMS : TENANT_ITEMS;

  const groups = React.useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const item of items) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return map;
  }, [items]);

  const navigate = React.useCallback((href: string) => {
    onClose();
    router.push(href);
  }, [onClose, router]);

  return (
    <CommandPalette
      open={open}
      onClose={onClose}
      groups={groups}
      navigate={navigate}
    />
  );
}