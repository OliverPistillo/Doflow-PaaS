"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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
  dangerNote = "Premendo conferma, l’operazione verrà registrata e non sarà “magicamente annullabile”.",
}: Props) {
  return (
    <div className="animate-in slide-in-from-bottom-10 fade-in duration-300">
      <Card className="border-4 border-green-700 bg-green-50/60">
        <CardContent className="p-8">
          <div className="mb-5">
            <div className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-700" />
              {title}
            </div>
            {subtitle ? <p className="mt-1 text-slate-600">{subtitle}</p> : null}
          </div>

          <Button
            onClick={onConfirm}
            disabled={!!disabled || !!loading}
            className="w-full h-32 text-4xl font-black uppercase bg-green-700 hover:bg-green-800 shadow-xl transition-transform active:scale-95"
          >
            {loading ? "Registrazione..." : confirmLabel}
          </Button>

          <p className="mt-4 text-center text-slate-600 flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {dangerNote}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}