"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  dangerNote?: string;
};

export default function KioskActionBar({
  title,
  subtitle,
  confirmLabel = "CONFERMA",
  onConfirm,
  loading,
  disabled,
  dangerNote,
}: Props) {
  return (
    <div className="animate-in slide-in-from-bottom-10 fade-in duration-500">
      <Card className="border-0 bg-transparent shadow-none">
        <CardContent className="p-0">
          
          <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
             <div className="flex-1">
                <div className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                    {title}
                </div>
                {subtitle && <p className="mt-1 text-muted-foreground font-medium text-lg">{subtitle}</p>}
             </div>
          </div>

          <Button
            onClick={onConfirm}
            disabled={!!disabled || !!loading}
            className="w-full h-28 rounded-[2.5rem] text-3xl font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_40px_rgba(204,243,47,0.3)] transition-all active:scale-95"
          >
            {loading ? (
                <div className="flex items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin" /> Elaborazione...
                </div>
            ) : confirmLabel}
          </Button>

          {dangerNote && (
             <div className="mt-6 flex justify-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-500 text-sm font-bold border border-red-500/20">
                    <AlertTriangle className="h-4 w-4" />
                    {dangerNote}
                </div>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}