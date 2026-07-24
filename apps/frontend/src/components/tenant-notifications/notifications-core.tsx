"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, FileText, Loader2, Settings, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import {
  archiveTenantNotification,
  deleteTenantNotification,
  getTenantNotificationSummary,
  listTenantNotifications,
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
  markTenantNotificationUnread,
  type NotificationSummary,
  type TenantNotification,
} from "@/lib/tenant-notifications-api";
import { getDoFlowUser } from "@/lib/jwt";
import { NotificationsList, type NotificationFilters } from "./notifications-list";
import { NotificationsSummaryCards } from "./notifications-summary-cards";

const DEFAULT_FILTERS: NotificationFilters = {
  status: "__all__",
  priority: "__all__",
  type: "",
  entity_type: "",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function NotificationsPage() {
  const { toast } = useToast();
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  const canViewFinance = ["owner", "admin", "superadmin", "super_admin"].includes(role);
  const [notifications, setNotifications] = useState<TenantNotification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [filters, setFilters] = useState<NotificationFilters>(DEFAULT_FILTERS);
  const [total, setTotal] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const params = useMemo(() => ({
    status: filters.status,
    priority: filters.priority,
    type: filters.type.trim(),
    entity_type: filters.entity_type.trim(),
    limit: 80,
    sortBy: "created_at",
    sortDir: "desc",
  }), [filters]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getTenantNotificationSummary();
      setSummary(data);
      setSummaryError(null);
    } catch (error) {
      setSummary(null);
      setSummaryError(errorMessage(error, "Summary notifiche non disponibile"));
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listTenantNotifications(params);
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total);
    } catch (error) {
      setNotifications([]);
      setTotal(0);
      toast({
        title: "Errore nel caricamento notifiche",
        description: errorMessage(error, "Impossibile leggere le notifiche interne."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [params, toast]);

  const reload = useCallback(async () => {
    await Promise.all([loadSummary(), loadNotifications()]);
  }, [loadNotifications, loadSummary]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast({ title: success });
      await reload();
    } catch (error) {
      toast({
        title: "Azione non completata",
        description: errorMessage(error, "Errore durante l'aggiornamento della notifica."),
        variant: "destructive",
      });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Notifiche"
        description="Centro notifiche interno doflow: task, progetti, preventivi, briefing e alert finance solo dove autorizzati."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/notifications/rules">
                <Workflow className="mr-2 h-4 w-4" />
                Regole
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/notifications/digest">
                <FileText className="mr-2 h-4 w-4" />
                Digest
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/notifications/preferences">
                <Settings className="mr-2 h-4 w-4" />
                Preferenze
              </Link>
            </Button>
          </>
        }
      />

      {summaryError ? (
        <div className="rounded-card border border-chart-5/30 bg-chart-5/10 px-4 py-3 text-sm text-foreground">
          {summaryError}. La lista notifiche resta utilizzabile.
        </div>
      ) : null}

      <NotificationsSummaryCards summary={summary} showFinance={canViewFinance} />

      {isLoading && notifications.length === 0 ? (
        <div className="flex min-h-[24vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          Caricamento notifiche...
        </div>
      ) : (
        <NotificationsList
          notifications={notifications}
          filters={filters}
          isLoading={isLoading}
          total={total}
          onFiltersChange={setFilters}
          onRefresh={reload}
          onMarkRead={(id) => void runAction(() => markTenantNotificationRead(id), "Notifica segnata come letta")}
          onMarkUnread={(id) => void runAction(() => markTenantNotificationUnread(id), "Notifica segnata come non letta")}
          onArchive={(id) => void runAction(() => archiveTenantNotification(id), "Notifica archiviata")}
          onDelete={(id) => void runAction(() => deleteTenantNotification(id), "Notifica eliminata")}
          onMarkAllRead={() => void runAction(markAllTenantNotificationsRead, "Notifiche segnate come lette")}
        />
      )}

      <div className="rounded-card border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Bell className="mr-2 inline h-4 w-4" />
        Le notifiche sono generate da regole interne reali. Nessuna email o integrazione esterna viene inviata da questa UI.
      </div>
    </PageShell>
  );
}
