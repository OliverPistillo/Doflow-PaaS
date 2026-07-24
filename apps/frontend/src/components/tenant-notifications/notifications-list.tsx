"use client";

import { Archive, Bell, Check, ExternalLink, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/page-shell";
import type { TenantNotification } from "@/lib/tenant-notifications-api";
import {
  entityLabel,
  formatDateTime,
  isSafeInternalUrl,
  priorityClass,
  priorityLabel,
  statusClass,
  statusLabel,
  typeLabel,
} from "./notifications-utils";
import { cn } from "@/lib/utils";

export type NotificationFilters = {
  status: string;
  priority: string;
  type: string;
  entity_type: string;
};

type Props = {
  notifications: TenantNotification[];
  filters: NotificationFilters;
  isLoading?: boolean;
  total?: number;
  onFiltersChange: (filters: NotificationFilters) => void;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkAllRead: () => void;
};

export function NotificationsList({
  notifications,
  filters,
  isLoading,
  total,
  onFiltersChange,
  onRefresh,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onDelete,
  onMarkAllRead,
}: Props) {
  const router = useRouter();

  const updateFilter = (key: keyof NotificationFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Centro notifiche</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {typeof total === "number" ? `${total} notifiche trovate` : "Notifiche interne del tenant"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Aggiorna
            </Button>
            <Button variant="outline" size="sm" onClick={onMarkAllRead}>
              <Check className="mr-2 h-4 w-4" />
              Segna tutte come lette
            </Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
            <SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti gli stati</SelectItem>
              <SelectItem value="unread">Non lette</SelectItem>
              <SelectItem value="read">Lette</SelectItem>
              <SelectItem value="archived">Archiviate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.priority} onValueChange={(value) => updateFilter("priority", value)}>
            <SelectTrigger><SelectValue placeholder="Priorità" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutte le priorità</SelectItem>
              <SelectItem value="low">Bassa</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={filters.type === "__all__" ? "" : filters.type}
            onChange={(event) => updateFilter("type", event.target.value)}
            placeholder="Filtra per type"
          />
          <Input
            value={filters.entity_type === "__all__" ? "" : filters.entity_type}
            onChange={(event) => updateFilter("entity_type", event.target.value)}
            placeholder="Filtra per entità"
          />
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nessuna notifica da mostrare"
            message="Le automazioni non hanno generato notifiche per questi filtri."
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "rounded-card border bg-card p-4 transition-colors",
                  notification.status === "unread" ? "border-primary/30 bg-primary/[0.03]" : "border-border",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{notification.title}</h3>
                      <Badge variant="outline" className={priorityClass(notification.priority)}>
                        {priorityLabel(notification.priority)}
                      </Badge>
                      <Badge variant="outline" className={statusClass(notification.status)}>
                        {statusLabel(notification.status)}
                      </Badge>
                    </div>
                    {notification.body ? (
                      <p className="text-sm text-muted-foreground">{notification.body}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{typeLabel(notification.type)}</span>
                      {notification.entity_type ? (
                        <>
                          <span>·</span>
                          <span>{entityLabel(notification.entity_type)}</span>
                        </>
                      ) : null}
                      {notification.entity_id ? (
                        <>
                          <span>·</span>
                          <span className="font-mono">{notification.entity_id.slice(0, 8)}</span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span>{formatDateTime(notification.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {isSafeInternalUrl(notification.link_url) ? (
                      <Button variant="outline" size="sm" onClick={() => router.push(notification.link_url!)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Apri
                      </Button>
                    ) : null}
                    {notification.status === "unread" ? (
                      <Button variant="outline" size="sm" onClick={() => onMarkRead(notification.id)}>
                        <Check className="mr-2 h-4 w-4" />
                        Letta
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => onMarkUnread(notification.id)}>
                        <Undo2 className="mr-2 h-4 w-4" />
                        Non letta
                      </Button>
                    )}
                    {notification.status !== "archived" ? (
                      <Button variant="outline" size="sm" onClick={() => onArchive(notification.id)}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archivia
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => onDelete(notification.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Elimina
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
