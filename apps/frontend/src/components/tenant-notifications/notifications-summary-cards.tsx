"use client";

import { AlertTriangle, Bell, CheckCircle2, Receipt, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NotificationSummary } from "@/lib/tenant-notifications-api";
import { cn } from "@/lib/utils";

type Props = {
  summary: NotificationSummary | null;
  showFinance?: boolean;
};

export function NotificationsSummaryCards({ summary, showFinance = true }: Props) {
  const items = [
    {
      label: "Non lette",
      value: summary?.unreadNotifications || 0,
      icon: Bell,
      tone: (summary?.unreadNotifications || 0) > 0 ? "text-primary" : "text-muted-foreground",
    },
    {
      label: "Urgenti",
      value: summary?.urgentNotifications || 0,
      icon: AlertTriangle,
      tone: (summary?.urgentNotifications || 0) > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Task scaduti",
      value: summary?.taskOverdueNotifications || 0,
      icon: Timer,
      tone: (summary?.taskOverdueNotifications || 0) > 0 ? "text-chart-5" : "text-muted-foreground",
    },
    ...(showFinance && (summary?.financeNotifications || 0) > 0
      ? [{
          label: "Finance",
          value: summary?.financeNotifications || 0,
          icon: Receipt,
          tone: "text-chart-5",
        }]
      : []),
    {
      label: "Digest oggi",
      value: summary?.todayDigestAvailable ? "Sì" : "No",
      icon: CheckCircle2,
      tone: summary?.todayDigestAvailable ? "text-chart-2" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{item.value}</p>
              </div>
              <span className={cn("rounded-nav bg-muted p-2", item.tone)}>
                <Icon className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        );
      })}
      {!showFinance ? (
        <Badge variant="outline" className="w-fit border-border text-muted-foreground sm:col-span-2 xl:col-span-5">
          I dati finance sono nascosti ai ruoli non autorizzati.
        </Badge>
      ) : null}
    </div>
  );
}
