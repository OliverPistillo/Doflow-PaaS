"use client";

import React from "react";
import { usePlan } from "@/contexts/PlanContext";
import { EmptyState } from "@/components/ui/page-shell";
import { Lock } from "lucide-react";

export function RequireTenantModule({
  moduleKey,
  children,
}: {
  moduleKey: string;
  children: React.ReactNode;
}) {
  const { activeModules, loading } = usePlan();

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Caricamento in corso...</div>;
  }

  if (!activeModules.has(moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <EmptyState
          icon={Lock}
          title="Modulo non attivo"
          message="Questo modulo non è stato attivato per il tuo piano. Contatta l'amministratore per maggiori informazioni o gestisci i moduli nelle impostazioni del piano."
        />
      </div>
    );
  }

  return <>{children}</>;
}
