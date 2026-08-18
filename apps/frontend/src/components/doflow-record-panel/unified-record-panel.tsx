"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUnifiedRecordPanelId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function withQuery(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function useUnifiedRecordPanelUrl({
  enabled,
  paramKey,
  tabs,
  defaultTab,
}: {
  enabled: boolean;
  paramKey: "opportunity" | "company" | "project";
  tabs: readonly string[];
  defaultTab: string;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const searchParams = useMemo(() => new URLSearchParams(query), [query]);
  const rawId = searchParams.get(paramKey);
  const recordId = enabled && isUnifiedRecordPanelId(rawId) ? rawId : null;
  const rawTab = searchParams.get("panelTab");
  const normalizedTab = rawTab === "flow" ? "overview" : rawTab;
  const activeTab = normalizedTab && tabs.includes(normalizedTab) ? normalizedTab : defaultTab;
  const openedFromPage = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const previousId = useRef<string | null>(recordId);

  useEffect(() => {
    const syncFromLocation = () => setQuery(window.location.search);
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [pathname]);

  const updateLocation = useCallback((params: URLSearchParams, mode: "push" | "replace") => {
    const nextUrl = `${withQuery(window.location.pathname, params)}${window.location.hash}`;
    if (mode === "push") window.history.pushState(window.history.state, "", nextUrl);
    else window.history.replaceState(window.history.state, "", nextUrl);
    setQuery(window.location.search);
  }, []);

  const openRecord = useCallback((id: string, trigger?: HTMLElement | null) => {
    if (!enabled || !isUnifiedRecordPanelId(id)) return;
    openedFromPage.current = true;
    returnFocus.current = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const params = new URLSearchParams(window.location.search);
    params.set(paramKey, id);
    params.delete("panelTab");
    updateLocation(params, "push");
  }, [enabled, paramKey, updateLocation]);

  const closeRecord = useCallback(() => {
    if (!recordId) return;
    if (openedFromPage.current) {
      openedFromPage.current = false;
      window.history.back();
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.delete(paramKey);
    params.delete("panelTab");
    updateLocation(params, "replace");
  }, [paramKey, recordId, updateLocation]);

  const setActiveTab = useCallback((tab: string) => {
    if (!tabs.includes(tab)) return;
    const params = new URLSearchParams(window.location.search);
    if (tab === defaultTab) params.delete("panelTab");
    else params.set("panelTab", tab);
    updateLocation(params, "replace");
  }, [defaultTab, tabs, updateLocation]);

  useEffect(() => {
    if (previousId.current && !recordId) {
      const target = returnFocus.current;
      window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }
    previousId.current = recordId;
  }, [recordId]);

  return { recordId, activeTab, openRecord, closeRecord, setActiveTab };
}

export type RecordPanelAction = {
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
  external?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  primary?: boolean;
};

export type RecordPanelMoreAction = {
  label: string;
  href?: string;
  onSelect?: () => void;
};

export type RecordPanelTab = {
  value: string;
  label: string;
  content: ReactNode;
  footer?: ReactNode;
};

export function UnifiedRecordPanel({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  status,
  progress,
  actions,
  moreActions = [],
  tabs,
  activeTab,
  onTabChange,
  loading = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  progress?: number | null;
  owner?: string | null;
  actions: RecordPanelAction[];
  moreActions?: RecordPanelMoreAction[];
  tabs: RecordPanelTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const activeDefinition = useMemo(
    () => tabs.find((tab) => tab.value === activeTab) || tabs[0],
    [activeTab, tabs],
  );

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        className="flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden border-l border-[#e8e8ed] bg-white p-0 shadow-[0_0_28px_rgba(15,23,42,0.12)] sm:max-w-none md:w-[min(540px,78vw)] lg:w-[540px] [&>button]:right-5 [&>button]:top-5 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-md [&>button]:text-slate-500 [&>button]:focus-visible:ring-0 [&>button]:focus-visible:ring-offset-0"
        overlayClassName="bg-slate-950/10 backdrop-blur-[1px]"
        data-unified-record-panel
      >
        <SheetHeader className="shrink-0 space-y-0 border-b border-[#e8e8ed] bg-white px-5 pb-0 pt-5 text-left sm:px-6">
          <p className="pr-10 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{eyebrow}</p>
          <SheetTitle className="mt-1.5 pr-10 text-[28px] font-bold leading-8 tracking-[-0.025em] text-slate-950" data-record-sensitive>{title}</SheetTitle>
          <SheetDescription className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
            {subtitle ? <span data-record-sensitive>{subtitle}</span> : null}
          </SheetDescription>
          {status || progress !== null && progress !== undefined ? <div className="mt-2 flex flex-wrap items-center gap-2">
            {status ? <Badge className="h-6 border-0 bg-violet-100 px-2.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">{status}</Badge> : null}
            {progress !== null && progress !== undefined ? <span className="text-[11px] font-semibold text-violet-700">{Math.max(0, Math.min(100, progress))}% <span className="font-medium text-slate-700">completato</span></span> : null}
          </div> : null}

          <div className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Azioni rapide">
            {actions.map((action) => {
              const Icon = action.icon;
              const content = <><Icon className="h-3.5 w-3.5" /><span>{action.label}</span></>;
              if (action.href && !action.disabled) {
                return (
                  <Button key={action.label} asChild variant={action.primary ? "default" : "outline"} size="sm" className={cn("h-9 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold", action.primary ? "border-0 bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm hover:from-blue-700 hover:to-violet-700" : "border-[#e1e2e8] bg-white text-slate-800")}>
                    <Link href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined}>{content}</Link>
                  </Button>
                );
              }
              return (
                <Button key={action.label} variant={action.primary ? "default" : "outline"} size="sm" className={cn("h-9 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold", action.primary ? "border-0 bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm hover:from-blue-700 hover:to-violet-700" : "border-[#e1e2e8] bg-white text-slate-800")} disabled={action.disabled || !action.onSelect} title={action.disabledReason} onClick={action.onSelect}>
                  {content}
                </Button>
              );
            })}
            {moreActions.length ? <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-lg border-[#e1e2e8] bg-white" aria-label="Altre azioni">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {moreActions.map((action) => action.href ? (
                  <DropdownMenuItem key={action.label} asChild><Link href={action.href}>{action.label}</Link></DropdownMenuItem>
                ) : (
                  <DropdownMenuItem key={action.label} onSelect={action.onSelect}>{action.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu> : null}
          </div>

          <div className="mt-3 flex justify-between gap-1 overflow-x-auto" role="tablist" aria-label={`Sezioni ${eyebrow.toLowerCase()}`}>
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  "relative shrink-0 px-2.5 py-3 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900",
                  activeTab === tab.value && "font-semibold text-slate-950 after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-violet-600",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-4 sm:px-6" role="tabpanel" data-record-panel-body>
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">Caricamento dettagli…</div>
          ) : error ? (
            <RecordPanelEmptyState title="Dettagli non disponibili" description={error} />
          ) : activeDefinition?.content}
        </div>
        {activeDefinition?.footer ? <footer className="shrink-0 border-t border-[#e8e8ed] bg-white px-5 py-3 sm:px-6" data-record-panel-footer>{activeDefinition.footer}</footer> : null}
      </SheetContent>
    </Sheet>
  );
}

export function RecordPanelSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-[#e8e8ed] bg-white p-3.5", className)}>
      <div className="mb-2.5">
        <h3 className="text-[13px] font-semibold text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function RecordPanelField({ label, value, sensitive = false }: { label: string; value?: ReactNode; sensitive?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] font-medium text-slate-900" {...(sensitive ? { "data-record-sensitive": true } : {})}>{value || "—"}</dd>
    </div>
  );
}

export function RecordPanelEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-7 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
