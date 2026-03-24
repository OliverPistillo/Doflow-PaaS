// Percorso: apps/frontend/src/app/(tenant)/my-plan/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import {
  Loader2, Crown, Puzzle, HardDrive, Bell, Users,
  CheckCircle2, Lock, Sparkles, ExternalLink, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type PlanInfo = {
  tenantId: string; name: string; slug: string; planTier: string;
  monthlyPrice: number; maxUsers: number; storageUsedMb: number;
  storageLimitGb: number; isActive: boolean; createdAt: string;
};

type ModuleInfo = {
  active: { key: string; name: string; category: string; status: string; assignedAt: string }[];
  available: { key: string; name: string; category: string; minTier: string; priceMonthly: number; isBeta: boolean; isActive: boolean }[];
};

const TIER_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  STARTER:    { color: "hsl(150 60% 45%)", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Starter" },
  PRO:        { color: "hsl(210 70% 55%)", bg: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Pro" },
  ENTERPRISE: { color: "hsl(280 60% 55%)", bg: "bg-violet-500/10 text-violet-600 border-violet-500/20", label: "Enterprise" },
};

export default function MyPlanPage() {
  const { toast } = useToast();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [modules, setModules] = useState<ModuleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, m] = await Promise.all([
          apiFetch<PlanInfo>("/tenant/self-service/plan"),
          apiFetch<ModuleInfo>("/tenant/self-service/modules"),
        ]);
        setPlan(p);
        setModules(m);
      } catch (e: any) {
        toast({ title: "Errore", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading || !plan) {
    return (
      <div className="flex-1 p-4 md:p-6 flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm animate-pulse">Caricamento piano...</p>
      </div>
    );
  }

  const tier = TIER_STYLE[plan.planTier] || TIER_STYLE.STARTER;
  const storagePct = plan.storageLimitGb > 0 ? Math.round((plan.storageUsedMb / (plan.storageLimitGb * 1024)) * 100) : 0;

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Il Mio Piano</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Panoramica del tuo abbonamento e moduli attivi</p>
        </div>
      </div>

      {/* Plan Card */}
      <Card className="mb-6 overflow-hidden relative">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: tier.color }} />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${tier.color} 12%, transparent)`, color: tier.color }}>
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground">{plan.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={tier.bg}>{tier.label}</Badge>
                  <span className="text-lg font-bold text-foreground tabular-nums">€{plan.monthlyPrice}/mese</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-2" />Contatta per upgrade</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Utenti max</p>
              <p className="text-xl font-black text-foreground mt-1 tabular-nums"><Users className="h-4 w-4 inline mr-1.5 text-muted-foreground" />{plan.maxUsers}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Storage</p>
              <p className="text-xl font-black text-foreground mt-1 tabular-nums"><HardDrive className="h-4 w-4 inline mr-1.5 text-muted-foreground" />{plan.storageLimitGb} GB</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Moduli Attivi</p>
              <p className="text-xl font-black text-foreground mt-1 tabular-nums"><Puzzle className="h-4 w-4 inline mr-1.5 text-muted-foreground" />{modules?.active.length || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Membro da</p>
              <p className="text-sm font-bold text-foreground mt-1.5">{new Date(plan.createdAt).toLocaleDateString("it-IT")}</p>
            </div>
          </div>

          {/* Storage bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Storage utilizzato</span>
              <span className="font-bold text-foreground tabular-nums">{plan.storageUsedMb.toFixed(0)} MB / {plan.storageLimitGb} GB ({storagePct}%)</span>
            </div>
            <Progress value={storagePct} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Modules Grid */}
      <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2"><Puzzle className="h-5 w-5 text-primary" />Moduli Disponibili</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {modules?.available.map(mod => (
          <Card key={mod.key} className={`transition-all duration-200 ${mod.isActive ? "border-primary/30 bg-primary/[0.02]" : "opacity-60"}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${mod.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {mod.isActive ? <CheckCircle2 className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-foreground text-sm truncate">{mod.name}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[9px]">{mod.category}</Badge>
                  {mod.isBeta && <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">Beta</Badge>}
                  {!mod.isActive && <span className="text-[10px] text-muted-foreground">Piano {mod.minTier}+</span>}
                </div>
              </div>
              {mod.isActive ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]" variant="outline">Attivo</Badge>
              ) : (
                <span className="text-xs font-bold text-muted-foreground tabular-nums">€{Number(mod.priceMonthly).toFixed(0)}/mo</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
