"use client";

import * as React from "react";
import { ArrowRight, Box, Hammer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import KioskHeader from "../components/KioskHeader";
import ScanInputCard from "../components/ScanInputCard";
import KioskActionBar from "../components/KioskActionBar";
import { tenantFetch } from "@/lib/tenant-fetch";

type Step = "SCAN_SOURCE" | "SCAN_TARGET" | "QTY" | "CONFIRM";

export default function BusinaroMachineToolsPage() {
  const { toast } = useToast();

  const [step, setStep] = React.useState<Step>("SCAN_SOURCE");
  const [loading, setLoading] = React.useState(false);

  const [sourceSku, setSourceSku] = React.useState("");
  const [targetSku, setTargetSku] = React.useState("");
  const [qty, setQty] = React.useState<number>(1);

  const reset = React.useCallback(() => {
    setStep("SCAN_SOURCE");
    setLoading(false);
    setSourceSku("");
    setTargetSku("");
    setQty(1);
  }, []);

  const validateSource = () => {
    if (!sourceSku.trim()) return;
    setStep("SCAN_TARGET");
    toast({ title: "Input acquisito", description: `Grezzo: ${sourceSku}` });
  };

  const validateTarget = () => {
    if (!targetSku.trim()) return;
    setStep("QTY");
  };

  const validateQty = () => {
    if (!qty || qty <= 0) {
      toast({ title: "Quantità non valida", description: "Inserisci una quantità > 0", variant: "destructive" });
      return;
    }
    setStep("CONFIRM");
  };

  const execute = async () => {
    setLoading(true);
    try {
      // Endpoint backend Businaro (da creare lato NestJS)
      // POST /api/businaro/production/machine-tools/transform
      const res = await tenantFetch("/api/businaro/production/machine-tools/transform", {
        method: "POST",
        body: JSON.stringify({ sourceSku, targetSku, quantity: qty }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Errore backend");
      }

      toast({
        title: "Trasformazione completata ✅",
        description: `${qty}x ${sourceSku} → ${targetSku}`,
        className: "bg-green-700 text-white border-green-800",
      });
      reset();
    } catch (e: any) {
      toast({
        title: "Errore bloccante",
        description: e?.message ?? "Impossibile completare la trasformazione",
        variant: "destructive",
      });
      setStep("SCAN_SOURCE");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <KioskHeader
        title="🔩 MACCHINE UTENSILI"
        subtitle="Trasformazione atomica: GREZZO → SEMILAVORATO"
        roleLabel="MACHINE_TOOLS"
        operatorLabel="MASTER_OFFICINA"
        onReset={reset}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ScanInputCard
          stepActive={step === "SCAN_SOURCE"}
          title="1) Scansiona GREZZO"
          description="SKU Materia prima (RAW_MATERIAL)"
          placeholder="SKU GREZZO..."
          value={sourceSku}
          onChange={setSourceSku}
          onEnter={validateSource}
          accent="blue"
        />

        <ScanInputCard
          stepActive={step === "SCAN_TARGET"}
          title="2) Scansiona LAVORATO"
          description="SKU pezzo prodotto (SEMI_FINISHED)"
          placeholder="SKU LAVORATO..."
          value={targetSku}
          onChange={setTargetSku}
          onEnter={validateTarget}
          disabled={step === "SCAN_SOURCE"}
          accent="orange"
        />
      </div>

      {/* QUANTITÀ */}
      <Card className={`transition-all duration-300 ${step === "QTY" ? "border-4 border-slate-300 shadow-xl" : "opacity-70 border"}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-900">3) Quantità</div>
              <div className="text-slate-600">Default 1. Inserisci solo se diverso.</div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="px-4 py-2 text-lg bg-slate-100 border-slate-300">
                <Box className="mr-2 h-4 w-4" />
                {sourceSku || "—"} <ArrowRight className="mx-2 h-4 w-4" />{" "}
                <Hammer className="mr-2 h-4 w-4" />
                {targetSku || "—"}
              </Badge>

              <Input
                disabled={step !== "QTY"}
                value={String(qty)}
                onChange={(e) => setQty(parseInt(e.target.value || "0", 10))}
                onKeyDown={(e) => e.key === "Enter" && validateQty()}
                className="h-20 w-40 text-center text-3xl font-mono"
                inputMode="numeric"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CONFERMA */}
      {step === "CONFIRM" && (
        <KioskActionBar
          title="Conferma trasformazione"
          subtitle={`${qty}x ${sourceSku} → ${targetSku}`}
          confirmLabel="CONFERMA TRASFORMAZIONE"
          onConfirm={execute}
          loading={loading}
          dangerNote="Operazione atomica: se manca materia prima, il sistema blocca. Niente numeri negativi."
        />
      )}
    </div>
  );
}
