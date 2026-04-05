"use client";

import { useState } from "react";
import { CreditCard, Check, Zap, Shield, Users, Download, ChevronRight,
  AlertTriangle, Star, Sparkles, Calendar, Receipt, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "STARTER",
    name: "Starter",
    price: 49,
    description: "Perfetto per piccoli team e liberi professionisti",
    color: "text-slate-700",
    border: "border-border",
    badge: "",
    features: [
      "Fino a 3 utenti", "CRM base (clienti, contatti, deal)", "Pipeline vendite",
      "Preventivi e ordini", "500 MB storage", "Supporto email",
    ],
    cta: "Piano attuale",
    current: false,
  },
  {
    id: "PRO",
    name: "Pro",
    price: 129,
    description: "Per team in crescita con esigenze avanzate",
    color: "text-indigo-700",
    border: "border-indigo-300 dark:border-indigo-700",
    badge: "Attivo",
    features: [
      "Fino a 15 utenti", "Tutto di Starter +", "Fatturazione & contabilità",
      "Calendario & task avanzati", "Campagne email", "Report e analytics Pro",
      "5 GB storage", "Supporto prioritario",
    ],
    cta: "Piano attuale",
    current: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 299,
    description: "Per aziende con workflow complessi e team estesi",
    color: "text-amber-700",
    border: "border-amber-300 dark:border-amber-700",
    badge: "Upgrade",
    features: [
      "Utenti illimitati", "Tutto di Pro +", "Business Intelligence avanzata",
      "Automazioni illimitate", "Firme digitali", "HR & Team management",
      "50 GB storage", "SLA garantito & supporto dedicato",
    ],
    cta: "Passa a Enterprise",
    current: false,
  },
];

// ─── Usage data ───────────────────────────────────────────────────────────────

const USAGE = [
  { label: "Utenti",          used: 9,    limit: 15,    unit: "utenti",    icon: Users,    color: "bg-indigo-500" },
  { label: "Storage",         used: 2.3,  limit: 5,     unit: "GB",        icon: Shield,   color: "bg-emerald-500" },
  { label: "Automazioni",     used: 4,    limit: 10,    unit: "attive",    icon: Zap,      color: "bg-amber-500" },
  { label: "Email Campaign",  used: 1840, limit: 5000,  unit: "inviate/m", icon: Sparkles, color: "bg-violet-500" },
];

// ─── Invoice history ──────────────────────────────────────────────────────────

const INVOICES = [
  { id: "INV-2026-02", date: "01/02/2026", amount: "€ 129,00", status: "Pagata",  plan: "Pro" },
  { id: "INV-2026-01", date: "01/01/2026", amount: "€ 129,00", status: "Pagata",  plan: "Pro" },
  { id: "INV-2025-12", date: "01/12/2025", amount: "€ 129,00", status: "Pagata",  plan: "Pro" },
  { id: "INV-2025-11", date: "01/11/2025", amount: "€ 129,00", status: "Pagata",  plan: "Pro" },
  { id: "INV-2025-10", date: "01/10/2025", amount: "€ 49,00",  status: "Pagata",  plan: "Starter" },
];

// ─── Payment method card ──────────────────────────────────────────────────────

function PaymentCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Metodo di Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
          <div className="h-9 w-14 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">VISA</span>
          </div>
          <div>
            <p className="text-sm font-medium">•••• •••• •••• 4242</p>
            <p className="text-xs text-muted-foreground">Scade 09/2028</p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs text-emerald-600 border-emerald-200 bg-emerald-50">Predefinita</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs">Aggiorna carta</Button>
          <Button variant="ghost" size="sm" className="flex-1 text-xs text-muted-foreground">Aggiungi metodo</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Next renewal card ────────────────────────────────────────────────────────

function RenewalCard() {
  return (
    <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Prossimo rinnovo</p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">1 Marzo 2026 · Piano Pro · <strong>€ 129,00</strong></p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-indigo-700">
            Gestisci <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Abbonamento & Fatturazione</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gestisci il tuo piano, utilizzo e fatturazione DoFlow</p>
        </div>
        <Button variant="outline" size="sm">
          <ExternalLink className="mr-1.5 h-4 w-4" /> Portale clienti
        </Button>
      </div>

      {/* Current plan banner */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">Piano Pro</h3>
                <Badge className="bg-indigo-600 text-white text-xs">Attivo</Badge>
              </div>
              <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-0.5">
                Fatturazione mensile · <strong>€ 129/mese</strong> · Rinnovo 01/03/2026
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowUpgrade(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shrink-0"
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Passa a Enterprise
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column — usage + plans */}
        <div className="lg:col-span-2 space-y-4">

          {/* Usage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Utilizzo Piano</CardTitle>
              <CardDescription className="text-xs">Consumo risorse nel mese corrente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {USAGE.map((u) => {
                const pct = Math.round((u.used / u.limit) * 100);
                const warn = pct >= 80;
                return (
                  <div key={u.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <u.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{u.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {warn && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        <span className={cn("text-xs tabular-nums", warn ? "text-amber-600 font-semibold" : "text-muted-foreground")}>
                          {u.used} / {u.limit} {u.unit}
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className={cn("h-2", warn ? "text-amber-500" : "")}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Plan comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Confronto Piani</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={cn(
                      "rounded-xl border p-4 flex flex-col gap-3 relative",
                      plan.current
                        ? "border-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-700"
                        : "border-border",
                    )}
                  >
                    {plan.current && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <Badge className="bg-indigo-600 text-white text-[10px]">Piano Attuale</Badge>
                      </div>
                    )}
                    {plan.id === "ENTERPRISE" && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <Badge className="bg-amber-500 text-white text-[10px]">Consigliato</Badge>
                      </div>
                    )}
                    <div>
                      <p className={cn("font-bold text-sm", plan.color)}>{plan.name}</p>
                      <p className="text-xl font-black tabular-nums mt-0.5">
                        € {plan.price}<span className="text-xs font-normal text-muted-foreground">/mese</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">{plan.description}</p>
                    </div>
                    <ul className="space-y-1.5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant={plan.current ? "outline" : plan.id === "ENTERPRISE" ? "default" : "ghost"}
                      disabled={plan.current}
                      className={cn(
                        "w-full text-xs mt-1",
                        plan.id === "ENTERPRISE" && "bg-amber-500 hover:bg-amber-600 text-white",
                      )}
                    >
                      {plan.cta}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right column */}
        <div className="space-y-4">
          <RenewalCard />
          <PaymentCard />

          {/* Invoice history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Storico Fatture
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {INVOICES.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/20 transition-colors">
                    <div>
                      <p className="text-xs font-semibold">{inv.id}</p>
                      <p className="text-[11px] text-muted-foreground">{inv.date} · {inv.plan}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums">{inv.amount}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="pt-2 pb-3 px-5">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full">
                Vedi tutte le fatture <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
