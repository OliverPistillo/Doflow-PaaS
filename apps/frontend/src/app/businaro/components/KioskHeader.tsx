"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldCheck } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  roleLabel: string;
  operatorLabel?: string;
  onReset?: () => void;
};

export default function KioskHeader({
  title,
  subtitle,
  roleLabel,
  operatorLabel = "MASTER",
  onReset,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-slate-500">{subtitle}</p>
          ) : (
            <p className="text-slate-500">Postazione operativa (Kiosk Mode)</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="px-4 py-2 text-base border-slate-300 bg-slate-100"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Ruolo: <b className="ml-1">{roleLabel}</b>
          </Badge>

          <Badge
            variant="outline"
            className="px-4 py-2 text-base border-slate-300 bg-slate-100"
          >
            Operatore: <b className="ml-1">{operatorLabel}</b>
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => (onReset ? onReset() : window.location.reload())}
            aria-label="Reset"
            title="Reset"
          >
            <RefreshCw className="h-6 w-6 text-slate-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}
