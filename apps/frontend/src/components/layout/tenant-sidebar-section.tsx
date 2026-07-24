"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PlanBadge } from "@/components/ui/locked-feature";
import type { PlanTier } from "@/lib/plans";
import { PLAN_META, planIncludes } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type {
  TenantNavigationItem,
  TenantNavigationRole,
  TenantNavigationSection,
} from "@/config/tenant-navigation";

function isHrefActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function roleCanSee(roles: TenantNavigationRole[] | undefined, role: TenantNavigationRole): boolean {
  return !roles || roles.includes(role);
}

function itemIsAvailable(item: TenantNavigationItem | TenantNavigationSection, role: TenantNavigationRole): boolean {
  return roleCanSee(item.roles, role);
}

function accessCanSee(item: TenantNavigationItem | TenantNavigationSection, canView?: (moduleKey?: string | null) => boolean): boolean {
  return canView ? canView(item.moduleKey) : true;
}

export function findActiveTenantSectionId(
  sections: TenantNavigationSection[],
  pathname: string,
  role: TenantNavigationRole,
  canView?: (moduleKey?: string | null) => boolean,
): string | null {
  let match: { id: string; hrefLength: number } | null = null;

  for (const section of sections) {
    if (!itemIsAvailable(section, role) || !accessCanSee(section, canView)) continue;

    if (section.href && isHrefActive(pathname, section.href)) {
      match = { id: section.id, hrefLength: section.href.length };
    }

    for (const child of section.children || []) {
      if (!itemIsAvailable(child, role) || !accessCanSee(child, canView)) continue;
      if (isHrefActive(pathname, child.href) && child.href.length >= (match?.hrefLength || 0)) {
        match = { id: section.id, hrefLength: child.href.length };
      }
    }
  }

  return match?.id || null;
}

export function filterTenantNavigation(
  sections: TenantNavigationSection[],
  role: TenantNavigationRole,
  canView?: (moduleKey?: string | null) => boolean,
  activePlan?: PlanTier,
  isDoflowTenant = false,
): TenantNavigationSection[] {
  return sections
    .filter((section) => itemIsAvailable(section, role) && accessCanSee(section, canView))
    .map((section) => ({
      ...section,
      children: section.children?.filter((child) => {
        if (!itemIsAvailable(child, role) || !accessCanSee(child, canView)) return false;
        if (isDoflowTenant && activePlan && !planIncludes(activePlan, child.minPlan || 'STARTER')) return false;
        return true;
      }),
    }))
    .filter((section) => {
      if (section.children) return section.children.length > 0;
      if (!section.href) return false;
      if (isDoflowTenant && activePlan && !planIncludes(activePlan, section.minPlan || 'STARTER')) return false;
      return true;
    });
}

function LockedHint({
  minPlan,
  isDoflowTenant,
}: {
  minPlan: PlanTier;
  isDoflowTenant: boolean;
}) {
  if (isDoflowTenant) return null;

  return (
    <span className="ml-auto group-data-[collapsible=icon]:hidden">
      <PlanBadge plan={minPlan} />
    </span>
  );
}

function DisabledUpgradeHint({
  minPlan,
  isDoflowTenant,
}: {
  minPlan: PlanTier;
  isDoflowTenant: boolean;
}) {
  if (isDoflowTenant) {
    return <span>Modulo non disponibile per il piano corrente.</span>;
  }

  return (
    <span>
      Disponibile con il piano {PLAN_META[minPlan].label}.
      <span className="mt-1.5 flex items-center gap-1 font-semibold text-primary">
        <Sparkles className="h-3 w-3" />
        {PLAN_META[minPlan].upgradeLabel ?? "Aggiorna piano"}
      </span>
    </span>
  );
}

function TenantSidebarLeaf({
  item,
  activeHref,
  activePlan,
  pathname,
  onNavigate,
  isDoflowTenant,
}: {
  item: TenantNavigationItem;
  activeHref?: string;
  activePlan: PlanTier;
  pathname: string;
  onNavigate: () => void;
  isDoflowTenant: boolean;
}) {
  const Icon = item.icon;
  const minPlan = item.minPlan || "STARTER";
  const isLocked = !planIncludes(activePlan, minPlan);
  const active = !isLocked && item.href === activeHref;

  if (isLocked) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          aria-disabled="true"
          className="cursor-not-allowed opacity-50"
          title={`Disponibile con il piano ${PLAN_META[minPlan].label}`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
          <LockedHint minPlan={minPlan} isDoflowTenant={isDoflowTenant} />
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={active}
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-8 rounded-md",
          active
            ? "bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
        )}
      >
        <Link href={item.href} onClick={onNavigate}>
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

export function TenantSidebarSection({
  section,
  activePlan,
  pathname,
  open,
  onOpenChange,
  onNavigate,
  role,
  isDoflowTenant,
}: {
  section: TenantNavigationSection;
  activePlan: PlanTier;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
  role: TenantNavigationRole;
  isDoflowTenant: boolean;
}) {
  const { state, isMobile } = useSidebar();
  const Icon = section.icon;
  const children = (section.children || []).filter((item) => itemIsAvailable(item, role));
  const minPlan = section.minPlan || "STARTER";
  const isLocked = !planIncludes(activePlan, minPlan);
  const hasChildren = children.length > 0;
  const activeChildHref = children
    .filter((item) => isHrefActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const active = Boolean(
    (section.href && isHrefActive(pathname, section.href)) ||
    children.some((item) => isHrefActive(pathname, item.href)),
  );
  const compact = state === "collapsed" && !isMobile;
  const contentId = `tenant-sidebar-section-${section.id}`;

  if (!hasChildren && section.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={section.label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "h-9 rounded-lg",
            active ? "bg-primary/10 text-primary" : "text-muted-foreground",
          )}
        >
          <Link href={section.href} onClick={onNavigate}>
            <Icon className="h-4 w-4" />
            <span>{section.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (compact && section.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={section.label}
          aria-current={active ? "page" : undefined}
          className={cn("h-9 rounded-lg", active && "bg-primary/10 text-primary")}
        >
          <Link href={section.href} onClick={onNavigate}>
            <Icon className="h-4 w-4" />
            <span>{section.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (isLocked) {
    if (isDoflowTenant) return null;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-disabled="true"
          tooltip={{
            children: <DisabledUpgradeHint minPlan={minPlan} isDoflowTenant={isDoflowTenant} />,
          }}
          className="h-9 cursor-not-allowed rounded-lg opacity-50"
        >
        <Icon className="h-4 w-4" />
          <span>{section.label}</span>
          <LockedHint minPlan={minPlan} isDoflowTenant={isDoflowTenant} />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            type="button"
            isActive={active}
            tooltip={section.label}
            aria-expanded={open}
            aria-controls={contentId}
            className={cn(
              "h-9 rounded-lg",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{section.label}</span>
            <ChevronRight
              className={cn(
                "ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90",
              )}
              aria-hidden="true"
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent id={contentId}>
          <SidebarMenuSub className="mx-3 mt-1 gap-0.5 border-l-border/70 px-2">
            {children.map((child) => (
              <TenantSidebarLeaf
                key={child.id}
                item={child}
                activeHref={activeChildHref}
                activePlan={activePlan}
                pathname={pathname}
                onNavigate={onNavigate}
                isDoflowTenant={isDoflowTenant}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function TenantSidebarSections({
  sections,
  activePlan,
  pathname,
  openSectionId,
  setOpenSectionId,
  role,
  isDoflowTenant,
}: {
  sections: TenantNavigationSection[];
  activePlan: PlanTier;
  pathname: string;
  openSectionId: string | null;
  setOpenSectionId: (id: string | null) => void;
  role: TenantNavigationRole;
  isDoflowTenant: boolean;
}) {
  const { setOpenMobile, isMobile } = useSidebar();

  const onNavigate = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  return (
    <SidebarMenu className="gap-2 px-3">
      {sections.map((section) => (
        <TenantSidebarSection
          key={section.id}
          section={section}
          activePlan={activePlan}
          pathname={pathname}
          open={openSectionId === section.id}
          onOpenChange={(nextOpen) => setOpenSectionId(nextOpen ? section.id : null)}
          onNavigate={onNavigate}
          role={role}
          isDoflowTenant={isDoflowTenant}
        />
      ))}
    </SidebarMenu>
  );
}
