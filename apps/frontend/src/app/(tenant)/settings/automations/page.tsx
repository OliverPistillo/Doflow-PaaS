// Percorso: apps/frontend/src/app/(tenant)/settings/automations/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import {
  Zap, Loader2, Mail, Bell, ArrowRight,
  UserCheck, Settings, ListTodo, Target, Webhook,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

type AutomationRule = {
  id: string; name: string; description: string | null;
  triggerEvent: string; actionType: string;
  isActive: boolean; executionCount: number;
  lastExecutedAt: string | null;
};

const TRIGGER_LABELS: Record<string, string> = {
  LEAD_STATUS_CHANGE: "Lead: cambio stato", LEAD_CREATED: "Lead: creato",
  LEAD_SCORE_THRESHOLD: "Lead: soglia score", TICKET_CREATED: "Ticket: creato",
  TICKET_SLA_BREACH: "Ticket: SLA violato", TENANT_TRIAL_EXPIRING: "Trial in scadenza",
  TENANT_INACTIVE: "Tenant inattivo", INVOICE_OVERDUE: "Fattura scaduta",
  DEAL_STAGE_CHANGE: "Deal: cambio fase", SCHEDULED: "Schedulato",
};

const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SEND_EMAIL:          { label: "Invia email",     icon: Mail,      color: "hsl(210 70% 55%)" },
  CREATE_NOTIFICATION: { label: "Notifica",        icon: Bell,      color: "hsl(280 60% 55%)" },
  UPDATE_STATUS:       { label: "Aggiorna stato",  icon: Settings,  color: "hsl(150 60% 45%)" },
  ASSIGN_TO:           { label: "Assegna",         icon: UserCheck, color: "hsl(40 80% 55%)" },
  WEBHOOK:             { label: "Webhook",         icon: Webhook,   color: "hsl(var(--chart-4))" },
  CREATE_TASK:         { label: "Crea task",       icon: ListTodo,  color: "hsl(var(--chart-5))" },
};

export default function Page() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<AutomationRule[]>("/superadmin/automations");
        setRules((Array.isArray(res) ? res : []).filter(r => r.isActive));
      } catch {
        setRules([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6 flex justify-center items-center py-32">
        <Loader2 className="animate-spin text-primary h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Zap className="h-6 w-6 text-primary" />Automazioni</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{rules.length} regole attive sul tuo workspace</p>
        </div>
        <Badge className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Piano Pro</Badge>
      </div>

      {rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map(rule => {
            const act = ACTION_CONFIG[rule.actionType] || { label: rule.actionType, icon: Settings, color: "gray" };
            const ActIcon = act.icon;
            return (
              <Card key={rule.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Target className="h-4 w-4" /></div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${act.color} 12%, transparent)`, color: act.color }}>
                      <ActIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground text-sm truncate">{rule.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {TRIGGER_LABELS[rule.triggerEvent] || rule.triggerEvent} → {act.label}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">{rule.executionCount}</p>
                    <p className="text-[10px] text-muted-foreground">esecuzioni</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-4">
              <Zap className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-base font-semibold mb-1">Nessuna automazione attiva</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Le automazioni vengono configurate dall'amministratore della piattaforma. Contatta il supporto per attivarne di nuove.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
